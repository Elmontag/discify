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


def _catno_variants(catno: str) -> list[str]:
    """
    Return distinct search strings to try for a catalog number.

    Discogs search is sensitive to spacing and punctuation in catno fields,
    so we try: the raw string, the fully-stripped version, and a single-space
    delimited variant (splits on non-alphanumeric runs).
    """
    raw = (catno or '').strip()
    if not raw:
        return []
    stripped = _norm_catno(raw)
    spaced = re.sub(r'[^A-Za-z0-9]+', ' ', raw).strip()
    seen: list[str] = []
    for v in [raw, spaced, stripped]:
        if v and v not in seen:
            seen.append(v)
    return seen


def validate_and_fix_ean13(barcode: str) -> tuple[str, bool]:
    """
    Validate an EAN-13 barcode checksum.  If the checksum digit (last digit) is
    wrong, return the corrected barcode and True.  If the barcode is not 13
    digits or already valid, return (barcode, False).

    Only EAN-13 (13 digits) is handled; shorter/longer codes are returned as-is.
    """
    digits = ''.join(c for c in (barcode or '') if c.isdigit())
    if len(digits) != 13:
        return digits, False
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(digits[:12]))
    expected_check = (10 - (total % 10)) % 10
    if int(digits[12]) == expected_check:
        return digits, False
    # Checksum wrong – correct it
    corrected = digits[:12] + str(expected_check)
    return corrected, True


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
    """Search by catalog number; try multiple catno variants and return scored results."""
    if not token or not catno:
        return []
    seen_ids: set = set()
    out: list[dict] = []
    for variant in _catno_variants(catno):
        try:
            r = requests.get(
                f"{_BASE_URL}/database/search",
                headers=_headers(token),
                params={"catno": variant, "type": "release", "per_page": per_page, "page": 1},
                timeout=15,
            )
            if r.status_code != 200:
                continue
            for res in r.json().get("results", []):
                fmt = _format_result(res, artist_hint=artist_hint)
                rid = fmt.get('release_id') or id(fmt)
                if rid not in seen_ids:
                    seen_ids.add(rid)
                    fmt['_score'] = _score_result(fmt, catno=catno)
                    out.append(fmt)
        except Exception:
            continue
    out.sort(key=lambda x: x['_score'], reverse=True)
    return out



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
) -> tuple[Optional[dict], list[dict], str, str]:
    """
    Run the full priority search chain and return (best, alternatives, confidence, search_reason).

    Priority: catno > barcode > artist+album text.
    Candidates are deduplicated by release_id, then sorted by score.

    EAN-13 barcodes are checksum-validated; a single wrong digit (common OCR
    error) is automatically corrected before the Discogs call.

    Returns:
        best          – highest-scoring result (no _score field), or None
        alternatives  – up to 6 next-best results
        confidence    – 'high' | 'medium' | 'low'
        search_reason – human-readable explanation of how the best was found
    """
    bucket: list[tuple[dict, float]] = []
    seen_ids: set = set()
    ean_was_corrected = False
    corrected_barcode = barcode

    def _add(hits: list[dict]) -> None:
        for c in hits:
            score = c.pop('_score', 0.0)
            rid = c.get('release_id')
            key = rid if rid is not None else id(c)
            if key not in seen_ids:
                seen_ids.add(key)
                bucket.append((c, score))

    # Track which sources contributed hits
    catno_hit = False
    barcode_hit = False
    ean_corrected_hit = False
    text_hit = False

    if catno:
        hits = search_all_by_catno(catno, token=token, artist_hint=artist)
        if hits:
            catno_hit = True
            _add(hits)

    if barcode:
        # Validate + auto-correct EAN-13 checksum
        fixed, was_fixed = validate_and_fix_ean13(barcode)
        if was_fixed:
            corrected_barcode = fixed
            ean_was_corrected = True
            # Try corrected EAN first
            corrected_hits = search_all_by_barcode(fixed, token=token, artist_hint=artist)
            if corrected_hits:
                ean_corrected_hit = True
                _add(corrected_hits)
        # Also try the original barcode (may still match if correction was wrong)
        original_hits = search_all_by_barcode(barcode, token=token, artist_hint=artist)
        if original_hits:
            if not ean_corrected_hit:
                barcode_hit = True
            _add(original_hits)
        elif fixed != barcode and not ean_corrected_hit:
            pass  # neither worked
        elif not ean_was_corrected and original_hits:
            barcode_hit = True

    if artist or album:
        hits = search_all_by_text(artist, album, token=token)
        if hits:
            text_hit = True
            _add(hits)

    # Album-only fallback
    if album and (not bucket or max(s for _, s in bucket) < 1.0):
        extra = search_all_by_text('', album, token=token, per_page=5)
        if extra:
            text_hit = True
            _add(extra)

    if not bucket:
        reason = 'not_found'
        if catno and barcode:
            reason = 'not_found_catno_barcode'
        elif catno:
            reason = 'not_found_catno'
        elif barcode:
            reason = 'not_found_barcode'
        elif artist or album:
            reason = 'not_found_text'
        return None, [], 'low', reason

    bucket.sort(key=lambda x: x[1], reverse=True)
    best, best_score = bucket[0]
    alternatives = [c for c, _ in bucket[1:7]]

    if catno and best.get('catno') and _norm_catno(best['catno']) == _norm_catno(catno):
        confidence = 'high'
    elif best_score >= 5.0:
        confidence = 'medium'
    else:
        confidence = 'low'

    # Build search_reason
    if ean_corrected_hit:
        reason = 'barcode_ean_corrected'
    elif barcode_hit or (barcode and not catno_hit and bucket and best_score >= 7.0):
        reason = 'barcode_hit'
    elif catno_hit:
        reason = 'catno_hit'
    elif text_hit:
        reason = 'text_hit'
    else:
        reason = 'unknown'

    # When best result is catno-based but suspect, run text-only as second opinion
    # and replace if text result is clearly better
    best_validated = _cross_validate_quick(artist, album, best)
    if best_validated.get('is_catno_suspect'):
        text_only = search_all_by_text(artist, album, token=token, per_page=5)
        if text_only:
            text_best = text_only[0]
            text_val = _cross_validate_quick(artist, album, text_best)
            combined_text = text_val['artist_sim'] + text_val['album_sim']
            combined_best = best_validated['artist_sim'] + best_validated['album_sim']
            if combined_text > combined_best + 0.4:
                # Text result is substantially better → prefer it
                old_best = best
                best = {k: v for k, v in text_best.items() if k != '_score'}
                alternatives = [old_best] + [c for c, _ in bucket[1:6]]
                confidence = 'medium'
                reason = 'suspect_replaced_by_text'

    return best, alternatives, confidence, reason



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


