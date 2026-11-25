const path = require('path');
const store = require('../data/store');
const { findNearestSite } = require('./geoService');
const { mlPredictor } = require('./mlPredictor');

// Weights from supervisor guide (sum = 100) + bonuses (matches engine.js & generate_training_data_v23.py)
const WEIGHTS = {
  salt: 22,
  water: 18,
  temp: 14,
  ph: 8,
  texture: 4,
  drainage: 4,
  fertility: 4,
  space: 8,
  care: 6,
  purpose: 8,
  pollution: 4,
};
const BONUS_NATIVE = 5;
const BONUS_GUIDE_GOOD = 5;
const BONUS_PROVEN = 3;
const WATER_DAYS_NEEDED = { 1: 1, 3: 3, 5: 7 };
const PH_MARGIN = 1.0;
const T_MARGIN = 3.0;
const UNKNOWN = 0.7;

const isNA = (v) => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) || v === '';
const known = (...vals) => vals.every((x) => !isNA(x));
const yes = (v) => !isNA(v) && Number(v) === 1;

function closeness(x, lo, hi, width) {
  if (!known(lo, hi)) return UNKNOWN;
  if (lo <= x && x <= hi) return 1.0;
  const d = x < lo ? lo - x : x - hi;
  return Math.max(0.0, 1 - d / width);
}

function band(x, olo, ohi, alo, ahi, margin) {
  if (!known(olo, ohi, alo, ahi)) return UNKNOWN;
  if (olo <= x && x <= ohi) return 1.0;
  if (alo <= x && x <= ahi) return 0.7;
  const d = x < alo ? alo - x : x - ahi;
  return Math.max(0.0, 0.7 * (1 - d / margin));
}

/**
 * Compute effective 0/1/2 salinity from map default + 4 yes/no salt signs.
 */
function salinityFromSigns(mapDefault, signs = {}) {
  const count = ['crust', 'borewell', 'burnt', 'sea'].filter((k) => signs[k] === true).length;
  let sal = Number(mapDefault) || 0;
  if (count >= 1) sal = Math.max(sal, 1);
  if (count >= 3 || (count >= 2 && sal >= 1 && Number(mapDefault) >= 1)) sal = 2;
  return Math.min(sal, 2);
}

/**
 * Format clean display name from common_name / scientific_name.
 */
