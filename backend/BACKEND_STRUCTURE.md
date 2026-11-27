# Plantify Karachi — Backend Architecture & File Guide

This document explains the directory structure of `backend/` and what each file does, so you can quickly understand, maintain, or extend the Node.js API.

---

## Directory Structure

```text
backend/
├── BACKEND_STRUCTURE.md           # This guide: folder layout & explanation of every file
├── package.json                   # Node.js metadata, dependencies (express, cors, @google/genai), & scripts
├── .env.example                   # Settings to copy into .env (GEMINI_API_KEY, GEMINI_MODEL, PORT, PYTHON_BIN)
├── server.js                      # Application entrypoint (CORS, static photos, routes, ML + chat workers, boot)
├── src/
│   ├── config/
│   │   └── paths.js               # Centralized file paths to data JSONs, photos, & ML artifacts
│   ├── data/
│   │   └── store.js               # Loads JSON data & model schemas into memory at startup
│   ├── services/
│   │   ├── geoService.js          # Haversine distance calculation & nearest Karachi site lookup
│   │   ├── hybridEngine.js        # Salinity logic, Stage 1 rule filter, Stage 2 scoring & photo enrichment
│   │   ├── mlPredictor.js         # Builds 66-column feature vectors & manages XGBoost worker process
│   │   ├── ragRetriever.js        # Manages the chat retrieval worker (rag_worker.py) over JSON lines
│   │   └── chatService.js         # Chat assistant: retrieval + user context + Gemini answer + fallbacks
│   ├── ml/
│   │   ├── predict.py             # Python worker that loads plantify_model.joblib & returns probabilities
│   │   ├── build_index.py         # Builds the chat knowledge base: passages.jsonl + FAISS index
│   │   ├── rag_worker.py          # Python worker: embeds questions (BGE-small) & searches the FAISS index
│   │   └── requirements.txt       # Python dependencies (joblib, numpy, scikit-learn, xgboost,
│   │                              #   sentence-transformers, faiss-cpu)
│   └── routes/
│       └── apiRoutes.js           # Express router implementing all 7 endpoints (incl. POST /api/chat)
├── scripts/
│   └── eval_chat.js               # Asks the running API 20 fixed questions; saves tests/chat_eval_results.md
├── tests/
│   ├── chat.test.js               # node:test tests of the chat service with a mocked Gemini
│   └── chat_eval_results*.md      # Output of eval_chat.js (with Gemini / "_no_llm" without a key)
└── assets/
    ├── data/
    │   ├── sites.json             # 104 Karachi reference sites (GPS, pH, temp, salinity, soil traits)
    │   ├── plants.json            # 85 Karachi plant species profiles & suitability limits
    │   ├── photos.json            # Photo manifest mapping scientific_name -> image, artist, license
    │   └── photos/                # 85 Creative Commons .jpg images served at /static/photos
    ├── knowledge/                 # Chat assistant knowledge base (RAG)
    │   ├── karachi_planting_guide.md  # Supervisor's planting guide (plain-language version)
    │   ├── Karachi-Planting-Guide.pdf # Original PDF (not used by the index)
    │   ├── project_faq.md         # "How Plantify works" Q&A, written from the project's own docs
    │   ├── passages.jsonl         # 213 passages: 85 plants, 104 sites, 12 guide, 12 FAQ (generated)
    │   ├── index.faiss            # FAISS IndexFlatIP of BGE-small embeddings, one row per passage (generated)
    │   └── index_meta.json        # Model name, dimension, counts, build time (generated)
    └── model/
        ├── schema.json            # Source of truth for feature groups & categorical columns
        ├── feature_columns.json   # Exact 66-column order expected by plantify_model.joblib
        ├── metrics.json           # Evaluation metrics (accuracy, F1, ROC-AUC, Top-6 overlap)
        └── plantify_model.joblib  # Trained XGBoost binary classifier (v2.4)
```

---

## File-by-File Explanation

### Root Files (`backend/`)
| File | What It Does |
| :--- | :--- |
| `server.js` | Boots the Express server, configures CORS for React (`localhost:5173` / `localhost:3000`), serves `assets/data/photos/` at `/static/photos`, mounts `/api` routes, warms up the ML worker, and handles JSON errors. |
| `package.json` | Defines the Node.js project (`express`, `cors`) and run commands (`npm start`, `npm run dev`). |
| `BACKEND_STRUCTURE.md` | Documentation of the backend layout and each module's responsibility. |

### Configuration & Data Loading (`backend/src/config/`, `backend/src/data/`)
| File | What It Does |
| :--- | :--- |
| `src/config/paths.js` | Resolves absolute file paths to `assets/data/*`, `assets/model/*`, and `src/ml/predict.py` so no relative path breaks. |
| `src/data/store.js` | Reads `sites.json`, `plants.json`, `photos.json`, `schema.json`, `feature_columns.json`, and `metrics.json` once at startup and builds fast lookup maps (`sitesById`, `plantsBySciName`). |

