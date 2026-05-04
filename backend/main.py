"""
main.py - Discify FastAPI backend.

Exposes settings, Discogs integration, JWT auth, and the vision scan API
used by the mobile app. In production the FastAPI app also serves the
built frontend at /.
"""

from __future__ import annotations

import base64
import binascii
import json
import os
import secrets
import sys
import threading
import time as _time
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

import psycopg2
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
from pwdlib import PasswordHash

# Ensure backend/ is on sys.path so local imports work regardless of how
# uvicorn is invoked (from repo root or from backend/).
sys.path.insert(0, str(Path(__file__).parent))

import settings as settings_module
from discogs_helper import add_release_to_collection, get_username, manual_search, search_release, search_by_catno, search_by_barcode, search_candidates
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

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://discify:discify_dev@localhost:5432/discify')
UPLOAD_DIR = Path(os.getenv('UPLOAD_DIR', '/app/data/uploads'))
IMAGE_RETENTION_DAYS = int(os.getenv('IMAGE_RETENTION_DAYS', '7'))
JWT_SECRET = os.getenv('JWT_SECRET') or secrets.token_hex(32)
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30
SCAN_LIMITS = {'free': 5, 'basic': 50, 'pro': -1}
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='auth/login')
_ph = PasswordHash.recommended()
_db_pool: ThreadedConnectionPool | None = None


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class SettingsUpdate(BaseModel):
    vision_backend: Optional[Literal['anthropic', 'ollama']] = None
    anthropic_model: Optional[str] = None
    ollama_model: Optional[str] = None
    ollama_url: Optional[str] = None
    anthropic_api_key: Optional[str] = None


