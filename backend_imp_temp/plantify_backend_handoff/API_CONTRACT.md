# Backend API Contract Plan (Node.js + React)

## Goal Description
Define the complete REST API contract required to convert the current `frontend/` UI into a **React** frontend backed by a **Node.js** backend. This specification is **folder-structure agnostic** and focuses purely on the endpoints, payloads, responsibilities, and React UI data requirements.

---

## Whole-Frontend Analysis (Screen-by-Screen)

Analyzing `frontend/index.html`, `app.js`, `api.js`, `engine.js`, `chat.js`, `exif.js`, `photos.js`, and `data/*.json` reveals 5 screens and their exact data dependencies:

| Screen | React View / Route | User Actions & UI Elements | Backend Dependency |
| :--- | :--- | :--- | :--- |
| **1. Welcome** | `/` or `/welcome` | Brand header, 3-step intro, dark mode toggle, "Get started" CTA, optional "Saved plan" / "Log in". | `GET /api/health` (optional warm-up check) |
| **2. Plot & Location** | `/location` | Upload plot photo (GPS EXIF extracted **in-browser** via `exif.js`; photo is not uploaded), "Use my current location" (browser Geolocation), Leaflet map pin drop, or select from 104 Karachi neighborhoods. | `GET /api/sites`<br>`POST /api/nearest-site` |
| **3. Site Questions** | `/questions` | 7 questions: 4 salt-sign toggles (`crust`, `borewell`, `burnt`, `sea`), `water_days` (`1, 2, 3, 5, 7`), `space`, `care`, `purpose`, `children_or_animals`, `budget`. | Client-side React state → submitted to `POST /api/recommend` |
| **4. Results** | `/results` | Site stats card (Salinity, Soil pH, Texture, Avg Temp), weather tip, filter chips (`Native`, `Low water`, `Low care`, `Shade`, `Fruit`, `Flowers`), Top 6 plant cards (photo + CC credit, match score/probability, tags, "Why this score" breakdown), "Not recommended" drawer with reasons, Save button. | `POST /api/recommend`<br>`GET /api/plants` *(optional/for catalog)*<br>Static/CDN photo assets |
| **5. Ask About a Plant** | `/chat` | Suggested quick questions + free-text Q&A about the 6 recommended plants with source citations. | `POST /api/chat` |

---

## Required Backend API Endpoints (Node.js)

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **What it is used for**:
  Allows the React app to verify that the Node.js API (and ML inference service, if connected) is online and ready.
- **Response (`200 OK`)**:
  ```json
  {
    "status": "ok",
    "service": "plantify-karachi-api",
    "model_ready": true
  }
  ```

---

### 2. Get All Karachi Reference Sites
- **Endpoint**: `GET /api/sites`
- **What it is used for**:
  Populates the **104 Karachi neighborhoods dropdown** and map reference points on **Screen 2 (Location)**. Each site object carries the mapped soil/climate metadata (`ph`, `t_mean`, `texture`, `site_salinity_default`, etc.) needed for **Screen 4 (Results)** stats.
- **Response (`200 OK`)**:
  ```json
  [
    {
      "site_id": 79,
      "area_name": "Gulshan-e-Iqbal",
      "town": "Gulshan",
      "label": "Gulshan-e-Iqbal",
      "lat": 24.9203,
      "lon": 67.0912,
      "ph": 8.1,
      "t_mean": 27.0,
      "t_hottest_month": 33.5,
      "t_coldest_month": 18.2,
      "site_salinity_default": 1,
      "sal_class_2016": 1,
      "site_type": "urban",
      "texture": "medium",
      "drainage": "well",
      "fertility": "medium",
      "industrial": 0
    }
  ]
  ```

---

### 3. Find Nearest Reference Site
- **Endpoint**: `POST /api/nearest-site`
- **What it is used for**:
  Used on **Screen 2 (Location)** whenever the user uploads a photo with GPS EXIF data, clicks **"Use my current location"**, or moves the **map pin**. Computes Haversine distance from `(lat, lon)` to all 104 Karachi reference sites and returns the closest site and distance in kilometers.
- **Request Body**:
  ```json
  {
    "lat": 24.9203,
    "lon": 67.0912
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "site": { "site_id": 79, "label": "Gulshan-e-Iqbal", "...": "..." },
    "distance_km": 1.8
  }
  ```

---

