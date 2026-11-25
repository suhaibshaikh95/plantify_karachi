# How the frontend uses the backend API

The React app talks to the Node.js backend in [`backend/`](../../backend) (Express, default port **8000**).
The frontend makes **no recommendation decisions**: site lookup, salinity, the rule filter, the
XGBoost ranking and the exclusions all happen in the backend. The frontend only sends the user's
input and turns the response into labels and text (`src/services/recommendationMapper.js`).

All calls go through `src/services/plantifyApi.js`. Errors come back as `{ "error": "message" }`
and the app shows that message.

| Endpoint | Used by | Purpose |
|---|---|---|
| `GET /api/sites` | Location page, "choose your area" list | The 104 Karachi reference sites |
| `POST /api/nearest-site` | Location page (photo GPS, current location, map pin) | Nearest site to a point |
| `POST /api/recommend` | Results page | Top 6 plants + excluded plants |
| `POST /api/chat` | Chat page | Answer a question (backend returns `501` for now) |
| `GET /static/photos/<file>` | Plant cards | Plant photos (URL comes in each plant's `photo.url`) |

Not used by the frontend yet: `GET /api/health`, `GET /api/plants`, `GET /api/model/info`.

---

## `GET /api/sites`

Response: an array of sites. The app uses `site_id`, `label`, `town`, `lat`, `lon`.

```json
[{ "site_id": 77, "label": "Safari Park, Main University Rd, Gulshan-e-Iqbal", "town": "Gulshan Iqbal", "lat": 24.92, "lon": 67.09, "...": "..." }]
```

## `POST /api/nearest-site`

Request `{ "lat": 24.9203, "lon": 67.0912 }` → response `{ "site": { …site… }, "distance_km": 2.2 }`.

The backend returns the nearest site even for points far outside Karachi. The app warns the user
when `distance_km` is over 15 km.

## `POST /api/recommend`

Request sent by the app:

```json
{
  "lat": 24.9203, "lon": 67.0912, "site_id": 77, "distance_km": 2.2,
  "salt_signs": { "borewell": true },
  "water_days": 3,
  "space": "medium",
  "care": "rarely",
  "purpose": "shade",
  "children_or_animals": 1,
  "budget": null
}
```

How the questions map to these values (`src/constants/questions.js`):

| Question | Screen option → value sent |
|---|---|
| Signs of salt | each answered sign: `crust`, `borewell`, `burnt`, `sea` → `true` / `false` (unanswered signs are left out) |
| Days you can water | 1, 2, 3, 5, 7 |
| Space | Pot / balcony → `small`, Small yard → `medium`, Large open land → `large` |
| Care | Low → `rarely`, Medium → `few_times_week`, High → `daily` |
| Main purpose | Shade → `shade`, Flowers → `ornamental`, Fruit → `fruit`, Hedge → `ornamental`, Greenery → `carbon` |
| Children or animals | Yes → `1`, No → `0` |
| Budget (optional) | `under_500`, `500_2000`, `any` or `null` (the backend does not use it yet) |

Response fields the app reads:

```json
{
  "source": "model",
  "site": { "site_id": 77, "label": "…", "town": "…", "ph": 8.2, "texture": "light", "t_mean": 26.1, "site_salinity_default": 0 },
  "distance_km": 2.2,
  "site_salinity": 1,
  "recommendations": [
    {
      "scientific_name": "Phoenix dactylifera",
      "common_name": "Date palm",
      "probability": 0.98,
      "score": 100,
      "sub": { "salt": 1, "water": 1, "temp": 1, "ph": 0.7, "texture": 1, "drainage": 1, "fertility": 1, "space": 1, "care": 0.7, "purpose": 1, "pollution": 0.7 },
      "traits": { "native": 1, "water_need": 1, "low_maintenance": 0, "urban_heat_tolerant": null, "proven_in_karachi": 1,
                  "purpose_shade": 1, "purpose_fruit": 1, "purpose_ornamental": 0, "form": ["tree", "evergreen"], "guide_note": "…" },
      "photo": { "url": "/static/photos/phoenix_dactylifera.jpg", "artist": "…", "license": "CC BY 4.0", "source_page": "https://…" }
    }
  ],
  "excluded": [{ "scientific_name": "Conocarpus erectus", "common_name": "Buttonwood", "code": "do_not_plant", "reason": "…" }]
}
```

How the app displays them (`recommendationMapper.js`):

| Backend field | Shown as |
|---|---|
| `probability` | Score ring (× 100); "Model: 98.0% likely to suit your site" when `source` is `model` |
| `score` | "Rule score 100/100" |
| `sub` | Bars in "Why this score" |
| `traits` | Tags (Native, Water 1×/week, Low care, Heat tolerant, Proven in Karachi), the one-line summary, the filter chips, and the tree/shrub icon |
| `photo` | Card photo and its credit line |
| `site_salinity`, `site` | Salinity, pH, texture and average temperature; a note when salinity was raised from the soil map |
| `excluded[].code` | Plain-language reason (e.g. `salinity` → "Salt above its tolerance") |
| `source` | "Ranked by the XGBoost model" or "rule scores (model offline)" |

## `POST /api/chat`

Request:
```json
{ "question": "How often should I water it?", "site_id": 77, "plants": ["Phoenix dactylifera", "…"], "history": [{ "role": "user", "text": "…" }] }
```

Expected response once the backend implements it: `{ "answer": "…", "source": "…" }` (`source` optional).
Until then the backend returns `501`, and the app replies "The plant chat is not available yet."

---

## Suggestions for the backend

- **Karachi check**: `/api/nearest-site` and `/api/recommend` accept any point on Earth. Returning
  `422 { "error": "Plantify only covers Karachi." }` for far-away points would let the app block them.
- **Chat**: implement `POST /api/chat` with the request/response above; the chat screen is ready.
- **Weather tip** (optional): the old app showed "Today 36 °C, no rain…". If wanted, add
  `"weather": { "headline": "…", "tip": "…" }` to the `/api/recommend` response and the app can show it.
