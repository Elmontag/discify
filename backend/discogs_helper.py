"""
discogs_helper.py – Discogs REST API integration.

Uses the public Discogs API with a Personal Access Token (PAT) for
authentication.  No third-party Discogs client library is required –
only the standard `requests` package.

Rate-limit note: Discogs allows ~60 authenticated requests / minute.
The caller is responsible for inserting sleep() delays between searches.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Optional

import requests

_BASE_URL = "https://api.discogs.com"
_USER_AGENT = "Discify/1.0 +https://github.com/Elmontag/discify"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Discogs token={token}",
        "User-Agent": _USER_AGENT,
        "Content-Type": "application/json",
    }


def _norm_catno(s: str) -> str:
    """Strip all non-alphanumeric characters and uppercase for fuzzy catno matching."""
    return re.sub(r'[^A-Za-z0-9]', '', s or '').upper()


def _similarity(a: str, b: str) -> float:
    """Return a 0–1 similarity ratio between two strings (case-insensitive)."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _score_result(result: dict, catno: str = '', artist: str = '', album: str = '') -> float:
    """
    Compute a relevance score for a formatted Discogs result dict.

    catno exact match  → +10
    catno substring    → +5
    artist similarity  → 0–3
    album similarity   → 0–2
    """
    score = 0.0
    result_catno = result.get('catno') or ''
    if catno and result_catno:
        nc, nr = _norm_catno(catno), _norm_catno(result_catno)
        if nc and nr:
            if nc == nr:
                score += 10.0
            elif nc in nr or nr in nc:
                score += 5.0
    if artist:
        score += _similarity(artist, result.get('artist') or '') * 3.0
    if album:
        raw_title = result.get('title') or ''
        parts = raw_title.split(' - ', 1)
        album_part = parts[1].strip() if len(parts) == 2 else raw_title
        score += _similarity(album, album_part) * 2.0
    return score


def _format_result(result: dict, artist_hint: str = "") -> dict:
    """Normalise a raw Discogs search result into our standard dict shape."""
    raw_title = result.get("title", "")
    parts = raw_title.split(" - ", 1)
    guessed_artist = parts[0].strip() if len(parts) == 2 else artist_hint
    album_part = parts[1].strip() if len(parts) == 2 else raw_title
    labels = result.get("label", [])
    label_name = labels[0] if labels else ""
    catno = result.get("catno", "")
    return {
        "release_id": result.get("id"),
        "master_id": result.get("master_id"),
        "title": raw_title,
        "album": album_part,
        "artist": artist_hint or guessed_artist,
        "year": result.get("year"),
        "cover_url": result.get("cover_image", ""),
        "thumb_url": result.get("thumb", ""),
        "catno": catno,
        "label": label_name,
    }


# ---------------------------------------------------------------------------
# Identity
# ---------------------------------------------------------------------------


def get_username(token: str) -> Optional[str]:
    """Return Discogs username for the given token, or None on error."""
    if not token:
        return None
    try:
        r = requests.get(f"{_BASE_URL}/oauth/identity", headers=_headers(token), timeout=10)
        if r.status_code == 200:
            return r.json().get("username")
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Ranked search helpers (return list[dict] sorted by relevance score)
# ---------------------------------------------------------------------------


def search_all_by_catno(catno: str, token: str = '', per_page: int = 10, artist_hint: str = '') -> list[dict]:
    """Search by catalog number; return scored results sorted by relevance."""
    if not token or not catno:
        return []
    try:
        r = requests.get(
            f"{_BASE_URL}/database/search",
            headers=_headers(token),
            params={"catno": catno, "type": "release", "per_page": per_page, "page": 1},
            timeout=15,
        )
        if r.status_code != 200:
            return []
        out = []
        for res in r.json().get("results", []):
            fmt = _format_result(res, artist_hint=artist_hint)
            fmt['_score'] = _score_result(fmt, catno=catno)
            out.append(fmt)
        out.sort(key=lambda x: x['_score'], reverse=True)
        return out
    except Exception:
        return []


def search_all_by_barcode(barcode: str, token: str = '', per_page: int = 5, artist_hint: str = '') -> list[dict]:
    """Search by barcode; barcodes are highly specific so results get a high base score."""
    if not token or not barcode:
        return []
    try:
        r = requests.get(
            f"{_BASE_URL}/database/search",
            headers=_headers(token),
            params={"barcode": barcode, "type": "release", "per_page": per_page, "page": 1},
            timeout=15,
        )
        if r.status_code != 200:
            return []
        out = []
        for i, res in enumerate(r.json().get("results", [])):
            fmt = _format_result(res, artist_hint=artist_hint)
            fmt['_score'] = 8.0 - i * 0.1
            out.append(fmt)
        return out
    except Exception:
        return []