### 4. Get Plant Recommendations (Core Endpoint)
- **Endpoint**: `POST /api/recommend`
- **What it is used for**:
  Called when the user clicks **"Get my plants"** on **Screen 3 (Questions)** to render **Screen 4 (Results)**.
  In the backend, it:
  1. Computes effective `site_salinity` (`0 = Low`, `1 = Medium`, `2 = High`) from `site_salinity_default` + `salt_signs` (never lower than the map default; any "yes" raises to at least `1`; 3 "yes"s or 2 "yes"s on an already-saline site raises to `2`).
  2. Runs **Stage 1 (Safety & Environmental Rule Filter)** to exclude unsafe or incompatible plants (`do_not_plant`, `poisonous`, `salinity`, `ph`, `temperature`, `water`, `space`) with human-readable reasons.
  3. Runs **Stage 2 (ML / Scoring Ranker)** to rank eligible plants and return the **top 6** with match probability/score and sub-score breakdowns (`salt`, `water`, `temp`, `ph`, etc.) for the *"Why this score"* drawer.
- **Request Body**:
  ```json
  {
    "lat": 24.9203,
    "lon": 67.0912,
    "site_id": 79,
    "distance_km": 1.8,
    "salt_signs": {
      "crust": false,
      "borewell": true,
      "burnt": false,
      "sea": false
    },
    "site_salinity": 1,
    "water_days": 3,
    "space": "medium",
    "care": "rarely",
    "purpose": "shade",
    "purpose_answer": "shade",
    "children_or_animals": 1,
    "budget": "500_2000"
  }
  ```
  - **Field Values**:
    - `water_days`: `1 | 2 | 3 | 5 | 7`
    - `space`: `"small" | "medium" | "large"` *(Pot/balcony → `small`, Small yard → `medium`, Large open land → `large`)*
    - `care`: `"rarely" | "few_times_week" | "daily"` *(Low → `rarely`, Medium → `few_times_week`, High → `daily`)*
    - `purpose`: `"shade" | "fruit" | "ornamental" | "carbon" | "any"` *(Flowers/Hedge → `ornamental`, Greenery → `carbon`)*
    - `children_or_animals`: `0 | 1`

- **Response (`200 OK`)**:
  > [!IMPORTANT]
  > **Self-Contained Payload for React**: Include full display metadata (`common_name`, `native`, `water_need`, `low_maintenance`, `urban_heat_tolerant`, `purpose_*`, `form`, `photo`) directly inside each item in `recommendations` and `excluded` so React does not need a duplicate local copy of `plants.json` or `photos.json`.
  ```json
  {
    "source": "model",
    "site": { "site_id": 79, "label": "Gulshan-e-Iqbal", "ph": 8.1, "texture": "medium", "t_mean": 27.0 },
    "distance_km": 1.8,
    "site_salinity": 1,
    "recommendations": [
      {
        "scientific_name": "Azadirachta indica",
        "common_name": "Neem",
        "probability": 0.984,
        "score": 94.0,
        "sub": {
          "salt": 1.0,
          "water": 1.0,
          "temp": 1.0,
          "ph": 0.7
        },
        "traits": {
          "native": 1,
          "water_need": 1,
          "low_maintenance": 1,
          "urban_heat_tolerant": 1,
          "purpose_shade": 1,
          "purpose_fruit": 0,
          "purpose_ornamental": 0,
          "form": ["tree", "evergreen"]
        },
        "photo": {
          "url": "/static/photos/azadirachta_indica.jpg",
          "artist": "Photographer Name",
          "license": "CC BY-SA 4.0",
          "source_page": "https://www.inaturalist.org/..."
        }
      }
    ],
    "excluded": [
      {
        "scientific_name": "Conocarpus erectus",
        "common_name": "Buttonwood",
        "code": "do_not_plant",
        "reason": "On the city's do-not-plant list (banned invasive, pipe/root damage)"
      }
    ]
  }
  ```

---

### 5. Plant Care Q&A Chatbot
- **Endpoint**: `POST /api/chat`
- **What it is used for**:
  Powers **Screen 5 (Ask about a plant)**. Accepts the user's question along with the current site ID, the 6 recommended plant names, and recent chat history, and returns a grounded answer with a source citation.
- **Request Body**:
  ```json
  {
    "question": "How often should I water Neem in summer?",
    "site_id": 79,
    "plants": ["Azadirachta indica", "Pongamia pinnata"],
    "history": [
      { "who": "bot", "text": "Hi. I can answer questions about the 6 plants..." },
      { "who": "user", "text": "How often should I water Neem in summer?" }
    ]
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "answer": "For the first three months, water 2–3 times a week, early morning...",
    "source": "Karachi planting guide · Neem care"
  }
  ```

---

## Recommended Endpoints for React & Future Features

### 6. Get Full Plants Catalog *(Recommended for React)*
- **Endpoint**: `GET /api/plants`
- **What it is used for**:
  Returns all 85 plant species profiles (including traits and photo attribution). Useful if React has a plant browser/detail modal or client-side fallback without bundling static JSON.

### 7. Model Metrics & Viva Info *(Optional / Planned)*
- **Endpoint**: `GET /api/model/info`
- **What it is used for**:
  Powers a Model Evaluation / Viva Defense view in React showing XGBoost vs. Random Forest accuracy, F1-score, Top-6 overlap, and top feature importances.

