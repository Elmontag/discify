# Discify – Copilot Instructions

## Architecture Overview

Discify is a CD-collection app with three sub-projects that work together:

```
discify/
├── backend/      # Python FastAPI – API + serves built frontend
├── frontend/     # React 19 / Vite / TailwindCSS v4 – web admin UI
└── mobile/       # Expo SDK 52 / React Native / NativeWind v4 – primary user app
```

**Request flows:**
- Mobile → `POST /api/scan` (JWT required) → backend proxies to Anthropic Claude
- Mobile → Discogs REST API **directly** (no backend proxy)
- Mobile → Ollama **directly** (user's own server, optional)
- Web frontend → backend API (settings management, health check)
- Docker: multi-stage build (Python deps + `npm run build`) → single image; backend serves `frontend/dist/` at `/`

**Anthropic key is server-side only.** It must never appear in the mobile bundle – the `/api/scan` endpoint is the proxy. Ollama and Discogs can be called directly from the app.

## Commands

### Backend
```bash
# Dev server (from repo root)
cd backend && uvicorn main:app --reload --port 8000

# Or via Docker
docker-compose up --build
```

### Frontend
```bash
cd frontend
npm run dev        # dev server on :5173
npm run build      # tsc -b && vite build → dist/
npm run lint       # eslint
```

### Mobile
```bash
cd mobile
npx expo start              # local (requires port 8081 open in firewall)
npx expo start --tunnel     # via ngrok (works on all networks, preferred for device testing)
npx expo start --android    # open in connected Android emulator/device
```

> Physical device testing: set `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000` in `mobile/.env`. The device and dev machine must be on the same network.

## Settings & Configuration

Settings are managed through a layered system in `backend/settings.py`:

1. **Defaults** (hardcoded)
2. **`backend/settings.json`** (user-saved via UI, gitignored)
3. **Environment variables WIN** – `ANTHROPIC_API_KEY`, `DISCOGS_TOKEN`, `OLLAMA_URL`

Layer 3 always overrides layers 1–2. This means Docker/server deployments using env vars are never overridden by a stale `settings.json`. **Do not add `backend/settings.json` as a Docker volume mount** – if the file doesn't exist on the host, Docker creates a directory, breaking reads/writes.

Copy `.env.example` → `.env` for local Docker deployments.

## Key Conventions

### Backend (Python)
- Password hash format: `pbkdf2:{salt_hex}:{dk_hex}` (PBKDF2-SHA256, 260 000 iterations). No `passlib`/`bcrypt` – they crash on Python 3.12.
- JWT: HS256, 30-day expiry. Set a stable `JWT_SECRET` env var – if absent it's auto-generated at startup, invalidating all tokens on container restart.
- Scan tiers enforced in `main.py`: `free=5`, `basic=50`, `pro=-1` (unlimited) per calendar month. Monthly counter resets automatically on next scan in a new month.
- User-facing error messages in `main.py` are in German (`detail='Ungültige E-Mail-Adresse.'`).
- `vision.identify_cds_from_image()` always returns `list[{"artist": str, "album": str}]`.
- `/auth/login` uses OAuth2 `application/x-www-form-urlencoded` (FastAPI `OAuth2PasswordRequestForm`), not JSON.
- Supported Anthropic models: `claude-sonnet-4-6` (default), `claude-haiku-4-6` – defined in `vision.ANTHROPIC_MODELS`.

### Mobile (Expo / React Native)
- Env vars for the Expo client **must** use the `EXPO_PUBLIC_` prefix (e.g. `EXPO_PUBLIC_API_URL`).
- JWT is stored in `expo-secure-store` under the key `auth_token`. All API calls in `src/services/api.ts` inject it automatically.
- Use the **synchronous** `expo-sqlite` API (SDK 52+): `openDatabaseSync`, `execSync`, `getAllSync<T>()`, `runSync`, `getFirstSync<T>()`. The old callback-based API is not used.
- NativeWind v4 setup: `nativewind/babel` preset in `babel.config.js`, `nativewind/metro` in `metro.config.js`, `nativewind/preset` in `tailwind.config.js`, `global.css` imported in `App.tsx`.
- Camera: use `CameraView` + `useCameraPermissions` from `expo-camera` (new SDK 52 API).
- Images are compressed to max 1200 px wide JPEG via `expo-image-manipulator` before upload.
- ScanScreen state machine: `camera → preview → scanning → results → done`.
- `babel-preset-expo` is pinned to `~54.0.10` to match Expo SDK 52.

### Frontend (React / Vite)
- TailwindCSS v4 (via `@tailwindcss/vite` plugin – no `tailwind.config.js` needed).
- API keys from env vars are shown as a green read-only banner in `SettingsPage.tsx`, not an editable input.

## Gitignored Runtime Files
- `backend/settings.json` – API keys saved via UI
- `backend/users.db` – SQLite user database
- `mobile/.env` – local Expo env vars
- `frontend/dist/`, `frontend/node_modules/`, `mobile/node_modules/`
