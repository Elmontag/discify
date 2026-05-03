# 💿 Discify

**Discify** is a Streamlit web app that digitises your CD collection in seconds.
Upload a photo of your CD shelf or stack, let GPT-4o identify every album, and
add them all to your Discogs collection with one click.

---

## Features

- **AI Vision Engine** – GPT-4o analyses a photo of CD spines and extracts artist/album
  names, even from narrow spine labels.
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

Edit `.env` and fill in your keys:

| Variable | Where to get it |
|---|---|
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `DISCOGS_TOKEN` | [discogs.com/settings/developers](https://www.discogs.com/settings/developers) |

> **Never commit your `.env` file!** It is listed in `.gitignore`.

### 3. Run the app

```bash
streamlit run app.py
```

The app opens automatically at `http://localhost:8501`.

---

## User Journey

1. Open the app and enter your API keys in the sidebar (or via `.env`).
2. Upload a photo of your CD shelf / stack.
3. Click **▶ Analyse starten** – the app analyses the image and searches Discogs.
4. Review the table: correct artist/album names, remove false positives, or trigger
   **Manual Search** for unmatched entries.
5. Click **🎵 … CDs zur Sammlung hinzufügen** – done!

---

## Project structure

```
discify/
├── app.py              # Streamlit UI (main entry point)
├── vision.py           # OpenAI GPT-4o image analysis
├── discogs_helper.py   # Discogs REST API helpers
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variable template
└── .gitignore
```

---

## Requirements

- Python 3.10+
- An OpenAI account with access to `gpt-4o`
- A Discogs account with a Personal Access Token
