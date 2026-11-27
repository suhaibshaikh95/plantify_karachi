const express = require('express');
const cors = require('cors');
const paths = require('./src/config/paths');
const apiRoutes = require('./src/routes/apiRoutes');
const { mlPredictor } = require('./src/services/mlPredictor');
const { ragRetriever } = require('./src/services/ragRetriever');
const { DEFAULT_GEMINI_MODEL } = require('./src/services/chatService');

const app = express();
const PORT = Number(process.env.PORT) || 8000;

const allowedOrigins = (
  process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:8000'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));

// Serve 85 local Creative Commons plant photos at /static/photos/:filename
app.use('/static/photos', express.static(paths.PHOTOS_DIR, { maxAge: '7d' }));

// Mount all REST API endpoints under /api
app.use('/api', apiRoutes);

// Centralized JSON error handler
app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

async function start() {
  // Warm up Python XGBoost worker on startup (falls back gracefully if Python ML libs are absent)
  // XGBoost worker: loads in the background (the first import can be slow on Windows); until it is
  // ready, /api/recommend uses rule scores.
  mlPredictor.init().then((ok) => {
    console.log(`XGBoost worker (.joblib): ${ok ? 'READY' : `UNAVAILABLE, using rule-score fallback (${mlPredictor.reason})`}`);
  });
  // Chat retrieval worker (BGE-small + FAISS): starts in the background; the first run may download the model.
  ragRetriever.init().then((ok) => {
    const info = ragRetriever.info();
    console.log(`Chat retrieval worker (FAISS): ${ok ? 'READY' : `UNAVAILABLE (${info.reason})`}`);
  });
  console.log(`Chat generation (Gemini): ${process.env.GEMINI_API_KEY ? `configured (${process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL})` : 'no GEMINI_API_KEY — chat answers with the best passage only'}`);
  return app.listen(PORT, () => {
    console.log(`Plantify Karachi Node.js backend running at http://localhost:${PORT}`);
    console.log('Loading the XGBoost model and the chat retrieval worker in the background...');
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
