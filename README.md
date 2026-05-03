# 💿 Discify

**Discify** digitises your CD collection in seconds.
Photograph your CD shelf, let AI identify every album, review the results, and sync them directly to Discogs — optimised for smartphone and tablet.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Vite · React · TypeScript · TailwindCSS |
| Backend | Python · FastAPI · Uvicorn |
| Vision AI | Anthropic Claude · Ollama (local) |
| Collection | Discogs REST API |

```
discify/
├── backend/          ← FastAPI + vision logic
│   ├── main.py       ← REST API (runs on :8000)
│   ├── vision.py     ← Claude / Ollama image analysis
│   ├── discogs_helper.py
│   ├── settings.py   ← Persistent settings (settings.json)
│   └── requirements.txt
└── frontend/         ← Vite/React app
    └── src/
        ├── pages/    ← CollectionPage, ScanSheet, SettingsPage
        └── components/
```

---

## Features

- **Mobile-first UI** – Responsive grid, bottom navigation, floating action button
- **Camera Capture** – On smartphones/tablets the + button opens the device camera directly
- **AI Vision** – Anthropic Claude (cloud) or Ollama (self-hosted) identifies CDs from photos
- **Discogs Integration** – Auto-matches releases, shows cover art, checks your existing collection
- **Review & Edit** – Edit recognised artist/album names, run manual searches per item
- **Batch Add** – One tap to add all new releases to your Discogs collection
- **In-App Settings** – API keys configured in the Settings page, stored locally in `settings.json`

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:8000`.

### First-time setup

1. Open http://localhost:5173
2. Go to **Einstellungen** (Settings)
3. Enter your Anthropic API Key and/or Discogs Token
4. Press **Einstellungen speichern**

---

## Docker (Production)

```bash
# Copy and fill in .env
cp .env.example .env

# Build and run (app available at http://localhost:8000)
docker compose up --build
```

API keys can also be set via environment variables (`.env`).  
The `settings.json` volume persists in-app changes across container restarts.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (fallback, UI settings take precedence) |
| `DISCOGS_TOKEN` | Discogs Personal Access Token |
| `OLLAMA_URL` | Ollama base URL (default: `http://localhost:11434`) |

---

## Workflow

1. **Open app** → see your Discogs collection as a cover grid
2. **Tap +** → photograph or upload your CD shelf
3. **AI analyses** → each CD matched against Discogs
4. **Review** → edit names, run manual searches if needed
5. **Add** → one tap to sync all selected releases to Discogs
