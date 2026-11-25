# Contract Implementation Plan (Node.js + React)

## Goal
Build the **Node.js (Express)** backend implementing all **7 Phase-1 endpoints** required by the React frontend, using the template, schema, dataset, plant photos, and trained XGBoost model located in:

> **Template & Resource Folder**:  
> `/Users/mac/Desktop/plantify-FYP1/backend_imp_temp/plantify_backend_handoff`

---

## 1. Template & Resource Files (`plantify_backend_handoff/`)

| File / Folder | Used By | Purpose |
| :--- | :--- | :--- |
| `API_CONTRACT.md` | Reference | Full REST API contract & JSON schemas |
| `schema.json` | `POST /api/recommend` | Defines `site_features` (10), `user_features` (6), `plant_features` (33), `categorical_features` (7), and `id_columns_not_features` |
| `feature_columns.json` | `POST /api/recommend`, `GET /api/model/info` | Exact **66-column feature order** expected by `plantify_model.joblib` |
| `plantify_model.joblib` | `POST /api/recommend` | Trained XGBoost classifier (`v2.4`) |
| `metrics.json` | `GET /api/model/info` | Model evaluation metrics (accuracy, F1, ROC-AUC, Top-6 overlap) |
| `data/sites.json` | `GET /api/sites`, `POST /api/nearest-site`, `POST /api/recommend` | 104 Karachi reference sites with GPS, pH, temperature, salinity, texture, drainage, fertility |
| `data/plants.json` | `GET /api/plants`, `POST /api/recommend` | 85 Karachi plant species profiles & traits |
| `data/photos.json` | `GET /api/plants`, `POST /api/recommend` | Maps `scientific_name` → image path, photographer (`artist`), `license`, `source_page` |
| `data/photos/` | `GET /static/photos/:filename` | 85 Creative Commons `.jpg` plant photos |

---

## 2. Step-by-Step Implementation Plan

### Step 1: Server Bootstrap, CORS & Static Photos
- Initialize a Node.js Express server with `cors` enabled for React (`http://localhost:5173`, `http://localhost:3000`).
- Load `data/sites.json`, `data/plants.json`, `data/photos.json`, `schema.json`, `feature_columns.json`, and `metrics.json` into memory at startup.
- Serve plant photos statically at `/static/photos`:
  ```js
  app.use('/static/photos', express.static(path.join(HANDOFF_DIR, 'data/photos')));
  ```

---

### Step 2: Implement Core Read & Location Endpoints
1. **`GET /api/health`** ✅
   - Return `{ status: "ok", service: "plantify-karachi-api", model_ready: true, sites_count: 104, plants_count: 85 }`.
2. **`GET /api/sites`** ✅
   - Return the 104 Karachi reference site objects from `data/sites.json`.
3. **`POST /api/nearest-site`** ✅
   - Validate `{ lat, lon }`.
   - Compute Haversine distance (km) against all 104 sites in `data/sites.json`.
   - Return `{ site, distance_km }`.
4. **`GET /api/plants`** ✅
   - Return all 85 species from `data/plants.json`, enriching each plant with its `photo` object (`{ url, artist, license, source_page }`) from `data/photos.json`.
5. **`GET /api/model/info`** ✅
   - Return `metrics.json` + `feature_columns.json` count & list.

---

### Step 3: Implement Hybrid Recommendation Engine (`POST /api/recommend`) ✅
When React sends `{ site_id, lat, lon, salt_signs, site_salinity, water_days, space, care, purpose, children_or_animals, budget }`:

1. **Resolve Site & Effective Salinity**:
   - Look up `site` by `site_id` (or nearest `(lat, lon)` if `site_id` is omitted).
   - Compute `site_salinity` (`0 = Low`, `1 = Medium`, `2 = High`) from `site.site_salinity_default` + `salt_signs` (`crust`, `borewell`, `burnt`, `sea`):
     - Never lower than `site_salinity_default`.
     - Any `true` raises to at least `1`; 3 `true`s (or 2 `true`s when `site_salinity_default >= 1`) raises to `2`.
2. **Stage 1 — Deterministic Safety & Hard-Constraint Filter (Node.js)**:
   - Loop over all 85 plants and exclude any plant failing:
     - `do_not_plant === 1` → `code: "do_not_plant"`
     - `children_or_animals === 1 && poisonous === 1` → `code: "poisonous"`
     - `site_salinity > salt_tolerance` → `code: "salinity"`
     - `site.ph > ph_abs_max + 1.0 || site.ph < ph_abs_min - 1.0` → `code: "ph"`
     - `site.t_coldest_month < temp_abs_min - 3.0 || site.t_hottest_month > temp_abs_max + 3.0` → `code: "temperature"`
     - `water_days < need - 1` (`water_need`: `1→1`, `3→3`, `5→7`) → `code: "water"`
     - `needs_large_space === 1 && space !== "large"` → `code: "space"`
   - Record each removed plant in `excluded` with `{ scientific_name, common_name, code, reason }`.
3. **Stage 2 — XGBoost Inference (`plantify_model.joblib`)**:
   - For the remaining eligible plants, build one feature row per plant:
     - Combine 10 `site_features` + 6 `user_features` + 33 `plant_features` (compute `purpose_match`).
     - Replace `null` / `undefined` traits with `-1`.
     - One-hot encode the 7 `categorical_features` with the `site_` prefix (e.g., `site_space_medium = 1`).
     - Order strictly to the **66 columns** in `feature_columns.json` (never pass `id_columns_not_features`).
   - Run batch `predict_proba` via `plantify_model.joblib` (Python inference worker or ONNX export) to get `probability` (`0.0–1.0`).
   - Sort eligible plants descending by `probability` and take the **Top 6**.
4. **Enrich Response for React (Photos + Traits + Sub-scores)**:
   - Attach `photo` (`url: "/static/photos/<file>.jpg"`, `artist`, `license`, `source_page`) from `data/photos.json`, `traits`, `score` (`0–100`), and `sub` breakdown to each of the 6 recommended plants.

---

### Step 4: Deferred & Frontend-Only Features
- **`POST /api/chat`**: ⏳ **PENDING (Later)** — Team is working on the chatbot separately and will provide it later.
- **Real-time Weather / Climate**: 🚫 **FRONTEND ONLY** — Fetched directly on the React frontend via the **Google Weather API**.

---

## 3. Verification Plan
1. **Health & Static Assets**:
   - `GET /api/health` → `200 OK` (`model_ready: true`, `sites_count: 104`, `plants_count: 85`).
   - `GET /static/photos/azadirachta_indica.jpg` → `200 OK` (image loads).
2. **Sites & Nearest Site**:
   - `GET /api/sites` → returns 104 items.
   - `POST /api/nearest-site` with `{"lat": 24.9203, "lon": 67.0912}` → returns `Gulshan-e-Iqbal` and `distance_km`.
3. **Recommendations + Photos**:
   - `POST /api/recommend` with Gulshan-e-Iqbal + `water_days: 3`, `space: "medium"`, `care: "rarely"`, `purpose: "shade"`, `children_or_animals: 1`:
     - Returns 6 `recommendations` sorted descending by `probability`, each with `photo.url` and `traits`.
     - Returns `excluded` containing *Conocarpus* (`do_not_plant`) and *Oleander* (`poisonous`).
4. **CORS Check**:
   - Verify `Access-Control-Allow-Origin` allows the React dev server (`http://localhost:5173`).