### Core Business Logic & ML Inference (`backend/src/services/`, `backend/src/ml/`)
| File | What It Does |
| :--- | :--- |
| `src/services/geoService.js` | Implements `haversineKm()` and `findNearestSite()` to match any `(lat, lon)` coordinate from photo EXIF, GPS, or map pin drop to the closest of the 104 Karachi sites. |
| `src/services/hybridEngine.js` | Runs the core recommendation pipeline: computes effective `site_salinity` from `salt_signs`, runs **Stage 1** deterministic safety/environmental exclusions (`do_not_plant`, `poisonous`, `salinity`, `ph`, `temperature`, `water`, `space`), calculates explainability `sub` scores (`0–100`), invokes Stage 2 ML predictions, ranks Top 6 plants, and attaches `traits` + `photo` URLs/credits. |
| `src/services/ragRetriever.js` | Starts `rag_worker.py` with the server and sends it `{ question, k, plants, site_id }` over JSON lines; returns the top passages, or `[]` if the worker is unavailable (10 s timeout per request). |
| `src/services/chatService.js` | The RAG chat assistant. Retrieves the 6 most similar passages, adds the user's live context (site profile from `site_id`, top-6 plants and excluded plants with reasons from the optional `recommendation` object), and asks Gemini (`@google/genai`, temperature 0.2, last 6 history turns) to answer only from them and name its sources. Declines off-topic questions. If there is no API key, Gemini fails or it takes over 15 s, it returns the best passage (or the user's exclusion reason) with a note; it never returns a 500. |
| `src/services/mlPredictor.js` | Builds the exact **66-column feature vector** per plant using `schema.json` + `feature_columns.json` (`-1` imputation for `null` traits, `site_` one-hot prefix) and communicates with `predict.py` over JSON lines (with graceful fallback to Stage 2 rule scores if Python ML packages aren't installed). |
| `src/ml/predict.py` | Lightweight Python worker that loads `plantify_model.joblib` once into memory (`--serve` mode) and computes batch `predict_proba()` probabilities in milliseconds. |
| `src/ml/build_index.py` | Turns `plants.json`, `sites.json`, `karachi_planting_guide.md` (split by `## ` sections, long ones further split) and `project_faq.md` into 80–200-word passages with metadata (id, source_type, title, scientific_name / site_id), embeds them with `BAAI/bge-small-en-v1.5` (normalized) and saves `passages.jsonl` + `index.faiss`. Null traits are written as "unknown"; estimated traits are flagged. Run with `npm run build:knowledge`. |
| `src/ml/rag_worker.py` | Long-running retrieval worker (`--serve`, JSON lines, like `predict.py`). Loads BGE-small and the index once; embeds each question with the BGE query instruction; boosts passages about the user's plants (+0.05), their site (+0.05) and plants named in the question (+0.06); keeps at most 4 plant passages and 1 other-site passage; returns the top k with similarity scores. |
| `src/ml/requirements.txt` | Lists the minimal Python packages (`joblib`, `numpy`, `scikit-learn`, `xgboost`) used inside `backend/.venv` to run `plantify_model.joblib`. |

### HTTP Routes (`backend/src/routes/`)
| File | What It Does |
| :--- | :--- |
| `src/routes/apiRoutes.js` | Defines all REST endpoints:<br>• `GET /api/health` — Server & model readiness check<br>• `GET /api/sites` — Returns all 104 Karachi sites<br>• `POST /api/nearest-site` — Finds nearest site from `{ lat, lon }`<br>• `GET /api/plants` — Returns all 85 plants with photo URLs & credits<br>• `GET /api/model/info` — Returns training metrics, schema, & 66 feature names<br>• `POST /api/recommend` — Validates inputs and returns Top 6 plants + excluded plants<br>• `POST /api/chat` — RAG chat assistant: `{ question, site_id?, plants?, history?, recommendation? }` → `{ answer, source, sources, mode }` |

---

## How to Run & Test

```bash
cd backend
npm install
pip install -r src/ml/requirements.txt   # Python packages for the model and the chat retrieval
cp .env.example .env                     # then put your GEMINI_API_KEY in .env
npm start
```

Server starts at `http://localhost:8000` (override with `PORT=...`). The startup log and `GET /api/health`
show the state of each part: `model_ready` (XGBoost), `rag_ready` (chat retrieval), `gemini_configured`.
If Python or a package is missing, recommendations fall back to rule scores and chat to the best passage.

### Chat knowledge base

`assets/knowledge/passages.jsonl` and `index.faiss` are committed, so the chat works after `npm install`.
Rebuild them whenever `plants.json`, `sites.json`, `karachi_planting_guide.md` or `project_faq.md` change:

```bash
npm run build:knowledge
```

It prints how many passages came from each source. The first run downloads `BAAI/bge-small-en-v1.5`
(about 130 MB) from Hugging Face; later runs use the local cache.

### Tests

```bash
npm test             # chat service tests with a mocked Gemini (no network, no key)
npm run eval:chat    # with the server running: 20 fixed questions -> tests/chat_eval_results.md
```