function formatDisplayName(plant) {
  let c = String(plant.common_name || plant.scientific_name || '')
    .trim()
    .replace(/^\((.*)\)$/, '$1')
    .replace(/^E\.g\.\s*/i, '')
    .replace(/\s+etc\.?$/i, '')
    .replace(/\s*\((shrub|tree)\)\s*$/i, '')
    .trim();
  if (!c) c = plant.scientific_name;
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/**
 * Resolve species photo metadata with `/static/photos/<filename>` URL.
 */
function formatPlantPhoto(scientificName) {
  const entry = store.photosManifest[scientificName];
  if (!entry || !entry.src) return null;
  const filename = path.basename(entry.src);
  return {
    url: `/static/photos/${filename}`,
    artist: entry.artist || null,
    license: entry.license || null,
    source_page: entry.source_page || entry.article || null,
  };
}

/**
 * Stage 1 (deterministic safety & environmental filter) + Stage 2 sub-scores.
 */
function evaluatePlant(scenario, p) {
  const excluded = (code, reason) => ({ removed: true, code, reason, score: 0, sub: {} });

  // ---- Stage 1: Hard exclusions
  if (yes(p.do_not_plant)) {
    return excluded('do_not_plant', 'do_not_plant: ' + (p.do_not_plant_tags || 'banned_species'));
  }
  if (Number(scenario.children_or_animals) && yes(p.poisonous)) {
    return excluded('poisonous', 'poisonous: children or animals at the site');
  }
  if (scenario.site_salinity > p.salt_tolerance) {
    return excluded('salinity', `salinity: site class ${scenario.site_salinity} > plant tolerance ${p.salt_tolerance}`);
  }
  if (scenario.ph > p.ph_abs_max + PH_MARGIN || scenario.ph < p.ph_abs_min - PH_MARGIN) {
    return excluded('ph', `pH: ${scenario.ph} far outside ${p.ph_abs_min}-${p.ph_abs_max}`);
  }
  if (
    scenario.t_coldest_month < p.temp_abs_min - T_MARGIN ||
    scenario.t_hottest_month > p.temp_abs_max + T_MARGIN
  ) {
    return excluded(
      'temperature',
      `temperature: monthly ${scenario.t_coldest_month.toFixed(1)}-${scenario.t_hottest_month.toFixed(1)} C far outside ${p.temp_abs_min}-${p.temp_abs_max}`
    );
  }
  const need = WATER_DAYS_NEEDED[Math.trunc(p.water_need)];
  if (scenario.water_days < need - 1 || (scenario.water_days === 0 && p.water_need > 1)) {
    return excluded('water', `water: ${scenario.water_days} day(s)/week, plant needs about ${need}`);
  }
  if (yes(p.needs_large_space) && scenario.space !== 'large') {
    return excluded('space', `space: needs large root space, site is ${scenario.space}`);
  }

  // ---- Stage 2: Sub-scores & rule score (0–100) for explainability
  const sub = {};
  sub.salt = p.salt_tolerance - scenario.site_salinity >= 1 ? 1.0 : 0.7;
  sub.water = Math.min(1.0, scenario.water_days / need);
  sub.temp =
    (closeness(scenario.t_mean, p.temp_opt_min, p.temp_opt_max, 10) +
      closeness(scenario.t_hottest_month, p.temp_opt_min, p.temp_opt_max, 10)) /
    2;
  sub.ph = band(scenario.ph, p.ph_opt_min, p.ph_opt_max, p.ph_abs_min, p.ph_abs_max, PH_MARGIN);

  const tex = p[`soil_${scenario.texture}`];
  sub.texture = isNA(tex) ? UNKNOWN : tex === 1 ? 1.0 : 0.3;

  const dr = p[`drainage_${scenario.drainage}`];
  sub.drainage = isNA(dr) ? UNKNOWN : dr === 1 ? 1.0 : 0.4;

  const fe = p[`fertility_${scenario.fertility}`];
  sub.fertility = isNA(fe) ? UNKNOWN : fe === 1 ? 1.0 : 0.5;
  if (p.guide_recommendation === 'needs_good_soil_water' && scenario.fertility === 'low') {
    sub.fertility = Math.min(sub.fertility, 0.4);
  }

  sub.space = 1.0;

  if (isNA(p.low_maintenance)) {
    sub.care = scenario.care === 'rarely' ? UNKNOWN : 1.0;
  } else {
    sub.care = scenario.care !== 'rarely' || p.low_maintenance === 1 ? 1.0 : 0.3;
  }

  sub.purpose = scenario.purpose === 'any' || p[`purpose_${scenario.purpose}`] === 1 ? 1.0 : 0.2;

  if (Number(scenario.industrial) || scenario.site_type === 'dense_urban') {
    if (isNA(p.pollution_tolerance) && isNA(p.urban_heat_tolerant)) sub.pollution = UNKNOWN;
    else sub.pollution = yes(p.pollution_tolerance) || yes(p.urban_heat_tolerant) ? 1.0 : 0.4;
  } else {
    sub.pollution = 1.0;
  }

  if (Number(scenario.lst_zone_celsius) === 3) {
    if (isNA(p.urban_heat_tolerant)) sub.pollution = Math.min(sub.pollution, UNKNOWN);
    else if (p.urban_heat_tolerant !== 1) sub.pollution = Math.min(sub.pollution, 0.5);
  }

  let score = 0;
  for (const k of Object.keys(WEIGHTS)) score += WEIGHTS[k] * sub[k];
  score += BONUS_NATIVE * (yes(p.native) ? 1 : 0);
  score += BONUS_GUIDE_GOOD * (p.guide_recommendation === 'good' ? 1 : 0);
  score += BONUS_PROVEN * (Number(p.proven_in_karachi) === 1 ? 1 : 0);
  score = Math.round(Math.min(100.0, score) * 10) / 10;

  return { removed: false, code: '', reason: '', score, sub };
}

function extractTraits(p) {
  return {
    native: p.native ?? 0,
    water_need: p.water_need ?? null,
    low_maintenance: p.low_maintenance ?? null,
    urban_heat_tolerant: p.urban_heat_tolerant ?? null,
    pollution_tolerance: p.pollution_tolerance ?? null,
    proven_in_karachi: p.proven_in_karachi ?? 0,
    salt_tolerance: p.salt_tolerance ?? null,
    purpose_shade: p.purpose_shade ?? 0,
    purpose_fruit: p.purpose_fruit ?? 0,
    purpose_ornamental: p.purpose_ornamental ?? 0,
    purpose_carbon: p.purpose_carbon ?? 0,
    form: p.form || [],
    guide_note: p.guide_note || null,
  };
}

/**
 * Full hybrid recommendation pipeline:
 * 1. Resolve site + effective salinity
 * 2. Stage 1 deterministic filtering across all 85 plants
 * 3. Stage 2 XGBoost inference (or graceful rule-score fallback) + Top 6 selection
 */
async function recommendPlants(reqBody) {
  let site = null;
  let distanceKm = reqBody.distance_km ?? null;

  if (reqBody.site_id !== undefined && reqBody.site_id !== null) {
    site = store.sitesById.get(Number(reqBody.site_id)) || null;
  }
  if (!site && typeof reqBody.lat === 'number' && typeof reqBody.lon === 'number') {
    const nearest = findNearestSite(reqBody.lat, reqBody.lon, store.sites);
    site = nearest.site;
    if (distanceKm === null) distanceKm = nearest.distance_km;
  }
  if (!site) {
    const err = new Error('Could not resolve site: provide a valid site_id or lat/lon.');
    err.statusCode = 400;
    throw err;
  }

  const siteSalinity =
    reqBody.site_salinity !== undefined && reqBody.site_salinity !== null
      ? Number(reqBody.site_salinity)
      : salinityFromSigns(site.site_salinity_default, reqBody.salt_signs || {});

  const userFeatures = {
    site_salinity: siteSalinity,
    water_days: Number(reqBody.water_days),
    space: String(reqBody.space),
    care: String(reqBody.care),
    purpose: String(reqBody.purpose || 'any'),
    children_or_animals: Number(reqBody.children_or_animals ? 1 : 0),
  };

  const scenario = { ...site, ...userFeatures };
  const eligible = [];
  const excluded = [];

  for (const plant of store.plants) {
    const res = evaluatePlant(scenario, plant);
    if (res.removed) {
      excluded.push({
        scientific_name: plant.scientific_name,
        common_name: formatDisplayName(plant),
        code: res.code,
        reason: res.reason,
      });
    } else {
      eligible.push({ plant, score: res.score, sub: res.sub });
    }
  }

  // Stage 2: XGBoost inference over eligible plants
  const { source, probabilities } = await mlPredictor.predictBatch(
    site,
    userFeatures,
    eligible.map((item) => item.plant)
  );

  const ranked = eligible.map((item, idx) => {
    const prob =
      probabilities && typeof probabilities[idx] === 'number'
        ? Math.round(probabilities[idx] * 10000) / 10000
        : Math.round((item.score / 100) * 10000) / 10000;

    return {
      scientific_name: item.plant.scientific_name,
      common_name: formatDisplayName(item.plant),
      probability: prob,
      score: item.score,
      sub: item.sub,
      traits: extractTraits(item.plant),
      photo: formatPlantPhoto(item.plant.scientific_name),
    };
  });

  // Sort descending by probability, using rule score as secondary tie-breaker
  ranked.sort((a, b) => {
    if (b.probability !== a.probability) return b.probability - a.probability;
    return b.score - a.score;
  });

  return {
    source,
    site,
    distance_km: distanceKm,
    site_salinity: siteSalinity,
    recommendations: ranked.slice(0, 6),
    excluded,
  };
}

module.exports = {
  salinityFromSigns,
  formatDisplayName,
  formatPlantPhoto,
  evaluatePlant,
  recommendPlants,
};

