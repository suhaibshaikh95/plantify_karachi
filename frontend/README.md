# Plantify Karachi — Frontend (React)

The web app for Plantify Karachi, built with **React 18 + Vite**. It works on phones and laptops.

1. **Welcome**: what the app does.
2. **Your plot**: photo of the land (GPS read from the photo), current location, map pin, or area list.
3. **About your site**: seven questions (salt signs, watering days, space, care, purpose, children/animals, budget).
4. **Your plants**: top plants with photo, score, summary, tags, "Why this score", filters, excluded plants, save.
5. **Ask about a plant**: chat about the recommended plants.

The frontend contains **no recommendation logic and no demo data**. Site lookup, salinity, the rule
filter, the XGBoost ranking, plant photos and chat answers all come from the Node.js backend in
`../backend`. How each endpoint is called and displayed: [`docs/BACKEND_API.md`](docs/BACKEND_API.md).
If the backend is not running, the app shows a clear error with a "Try again" button.

Folder layout and what each file does: [`FOLDER_STRUCTURE.md`](FOLDER_STRUCTURE.md).

## Run it

Needs Node.js 18 or newer. Start the backend first (in another terminal):

```bash
cd backend
npm install
npm start            # http://localhost:8000
```

Then the frontend:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

In development, requests to `/api/...` and `/static/...` (photos) are forwarded to the backend at
`http://localhost:8000`. To use another address, copy `.env.example` to `.env.local` and change
`VITE_DEV_API_TARGET`.

## Build for production

```bash
npm run build      # output in frontend/dist
npm run preview    # check the build locally
```

Either serve `dist/` from the Node.js backend (then leave `VITE_API_BASE_URL` empty), or host it
separately: set `VITE_API_BASE_URL` to the backend's address before building, and add the frontend's
address to the backend's `CORS_ORIGINS`. Configure the host to send unknown paths to `index.html`
(the app uses client-side routes like `/results`).

## Current backend gaps

- `POST /api/chat` returns `501` (planned for the next phase). The chat screen says the chat is not available yet.
- The backend accepts points outside Karachi; the app warns when the point is more than 15 km from the nearest reference site.

## Outside services

- **Map**: Leaflet with OpenStreetMap tiles.
- **Fonts**: Inter and Plus Jakarta Sans from Google Fonts (system fonts are used if they don't load).
