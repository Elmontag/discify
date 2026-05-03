"""
app.py – Discify: CD Collection Manager

Streamlit web application that:
1. Accepts a photo of a CD shelf or stack.
2. Uses a vision AI (Anthropic Claude or Ollama) to identify all visible albums.
3. Looks each album up on Discogs.
4. Presents an editable review table.
5. Batch-adds confirmed albums to the user's Discogs collection.
"""

from __future__ import annotations

import os
import time

import pandas as pd
import streamlit as st
from dotenv import load_dotenv

from discogs_helper import (
    add_release_to_collection,
    get_collection_release_ids,
    get_username,
    manual_search,
    search_release,
)
from vision import identify_cds_from_image, ANTHROPIC_MODELS, OLLAMA_MODELS

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

load_dotenv()

st.set_page_config(
    page_title="Discify – CD Collection Manager",
    page_icon="💿",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Custom CSS
# ---------------------------------------------------------------------------

st.markdown(
    """
<style>
/* Page background */
[data-testid="stAppViewContainer"] { background-color: #0e0e0e; }
[data-testid="stSidebar"] { background-color: #1a1a1a; }

/* Headers */
h1, h2, h3 { color: #f0f0f0 !important; }
p, label, span { color: #cccccc; }

/* Primary button */
div.stButton > button[kind="primary"] {
    background-color: #e63946;
    border: none;
    color: white;
    font-weight: 600;
    border-radius: 6px;
    padding: 0.5rem 1.2rem;
}
div.stButton > button[kind="primary"]:hover { background-color: #c1121f; }

/* Metric cards */
[data-testid="metric-container"] {
    background: #1e1e1e;
    border-radius: 8px;
    padding: 0.6rem 1rem;
}

/* Separator */
.separator { border-top: 1px solid #333; margin: 1rem 0; }

/* Status badges */
.badge-new        { color: #4ade80; font-weight: 600; }
.badge-collection { color: #facc15; font-weight: 600; }
.badge-missing    { color: #f87171; font-weight: 600; }
</style>
""",
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Session state initialisation
# ---------------------------------------------------------------------------

_DEFAULTS: dict = {
    "albums_identified": [],   # [{artist, album}, …]  from vision AI
    "search_results": [],      # enriched dicts with Discogs data
    "discogs_username": None,  # fetched once after token entry
    "results_ready": False,
    "manual_search_idx": None, # index of row needing manual search
}

for key, value in _DEFAULTS.items():
    if key not in st.session_state:
        st.session_state[key] = value


# ---------------------------------------------------------------------------
# Sidebar – API credentials
# ---------------------------------------------------------------------------

with st.sidebar:
    st.markdown("## ⚙️ Einstellungen")
    st.markdown("---")

    # ---- Vision backend ------------------------------------------------
    st.markdown("### 🤖 Vision-Backend")
    vision_backend = st.radio(
        "Backend auswählen",
        options=["anthropic", "ollama"],
        format_func=lambda x: "☁️ Anthropic Claude" if x == "anthropic" else "🏠 Ollama (lokal)",
        horizontal=True,
        label_visibility="collapsed",
    )

    if vision_backend == "anthropic":
        anthropic_key = st.text_input(
            "🔑 Anthropic API Key",
            value=os.getenv("ANTHROPIC_API_KEY", ""),
            type="password",
            help="Erhältlich unter console.anthropic.com/account/keys",
        )
        if anthropic_key:
            os.environ["ANTHROPIC_API_KEY"] = anthropic_key

        vision_model = st.selectbox(
            "Modell",
            options=ANTHROPIC_MODELS,
            index=0,
            help="claude-opus-4-5 hat die beste Bildqualität; haiku ist am schnellsten.",
        )
        ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")

    else:  # ollama
        ollama_url = st.text_input(
            "🌐 Ollama URL",
            value=os.getenv("OLLAMA_URL", "http://localhost:11434"),
            help="Standard: http://localhost:11434 – starte Ollama mit `ollama serve`",
        )
        vision_model = st.selectbox(
            "Modell",
            options=OLLAMA_MODELS,
            index=0,
            help="Das Modell muss vision-fähig sein und lokal installiert sein (`ollama pull llava`).",
        )
        # Custom model override
        custom_model = st.text_input(
            "Oder eigenes Modell eingeben",
            value="",
            placeholder="z.B. llava:34b",
        )
        if custom_model.strip():
            vision_model = custom_model.strip()

    st.markdown("---")

    # ---- Discogs token -------------------------------------------------
    st.markdown("### 🎵 Discogs")
    discogs_token = st.text_input(
        "Personal Access Token",
        value=os.getenv("DISCOGS_TOKEN", ""),
        type="password",
        help="Einstellungen › Entwickler › Personal Access Token",
    )
    if discogs_token:
        os.environ["DISCOGS_TOKEN"] = discogs_token

    # Fetch and cache Discogs username when token is provided
    if discogs_token and not st.session_state.discogs_username:
        with st.spinner("Verbinde mit Discogs…"):
            uname = get_username()
            if uname:
                st.session_state.discogs_username = uname

    if st.session_state.discogs_username:
        st.success(f"✅ Eingeloggt als **{st.session_state.discogs_username}**")
    elif discogs_token:
        st.error("Token ungültig oder kein Netzwerkzugang.")

    st.markdown("---")
    st.markdown(
        "[Discogs Token erstellen →](https://www.discogs.com/settings/developers)\n\n"
        "[Anthropic API Key →](https://console.anthropic.com/account/keys)\n\n"
        "[Ollama installieren →](https://ollama.com/download)"
    )

# ---------------------------------------------------------------------------
# Page header
# ---------------------------------------------------------------------------

col_title, _ = st.columns([3, 1])
with col_title:
    st.markdown("# 💿 Discify")
    st.markdown("*Deine CD-Sammlung, digitalisiert in Sekunden.*")

st.markdown("---")

# ---------------------------------------------------------------------------
# Step 1 – Image upload
# ---------------------------------------------------------------------------

st.markdown("## 📸 Schritt 1 – Foto hochladen")
st.markdown(
    "Lade ein Foto deines CD-Regals (Rücken / Spines) oder eines CD-Stapels hoch."
)

upload_col, preview_col = st.columns([2, 1])

with upload_col:
    uploaded_file = st.file_uploader(
        "Bild auswählen",
        type=["jpg", "jpeg", "png", "webp"],
        label_visibility="collapsed",
    )

with preview_col:
    if uploaded_file:
        st.image(uploaded_file, caption="Vorschau", use_container_width=True)

# ---------------------------------------------------------------------------
# Step 2 – Analysis
# ---------------------------------------------------------------------------

if uploaded_file:
    st.markdown("## 🔍 Schritt 2 – CDs analysieren")

    # Validate keys before allowing analysis
    missing = []
    if vision_backend == "anthropic" and not os.getenv("ANTHROPIC_API_KEY"):
        missing.append("Anthropic API Key")
    if not os.getenv("DISCOGS_TOKEN"):
        missing.append("Discogs Token")

    if missing:
        st.warning(
            f"Bitte gib folgende Keys in der Seitenleiste ein: **{', '.join(missing)}**"
        )
    else:
        if st.button("▶ Analyse starten", type="primary"):
            # ---- Phase 1: Vision AI ----------------------------------------
            image_bytes = uploaded_file.getvalue()

            backend_label = (
                f"Anthropic {vision_model}" if vision_backend == "anthropic"
                else f"Ollama {vision_model}"
            )
            with st.spinner(f"🤔 Analysiere Bild mit {backend_label} … (dies kann einige Sekunden dauern)"):
                try:
                    identified = identify_cds_from_image(
                        image_bytes,
                        backend=vision_backend,
                        model=vision_model,
                        ollama_url=ollama_url,
                    )
                    st.session_state.albums_identified = identified
                except (ValueError, RuntimeError) as exc:
                    st.error(f"❌ Fehler bei der Bildanalyse: {exc}")
                    st.stop()

            if not identified:
                st.warning(
                    "⚠️ Keine CDs erkannt. "
                    "Versuche ein schärferes Foto oder zoome näher an die CD-Rücken heran."
                )
                st.stop()

            st.success(f"✅ {len(identified)} CD(s) im Bild erkannt.")

            # ---- Phase 2: Discogs lookup ------------------------------------
            username = st.session_state.discogs_username

            # Fetch existing collection IDs (non-fatal if it fails)
            collection_ids: set[int] = set()
            if username:
                with st.spinner("📚 Lade bestehende Sammlung von Discogs …"):
                    try:
                        collection_ids = get_collection_release_ids(username)
                    except Exception:
                        pass

            results: list[dict] = []
            progress_bar = st.progress(0, text="Suche auf Discogs …")

            for idx, album in enumerate(identified):
                artist = album.get("artist", "")
                album_name = album.get("album", "")
                progress_bar.progress(
                    (idx + 1) / len(identified),
                    text=f"🔍 Suche: {artist} – {album_name} ({idx + 1}/{len(identified)})",
                )

                hit = search_release(artist, album_name)

                entry: dict = {
                    "idx": idx,
                    "include": True,
                    "recognized_artist": artist,
                    "recognized_album": album_name,
                    "found": hit is not None,
                    "discogs_title": hit["title"] if hit else "",
                    "discogs_artist": hit.get("artist", "") if hit else "",
                    "release_id": hit["release_id"] if hit else None,
                    "master_id": hit.get("master_id") if hit else None,
                    "year": str(hit["year"]) if hit and hit.get("year") else "",
                    "cover_url": hit.get("cover_url", "") if hit else "",
                    "thumb_url": hit.get("thumb_url", "") if hit else "",
                    "in_collection": (
                        bool(hit and hit["release_id"] in collection_ids)
                    ),
                    "manual_query": "",
                }

                # Derive status
                if not hit:
                    entry["status"] = "not_found"
                elif entry["in_collection"]:
                    entry["status"] = "in_collection"
                else:
                    entry["status"] = "new"

                results.append(entry)

                # Respect Discogs rate limit (60 req / min)
                if idx < len(identified) - 1:
                    time.sleep(1.1)

            progress_bar.empty()
            st.session_state.search_results = results
            st.session_state.results_ready = True
            st.rerun()

# ---------------------------------------------------------------------------
# Step 3 – Review & Edit
# ---------------------------------------------------------------------------

if st.session_state.results_ready and st.session_state.search_results:
    results: list[dict] = st.session_state.search_results

    st.markdown("## 📋 Schritt 3 – Ergebnisse überprüfen")

    # Summary metrics
    total = len(results)
    n_found = sum(1 for r in results if r["found"])
    n_new = sum(1 for r in results if r["status"] == "new")
    n_collection = sum(1 for r in results if r["status"] == "in_collection")
    n_missing = sum(1 for r in results if r["status"] == "not_found")

    mc1, mc2, mc3, mc4 = st.columns(4)
    mc1.metric("Erkannt", total)
    mc2.metric("Auf Discogs gefunden", n_found)
    mc3.metric("Neu (hinzufügbar)", n_new)
    mc4.metric("Bereits in Sammlung", n_collection)

    st.markdown("---")

    # ---- Column headers ----------------------------------------------------
    hdr = st.columns([0.5, 1, 2, 2, 1, 1, 0.5])
    for col, label in zip(
        hdr, ["", "Cover", "Erkannt", "Discogs-Treffer", "Jahr", "Status", "✓"]
    ):
        col.markdown(f"**{label}**")

    st.markdown('<div class="separator"></div>', unsafe_allow_html=True)

    # ---- Per-row display ---------------------------------------------------
    updated: list[dict] = []
    for row in results:
        i = row["idx"]
        cols = st.columns([0.5, 1, 2, 2, 1, 1, 0.5])

        # Remove button
        with cols[0]:
            if st.button("🗑", key=f"del_{i}", help="Aus Liste entfernen"):
                row["include"] = False

        # Cover thumbnail
        with cols[1]:
            thumb = row.get("thumb_url") or row.get("cover_url") or ""
            if thumb:
                st.image(thumb, width=64)
            else:
                st.markdown("💿")

        # Editable recognized fields
        with cols[2]:
            row["recognized_artist"] = st.text_input(
                "Künstler",
                value=row["recognized_artist"],
                key=f"art_{i}",
                label_visibility="collapsed",
            )
            row["recognized_album"] = st.text_input(
                "Album",
                value=row["recognized_album"],
                key=f"alb_{i}",
                label_visibility="collapsed",
            )

        # Discogs match
        with cols[3]:
            if row["found"]:
                st.markdown(f"**{row['discogs_title']}**")
            else:
                st.markdown("*Nicht gefunden*")
                # Manual search sub-widget
                mq = st.text_input(
                    "Manuelle Suche",
                    value=row.get("manual_query", ""),
                    placeholder=f"{row['recognized_artist']} {row['recognized_album']}",
                    key=f"mq_{i}",
                    label_visibility="collapsed",
                )
                row["manual_query"] = mq
                if st.button("🔍 Manuell suchen", key=f"ms_{i}"):
                    with st.spinner("Suche läuft…"):
                        hit = manual_search(mq or f"{row['recognized_artist']} {row['recognized_album']}")
                    if hit:
                        row.update(
                            {
                                "found": True,
                                "discogs_title": hit["title"],
                                "discogs_artist": hit.get("artist", ""),
                                "release_id": hit["release_id"],
                                "master_id": hit.get("master_id"),
                                "year": str(hit.get("year") or ""),
                                "cover_url": hit.get("cover_url", ""),
                                "thumb_url": hit.get("thumb_url", ""),
                                "status": "new",
                            }
                        )
                        st.success("Gefunden!")
                        st.rerun()
                    else:
                        st.error("Kein Treffer.")

        # Year
        with cols[4]:
            st.markdown(row.get("year") or "–")

        # Status badge
        with cols[5]:
            status_map = {
                "new": '<span class="badge-new">🆕 Neu</span>',
                "in_collection": '<span class="badge-collection">✅ In Sammlung</span>',
                "not_found": '<span class="badge-missing">❓ Nicht gefunden</span>',
            }
            st.markdown(
                status_map.get(row["status"], row["status"]),
                unsafe_allow_html=True,
            )

        # Include checkbox
        with cols[6]:
            row["include"] = st.checkbox(
                "Auswählen",
                value=row["include"],
                key=f"sel_{i}",
                label_visibility="collapsed",
            )

        st.markdown('<div class="separator"></div>', unsafe_allow_html=True)
        updated.append(row)

    st.session_state.search_results = updated

    # ---- Step 4 – Batch add ------------------------------------------------
    st.markdown("## 💾 Schritt 4 – Zur Sammlung hinzufügen")

    to_add = [
        r for r in updated
        if r.get("include") and r.get("found") and r.get("status") != "in_collection"
    ]

    if not to_add:
        st.info("Keine neuen CDs ausgewählt. Aktiviere die Checkboxen für Alben, die du hinzufügen möchtest.")
    else:
        username = st.session_state.discogs_username
        if not username:
            st.error("Kein Discogs-Benutzername gefunden. Überprüfe deinen Token.")
        else:
            st.markdown(f"**{len(to_add)} CD(s)** werden deiner Sammlung hinzugefügt.")

            if st.button(
                f"🎵 {len(to_add)} CD(s) zur Sammlung hinzufügen",
                type="primary",
            ):
                success_count = 0
                error_count = 0
                add_progress = st.progress(0, text="Füge zur Sammlung hinzu …")

                for j, album in enumerate(to_add):
                    release_id = album.get("release_id")
                    if release_id:
                        add_progress.progress(
                            (j + 1) / len(to_add),
                            text=f"Füge hinzu: {album['discogs_title']} …",
                        )
                        ok = add_release_to_collection(username, int(release_id))
                        if ok:
                            success_count += 1
                            album["status"] = "in_collection"
                            album["in_collection"] = True
                        else:
                            error_count += 1
                        # Rate limiting
                        if j < len(to_add) - 1:
                            time.sleep(1.1)
                    else:
                        error_count += 1

                add_progress.empty()

                if success_count:
                    st.success(
                        f"🎉 {success_count} CD(s) wurden deiner Sammlung hinzugefügt!"
                    )
                if error_count:
                    st.error(
                        f"❌ {error_count} CD(s) konnten nicht hinzugefügt werden. "
                        "Prüfe deine Internetverbindung und den Discogs-Token."
                    )

                # Persist updated statuses
                st.session_state.search_results = updated
                st.rerun()

    # Reset button
    st.markdown("---")
    if st.button("🔄 Neue Analyse starten"):
        for key in _DEFAULTS:
            st.session_state[key] = _DEFAULTS[key]
        st.rerun()
