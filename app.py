"""
app.py – Discify: modern Streamlit UI for CD collection digitisation.
"""

from __future__ import annotations

import os
import time
from html import escape

import streamlit as st
from dotenv import load_dotenv

from discogs_helper import (
    add_release_to_collection,
    get_collection_release_ids,
    get_username,
    manual_search,
    search_release,
)
from vision import ANTHROPIC_MODELS, OLLAMA_MODELS, identify_cds_from_image


load_dotenv()

st.set_page_config(
    page_title="Discify – Smarte CD-Sammlung",
    page_icon="💿",
    layout="wide",
    initial_sidebar_state="expanded",
)


_DEFAULTS: dict = {
    "albums_identified": [],
    "search_results": [],
    "discogs_username": None,
    "results_ready": False,
    "collection_release_ids": set(),
    "active_discogs_token": "",
}


for key, value in _DEFAULTS.items():
    if key not in st.session_state:
        st.session_state[key] = value


def _set_env_var(name: str, value: str) -> None:
    if value:
        os.environ[name] = value
    else:
        os.environ.pop(name, None)


def _status_meta(row: dict) -> tuple[str, str]:
    mapping = {
        "new": ("Neu", "status-new"),
        "in_collection": ("Schon in Sammlung", "status-collection"),
        "not_found": ("Manueller Treffer noetig", "status-missing"),
    }
    return mapping.get(row.get("status"), ("Unbekannt", "status-muted"))


