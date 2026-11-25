# Frontend folder structure

React (Vite) app for Plantify Karachi. It only collects input and shows results:
**every recommendation, site lookup, photo and chat answer comes from the Node.js backend**
in `../backend` (see [`docs/BACKEND_API.md`](docs/BACKEND_API.md)).

```text
frontend/
├── index.html                 HTML shell; loads fonts and mounts the React app (#root)
├── package.json               Dependencies and scripts (dev, build, preview)
├── vite.config.js             Vite setup; dev proxy sends /api/* and /static/* to the backend
├── .env.example               Backend address settings (copy to .env.local)
├── README.md                  How to install, run and build
├── FOLDER_STRUCTURE.md        This file
│
├── docs/
│   └── BACKEND_API.md         Every backend endpoint the app calls, the values it sends, and how
│                              each response field is displayed
│
├── public/                    Served as-is at the site root
│   └── favicon.svg            Browser tab icon
│
└── src/
    ├── main.jsx               Entry point: renders <App /> and loads global styles
    ├── App.jsx                Routes (/, /location, /questions, /results, /chat) and providers
    │
    ├── config/
    │   └── env.js             Backend base URL, request timeout, default map view
    │
    ├── constants/
    │   ├── routes.js          All page paths in one place
    │   └── questions.js       The 7 questions, their options and the value each sends to the backend;
    │                          result filters; chat suggestions
    │
    ├── services/              Talking to the outside world
    │   ├── apiClient.js       fetch wrapper: JSON, timeout, readable errors (ApiError), backend file URLs
    │   ├── plantifyApi.js     One function per backend endpoint (sites, nearest-site, recommend, chat)
    │   └── recommendationMapper.js  Turns the raw /api/recommend response into what the results
    │                              screen shows (labels, tags, score bars); makes no decisions
    │
    ├── context/
    │   └── PlanContext.jsx    App state for one session (photo, location, answers, results, chat),
    │                          saved in sessionStorage; builds the /api/recommend request body
    │
    ├── hooks/
    │   ├── useAsync.js        Loading / error / data state for any async call
    │   └── useSavedPlan.js    "Save" button: keeps results on this device (localStorage)
    │
    ├── utils/
    │   ├── exif.js            Reads GPS coordinates from a JPEG photo in the browser
    │   ├── format.js          Coordinates, site names, plurals
    │   └── storage.js         Safe sessionStorage / localStorage read and write
    │
    ├── styles/
    │   ├── tokens.css         Design tokens: colours, fonts, spacing, radii, shadows
    │   └── global.css         Base element styles, page background, shared helpers
    │
    ├── components/            Reusable building blocks (no business knowledge)
    │   ├── layout/
    │   │   ├── AppLayout.jsx  Sticky frosted header, page outlet, footer
    │   │   └── PageHeader.jsx Back link, title, subtitle, optional right-side action
    │   └── ui/
    │       ├── Button.jsx     Primary / secondary / ghost buttons and link-buttons
    │       ├── Card.jsx       Rounded surface (optional glass effect)
    │       ├── Icon.jsx       Inline SVG icon set
    │       ├── Notice.jsx     Info / warning / error message with optional "Try again"
    │       ├── StepProgress.jsx  "Step 1 of 3" progress bar
    │       └── ToggleChip.jsx Pill button with on/off state (answers, filters)
    │
    ├── features/              Pieces that belong to one part of the app
    │   ├── location/
    │   │   ├── PhotoPicker.jsx   Choose/take a photo, preview, GPS-found badge
    │   │   ├── LocationMap.jsx   Leaflet map with a draggable pin
    │   │   └── AreaSelect.jsx    "Choose your area" list from GET /api/sites
    │   ├── questions/
    │   │   ├── SaltSignsCard.jsx Question 1: four yes/no salt signs
    │   │   └── ChoiceQuestion.jsx Questions 2–7 as pill buttons
    │   ├── results/
    │   │   ├── SiteSummary.jsx   Site facts (salinity, pH, texture, temperature) and notes
    │   │   ├── FilterBar.jsx     Native / Low water / … filter chips
    │   │   ├── PlantCard.jsx     Plant photo, name, score, reason, tags, "Why this score"
    │   │   ├── PlantPhoto.jsx    Backend photo, with a tree/shrub/palm icon until it loads
    │   │   ├── ScoreRing.jsx     Circular 0–100 score gauge
    │   │   ├── ExcludedList.jsx  "Not recommended here" with reasons
    │   │   └── ResultsSkeleton.jsx Loading placeholder
    │   └── chat/
    │       ├── ChatMessage.jsx   One chat bubble (with source line)
    │       └── ChatComposer.jsx  Suggested questions and the input box
    │
    └── pages/                 One file per screen; each combines features and calls services
        ├── WelcomePage.jsx    Landing page
        ├── LocationPage.jsx   Step 1: photo and location
        ├── QuestionsPage.jsx  Step 2: the seven questions
        ├── ResultsPage.jsx    Step 3: recommendations, filters, save, excluded plants
        ├── ChatPage.jsx       Ask about the recommended plants
        └── NotFoundPage.jsx   Unknown URLs
```

Every `.jsx` component that needs styles has a matching `*.module.css` file next to it
(CSS Modules: class names are local to that component).

## Where to change things

| To change… | Edit |
|---|---|
| Backend address | `.env.local` (`VITE_DEV_API_TARGET`, `VITE_API_BASE_URL`) |
| An endpoint or its request body | `src/services/plantifyApi.js`, `src/context/PlanContext.jsx` (`useRecommendRequest`) and `docs/BACKEND_API.md` |
| How backend results are worded (tags, reasons, labels) | `src/services/recommendationMapper.js` |
| A question, its options or the value sent | `src/constants/questions.js` |
| Colours, fonts, spacing | `src/styles/tokens.css` |
| A page's layout | `src/pages/<Page>.jsx` and its `.module.css` |
| Plant photos | the backend: `backend/assets/data/photos/` and `photos.json` |