def search_all_by_text(artist: str, album: str, token: str = '', per_page: int = 8) -> list[dict]:
    """Search by artist + album text; return scored and sorted results."""
    if not token:
        return []
    query = " ".join(p for p in [artist, album] if p).strip()
    if not query:
        return []
    try:
        params: dict = {"q": query, "type": "release", "per_page": per_page, "page": 1}
        if artist:
            params["artist"] = artist
        if album:
            params["release_title"] = album
        r = requests.get(
            f"{_BASE_URL}/database/search",
            headers=_headers(token),
            params=params,
            timeout=15,
        )
        if r.status_code != 200:
            return []
        out = []
        for res in r.json().get("results", []):
            fmt = _format_result(res, artist_hint=artist)
            fmt['_score'] = _score_result(fmt, artist=artist, album=album)
            out.append(fmt)
        out.sort(key=lambda x: x['_score'], reverse=True)
        return out
    except Exception:
        return []


def search_candidates(
    catno: str = '',
    barcode: str = '',
    artist: str = '',
    album: str = '',
    token: str = '',
) -> tuple[Optional[dict], list[dict], str]:
    """
    Run the full priority search chain and return (best, alternatives, confidence).

    Priority: catno > barcode > artist+album text.
    Candidates are deduplicated by release_id, then sorted by score.

    Returns:
        best        – highest-scoring result (no _score field), or None
        alternatives – up to 6 next-best results
        confidence   – 'high' (exact catno match) | 'medium' | 'low'
    """
    bucket: list[tuple[dict, float]] = []
    seen_ids: set = set()

    def _add(hits: list[dict]) -> None:
        for c in hits:
            score = c.pop('_score', 0.0)
            rid = c.get('release_id')
            key = rid if rid is not None else id(c)
            if key not in seen_ids:
                seen_ids.add(key)
                bucket.append((c, score))

    if catno:
        _add(search_all_by_catno(catno, token=token, artist_hint=artist))
    if barcode:
        _add(search_all_by_barcode(barcode, token=token, artist_hint=artist))
    if artist or album:
        _add(search_all_by_text(artist, album, token=token))

    # Album-only fallback: if text search found nothing useful, try album title alone
    if album and (not bucket or max(s for _, s in bucket) < 1.0):
        _add(search_all_by_text('', album, token=token, per_page=5))

    if not bucket:
        return None, [], 'low'

    bucket.sort(key=lambda x: x[1], reverse=True)
    best, best_score = bucket[0]
    alternatives = [c for c, _ in bucket[1:7]]

    if catno and best.get('catno') and _norm_catno(best['catno']) == _norm_catno(catno):
        confidence = 'high'
    elif best_score >= 5.0:
        confidence = 'medium'
    else:
        confidence = 'low'

    return best, alternatives, confidence


# ---------------------------------------------------------------------------
# Legacy single-result wrappers (used by /api/discogs/search endpoints)
# ---------------------------------------------------------------------------


def search_release(artist: str, album: str, token: str = '') -> Optional[dict]:
    """Search by artist + album; returns best single result or None."""
    hits = search_all_by_text(artist, album, token=token, per_page=5)
    if not hits:
        return None
    return {k: v for k, v in hits[0].items() if k != '_score'}


def search_by_catno(catno: str, token: str = '') -> Optional[dict]:
    """Search by catalog number; returns best single result or None."""
    hits = search_all_by_catno(catno, token=token, per_page=3)
    if not hits:
        return None
    return {k: v for k, v in hits[0].items() if k != '_score'}


def search_by_barcode(barcode: str, token: str = '') -> Optional[dict]:
    """Search by barcode; returns best single result or None."""
    hits = search_all_by_barcode(barcode, token=token, per_page=3)
    if not hits:
        return None
    return {k: v for k, v in hits[0].items() if k != '_score'}


def manual_search(query: str, token: str = '') -> Optional[dict]:
    """Free-text search – used when artist/album lookup failed."""
    if not token:
        return None
    try:
        params = {
            "q": query.strip(),
            "type": "release",
            "per_page": 5,
            "page": 1,
        }
        r = requests.get(
            f"{_BASE_URL}/database/search",
            headers=_headers(token),
            params=params,
            timeout=15,
        )
        if r.status_code != 200:
            return None
        results = r.json().get("results", [])
        if not results:
            return None
        best = results[0]
        hit = _format_result(best)
        raw_title = hit["title"]
        parts = raw_title.split(" - ", 1)
        hit["artist"] = parts[0].strip() if len(parts) == 2 else ""
        hit["album"] = parts[1].strip() if len(parts) == 2 else raw_title
        return hit
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Collection management
# ---------------------------------------------------------------------------


def get_collection_release_ids(username: str, token: str) -> set[int]:
    """
    Return the set of release IDs already in the user's collection.

    Paginates through all pages of folder 0 ("All").
    Returns an empty set on error.
    """
    if not token:
        return set()
    try:
        ids: set[int] = set()
        page = 1
        while True:
            r = requests.get(
                f"{_BASE_URL}/users/{username}/collection/folders/0/releases",
                headers=_headers(token),
                params={"page": page, "per_page": 100, "sort": "added", "sort_order": "desc"},
                timeout=15,
            )
            if r.status_code != 200:
                break
            data = r.json()
            for item in data.get("releases", []):
                rid = item.get("id") or item.get("basic_information", {}).get("id")
                if rid:
                    ids.add(int(rid))
            pagination = data.get("pagination", {})
            if page >= pagination.get("pages", 1):
                break
            page += 1
        return ids
    except Exception:
        return set()


