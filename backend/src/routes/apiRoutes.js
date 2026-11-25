const express = require('express');
const store = require('../data/store');
const { findNearestSite } = require('../services/geoService');
const { recommendPlants, formatDisplayName, formatPlantPhoto } = require('../services/hybridEngine');
const { mlPredictor } = require('../services/mlPredictor');

const router = express.Router();

// 1. GET /api/health
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'plantify-karachi-api',
    model_ready: mlPredictor.isModelReady(),
    sites_count: store.sites.length,
    plants_count: store.plants.length,
  });
});

// 2. GET /api/sites
router.get('/sites', (_req, res) => {
  res.json(store.sites);
});

// 3. POST /api/nearest-site
router.post('/nearest-site', (req, res) => {
  const { lat, lon } = req.body || {};
  if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'Invalid request: numeric lat and lon are required.' });
  }
  const result = findNearestSite(lat, lon, store.sites);
  return res.json(result);
});

// 4. GET /api/plants
router.get('/plants', (_req, res) => {
  const catalog = store.plants.map((plant) => ({
    ...plant,
    display_name: formatDisplayName(plant),
    photo: formatPlantPhoto(plant.scientific_name),
  }));
  res.json(catalog);
});

// 5. GET /api/model/info
router.get('/model/info', (_req, res) => {
  res.json({
    model_name: store.metrics.best_model || 'XGBoost',
    metrics: store.metrics,
    feature_count: store.featureColumns.length,
    feature_columns: store.featureColumns,
    schema: store.schema,
  });
});

// 6. POST /api/recommend
router.post('/recommend', async (req, res, next) => {
  try {
    const body = req.body || {};
    const validSpaces = ['small', 'medium', 'large'];
    const validCare = ['rarely', 'few_times_week', 'daily'];
    const validPurposes = ['shade', 'fruit', 'ornamental', 'carbon', 'any'];

    if (body.water_days === undefined || Number.isNaN(Number(body.water_days))) {
      return res.status(400).json({ error: 'water_days is required (1, 2, 3, 5, or 7).' });
    }
    if (!validSpaces.includes(body.space)) {
      return res.status(400).json({ error: `space must be one of: ${validSpaces.join(', ')}` });
    }
    if (!validCare.includes(body.care)) {
      return res.status(400).json({ error: `care must be one of: ${validCare.join(', ')}` });
    }
    if (body.purpose && !validPurposes.includes(body.purpose)) {
      return res.status(400).json({ error: `purpose must be one of: ${validPurposes.join(', ')}` });
    }
    if (body.children_or_animals === undefined) {
      return res.status(400).json({ error: 'children_or_animals is required (0 or 1).' });
    }

    const result = await recommendPlants(body);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// 7. POST /api/chat (Pending — Phase 2)
router.post('/chat', (_req, res) => {
  res.status(501).json({
    error: 'Chatbot endpoint is pending (Phase 2).',
    status: 'pending',
  });
});

module.exports = router;