class UserRegister(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = 'bearer'


class UserProfile(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


class DiscogsSettings(BaseModel):
    discogs_token: str


class OllamaSettings(BaseModel):
    ollama_url: str


class ScanHistoryItem(BaseModel):
    id: int
    created_at: str
    image_path: Optional[str]
    analysis_json: str
    discogs_results_json: str
    status: str


class ScanHistoryUpdate(BaseModel):
    analysis_json: Optional[str] = None
    discogs_results_json: Optional[str] = None


class UserMe(BaseModel):
    id: int
    email: str
    display_name: Optional[str]
    tier: str
    scans_used: int
    scans_limit: int
    is_admin: bool
    discogs_token_set: bool
    ollama_url: str
    created_at: Optional[str] = None


class AdminUserItem(BaseModel):
    id: int
    email: str
    tier: str
    is_admin: bool
    scans_used: int
    created_at: str


class AdminUserUpdate(BaseModel):
    tier: Optional[Literal['free', 'basic', 'pro']] = None
    is_admin: Optional[bool] = None


class DiscogsSearchRequest(BaseModel):
    artist: str
    album: str


class ManualSearchRequest(BaseModel):
    query: str


class SuggestionsRequest(BaseModel):
    artist: str = ''
    album: str = ''
    catno: str = ''
    barcode: str = ''


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


def _get_pool() -> ThreadedConnectionPool:
    global _db_pool
    if _db_pool is None:
        _db_pool = ThreadedConnectionPool(2, 20, DATABASE_URL)
    return _db_pool


@contextmanager
def get_db():
    pool = _get_pool()
    conn = pool.getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        yield cur
        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def wait_for_db(max_tries: int = 20, delay: float = 3.0) -> None:
    for attempt in range(max_tries):
        try:
            conn = psycopg2.connect(DATABASE_URL)
            conn.close()
            return
        except psycopg2.OperationalError:
            if attempt == max_tries - 1:
                raise
            _time.sleep(delay)


def init_db() -> None:
    with get_db() as cur:
        cur.execute(
            '''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                display_name TEXT,
                tier TEXT NOT NULL DEFAULT 'free',
                is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                discogs_token TEXT NOT NULL DEFAULT '',
                ollama_url TEXT NOT NULL DEFAULT '',
                scans_used INTEGER NOT NULL DEFAULT 0,
                scans_month TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
            '''
        )
        cur.execute(
            '''
            CREATE TABLE IF NOT EXISTS scan_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                image_path TEXT,
                image_expires_at TIMESTAMP WITH TIME ZONE,
                analysis_json TEXT NOT NULL DEFAULT '[]',
                discogs_results_json TEXT NOT NULL DEFAULT '[]',
                status TEXT NOT NULL DEFAULT 'complete'
            )
            '''
        )
        cur.execute('CREATE INDEX IF NOT EXISTS idx_scan_history_user ON scan_history(user_id)')
        cur.execute(
            'CREATE INDEX IF NOT EXISTS idx_scan_expires ON scan_history(image_expires_at) WHERE image_path IS NOT NULL'
        )


def current_scan_month() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m')


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not normalized or '@' not in normalized:
        raise HTTPException(status_code=400, detail='Ungültige E-Mail-Adresse.')
    return normalized


def get_scans_limit(tier: str) -> int:
    return SCAN_LIMITS.get(tier, SCAN_LIMITS['free'])


def get_user_by_email(cur, email: str):
    cur.execute('SELECT * FROM users WHERE email = %s', (email,))
    return cur.fetchone()


def get_user_by_id(cur, user_id: int):
    cur.execute('SELECT * FROM users WHERE id = %s', (user_id,))
    return cur.fetchone()


def sync_user_scan_cycle(cur, user: dict) -> dict:
    month_key = current_scan_month()
    if user['scans_month'] == month_key:
        return dict(user)
    cur.execute(
        'UPDATE users SET scans_used = 0, scans_month = %s WHERE id = %s',
        (month_key, user['id']),
    )
    cur.execute('SELECT * FROM users WHERE id = %s', (user['id'],))
    refreshed = cur.fetchone()
    if refreshed is None:
        raise HTTPException(status_code=401, detail='Benutzer nicht gefunden.')
    return dict(refreshed)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {'sub': subject, 'exp': expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def user_to_me(user: dict) -> UserMe:
    return UserMe(
        id=user['id'],
        email=user['email'],
        display_name=user.get('display_name'),
        tier=user['tier'],
        scans_used=user['scans_used'],
        scans_limit=get_scans_limit(user['tier']),
        is_admin=bool(user['is_admin']),
        discogs_token_set=bool(user.get('discogs_token', '')),
        ollama_url=user.get('ollama_url', ''),
        created_at=user['created_at'].isoformat() if user.get('created_at') else None,
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

    with get_db() as cur:
        user = get_user_by_email(cur, normalize_email(email))
        if user is None:
            raise credentials_exception
        synced = sync_user_scan_cycle(cur, user)
        return dict(synced)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get('is_admin'):
        raise HTTPException(status_code=403, detail='Zugriff verweigert.')
    return current_user


def increment_scan_usage(user_id: int) -> None:
    with get_db() as cur:
        cur.execute(
            'UPDATE users SET scans_used = scans_used + 1 WHERE id = %s',
            (user_id,),
        )


def _cleanup_expired_images() -> None:
    while True:
        try:
            now = datetime.now(timezone.utc)
            with get_db() as cur:
                cur.execute(
                    'SELECT id, image_path FROM scan_history WHERE image_expires_at < %s AND image_path IS NOT NULL',
                    (now,),
                )
                rows = cur.fetchall()
                for row in rows:
                    try:
                        Path(row['image_path']).unlink(missing_ok=True)
                    except Exception:
                        pass
                    cur.execute('UPDATE scan_history SET image_path = NULL WHERE id = %s', (row['id'],))
        except Exception:
            pass
        _time.sleep(3600)


def _start_cleanup_thread() -> None:
    t = threading.Thread(target=_cleanup_expired_images, daemon=True)
    t.start()


wait_for_db()
init_db()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
_start_cleanup_thread()


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@app.post('/auth/register', response_model=Token)
def register(body: UserRegister):
    email = normalize_email(body.email)
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail='Passwort muss mindestens 8 Zeichen lang sein.')
    with get_db() as cur:
        cur.execute('SELECT COUNT(*) as cnt FROM users')
        row = cur.fetchone()
        is_admin = row['cnt'] == 0
        if get_user_by_email(cur, email) is not None:
            raise HTTPException(status_code=409, detail='E-Mail ist bereits registriert.')
        cur.execute(
            '''INSERT INTO users (email, password_hash, tier, scans_used, scans_month, is_admin)
               VALUES (%s, %s, 'free', 0, %s, %s)''',
            (email, _ph.hash(body.password), current_scan_month(), is_admin),
        )
    return Token(access_token=create_access_token(email))


@app.post('/auth/login', response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    email = normalize_email(form_data.username)

    with get_db() as cur:
        user = get_user_by_email(cur, email)
        if user is None or not _ph.verify(form_data.password, user['password_hash']):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Ungültige E-Mail oder Passwort.',
                headers={'WWW-Authenticate': 'Bearer'},
            )
        sync_user_scan_cycle(cur, user)

    return Token(access_token=create_access_token(email))


@app.get('/auth/me', response_model=UserMe)
def auth_me(current_user: dict = Depends(get_current_user)):
    return user_to_me(current_user)


@app.put('/auth/me/profile', response_model=UserMe)
def update_profile(body: UserProfile, current_user: dict = Depends(get_current_user)):
    updates = {}
    if body.display_name is not None:
        updates['display_name'] = body.display_name.strip() or None
    if body.email is not None:
        new_email = normalize_email(body.email)
        updates['email'] = new_email
    if body.password is not None:
        if len(body.password) < 8:
            raise HTTPException(status_code=400, detail='Passwort muss mindestens 8 Zeichen lang sein.')
        updates['password_hash'] = _ph.hash(body.password)
    if not updates:
        return user_to_me(current_user)
    with get_db() as cur:
        if 'email' in updates:
            existing = get_user_by_email(cur, updates['email'])
            if existing is not None and existing['id'] != current_user['id']:
                raise HTTPException(status_code=409, detail='E-Mail ist bereits registriert.')
        set_clause = ', '.join(f'{k} = %s' for k in updates)
        cur.execute(
            f'UPDATE users SET {set_clause} WHERE id = %s RETURNING *',
            (*updates.values(), current_user['id']),
        )
        updated = cur.fetchone()
    return user_to_me(dict(updated))


@app.get('/auth/me/discogs')
def get_discogs_settings(current_user: dict = Depends(get_current_user)):
    token = current_user.get('discogs_token', '')
    username = None
    if token:
        username = get_username(token)
    return {
        'discogs_token_set': bool(token),
        'discogs_username': username,
    }


@app.put('/auth/me/discogs')
def update_discogs_settings(body: DiscogsSettings, current_user: dict = Depends(get_current_user)):
    with get_db() as cur:
        cur.execute('UPDATE users SET discogs_token = %s WHERE id = %s', (body.discogs_token.strip(), current_user['id']))
    return {'discogs_token_set': bool(body.discogs_token.strip())}


@app.get('/auth/me/ollama')
def get_ollama_settings(current_user: dict = Depends(get_current_user)):
    s = settings_module.load()
    return {
        'ollama_url': current_user.get('ollama_url') or s.get('ollama_url', ''),
        'global_ollama_url': s.get('ollama_url', ''),
    }


@app.put('/auth/me/ollama')
def update_ollama_settings(body: OllamaSettings, current_user: dict = Depends(get_current_user)):
    with get_db() as cur:
        cur.execute('UPDATE users SET ollama_url = %s WHERE id = %s', (body.ollama_url.strip(), current_user['id']))
    return {'ollama_url': body.ollama_url.strip()}


@app.get('/auth/me/scans')
def get_scan_history(
    page: int = 1,
    per_page: int = 20,
    current_user: dict = Depends(get_current_user),
):
    offset = (page - 1) * per_page
    with get_db() as cur:
        cur.execute('SELECT COUNT(*) as cnt FROM scan_history WHERE user_id = %s', (current_user['id'],))
        total = cur.fetchone()['cnt']
        cur.execute(
            '''SELECT id, created_at, image_path, analysis_json, discogs_results_json, status
               FROM scan_history WHERE user_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s''',
            (current_user['id'], per_page, offset),
        )
        rows = cur.fetchall()
    return {
        'total': total,
        'page': page,
        'per_page': per_page,
        'items': [
            {
                'id': r['id'],
                'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                'has_image': r['image_path'] is not None,
                'analysis_json': r['analysis_json'],
                'discogs_results_json': r['discogs_results_json'],
                'status': r['status'],
            }
            for r in rows
        ],
    }


@app.put('/auth/me/scans/{scan_id}')
def update_scan_history_item(
    scan_id: int,
    body: ScanHistoryUpdate,
    current_user: dict = Depends(get_current_user),
):
    with get_db() as cur:
        cur.execute('SELECT id FROM scan_history WHERE id = %s AND user_id = %s', (scan_id, current_user['id']))
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail='Scan nicht gefunden.')
        updates = {}
        if body.analysis_json is not None:
            updates['analysis_json'] = body.analysis_json
        if body.discogs_results_json is not None:
            updates['discogs_results_json'] = body.discogs_results_json
        if updates:
            set_clause = ', '.join(f'{k} = %s' for k in updates)
            cur.execute(
                f'UPDATE scan_history SET {set_clause} WHERE id = %s AND user_id = %s',
                (*updates.values(), scan_id, current_user['id']),
            )
        cur.execute(
            '''SELECT id, created_at, image_path, analysis_json, discogs_results_json, status
               FROM scan_history WHERE id = %s''',
            (scan_id,),
        )
        row = cur.fetchone()
    return {
        'id': row['id'],
        'created_at': row['created_at'].isoformat() if row['created_at'] else None,
        'has_image': row['image_path'] is not None,
        'analysis_json': row['analysis_json'],
        'discogs_results_json': row['discogs_results_json'],
        'status': row['status'],
    }


@app.delete('/auth/me/scans/{scan_id}', status_code=204)
def delete_scan_history_item(scan_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as cur:
        cur.execute('SELECT image_path FROM scan_history WHERE id = %s AND user_id = %s', (scan_id, current_user['id']))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail='Scan nicht gefunden.')
        if row['image_path']:
            Path(row['image_path']).unlink(missing_ok=True)
        cur.execute('DELETE FROM scan_history WHERE id = %s AND user_id = %s', (scan_id, current_user['id']))


@app.delete('/auth/me', status_code=204)
def delete_own_account(current_user: dict = Depends(get_current_user)):
    """Delete the currently authenticated user's account and all their data."""
    with get_db() as cur:
        # Delete scan images from disk before removing DB records
        cur.execute('SELECT image_path FROM scan_history WHERE user_id = %s AND image_path IS NOT NULL', (current_user['id'],))
        for row in cur.fetchall():
            Path(row['image_path']).unlink(missing_ok=True)
        cur.execute('DELETE FROM users WHERE id = %s', (current_user['id'],))


@app.get('/admin/users', response_model=list[AdminUserItem])
def admin_list_users(admin: dict = Depends(require_admin)):
    with get_db() as cur:
        cur.execute('SELECT id, email, tier, is_admin, scans_used, created_at FROM users ORDER BY created_at ASC')
        rows = cur.fetchall()
        return [
            AdminUserItem(
                id=r['id'],
                email=r['email'],
                tier=r['tier'],
                is_admin=bool(r['is_admin']),
                scans_used=r['scans_used'],
                created_at=r['created_at'].isoformat() if r['created_at'] else '',
            )
            for r in rows
        ]


@app.put('/admin/users/{user_id}', response_model=AdminUserItem)
def admin_update_user(user_id: int, body: AdminUserUpdate, admin: dict = Depends(require_admin)):
    with get_db() as cur:
        user = get_user_by_id(cur, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail='Benutzer nicht gefunden.')
        updates = {}
        if body.tier is not None:
            updates['tier'] = body.tier
        if body.is_admin is not None:
            updates['is_admin'] = body.is_admin
        if updates:
            set_clause = ', '.join(f'{k} = %s' for k in updates)
            cur.execute(f'UPDATE users SET {set_clause} WHERE id = %s', (*updates.values(), user_id))
        cur.execute('SELECT id, email, tier, is_admin, scans_used, created_at FROM users WHERE id = %s', (user_id,))
        row = cur.fetchone()
        return AdminUserItem(
            id=row['id'],
            email=row['email'],
            tier=row['tier'],
            is_admin=bool(row['is_admin']),
            scans_used=row['scans_used'],
            created_at=row['created_at'].isoformat() if row['created_at'] else '',
        )


@app.delete('/admin/users/{user_id}', status_code=204)
def admin_delete_user(user_id: int, admin: dict = Depends(require_admin)):
    if user_id == admin['id']:
        raise HTTPException(status_code=400, detail='Du kannst dich nicht selbst löschen.')
    with get_db() as cur:
        cur.execute('DELETE FROM users WHERE id = %s', (user_id,))


# ---------------------------------------------------------------------------
# Settings endpoints
# ---------------------------------------------------------------------------


@app.get('/api/settings')
def get_settings(admin: dict = Depends(require_admin)):
    return settings_module.get_safe()


@app.put('/api/settings')
def update_settings(body: SettingsUpdate, admin: dict = Depends(require_admin)):
    data = {key: value for key, value in body.model_dump().items() if value is not None}
    settings_module.save(data)
    return settings_module.get_safe()


@app.get('/api/settings/models')
def get_models(admin: dict = Depends(require_admin)):
    return {'anthropic': ANTHROPIC_MODELS, 'ollama': OLLAMA_MODELS}


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get('/api/health')
def health_check(current_user: Optional[dict] = None):
    s = settings_module.load()
    anthropic_key_set = bool(s.get('anthropic_api_key'))
    return {
        'anthropic_key_set': anthropic_key_set,
        'ollama_url': s.get('ollama_url'),
        'vision_backend': s.get('vision_backend'),
        'vision_model': (
            s.get('anthropic_model') if s.get('vision_backend') == 'anthropic' else s.get('ollama_model')
        ),
    }


# ---------------------------------------------------------------------------
# Collection endpoint
# ---------------------------------------------------------------------------


@app.get('/api/collection')
def get_collection(page: int = 1, per_page: int = 50, current_user: dict = Depends(get_current_user)):
    import requests as req

    token = current_user.get('discogs_token', '')
    if not token:
        raise HTTPException(status_code=400, detail='Discogs-Token nicht konfiguriert. Bitte in den Kontoeinstellungen hinterlegen.')
    username = get_username(token)
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
                'formats': [e.get('name', '') for e in info.get('formats', [])],
                'labels': [e.get('name', '') for e in info.get('labels', [])],
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
        raise HTTPException(status_code=429, detail=f'Monatliches Scan-Limit erreicht ({limit}).')

    s = settings_module.load()
    backend = 'ollama' if body.use_ollama else s.get('vision_backend', 'anthropic')
    model = (
        s.get('anthropic_model', ANTHROPIC_MODELS[0])
        if backend == 'anthropic'
        else s.get('ollama_model', OLLAMA_MODELS[0])
    )
    user_ollama_url = current_user.get('ollama_url', '')
    ollama_url = body.ollama_url or user_ollama_url or s.get('ollama_url', 'http://localhost:11434')
    image_bytes = decode_image_base64(body.image_base64)

    user_upload_dir = UPLOAD_DIR / str(current_user['id'])
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    image_filename = f"{uuid.uuid4()}.jpg"
    image_path = user_upload_dir / image_filename
    image_path.write_bytes(image_bytes)
    expires_at = datetime.now(timezone.utc) + timedelta(days=IMAGE_RETENTION_DAYS)

    try:
        identified = identify_cds_from_image(image_bytes, backend=backend, model=model, ollama_url=ollama_url)
    except Exception as exc:
        image_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    token = current_user.get('discogs_token', '')

    analysis_results = []
    discogs_results = []

    for item in identified:
        artist = str(item.get('artist', '')).strip()
        album = str(item.get('album', '')).strip()
        catalog_number = str(item.get('catalog_number', '')).strip()
        barcode = str(item.get('barcode', '')).strip()
        sticker_text = str(item.get('sticker_text', '')).strip()
        edition = str(item.get('edition', '')).strip()

        if not artist and not album and not catalog_number and not barcode:
            continue

        analysis_results.append({
            'artist': artist,
            'album': album,
            'catalog_number': catalog_number,
            'barcode': barcode,
            'sticker_text': sticker_text,
            'edition': edition,
            'confidence': 'medium',
        })

        # Priority chain: catno → barcode → artist+album text (all merged + ranked)
        best, alternatives, confidence = search_candidates(
            catno=catalog_number,
            barcode=barcode,
            artist=artist,
            album=album,
            token=token,
        )

        discogs_results.append({
            'ai_artist': artist,
            'ai_album': album,
            'ai_catalog_number': catalog_number,
            'ai_barcode': barcode,
            'ai_edition': edition,
            'found': best is not None,
            'confidence': confidence,
            'release_id': best.get('release_id') if best else None,
            'master_id': best.get('master_id') if best else None,
            'title': best.get('title', '') if best else '',
            'album': best.get('album', '') if best else album,
            'artist': best.get('artist', '') if best else artist,
            'year': best.get('year') if best else None,
            'cover_url': best.get('cover_url', '') if best else '',
            'thumb_url': best.get('thumb_url', '') if best else '',
            'catno': best.get('catno', '') if best else catalog_number,
            'label': best.get('label', '') if best else '',
            'alternatives': alternatives,
        })

    with get_db() as cur:
        cur.execute(
            '''INSERT INTO scan_history (user_id, image_path, image_expires_at, analysis_json, discogs_results_json, status)
               VALUES (%s, %s, %s, %s, %s, 'complete')''',
            (current_user['id'], str(image_path), expires_at,
             json.dumps(analysis_results), json.dumps(discogs_results)),
        )
    increment_scan_usage(current_user['id'])
    return discogs_results


# ---------------------------------------------------------------------------
# Discogs search endpoints
# ---------------------------------------------------------------------------


@app.post('/api/discogs/search')
def discogs_search(body: DiscogsSearchRequest, current_user: dict = Depends(get_current_user)):
    token = current_user.get('discogs_token', '')
    hit = search_release(body.artist, body.album, token=token)
    if not hit:
        raise HTTPException(status_code=404, detail='Kein Treffer gefunden.')
    return {
        'id': hit.get('release_id'),
        'release_id': hit.get('release_id'),
        'title': hit.get('title', ''),
        'artist': hit.get('artist', ''),
        'year': hit.get('year'),
        'cover_url': hit.get('cover_url') or None,
        'thumb_url': hit.get('thumb_url') or None,
        'catno': hit.get('catno', ''),
        'label': hit.get('label', ''),
    }


@app.post('/api/discogs/search/manual')
def discogs_manual_search(body: ManualSearchRequest, current_user: dict = Depends(get_current_user)):
    token = current_user.get('discogs_token', '')
    hit = manual_search(body.query, token=token)
    if not hit:
        raise HTTPException(status_code=404, detail='Kein Treffer gefunden.')
    return hit


@app.post('/api/discogs/suggestions')
def discogs_suggestions(body: SuggestionsRequest, current_user: dict = Depends(get_current_user)):
    token = current_user.get('discogs_token', '')
    best, alternatives, confidence = search_candidates(
        catno=body.catno,
        barcode=body.barcode,
        artist=body.artist,
        album=body.album,
        token=token,
    )
    results = []
    if best:
        results.append(best)
    results.extend(alternatives)
    return {'results': results, 'confidence': confidence}


@app.post('/api/discogs/add')
def discogs_add(body: AddToCollectionRequest, current_user: dict = Depends(get_current_user)):
    token = current_user.get('discogs_token', '')
    if not token:
        raise HTTPException(status_code=400, detail='Discogs-Token nicht konfiguriert.')
    username = get_username(token)
    if not username:
        raise HTTPException(status_code=401, detail='Discogs-Verbindung fehlgeschlagen.')
    success = add_release_to_collection(username, body.release_id, token=token)
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
