/*
 * Plantify Karachi - offline hybrid engine (Stage 1 rules + Stage 2 score).
 *
 * A line-by-line port of evaluate() in
 * training_dataset/training_data/plantify_dataset_v2.4/scripts/generate_training_data_v23.py,
 * the rule engine whose labels the XGBoost model was trained to reproduce.
 * The app uses it when the FastAPI backend is not running, so the UI always works.
 * When the backend is up, its XGBoost probabilities are shown instead.
 *
 * (Roman Urdu: backend band ho to bhi app chale, is liye wohi rules yahan JS mein hain.)
 */
(function (root) {
  'use strict';

  // Weights from the supervisor guide (sum = 100) and bonuses.
  const W = { salt: 22, water: 18, temp: 14, ph: 8, texture: 4, drainage: 4, fertility: 4,
              space: 8, care: 6, purpose: 8, pollution: 4 };
  const BONUS_NATIVE = 5, BONUS_GUIDE_GOOD = 5, BONUS_PROVEN = 3;
  const WATER_DAYS_NEEDED = { 1: 1, 3: 3, 5: 7 };   // water_need -> days per week
  const PH_MARGIN = 1.0, T_MARGIN = 3.0, UNKNOWN = 0.7;
  const SUITABLE_SCORE = 70;

  const isNA = (v) => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) || v === '';
  const known = (...v) => v.every((x) => !isNA(x));
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
   * Evaluate one plant for one scenario.
   * s: site fields + user answers (site_salinity, water_days, space, care, purpose, children_or_animals)
   * p: plant row from plants.json
   * Returns { removed, code, reason, score, sub }.
   */
  function evaluate(s, p) {
    const out = (code, reason) => ({ removed: true, code, reason, score: 0, sub: {} });

    // ---- Stage 1: remove
    if (yes(p.do_not_plant)) return out('do_not_plant', 'do_not_plant: ' + (p.do_not_plant_tags || ''));
    if (Number(s.children_or_animals) && yes(p.poisonous)) return out('poisonous', 'poisonous: children or animals at the site');
    if (s.site_salinity > p.salt_tolerance) return out('salinity', `salinity: site class ${s.site_salinity} > plant tolerance ${p.salt_tolerance}`);
    if (s.ph > p.ph_abs_max + PH_MARGIN || s.ph < p.ph_abs_min - PH_MARGIN) return out('ph', `pH: ${s.ph} far outside ${p.ph_abs_min}-${p.ph_abs_max}`);
    if (s.t_coldest_month < p.temp_abs_min - T_MARGIN || s.t_hottest_month > p.temp_abs_max + T_MARGIN) {
      return out('temperature', `temperature: monthly ${s.t_coldest_month.toFixed(1)}-${s.t_hottest_month.toFixed(1)} C far outside ${p.temp_abs_min}-${p.temp_abs_max}`);
    }
    const need = WATER_DAYS_NEEDED[Math.trunc(p.water_need)];
    if (s.water_days < need - 1 || (s.water_days === 0 && p.water_need > 1)) return out('water', `water: ${s.water_days} day(s)/week, plant needs about ${need}`);
    if (yes(p.needs_large_space) && s.space !== 'large') return out('space', `space: needs large root space, site is ${s.space}`);

    // ---- Stage 2: score out of 100
    const sub = {};
    sub.salt = p.salt_tolerance - s.site_salinity >= 1 ? 1.0 : 0.7;
    sub.water = Math.min(1.0, s.water_days / need);
    sub.temp = (closeness(s.t_mean, p.temp_opt_min, p.temp_opt_max, 10) +
                closeness(s.t_hottest_month, p.temp_opt_min, p.temp_opt_max, 10)) / 2;
    sub.ph = band(s.ph, p.ph_opt_min, p.ph_opt_max, p.ph_abs_min, p.ph_abs_max, PH_MARGIN);
    const tex = p['soil_' + s.texture];
    sub.texture = isNA(tex) ? UNKNOWN : (tex === 1 ? 1.0 : 0.3);
    const dr = p['drainage_' + s.drainage];
    sub.drainage = isNA(dr) ? UNKNOWN : (dr === 1 ? 1.0 : 0.4);
    const fe = p['fertility_' + s.fertility];
    sub.fertility = isNA(fe) ? UNKNOWN : (fe === 1 ? 1.0 : 0.5);
    if (p.guide_recommendation === 'needs_good_soil_water' && s.fertility === 'low') sub.fertility = Math.min(sub.fertility, 0.4);
    sub.space = 1.0;
    if (isNA(p.low_maintenance)) sub.care = s.care === 'rarely' ? UNKNOWN : 1.0;
    else sub.care = (s.care !== 'rarely' || p.low_maintenance === 1) ? 1.0 : 0.3;
    sub.purpose = (s.purpose === 'any' || p['purpose_' + s.purpose] === 1) ? 1.0 : 0.2;
    if (Number(s.industrial) || s.site_type === 'dense_urban') {
      if (isNA(p.pollution_tolerance) && isNA(p.urban_heat_tolerant)) sub.pollution = UNKNOWN;
      else sub.pollution = (yes(p.pollution_tolerance) || yes(p.urban_heat_tolerant)) ? 1.0 : 0.4;
    } else {
      sub.pollution = 1.0;
    }
    if (Number(s.lst_zone_celsius) === 3) {   // high urban-heat zone
      if (isNA(p.urban_heat_tolerant)) sub.pollution = Math.min(sub.pollution, UNKNOWN);
      else if (p.urban_heat_tolerant !== 1) sub.pollution = Math.min(sub.pollution, 0.5);
    }
    let score = 0;
    for (const k of Object.keys(W)) score += W[k] * sub[k];
    score += BONUS_NATIVE * (yes(p.native) ? 1 : 0);
    score += BONUS_GUIDE_GOOD * (p.guide_recommendation === 'good' ? 1 : 0);
    score += BONUS_PROVEN * (Number(p.proven_in_karachi) === 1 ? 1 : 0);
    score = Math.round(Math.min(100.0, score) * 10) / 10;
    return { removed: false, code: '', reason: '', score, sub };
  }

  /** Run every plant, return { recommended (top n), eligible, excluded }. */
  function recommend(scenario, plants, n = 6) {
    const eligible = [], excluded = [];
    for (const p of plants) {
      const r = evaluate(scenario, p);
      if (r.removed) excluded.push({ plant: p, code: r.code, reason: r.reason });
      else eligible.push({ plant: p, score: r.score, sub: r.sub, suitable: r.score >= SUITABLE_SCORE });
    }
    eligible.sort((a, b) => b.score - a.score);
    return { recommended: eligible.slice(0, n), eligible, excluded };
  }

  /** Great-circle distance in km. */
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function nearestSite(lat, lon, sites) {
    let best = null, bestKm = Infinity;
    for (const s of sites) {
      const km = haversineKm(lat, lon, s.lat, s.lon);
      if (km < bestKm) { bestKm = km; best = s; }
    }
    return { site: best, distance_km: Math.round(bestKm * 10) / 10 };
  }

  // Rough box around Karachi division; the reference sites all fall inside it.
  const KARACHI_BOUNDS = { south: 24.70, north: 25.25, west: 66.65, east: 67.60 };
  const inKarachi = (lat, lon) => lat >= KARACHI_BOUNDS.south && lat <= KARACHI_BOUNDS.north &&
                                  lon >= KARACHI_BOUNDS.west && lon <= KARACHI_BOUNDS.east;

  /**
   * Turn the four yes/no salt-sign answers into the model's 0/1/2 salinity class.
   * Starts from the map default (ISRIC 2026 projection) and can only raise it,
   * matching how the training scenarios were drawn around the map value.
   */
  function salinityFromSigns(mapDefault, signs) {
    const n = ['crust', 'borewell', 'burnt', 'sea'].filter((k) => signs[k] === true).length;
    let sal = Number(mapDefault) || 0;
    if (n >= 1) sal = Math.max(sal, 1);
    if (n >= 3 || (n >= 2 && sal >= 1 && Number(mapDefault) >= 1)) sal = 2;
    return Math.min(sal, 2);
  }

  const api = { evaluate, recommend, nearestSite, haversineKm, inKarachi, salinityFromSigns,
                KARACHI_BOUNDS, WATER_DAYS_NEEDED, SUITABLE_SCORE, W };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PlantifyEngine = api;
})(typeof self !== 'undefined' ? self : this);