def _cross_validate_quick(ai_artist: str, ai_album: str, result: dict) -> dict:
    """
    Lightweight similarity check used internally during candidate selection.
    Returns artist_sim, album_sim, and is_catno_suspect (True when the result
    was likely found via catno but text similarity is very low).
    """
    artist_sim = _similarity(ai_artist, result.get('artist', ''))
    disc_album = result.get('album') or ''
    if not disc_album:
        raw = result.get('title', '')
        parts = raw.split(' - ', 1)
        disc_album = parts[1].strip() if len(parts) == 2 else raw
    album_sim = _similarity(ai_album, disc_album)
    # Only flag as suspect for catno-found results (not barcode — those are authoritative)
    is_catno_suspect = bool(result.get('catno')) and artist_sim < 0.35 and album_sim < 0.35
    return {'artist_sim': artist_sim, 'album_sim': album_sim, 'is_catno_suspect': is_catno_suspect}


def _cross_validate(
    ai_artist: str,
    ai_album: str,
    ai_catno: str,
    ai_barcode: str,
    discogs_result: dict,
    search_confidence: str = '',
    search_reason: str = '',
) -> dict:
    """
    Cross-validate AI-extracted data against a Discogs search result.

    Separates "how we found it" (search_confidence/search_reason) from
    "is this correct" (match_quality).

    Key rule: barcode hits are authoritative — a valid EAN match is NOT
    flagged as suspect just because AI text recognition was imperfect.
    Only catno-based hits with very low text similarity are suspect
    (catno OCR errors are more common than EAN OCR errors).

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

    # Barcode hits are authoritative (EAN is a globally unique identifier).
    # Only flag suspect when a catno search yielded a result with very low text match.
    # Barcode results (barcode_hit / barcode_ean_corrected) are NEVER suspect.
    barcode_based = search_reason in ('barcode_hit', 'barcode_ean_corrected')
    catno_id_based = (search_confidence == 'high' or catno_match in ('exact', 'partial')) and not barcode_based
    is_suspect = catno_id_based and artist_sim < 0.35 and album_sim < 0.35

    if is_suspect:
        match_quality = 'suspect'
    elif barcode_based:
        # Barcode hit: trust EAN, quality determined by text confirmation
        if artist_sim >= 0.4 or album_sim >= 0.4:
            match_quality = 'high'
        else:
            match_quality = 'medium'
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
