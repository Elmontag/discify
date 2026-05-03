"""
main.py - Discify FastAPI backend.

Exposes settings, Discogs integration, JWT auth, and the vision scan API
used by the mobile app. In production the FastAPI app also serves the
built frontend at /.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import os
import secrets
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure backend/ is on sys.path so local imports work regardless of how
# uvicorn is invoked (from repo root or from backend/).
sys.path.insert(0, str(Path(__file__).parent))
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from pydantic import BaseModel

import settings as settings_module
from discogs_helper import add_release_to_collection, get_username, manual_search, search_release
from vision import ANTHROPIC_MODELS, OLLAMA_MODELS, identify_cds_from_image

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

settings_module.apply_to_env()

app = FastAPI(title='Discify API', version='2.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:8000',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

_USERS_DB = Path(__file__).parent / 'users.db'
JWT_SECRET = os.getenv('JWT_SECRET') or secrets.token_hex(32)
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30
SCAN_LIMITS = {'free': 5, 'basic': 50, 'pro': -1}
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='auth/login')

_HASH_ITER = 260_000  # PBKDF2-SHA256 iterations (OWASP 2023 recommendation)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), _HASH_ITER)
    return f"pbkdf2:{salt}:{dk.hex()}"


def verify_password(plain: str, hashed: str) -> bool:
    try:
        _, salt, dk_hex = hashed.split(':')
        dk = hashlib.pbkdf2_hmac('sha256', plain.encode(), salt.encode(), _HASH_ITER)
        return secrets.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class SettingsUpdate(BaseModel):
    vision_backend: Optional[Literal['anthropic', 'ollama']] = None
    anthropic_model: Optional[str] = None
    ollama_model: Optional[str] = None
    ollama_url: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    discogs_token: Optional[str] = None


class UserRegister(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = 'bearer'


class UserMe(BaseModel):
    email: str
    tier: str
    scans_used: int
    scans_limit: int


class DiscogsSearchRequest(BaseModel):
    artist: str
    album: str


class ManualSearchRequest(BaseModel):
    query: str


class AddToCollectionRequest(BaseModel):
    release_id: int


class ScanRequest(BaseModel):
    image_base64: str
    mime_type: str = 'image/jpeg'
    use_ollama: bool = False
    ollama_url: Optional[str] = None


# ---------------------------------------------------------------------------
# User/auth helpers
# ---------------------------------------------------------------------------


def init_users_db() -> None:
    with sqlite3.connect(_USERS_DB) as conn:
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                tier TEXT NOT NULL DEFAULT 'free',
                scans_used INTEGER NOT NULL DEFAULT 0,
                scans_month TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            '''
        )
        conn.commit()


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(_USERS_DB)
    conn.row_factory = sqlite3.Row
    return conn


def current_scan_month() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m')


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not normalized or '@' not in normalized:
        raise HTTPException(status_code=400, detail='Ungültige E-Mail-Adresse.')
    return normalized


def get_scans_limit(tier: str) -> int:
    return SCAN_LIMITS.get(tier, SCAN_LIMITS['free'])


def get_user_by_email(conn: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    return conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()


def sync_user_scan_cycle(conn: sqlite3.Connection, user: sqlite3.Row) -> sqlite3.Row:
    month_key = current_scan_month()
    if user['scans_month'] == month_key:
        return user

    conn.execute(
        'UPDATE users SET scans_used = 0, scans_month = ? WHERE id = ?',
        (month_key, user['id']),
    )
    conn.commit()
    refreshed = conn.execute('SELECT * FROM users WHERE id = ?', (user['id'],)).fetchone()
    if refreshed is None:
        raise HTTPException(status_code=401, detail='Benutzer nicht gefunden.')
    return refreshed


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {'sub': subject, 'exp': expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def user_to_me(user: sqlite3.Row) -> UserMe:
    return UserMe(
        email=user['email'],
        tier=user['tier'],
        scans_used=user['scans_used'],
        scans_limit=get_scans_limit(user['tier']),
    )


def decode_image_base64(data: str) -> bytes:
    raw = data.split(',', 1)[1] if ',' in data else data
    try:
        return base64.b64decode(raw)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail='Ungültige Bilddaten.') from exc


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Ungültige Authentifizierung.',
        headers={'WWW-Authenticate': 'Bearer'},
    )

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get('sub')
        if not email:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    with get_db_connection() as conn:
        user = get_user_by_email(conn, normalize_email(email))
        if user is None:
            raise credentials_exception
        synced = sync_user_scan_cycle(conn, user)
        return dict(synced)


def increment_scan_usage(email: str) -> None:
    with get_db_connection() as conn:
        user = get_user_by_email(conn, email)
        if user is None:
            raise HTTPException(status_code=401, detail='Benutzer nicht gefunden.')
        synced = sync_user_scan_cycle(conn, user)
        conn.execute(
            'UPDATE users SET scans_used = ? WHERE id = ?',
            (synced['scans_used'] + 1, synced['id']),
        )
        conn.commit()


init_users_db()


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@app.post('/auth/register', response_model=Token)
def register(body: UserRegister):
    email = normalize_email(body.email)
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail='Passwort muss mindestens 6 Zeichen lang sein.')

    with get_db_connection() as conn:
        if get_user_by_email(conn, email) is not None:
            raise HTTPException(status_code=409, detail='E-Mail ist bereits registriert.')

        conn.execute(
            '''
            INSERT INTO users (email, password_hash, tier, scans_used, scans_month)
            VALUES (?, ?, 'free', 0, ?)
            ''',
            (email, hash_password(body.password), current_scan_month()),
        )
        conn.commit()

    return Token(access_token=create_access_token(email))


@app.post('/auth/login', response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    email = normalize_email(form_data.username)

    with get_db_connection() as conn:
        user = get_user_by_email(conn, email)
        if user is None or not verify_password(form_data.password, user['password_hash']):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Ungültige E-Mail oder Passwort.',
                headers={'WWW-Authenticate': 'Bearer'},
            )
        sync_user_scan_cycle(conn, user)

    return Token(access_token=create_access_token(email))


@app.get('/auth/me', response_model=UserMe)
def auth_me(current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        user = get_user_by_email(conn, normalize_email(current_user['email']))
        if user is None:
            raise HTTPException(status_code=404, detail='Benutzer nicht gefunden.')
        return user_to_me(sync_user_scan_cycle(conn, user))


# ---------------------------------------------------------------------------
# Settings endpoints
# ---------------------------------------------------------------------------


@app.get('/api/settings')
def get_settings():
    return settings_module.get_safe()


@app.put('/api/settings')
def update_settings(body: SettingsUpdate):
    data = {key: value for key, value in body.model_dump().items() if value is not None}
    settings_module.save(data)
    return settings_module.get_safe()


@app.get('/api/settings/models')
def get_models():
    return {'anthropic': ANTHROPIC_MODELS, 'ollama': OLLAMA_MODELS}


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get('/api/health')
def health_check():
    s = settings_module.load()

    discogs_username = None
    discogs_ok = False
    if s.get('discogs_token'):
        discogs_username = get_username()
        discogs_ok = discogs_username is not None

    anthropic_key_set = bool(s.get('anthropic_api_key'))

    return {
        'discogs_connected': discogs_ok,
        'discogs_username': discogs_username,
        'anthropic_key_set': anthropic_key_set,
        'ollama_url': s.get('ollama_url'),
        'vision_backend': s.get('vision_backend'),
        'vision_model': (
            s.get('anthropic_model')
            if s.get('vision_backend') == 'anthropic'
            else s.get('ollama_model')
        ),
    }


# ---------------------------------------------------------------------------
# Collection endpoint
# ---------------------------------------------------------------------------


@app.get('/api/collection')
def get_collection(page: int = 1, per_page: int = 50):
    s = settings_module.load()
    if not s.get('discogs_token'):
        raise HTTPException(status_code=400, detail='Discogs token nicht konfiguriert.')

    import requests as req

    token = s['discogs_token']
    username = get_username()
    if not username:
        raise HTTPException(status_code=401, detail='Discogs-Verbindung fehlgeschlagen.')

    headers = {
        'Authorization': f'Discogs token={token}',
        'User-Agent': 'Discify/2.0 +https://github.com/Elmontag/discify',
    }

    response = req.get(
        f'https://api.discogs.com/users/{username}/collection/folders/0/releases',
        headers=headers,
        params={'page': page, 'per_page': per_page, 'sort': 'added', 'sort_order': 'desc'},
        timeout=20,
    )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f'Discogs API Fehler: {response.status_code}')

    data = response.json()
    releases = []
    for item in data.get('releases', []):
        info = item.get('basic_information', {})
        artists = info.get('artists', [])
        artist_name = artists[0].get('name', '') if artists else ''
        releases.append(
            {
                'instance_id': item.get('instance_id'),
                'release_id': info.get('id'),
                'title': info.get('title', ''),
                'artist': artist_name,
                'year': info.get('year'),
                'cover_url': info.get('cover_image', ''),
                'thumb_url': info.get('thumb', ''),
                'formats': [entry.get('name', '') for entry in info.get('formats', [])],
                'labels': [entry.get('name', '') for entry in info.get('labels', [])],
                'date_added': item.get('date_added', ''),
            }
        )

    pagination = data.get('pagination', {})
    return {
        'releases': releases,
        'pagination': {
            'page': pagination.get('page', page),
            'pages': pagination.get('pages', 1),
            'per_page': pagination.get('per_page', per_page),
            'items': pagination.get('items', len(releases)),
        },
        'username': username,
    }


# ---------------------------------------------------------------------------
# Scan endpoint
# ---------------------------------------------------------------------------


@app.post('/api/scan')
async def scan_image(body: ScanRequest, current_user: dict = Depends(get_current_user)):
    limit = get_scans_limit(current_user['tier'])
    if limit != -1 and current_user['scans_used'] >= limit:
        raise HTTPException(
            status_code=429,
            detail=f'Monatliches Scan-Limit erreicht ({limit}).',
        )

    s = settings_module.load()
    backend = 'ollama' if body.use_ollama else s.get('vision_backend', 'anthropic')
    model = (
        s.get('anthropic_model', ANTHROPIC_MODELS[0])
        if backend == 'anthropic'
        else s.get('ollama_model', OLLAMA_MODELS[0])
    )
    ollama_url = body.ollama_url or s.get('ollama_url', 'http://localhost:11434')
    image_bytes = decode_image_base64(body.image_base64)

    try:
        identified = identify_cds_from_image(
            image_bytes,
            backend=backend,
            model=model,
            ollama_url=ollama_url,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    increment_scan_usage(normalize_email(current_user['email']))

    return [
        {
            'artist': str(item.get('artist', '')).strip(),
            'album': str(item.get('album', '')).strip(),
            'confidence': 'medium',
        }
        for item in identified
        if item.get('artist') or item.get('album')
    ]


# ---------------------------------------------------------------------------
# Discogs search endpoints
# ---------------------------------------------------------------------------


@app.post('/api/discogs/search')
def discogs_search(body: DiscogsSearchRequest):
    hit = search_release(body.artist, body.album)
    if not hit:
        raise HTTPException(status_code=404, detail='Kein Treffer gefunden.')

    return {
        'id': hit.get('release_id'),
        'title': hit.get('title', ''),
        'artist': hit.get('artist', ''),
        'year': hit.get('year'),
        'cover_url': hit.get('cover_url') or None,
        'thumb_url': hit.get('thumb_url') or None,
        'label': None,
        'format': None,
    }


@app.post('/api/discogs/search/manual')
def discogs_manual_search(body: ManualSearchRequest):
    hit = manual_search(body.query)
    if not hit:
        raise HTTPException(status_code=404, detail='Kein Treffer gefunden.')
    return hit


@app.post('/api/discogs/add')
def discogs_add(body: AddToCollectionRequest):
    s = settings_module.load()
    if not s.get('discogs_token'):
        raise HTTPException(status_code=400, detail='Discogs token nicht konfiguriert.')

    username = get_username()
    if not username:
        raise HTTPException(status_code=401, detail='Discogs-Verbindung fehlgeschlagen.')

    success = add_release_to_collection(username, body.release_id)
    if not success:
        raise HTTPException(status_code=502, detail='Fehler beim Hinzufügen zur Sammlung.')

    return {'success': True, 'release_id': body.release_id}


# ---------------------------------------------------------------------------
# Serve built frontend (production)
# ---------------------------------------------------------------------------

_FRONTEND_DIST = Path(__file__).parent.parent / 'frontend' / 'dist'

if _FRONTEND_DIST.exists():
    app.mount(
        '/assets',
        StaticFiles(directory=str(_FRONTEND_DIST / 'assets')),
        name='assets',
    )

    @app.get('/favicon.ico', include_in_schema=False)
    @app.get('/favicon.svg', include_in_schema=False)
    def serve_favicon():
        for name in ('favicon.ico', 'favicon.svg'):
            file_path = _FRONTEND_DIST / name
            if file_path.exists():
                return FileResponse(str(file_path))
        raise HTTPException(status_code=404)

    @app.get('/{full_path:path}', include_in_schema=False)
    def serve_frontend(full_path: str):
        return FileResponse(str(_FRONTEND_DIST / 'index.html'))