def _render_shell() -> None:
    st.markdown(
        """
        <style>
        :root {
            --bg: #07111f;
            --panel: rgba(8, 15, 29, 0.78);
            --panel-strong: rgba(10, 19, 37, 0.96);
            --panel-soft: rgba(130, 153, 196, 0.10);
            --line: rgba(160, 183, 221, 0.16);
            --text: #f5f7ff;
            --muted: #9eaccf;
            --accent: #7c5cff;
            --accent-2: #00c2ff;
            --success: #31d19b;
            --warning: #ffd166;
            --danger: #ff7a7a;
            --shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
            --radius: 22px;
        }

        [data-testid="stAppViewContainer"] {
            background:
                radial-gradient(circle at top left, rgba(124, 92, 255, 0.18), transparent 32%),
                radial-gradient(circle at top right, rgba(0, 194, 255, 0.16), transparent 26%),
                linear-gradient(180deg, #07111f 0%, #091425 55%, #060d18 100%);
            color: var(--text);
        }

        [data-testid="stHeader"] {
            background: rgba(7, 17, 31, 0.38);
        }

        [data-testid="stSidebar"] {
            background:
                linear-gradient(180deg, rgba(8, 15, 29, 0.98), rgba(7, 13, 24, 0.98));
            border-right: 1px solid var(--line);
        }

        [data-testid="stSidebar"] .block-container {
            padding-top: 1.4rem;
        }

        .block-container {
            max-width: 1280px;
            padding-top: 2rem;
            padding-bottom: 3rem;
        }

        h1, h2, h3, h4, label, p, span, div {
            color: var(--text);
        }

        .stMarkdown a {
            color: #95d7ff;
        }

        [data-testid="stMetric"] {
            background: transparent;
        }

        div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"],
        div[data-testid="stForm"] {
            border-radius: var(--radius);
        }

        div[data-testid="stVerticalBlockBorderWrapper"] > div {
            background: var(--panel);
            border: 1px solid var(--line);
            box-shadow: var(--shadow);
        }

        div.stButton > button,
        div.stDownloadButton > button {
            width: 100%;
            border-radius: 999px;
            border: 1px solid transparent;
            min-height: 2.9rem;
            font-weight: 700;
            letter-spacing: 0.01em;
            transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        div.stButton > button[kind="primary"] {
            background: linear-gradient(135deg, var(--accent), var(--accent-2));
            color: white;
            box-shadow: 0 18px 40px rgba(72, 102, 255, 0.34);
        }

        div.stButton > button:hover,
        div.stDownloadButton > button:hover {
            transform: translateY(-1px);
        }

        div.stButton > button[kind="secondary"] {
            background: rgba(255, 255, 255, 0.04);
            color: var(--text);
            border-color: rgba(255, 255, 255, 0.08);
        }

        div[data-baseweb="input"] > div,
        div[data-baseweb="select"] > div,
        textarea {
            background: rgba(255, 255, 255, 0.04) !important;
            border-radius: 16px !important;
            border-color: rgba(255, 255, 255, 0.10) !important;
        }

        [data-testid="stFileUploaderDropzone"] {
            background: rgba(255, 255, 255, 0.03);
            border: 1px dashed rgba(151, 173, 214, 0.30);
            border-radius: 22px;
            padding: 1.4rem;
        }

        [data-testid="stCheckbox"] label {
            font-weight: 600;
        }

        .hero-card {
            position: relative;
            overflow: hidden;
            padding: 2rem;
            border-radius: 30px;
            border: 1px solid rgba(255, 255, 255, 0.10);
            background:
                linear-gradient(135deg, rgba(124, 92, 255, 0.22), rgba(0, 194, 255, 0.12)),
                rgba(8, 15, 29, 0.86);
            box-shadow: var(--shadow);
            margin-bottom: 1rem;
        }

        .hero-card::after {
            content: "";
            position: absolute;
            inset: auto -8% -35% auto;
            width: 280px;
            height: 280px;
            border-radius: 999px;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.18) 0%, transparent 68%);
            pointer-events: none;
        }

        .hero-kicker {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.45rem 0.85rem;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.08);
            color: #dce7ff;
            font-size: 0.82rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }

        .hero-title {
            font-size: clamp(2.2rem, 4vw, 4rem);
            line-height: 1.02;
            margin: 1rem 0 0.75rem;
            font-weight: 800;
        }

        .hero-copy {
            max-width: 760px;
            font-size: 1.02rem;
            line-height: 1.7;
            color: #c7d2ef;
        }

        .hero-badges,
        .stat-grid,
        .workflow-grid {
            display: grid;
            gap: 0.9rem;
        }

        .hero-badges {
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
            margin-top: 1.4rem;
        }

        .chip {
            padding: 0.85rem 1rem;
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .chip-label {
            display: block;
            margin-bottom: 0.28rem;
            color: var(--muted);
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        .chip-value {
            font-size: 1rem;
            font-weight: 700;
        }

        .stat-grid {
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            margin: 1rem 0 0.2rem;
        }

        .stat-card,
        .workflow-card,
        .match-card,
        .empty-card {
            border-radius: 22px;
            border: 1px solid var(--line);
            background: rgba(255, 255, 255, 0.03);
            padding: 1rem 1.1rem;
        }

        .stat-label,
        .workflow-label {
            color: var(--muted);
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .stat-value {
            margin-top: 0.45rem;
            font-size: 1.8rem;
            font-weight: 800;
        }

        .workflow-grid {
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            margin: 0.8rem 0 1.1rem;
        }

        .workflow-step {
            color: #dce7ff;
            font-size: 1rem;
            font-weight: 700;
            margin: 0.35rem 0 0.5rem;
        }

        .workflow-copy,
        .muted-copy {
            color: var(--muted);
            line-height: 1.6;
        }

        .section-title {
            font-size: 1.55rem;
            font-weight: 780;
            margin-bottom: 0.2rem;
        }

        .section-copy {
            color: var(--muted);
            margin-bottom: 1rem;
            line-height: 1.65;
        }

        .sidebar-card {
            padding: 1rem 1rem 1.1rem;
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            margin-bottom: 1rem;
        }

        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.45rem 0.75rem;
            border-radius: 999px;
            font-size: 0.82rem;
            font-weight: 700;
            border: 1px solid transparent;
        }

        .status-new {
            background: rgba(49, 209, 155, 0.12);
            color: #86f0c9;
            border-color: rgba(49, 209, 155, 0.22);
        }

        .status-collection {
            background: rgba(255, 209, 102, 0.12);
            color: #ffe29e;
            border-color: rgba(255, 209, 102, 0.22);
        }

        .status-missing {
            background: rgba(255, 122, 122, 0.12);
            color: #ffb0b0;
            border-color: rgba(255, 122, 122, 0.22);
        }

        .status-muted {
            background: rgba(255, 255, 255, 0.06);
            color: #d7def0;
            border-color: rgba(255, 255, 255, 0.10);
        }

        .result-title {
            font-size: 1.1rem;
            font-weight: 780;
            margin: 0.2rem 0 0.4rem;
        }

        .result-subtitle {
            color: var(--muted);
            margin-bottom: 0.8rem;
            line-height: 1.55;
        }

        .match-card {
            margin-top: 0.75rem;
        }

        .match-card strong {
            font-size: 1rem;
        }

        .cover-frame {
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.02);
        }

        .empty-card {
            text-align: center;
            padding: 1.5rem;
        }

        .empty-title {
            font-size: 1.18rem;
            font-weight: 780;
            margin-bottom: 0.4rem;
        }

        .action-strip {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 0.9rem;
            margin-top: 1rem;
        }

        @media (max-width: 900px) {
            .block-container {
                padding-top: 1.1rem;
            }

            .hero-card {
                padding: 1.4rem;
                border-radius: 24px;
            }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def _render_hero(vision_backend: str, vision_model: str) -> None:
    username = st.session_state.discogs_username or "nicht verbunden"
    badges = [
        ("Vision", "Anthropic Claude" if vision_backend == "anthropic" else "Ollama lokal"),
        ("Modell", vision_model),
        ("Discogs", username),
        ("Workflow", "Upload → Analyse → Review → Sync"),
    ]
    badge_markup = "".join(
        f"""
        <div class="chip">
            <span class="chip-label">{escape(label)}</span>
            <span class="chip-value">{escape(value)}</span>
        </div>
        """
        for label, value in badges
    )
    st.markdown(
        f"""
        <section class="hero-card">
            <span class="hero-kicker">Discify • AI-powered Collection Workflow</span>
            <div class="hero-title">CD-Regale fotografieren. Treffer pruefen. Direkt nach Discogs schicken.</div>
            <div class="hero-copy">
                Die Python-Backends fuer Vision, Discogs und manuelle Nachsuche bleiben bestehen,
                aber das Interface arbeitet jetzt wie ein modernes Control Center: klarere Prioritaeten,
                bessere Statussignale und ein deutlich staerkeres mobiles Layout.
            </div>
            <div class="hero-badges">{badge_markup}</div>
        </section>
        """,
        unsafe_allow_html=True,
    )


def _render_section(title: str, copy: str) -> None:
    st.markdown(
        f"""
        <div class="section-title">{escape(title)}</div>
        <div class="section-copy">{escape(copy)}</div>
        """,
        unsafe_allow_html=True,
    )


def _render_stats(cards: list[tuple[str, str]]) -> None:
    markup = "".join(
        f"""
        <div class="stat-card">
            <div class="stat-label">{escape(label)}</div>
            <div class="stat-value">{escape(value)}</div>
        </div>
        """
        for label, value in cards
    )
    st.markdown(f'<div class="stat-grid">{markup}</div>', unsafe_allow_html=True)


def _render_workflow() -> None:
    cards = [
        ("01", "Bildquelle", "Ziehe ein Shelf-Foto hinein oder lade mehrere Formate wie JPG, PNG und WebP hoch."),
        ("02", "Vision-Analyse", "Claude oder Ollama extrahieren Artist- und Albumdaten aus Spine-Labels und Covers."),
        ("03", "Discogs-Match", "Jede erkannte Platte wird gegen Discogs geprueft, inklusive Sammlungssync und Manual Search."),
        ("04", "Batch-Sync", "Nur neue Treffer bleiben fuer den Sammelimport markiert und koennen gesammelt uebernommen werden."),
    ]
    markup = "".join(
        f"""
        <div class="workflow-card">
            <div class="workflow-label">Step {escape(step)}</div>
            <div class="workflow-step">{escape(title)}</div>
            <div class="workflow-copy">{escape(copy)}</div>
        </div>
        """
        for step, title, copy in cards
    )
    st.markdown(f'<div class="workflow-grid">{markup}</div>', unsafe_allow_html=True)


def _sync_discogs_identity(discogs_token: str) -> None:
    if not discogs_token:
        st.session_state.discogs_username = None
        st.session_state.collection_release_ids = set()
        st.session_state.active_discogs_token = ""
        return

    if discogs_token == st.session_state.active_discogs_token:
        return

    st.session_state.discogs_username = None
    st.session_state.collection_release_ids = set()
    st.session_state.active_discogs_token = discogs_token

    with st.spinner("Verbinde Discogs-Konto ..."):
        st.session_state.discogs_username = get_username()


def _render_sidebar() -> tuple[str, str, str]:
    with st.sidebar:
        st.markdown(
            """
            <div class="sidebar-card">
                <div class="workflow-label">Control Center</div>
                <div class="result-title">Verbindungen und Modelle</div>
                <div class="muted-copy">
                    Waehle deinen Vision-Stack, verbinde Discogs und starte den gesamten Ablauf von hier.
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("### Vision")
        vision_backend = st.radio(
            "Backend",
            options=["anthropic", "ollama"],
            format_func=lambda value: "Anthropic Claude" if value == "anthropic" else "Ollama lokal",
            horizontal=True,
            label_visibility="collapsed",
        )

        if vision_backend == "anthropic":
            anthropic_key = st.text_input(
                "Anthropic API Key",
                value=os.getenv("ANTHROPIC_API_KEY", ""),
                type="password",
                help="Schluessel aus der Anthropic Console.",
            ).strip()
            _set_env_var("ANTHROPIC_API_KEY", anthropic_key)
            vision_model = st.selectbox(
                "Vision-Modell",
                ANTHROPIC_MODELS,
                index=0,
                help="Opus liefert die staerkste Erkennung, Haiku ist meist am schnellsten.",
            )
            ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434").strip()
        else:
            ollama_url = st.text_input(
                "Ollama URL",
                value=os.getenv("OLLAMA_URL", "http://localhost:11434"),
                help="Beispiel: http://localhost:11434",
            ).strip()
            _set_env_var("OLLAMA_URL", ollama_url)
            vision_model = st.selectbox(
                "Vision-Modell",
                OLLAMA_MODELS,
                index=0,
                help="Das Modell muss vision-faehig und lokal installiert sein.",
            )
            custom_model = st.text_input(
                "Eigenes Modell",
                value="",
                placeholder="z.B. llava:34b",
            ).strip()
            if custom_model:
                vision_model = custom_model

        st.markdown("### Discogs")
        discogs_token = st.text_input(
            "Personal Access Token",
            value=os.getenv("DISCOGS_TOKEN", ""),
            type="password",
            help="Zu finden unter Discogs > Settings > Developers.",
        ).strip()
        _set_env_var("DISCOGS_TOKEN", discogs_token)
        _sync_discogs_identity(discogs_token)

        if discogs_token and st.session_state.discogs_username:
            st.success(f"Verbunden als **{st.session_state.discogs_username}**")
        elif discogs_token:
            st.error("Token ungueltig oder Discogs derzeit nicht erreichbar.")
        else:
            st.info("Lege einen Discogs-Token an, damit die Sammlung synchronisiert werden kann.")

        st.markdown("### Quick links")
        st.markdown(
            "[Discogs Token erstellen](https://www.discogs.com/settings/developers)\n\n"
            "[Anthropic API Keys](https://console.anthropic.com/account/keys)\n\n"
            "[Ollama herunterladen](https://ollama.com/download)"
        )

    return vision_backend, vision_model, ollama_url or "http://localhost:11434"


def _perform_analysis(uploaded_file, vision_backend: str, vision_model: str, ollama_url: str) -> None:
    image_bytes = uploaded_file.getvalue()
    backend_label = (
        f"Anthropic {vision_model}" if vision_backend == "anthropic" else f"Ollama {vision_model}"
    )

    with st.spinner(f"Analysiere das Bild mit {backend_label} ..."):
        identified = identify_cds_from_image(
            image_bytes,
            backend=vision_backend,
            model=vision_model,
            ollama_url=ollama_url,
        )

    if not identified:
        st.warning("Keine CDs erkannt. Ein naeheres oder schaerferes Foto liefert meist bessere Spine-Treffer.")
        return

    st.session_state.albums_identified = identified

    username = st.session_state.discogs_username
    collection_ids: set[int] = set()
    if username:
        with st.spinner("Lade bestehende Discogs-Sammlung ..."):
            collection_ids = get_collection_release_ids(username)

    results: list[dict] = []
    progress_bar = st.progress(0, text="Durchsuche Discogs ...")

    for idx, album in enumerate(identified):
        artist = album.get("artist", "")
        album_name = album.get("album", "")
        progress_bar.progress(
            (idx + 1) / len(identified),
            text=f"Discogs-Abgleich {idx + 1}/{len(identified)}: {artist} - {album_name}",
        )

        hit = search_release(artist, album_name)
        in_collection = bool(hit and hit["release_id"] in collection_ids)

        results.append(
            {
                "idx": idx,
                "include": bool(hit and not in_collection),
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
                "in_collection": in_collection,
                "manual_query": "",
                "status": "not_found" if not hit else ("in_collection" if in_collection else "new"),
            }
        )

        if idx < len(identified) - 1:
            time.sleep(1.1)

    progress_bar.empty()
    st.session_state.collection_release_ids = collection_ids
    st.session_state.search_results = results
    st.session_state.results_ready = True
    st.rerun()


def _render_upload_area(vision_backend: str, vision_model: str, ollama_url: str):
    _render_section(
        "01 · Fotoquelle",
        "Der Upload bleibt bewusst einfach: erst Bild laden, dann startet der Analysepfad mit den aktiven Python-Backends.",
    )

    upload_col, preview_col = st.columns([1.3, 0.9], gap="large")
    with upload_col:
        uploaded_file = st.file_uploader(
            "Foto hochladen",
            type=["jpg", "jpeg", "png", "webp"],
            label_visibility="collapsed",
        )
        st.caption("Ideal sind frontale Fotos von Ruecken oder klar sichtbaren Covers ohne starke Spiegelungen.")

    with preview_col:
        if uploaded_file:
            st.markdown('<div class="cover-frame">', unsafe_allow_html=True)
            st.image(uploaded_file, use_container_width=True)
            st.markdown("</div>", unsafe_allow_html=True)
        else:
            st.markdown(
                """
                <div class="empty-card">
                    <div class="empty-title">Bereit fuer den Upload</div>
                    <div class="muted-copy">
                        Sobald ein Bild geladen ist, erscheinen Analyse, Review und Sammelimport automatisch darunter.
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    if not uploaded_file:
        return None

    missing = []
    if vision_backend == "anthropic" and not os.getenv("ANTHROPIC_API_KEY"):
        missing.append("Anthropic API Key")
    if not os.getenv("DISCOGS_TOKEN"):
        missing.append("Discogs Token")

    with st.container(border=True):
        _render_section(
            "02 · Analyse anstossen",
            "Vision und Discogs werden sequenziell ausgefuehrt. Discogs bleibt dabei rate-limit-konform.",
        )
        if missing:
            st.warning(f"Vor dem Start fehlen noch: **{', '.join(missing)}**")
        else:
            if st.button("Analyse starten", type="primary"):
                _perform_analysis(uploaded_file, vision_backend, vision_model, ollama_url)

    return uploaded_file


def _render_result_card(row: dict, results: list[dict]) -> dict:
    status_label, status_class = _status_meta(row)

    with st.container(border=True):
        header_left, header_right = st.columns([1, 3], gap="large")
        with header_left:
            thumb = row.get("thumb_url") or row.get("cover_url") or ""
            if thumb:
                st.markdown('<div class="cover-frame">', unsafe_allow_html=True)
                st.image(thumb, use_container_width=True)
                st.markdown("</div>", unsafe_allow_html=True)
            else:
                st.markdown(
                    """
                    <div class="empty-card">
                        <div style="font-size:2rem;">💿</div>
                        <div class="muted-copy">Kein Cover verfuegbar</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

        with header_right:
            st.markdown(
                f'<span class="status-pill {status_class}">{escape(status_label)}</span>',
                unsafe_allow_html=True,
            )
            st.markdown(
                f"<div class='result-title'>{escape(row.get('recognized_artist') or 'Unbekannter Artist')} — {escape(row.get('recognized_album') or 'Unbekanntes Album')}</div>",
                unsafe_allow_html=True,
            )
            st.markdown(
                "<div class='result-subtitle'>Erkannten Datensatz pruefen, bei Bedarf korrigieren und optional in die Sammlung uebernehmen.</div>",
                unsafe_allow_html=True,
            )

            row["recognized_artist"] = st.text_input(
                "Artist",
                value=row["recognized_artist"],
                key=f"artist_{row['idx']}",
            )
            row["recognized_album"] = st.text_input(
                "Album",
                value=row["recognized_album"],
                key=f"album_{row['idx']}",
            )

            if row["found"]:
                match_copy = f"Discogs Artist: {row.get('discogs_artist') or 'unbekannt'}"
                if row.get("year"):
                    match_copy += f" · Jahr: {row['year']}"
                st.markdown(
                    f"""
                    <div class="match-card">
                        <div class="workflow-label">Discogs Treffer</div>
                        <strong>{escape(row['discogs_title'])}</strong>
                        <div class="muted-copy">{escape(match_copy)}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
            else:
                st.warning("Kein automatischer Discogs-Treffer. Hier kann direkt nachgesucht werden.")
                row["manual_query"] = st.text_input(
                    "Manuelle Suchanfrage",
                    value=row.get("manual_query", ""),
                    placeholder=f"{row['recognized_artist']} {row['recognized_album']}".strip(),
                    key=f"manual_query_{row['idx']}",
                )
                if st.button("Manuelle Suche ausfuehren", key=f"manual_search_{row['idx']}"):
                    query = row["manual_query"] or f"{row['recognized_artist']} {row['recognized_album']}"
                    with st.spinner("Suche in Discogs ..."):
                        hit = manual_search(query)
                    if hit:
                        in_collection = hit["release_id"] in st.session_state.collection_release_ids
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
                                "in_collection": in_collection,
                                "status": "in_collection" if in_collection else "new",
                                "include": not in_collection,
                            }
                        )
                        st.session_state.search_results = results
                        st.rerun()
                    st.error("Kein passender Treffer gefunden.")

            row["include"] = st.checkbox(
                "Fuer den Sammelimport vormerken",
                value=row["include"],
                key=f"include_{row['idx']}",
                disabled=row["status"] == "in_collection",
            )

            if st.button("Aus Review entfernen", key=f"remove_{row['idx']}"):
                st.session_state.search_results = [item for item in results if item["idx"] != row["idx"]]
                st.rerun()

    return row


def _render_results() -> None:
    results: list[dict] = st.session_state.search_results
    if not st.session_state.results_ready or not results:
        return

    _render_section(
        "03 · Review und Freigabe",
        "Statt einer starren Tabelle arbeitet das Review jetzt kartenzentriert: besser lesbar, mobil robuster und mit klaren Statussignalen.",
    )

    total = len(results)
    found = sum(1 for row in results if row["found"])
    ready = sum(1 for row in results if row["status"] == "new")
    in_collection = sum(1 for row in results if row["status"] == "in_collection")
    missing = sum(1 for row in results if row["status"] == "not_found")

    _render_stats(
        [
            ("Erkannt", str(total)),
            ("Discogs-Treffer", str(found)),
            ("Neu fuer Import", str(ready)),
            ("Schon vorhanden", str(in_collection)),
            ("Offene Nachsuche", str(missing)),
        ]
    )

    updated: list[dict] = []
    for row in results:
        updated.append(_render_result_card(row, results))

    st.session_state.search_results = updated

    to_add = [
        row
        for row in updated
        if row.get("include") and row.get("found") and row.get("status") != "in_collection"
    ]

    with st.container(border=True):
        _render_section(
            "04 · Sammlung synchronisieren",
            "Nur markierte, neue Releases gehen in den Batch-Import. Bereits vorhandene Treffer bleiben gesperrt und sichtbar.",
        )
        _render_stats(
            [
                ("Ausgewaehlt", str(len(to_add))),
                ("Automatisch gefunden", str(found)),
                ("Manuell offen", str(missing)),
            ]
        )

        username = st.session_state.discogs_username
        if not to_add:
            st.info("Aktuell ist nichts fuer den Import ausgewaehlt.")
        elif not username:
            st.error("Ohne gueltigen Discogs-Login kann der Batch nicht geschrieben werden.")
        else:
            st.markdown(
                f"""
                <div class="match-card">
                    <div class="workflow-label">Batch bereit</div>
                    <strong>{len(to_add)} Release(s)</strong>
                    <div class="muted-copy">Die markierten Treffer werden nacheinander und rate-limit-sicher nach Discogs uebernommen.</div>
                </div>
                """,
                unsafe_allow_html=True,
            )
            if st.button(f"{len(to_add)} Release(s) zu Discogs hinzufuegen", type="primary"):
                success_count = 0
                error_count = 0
                add_progress = st.progress(0, text="Schreibe Releases in die Sammlung ...")

                for index, album in enumerate(to_add):
                    release_id = album.get("release_id")
                    if release_id:
                        add_progress.progress(
                            (index + 1) / len(to_add),
                            text=f"Importiere {album['discogs_title']} ...",
                        )
                        ok = add_release_to_collection(username, int(release_id))
                        if ok:
                            success_count += 1
                            album["status"] = "in_collection"
                            album["in_collection"] = True
                            album["include"] = False
                        else:
                            error_count += 1
                        if index < len(to_add) - 1:
                            time.sleep(1.1)
                    else:
                        error_count += 1

                add_progress.empty()
                if success_count:
                    st.success(f"{success_count} Release(s) wurden erfolgreich nach Discogs geschrieben.")
                if error_count:
                    st.error(f"{error_count} Release(s) konnten nicht importiert werden.")
                st.session_state.search_results = updated
                st.rerun()

        if st.button("Neue Analyse starten"):
            for key, value in _DEFAULTS.items():
                st.session_state[key] = value
            st.rerun()


_render_shell()
vision_backend, vision_model, ollama_url = _render_sidebar()
_render_hero(vision_backend, vision_model)

_render_workflow()

with st.container(border=True):
    uploaded_file = _render_upload_area(vision_backend, vision_model, ollama_url)

_render_results()