### 8. Static Plant Photos Hosting *(Recommended for React)*
- **Endpoint**: `GET /static/photos/:filename` *(or served via CDN / public folder)*
- **What it is used for**:
  Serves the 85 local Creative Commons plant `.jpg` images (`azadirachta_indica.jpg`, etc.) referenced in `/api/recommend` so cards render species photos with photographer/license credits.

### 9. Weather Tip *(Client-Side or Optional Backend Proxy)*
- Currently fetched directly by the browser from Open-Meteo (`https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&daily=temperature_2m_max,precipitation_sum,precipitation_probability_max&timezone=Asia/Karachi&forecast_days=1`). React can keep calling Open-Meteo directly or optionally proxy it through `GET /api/weather?lat=...&lon=...`.

---

## React Conversion & Node.js Integration Notes

> [!NOTE]
> **Ensuring Smooth React + Node.js Integration**:
> 1. **CORS**: Enable `cors` in Node.js for your React dev server (`http://localhost:5173` for Vite or `http://localhost:3000` for CRA/Next) and production domain.
> 2. **ML Inference from Node.js**: Since the trained model (`plantify_model.joblib`) is an XGBoost Python artifact, your Node.js backend will either:
>    - Invoke a lightweight Python inference script/microservice for `POST /api/recommend`, **or**
>    - Export the XGBoost model to **ONNX** (`onnxruntime-node`) / JSON trees so Node.js can run `predict_proba` natively in-process.
> 3. **Client-Side Features to Keep in React**:
>    - **EXIF GPS Parsing**: Keep JPEG GPS extraction in the browser (e.g., `exifr` in React) so raw plot photos never need to be uploaded.
>    - **Client-Side Filter Chips**: Filtering the 6 recommended plants by `Native`, `Low water`, `Low care`, `Shade`, `Fruit`, `Flowers` happens instantly in React state using `traits` from `/api/recommend`.
>    - **State Persistence**: Keep `sessionStorage` for multi-step form progress and `localStorage` for "Saved plan" (unless you later add user login + database persistence).

---

## Files to Copy & How to Use the Schemas (Prevents AI / Code Hallucinations)

Yes — copying the **schema** and **data/model files** alongside this API contract is the best way to make backend development fast and prevent an AI assistant or developer from guessing field names, categorical values, or model feature ordering.

### Which Files to Copy to the Backend Repo
1. **`training_dataset/training_data/plantify_dataset_v2.4/schema.json`** — The single source of truth for feature groups (`site_features`, `user_features`, `plant_features`, `categorical_features`) and excluded ID columns.
2. **`training_dataset/outputs/outputs_v2.4/feature_columns.json`** — The **exact 66-column feature vector order** expected by the trained XGBoost model.
3. **`training_dataset/outputs/outputs_v2.4/plantify_model.joblib`** — The trained XGBoost model artifact.
4. **`frontend/data/sites.json`** — All 104 Karachi reference sites (used by `GET /api/sites` and `POST /api/nearest-site`).
5. **`frontend/data/plants.json`** — All 85 plant profiles and traits (used by `POST /api/recommend` and `GET /api/plants`).
6. **`frontend/data/photos.json`** *(and `frontend/data/photos/`)* — Species photo paths and Creative Commons credits.

### How to Use `schema.json` and `feature_columns.json` in `POST /api/recommend`
When building the 66-feature input vector $X$ for a `(site, user_request, plant)` row:
1. **Combine base fields**:
   - Take the 10 `site_features` from the matched site in `sites.json`.
   - Take the 6 `user_features` (`site_salinity`, `water_days`, `space`, `care`, `purpose`, `children_or_animals`) from the request.
   - Take the 33 `plant_features` from `plants.json`, computing `purpose_match` (`1` if `purpose == "any"` or the plant's `purpose_<purpose> == 1`, else `0`).
2. **Impute missing values with `-1`**:
   - Some plant traits in `plants.json` can be `null` (e.g., `pollution_tolerance`, `urban_heat_tolerant`, `low_maintenance`). Replace `null` / `undefined` with **`-1`** (never drop rows).
3. **One-hot encode the 7 `categorical_features` with the `site_` prefix**:
   - `site_type`, `texture`, `drainage`, `fertility`, `space`, `care`, `purpose` must be encoded as `site_<column>_<value>` (e.g., `site_space_medium = 1`, `site_care_rarely = 1`, `site_purpose_shade = 1`).
4. **Align strictly to `feature_columns.json`**:
   - Reindex / order the final array to match the **exact 66 keys** in `feature_columns.json` before calling `predict_proba` (with any unseen one-hot column set to `0`).
5. **Never pass `id_columns_not_features`**:
   - Exclude `scenario_id`, `site_id`, and `scientific_name` from the model input vector; keep `scientific_name` only for mapping predictions back to plant objects in the JSON response.
