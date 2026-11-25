# Plantify Karachi — Web Frontend (Phase 3)

The mobile-first web app built from the **Plantify Karachi UI** design: five screens,
plain HTML/CSS/JS, no build step.

It is a responsive website: on phones it shows the mobile design; on laptops and desktops
(900px and wider) it switches to a full-width site header and two-column pages
(photo beside map, questions in two columns, results with a site-info sidebar and a grid of plant cards).

| # | Screen | Route | What it does |
|---|---|---|---|
| 1 | Welcome | `#/welcome` | Intro and the three steps |
| 2 | Photo & location | `#/location` | Photo upload (reads GPS from the photo), current location, map pin, or pick from the 104 reference areas |
| 3 | Site questions | `#/questions` | The 7 questions (salt signs, watering days, space, care, purpose, children/animals, budget) |
| 4 | Results | `#/results` | Top 6 plants with score, reason, tags, a "Why this score" breakdown, and every excluded plant with its reason |
| 5 | Ask about a plant | `#/chat` | Questions about the recommended plants |

## Run it

From the repository root:

```bash
python3 -m http.server 8000 --directory frontend
```

Then open http://localhost:8000. (Opening `index.html` directly as a file will not load the data;
use a local server.)

**It works without the backend.** If the FastAPI server is not running, the app uses
`engine.js`, a JavaScript copy of the rule engine that produced the training labels.
When the backend is running, the XGBoost probabilities are shown instead.

To point the app at a backend on another address, add `?api=`:

```
http://localhost:8000/?api=http://localhost:8001
```

If FastAPI serves the `frontend/` folder itself, no setting is needed (same origin).

## Files

| File | Purpose |
|---|---|
| `index.html` | All five screens |
| `style.css` | Styles (colours, type and spacing from the design) |
| `app.js` | Screen routing, form state, results, saving, chat UI |
| `api.js` | Backend client with automatic offline fallback |
| `engine.js` | Stage 1 rule filter + Stage 2 score, ported from `scripts/generate_training_data_v23.py` |
| `chat.js` | Plain-language reasons and the offline Q&A for the chat screen |
| `exif.js` | Reads GPS coordinates from a JPEG photo |
| `photos.js` | Shows each plant's photo with its credit (from `data/photos.json`) |
| `data/sites.json`, `data/plants.json` | Built from the v2.4 dataset |
| `data/photos/`, `data/photos.json` | One photo per plant, with photographer and licence |
| `scripts/build_data.py` | Rebuilds `data/sites.json` and `data/plants.json` — run after the CSVs change |
| `scripts/fetch_photos.py` | Downloads the plant photos from Wikipedia / Wikimedia Commons |
| `tests/engine_parity.test.js` | Checks `engine.js` against all 221,000 labelled training rows |

## Tests

```bash
node frontend/tests/engine_parity.test.js
```

Current result: **0 mismatches** in `suitable` and **0 mismatches** in `top6` over all
221,000 rows (2,600 scenarios), so the offline engine gives exactly the labels the model learned from.

## How answers map to the model

The model takes 6 user inputs (`schema.json` → `user_features`). The design's questions map to them like this:

| Question | Model input | Mapping |
|---|---|---|
| 1. Signs of salt (4 yes/no) | `site_salinity` (0/1/2) | Start from the site's map value (`site_salinity_default`, ISRIC 2026 projection). Any "yes" raises it to at least 1. Three "yes", or two "yes" on an already-saline site, raises it to 2. It never goes below the map value. |
| 2. Watering days | `water_days` | 1, 2, 3, 5, 7 as given |
| 3. Space | `space` | Pot / balcony → `small`, Small yard → `medium`, Large open land → `large` |
| 4. Care | `care` | Low → `rarely`, Medium → `few_times_week`, High → `daily` |
| 5. Purpose | `purpose` | Shade → `shade`, Fruit → `fruit`, Flowers → `ornamental`, Hedge → `ornamental`, Greenery → `carbon` |
| 6. Children or animals | `children_or_animals` | Yes → 1, No → 0 |
| 7. Budget | *(none)* | Sent to the API as `budget`, but the dataset has no price data, so it does not change results yet |

The photo is used only for its GPS location; it is not uploaded or analysed.

