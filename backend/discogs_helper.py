"""
discogs_helper.py – Discogs REST API integration.

Uses the public Discogs API with a Personal Access Token (PAT) for
authentication.  No third-party Discogs client library is required –
only the standard `requests` package.

Rate-limit note: Discogs allows ~60 authenticated requests / minute.
The caller is responsible for inserting sleep() delays between searches.
"""

from __future__ import annotations

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


def search_release(artist: str, album: str, token: str = '') -> Optional[dict]:
    """
    Search Discogs for the best matching release.

    Returns a dict with keys:
        release_id, master_id, title, artist, year, cover_url, thumb_url
    or None if nothing was found / an error occurred.
    """
    if not token:
        return None
    try:
        query = " ".join(part for part in [artist, album] if part).strip()
        if not query:
            return None

        params: dict = {
            "q": query,
            "type": "release",
            "per_page": 5,
            "page": 1,
        }
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
            return None

        results = r.json().get("results", [])
        if not results:
            return None

        best = results[0]
        return {
            "release_id": best.get("id"),
            "master_id": best.get("master_id"),
            "title": best.get("title", ""),
            "artist": artist or best.get("title", "").split(" - ")[0],
            "year": best.get("year"),
            "cover_url": best.get("cover_image", ""),
            "thumb_url": best.get("thumb", ""),
        }

    except Exception:
        return None


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
        raw_title = best.get("title", "")
        parts = raw_title.split(" - ", 1)
        guessed_artist = parts[0].strip() if len(parts) == 2 else ""
        guessed_album = parts[1].strip() if len(parts) == 2 else raw_title
        return {
            "release_id": best.get("id"),
            "master_id": best.get("master_id"),
            "title": raw_title,
            "artist": guessed_artist,
            "album": guessed_album,
            "year": best.get("year"),
            "cover_url": best.get("cover_image", ""),
            "thumb_url": best.get("thumb", ""),
        }
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
