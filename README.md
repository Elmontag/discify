# 💿 Discify

**Discify** is a Streamlit web app that digitises your CD collection in seconds.
Upload a photo of your CD shelf or stack, let an AI model identify every album, and
add them all to your Discogs collection with one click.

---

## Features

- **AI Vision Engine** – Supports **Anthropic Claude** (cloud) and **Ollama** (local/self-hosted).
  The model analyses a photo of CD spines and extracts artist/album names, even from narrow spine labels.
- **Discogs Search** – Each identified album is matched against the Discogs database,
  returning the best release with cover art and year.
- **Review Interface** – An editable table lets you correct misidentified albums, remove
  entries, or trigger a manual search for anything that wasn't found automatically.
- **One-Click Add** – Batch-add all selected albums to your Discogs collection.
- **Rate-Limit Aware** – Requests to the Discogs API are spaced at ≥ 1 second apart to
  stay within the 60 req/min limit.

---

## Setup

### 1. Clone & install dependencies

```bash
git clone https://github.com/Elmontag/discify.git
cd discify
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure API keys

```bash
cp .env.example .env
```

Edit `.env` and fill in the relevant keys:

| Variable | Required for | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic backend | [console.anthropic.com/account/keys](https://console.anthropic.com/account/keys) |
| `OLLAMA_URL` | Ollama backend | Default: `http://localhost:11434` |
| `DISCOGS_TOKEN` | Always | [discogs.com/settings/developers](https://www.discogs.com/settings/developers) |

> **Never commit your `.env` file!** It is listed in `.gitignore`.

### 3. (Optional) Set up Ollama

If you want to use a local model instead of Anthropic:

```bash
# Install Ollama: https://ollama.com/download
ollama pull llava          # recommended vision model
ollama serve               # starts the local server on :11434
```

### 4. Run the app

```bash
streamlit run app.py
```

The app opens automatically at `http://localhost:8501`.

---

## Vision Backends

| Backend | Models | Notes |
|---|---|---|
| **Anthropic** | `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-4-5`, … | Cloud API, best accuracy |
| **Ollama** | `llava`, `llava:13b`, `bakllava`, `moondream`, `gemma3`, … | Local/self-hosted, no data leaves your machine |

Switch backends and select the model directly in the sidebar of the app.

---

## User Journey

1. Open the app and enter your API keys in the sidebar (or via `.env`).
2. Choose your vision backend (Anthropic or Ollama) and model.
3. Upload a photo of your CD shelf / stack.
4. Click **▶ Analyse starten** – the app analyses the image and searches Discogs.
5. Review the table: correct artist/album names, remove false positives, or trigger
   **Manual Search** for unmatched entries.
6. Click **🎵 … CDs zur Sammlung hinzufügen** – done!

---

## Project structure

```
discify/
├── app.py              # Streamlit UI (main entry point)
├── vision.py           # Vision AI: Anthropic Claude + Ollama backends
├── discogs_helper.py   # Discogs REST API helpers
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variable template
└── .gitignore
```

---

## Requirements

- Python 3.10+
- A Discogs account with a Personal Access Token
- **Either** an Anthropic account (API key) **or** a local Ollama installation