## API contract for the backend (Phase 2)

These match step 2.4 of `development_guide/PROJECT_DEVELOPMENT_GUIDE.md`. Enable CORS if the
frontend is served from a different address.

**`GET /api/health`** → any `200` JSON, e.g. `{"status": "ok"}`. The app calls this once to decide whether to use the backend.

**`GET /api/sites`** → the array in `data/sites.json` (same fields).

**`POST /api/nearest-site`** — body `{"lat": 24.92, "lon": 67.09}` →
`{"site": {<site object>}, "distance_km": 2.2}`

**`POST /api/recommend`** — body sent by the app:

```json
{
  "lat": 24.9203, "lon": 67.0912, "site_id": 79, "distance_km": 2.2,
  "salt_signs": {"crust": false, "borewell": true, "burnt": false, "sea": false},
  "site_salinity": 1,
  "water_days": 3, "space": "medium", "care": "rarely", "purpose": "shade",
  "purpose_answer": "shade", "children_or_animals": 1, "budget": "500_2000"
}
```

`site_salinity` is already worked out by the app (see the table above); the backend can use it directly.
Response:

```json
{
  "site": {<site object>},
  "distance_km": 2.2,
  "site_salinity": 1,
  "recommendations": [
    {"scientific_name": "Azadirachta indica", "probability": 0.984, "score": 94.0,
     "sub": {"salt": 1.0, "water": 1.0, "temp": 1.0, "ph": 0.7, "...": 1.0}}
  ],
  "excluded": [
    {"scientific_name": "Conocarpus erectus", "code": "do_not_plant", "reason": "do_not_plant: banned_invasive|root_damage"}
  ]
}
```

- `recommendations`: up to 6, best first. `probability` (0–1) from `predict_proba` is what the app shows. `score` and `sub` are optional; if missing, the app fills them in from its own rule engine.
- `excluded[].code` is one of `do_not_plant`, `poisonous`, `salinity`, `ph`, `temperature`, `water`, `space` (the app turns these into plain-language reasons).

**`POST /api/chat`** *(optional)* — body `{"question": "...", "site_id": 79, "plants": ["Azadirachta indica", ...], "history": [...]}` →
`{"answer": "...", "source": "Karachi planting guide · Neem care"}`.
If this endpoint does not exist, the chat screen answers from the species data instead.

## Plant photos

Each plant card shows a photo stored in the project (`data/photos/`), so photos work without
internet. All 85 plants have one. They come from [iNaturalist](https://www.inaturalist.org) and
were shared by their photographers under Creative Commons licences: CC0, CC BY or CC BY-SA where
available, otherwise CC BY-NC / CC BY-NC-SA, which allow non-commercial use such as this
university project. "All rights reserved" and no-derivatives photos are never used.
The photographer and licence of each photo are in `data/photos.json` and are shown under
"Why this score" on each card, as the licences require. If this app is ever used commercially,
replace the CC BY-NC photos.

Seven automatic picks were replaced by hand (`scripts/photo_overrides.json` holds the chosen
iNaturalist photo ids). To download the photos again (needs Pillow and internet):

```bash
pip install pillow
python3 frontend/scripts/fetch_photos.py --refresh
```

If it stops part-way, run it again without `--refresh`: it carries on with the plants that still
have no photo. To replace one photo, add its iNaturalist photo id to `scripts/photo_overrides.json`
(for example `{"Azadirachta indica": 46478533}`) and run
`python3 frontend/scripts/fetch_photos.py --only "Azadirachta indica"`.

## Outside services

- **Map:** Leaflet 1.9.4 (from unpkg) with OpenStreetMap tiles. If they can't load, the map hides and the area list still works.
- **Weather tip:** Open-Meteo forecast (free, no key). Hidden if it can't load.
- **Font:** Inter from Google Fonts, with a system-font fallback.

## Not built yet

- **Log in** (shown on the design's welcome screen): there is no account system yet. The welcome screen shows a "Saved plan" link instead when a result is saved on the device.
- **Model evaluation / viva tab** (guide step 3.6): needs `GET /api/model/info` from the backend.
- **AI chat:** the offline chat is keyword-based. Answers about planting time, fertiliser and pests are general advice and are labelled that way.
