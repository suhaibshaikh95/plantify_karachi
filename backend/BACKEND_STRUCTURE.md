# Plantify Karachi — Backend Architecture & File Guide

This document explains the directory structure of `backend/` and what each file does, so you can quickly understand, maintain, or extend the Node.js API.

---

## Directory Structure

```text
backend/
├── BACKEND_STRUCTURE.md           # This guide: folder layout & explanation of every file
├── package.json                   # Node.js metadata, dependencies (express, cors), & scripts
├── server.js                      # Application entrypoint (CORS, static photos, routes, server boot)
├── src/
│   ├── config/
│   │   └── paths.js               # Centralized file paths to data JSONs, photos, & ML artifacts
│   ├── data/
│   │   └── store.js               # Loads JSON data & model schemas into memory at startup
│   ├── services/
│   │   ├── geoService.js          # Haversine distance calculation & nearest Karachi site lookup
│   │   ├── hybridEngine.js        # Salinity logic, Stage 1 rule filter, Stage 2 scoring & photo enrichment
│   │   └── mlPredictor.js         # Builds 66-column feature vectors & manages XGBoost worker process
│   ├── ml/
│   │   ├── predict.py             # Python worker that loads plantify_model.joblib & returns probabilities
│   │   └── requirements.txt       # Python ML dependencies (joblib, numpy, scikit-learn, xgboost)
│   └── routes/
│       └── apiRoutes.js           # Express router implementing all 7 Phase-1 endpoints (+ /api/chat stub)
└── assets/
    ├── data/
    │   ├── sites.json             # 104 Karachi reference sites (GPS, pH, temp, salinity, soil traits)
    │   ├── plants.json            # 85 Karachi plant species profiles & suitability limits
    │   ├── photos.json            # Photo manifest mapping scientific_name -> image, artist, license
    │   └── photos/                # 85 Creative Commons .jpg images served at /static/photos
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
| `src/services/mlPredictor.js` | Builds the exact **66-column feature vector** per plant using `schema.json` + `feature_columns.json` (`-1` imputation for `null` traits, `site_` one-hot prefix) and communicates with `predict.py` over JSON lines (with graceful fallback to Stage 2 rule scores if Python ML packages aren't installed). |
| `src/ml/predict.py` | Lightweight Python worker that loads `plantify_model.joblib` once into memory (`--serve` mode) and computes batch `predict_proba()` probabilities in milliseconds. |
| `src/ml/requirements.txt` | Lists the minimal Python packages (`joblib`, `numpy`, `scikit-learn`, `xgboost`) used inside `backend/.venv` to run `plantify_model.joblib`. |

### HTTP Routes (`backend/src/routes/`)
| File | What It Does |
| :--- | :--- |
| `src/routes/apiRoutes.js` | Defines all REST endpoints:<br>• `GET /api/health` — Server & model readiness check<br>• `GET /api/sites` — Returns all 104 Karachi sites<br>• `POST /api/nearest-site` — Finds nearest site from `{ lat, lon }`<br>• `GET /api/plants` — Returns all 85 plants with photo URLs & credits<br>• `GET /api/model/info` — Returns training metrics, schema, & 66 feature names<br>• `POST /api/recommend` — Validates inputs and returns Top 6 plants + excluded plants<br>• `POST /api/chat` — `501` stub (pending Phase 2 chatbot) |

---

## How to Run & Test

```bash
cd backend
npm install
npm start
```

Server starts at `http://localhost:8000` (override with `PORT=...`).  
*(Note: To run `plantify_model.joblib` live instead of rule-score fallback, ensure a Python environment with `joblib`, `xgboost`, and `numpy` is available via `PYTHON_BIN=/path/to/python` or in PATH).*