def add_release_to_collection(username: str, release_id: int, token: str) -> bool:
    """
    Add a release to folder 0 of the user's Discogs collection.

    Returns True on success, False otherwise.
    """
    if not token:
        return False
    try:
        r = requests.post(
            f"{_BASE_URL}/users/{username}/collection/folders/0/releases/{release_id}",
            headers=_headers(token),
            timeout=15,
        )
        return r.status_code in (200, 201)
    except Exception:
        return False


def remove_from_collection(username: str, instance_id: int, release_id: int, token: str) -> bool:
    """Remove a specific instance from the user's Discogs collection (folder 0)."""
    if not token:
        return False
    try:
        r = requests.delete(
            f"{_BASE_URL}/users/{username}/collection/folders/0/releases/{release_id}/instances/{instance_id}",
            headers=_headers(token),
            timeout=15,
        )
        return r.status_code == 204
    except Exception:
        return False


def get_release_details(release_id: int, token: str) -> Optional[dict]:
    """
    Fetch full release details from Discogs.

    Returns a dict with: release_id, title, year, barcode, catno, label,
    lowest_price, num_for_sale, formats, genres, styles, tracklist_count.
    Returns None on error.
    """
    if not token or not release_id:
        return None
    try:
        r = requests.get(
            f"{_BASE_URL}/releases/{release_id}",
            headers=_headers(token),
            timeout=15,
        )
        if r.status_code != 200:
            return None
        data = r.json()
        barcode = ''
        for ident in data.get('identifiers', []):
            if ident.get('type', '').lower() in ('barcode', 'ean'):
                barcode = ident.get('value', '')
                break
        labels = data.get('labels', [])
        catno = labels[0].get('catno', '') if labels else ''
        label = labels[0].get('name', '') if labels else ''
        return {
            'release_id': data.get('id'),
            'title': data.get('title', ''),
            'year': data.get('year'),
            'country': data.get('country', ''),
            'barcode': barcode,
            'catno': catno,
            'label': label,
            'lowest_price': data.get('lowest_price'),
            'num_for_sale': data.get('num_for_sale', 0),
            'formats': [f.get('name', '') for f in data.get('formats', [])],
            'genres': data.get('genres', []),
            'styles': data.get('styles', []),
            'tracklist_count': len(data.get('tracklist', [])),
        }
    except Exception:
        return None


def _cross_validate(
    ai_artist: str,
    ai_album: str,
    ai_catno: str,
    ai_barcode: str,
    discogs_result: dict,
    search_confidence: str = '',
) -> dict:
    """
    Cross-validate AI-extracted data against a Discogs search result.

    Separates "how we found it" (search_confidence) from "is this correct"
    (match_quality). Flags suspicious results where a number-based search
    succeeded but text similarity is very low (likely OCR error in the number).

    Returns:
        artist_sim    – float 0–1
        album_sim     – float 0–1
        catno_match   – 'exact' | 'partial' | 'none'
        match_quality – 'high' | 'medium' | 'low' | 'suspect'
        is_suspect    – bool
    """
    artist_sim = _similarity(ai_artist, discogs_result.get('artist', ''))
    disc_album = discogs_result.get('album') or ''
    if not disc_album:
        raw = discogs_result.get('title', '')
        parts = raw.split(' - ', 1)
        disc_album = parts[1].strip() if len(parts) == 2 else raw
    album_sim = _similarity(ai_album, disc_album)

    dc = _norm_catno(discogs_result.get('catno', ''))
    ac = _norm_catno(ai_catno)
    if ac and dc:
        if ac == dc:
            catno_match = 'exact'
        elif ac in dc or dc in ac:
            catno_match = 'partial'
        else:
            catno_match = 'none'
    else:
        catno_match = 'none'

    # A number-based hit (catno/barcode) with very low text similarity → suspect
    has_id_based_hit = search_confidence == 'high' or catno_match in ('exact', 'partial') or bool(ai_barcode)
    is_suspect = has_id_based_hit and artist_sim < 0.35 and album_sim < 0.35

    if is_suspect:
        match_quality = 'suspect'
    elif catno_match == 'exact' and (artist_sim >= 0.4 or album_sim >= 0.4):
        match_quality = 'high'
    elif catno_match == 'exact':
        match_quality = 'medium'
    elif (catno_match == 'partial' or search_confidence == 'high') and (artist_sim >= 0.5 or album_sim >= 0.5):
        match_quality = 'high'
    elif artist_sim >= 0.65 and album_sim >= 0.55:
        match_quality = 'high'
    elif artist_sim >= 0.4 or album_sim >= 0.45:
        match_quality = 'medium'
    else:
        match_quality = 'low'

    return {
        'artist_sim': round(artist_sim, 3),
        'album_sim': round(album_sim, 3),
        'catno_match': catno_match,
        'match_quality': match_quality,
        'is_suspect': is_suspect,
    }
