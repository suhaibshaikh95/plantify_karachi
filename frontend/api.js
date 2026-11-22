/*
 * Plantify Karachi - API client.
 *
 * Talks to the Phase 2 FastAPI backend (development_guide/PROJECT_DEVELOPMENT_GUIDE.md, step 2.4).
 * If the backend can't be reached, every call falls back to the offline engine
 * (engine.js + data/*.json), so the app works with or without the server.
 *
 * Backend address, first match wins:
 *   1. ?api=http://localhost:8000 in the page URL (remembered for the session)
 *   2. window.PLANTIFY_API_BASE set before this file loads
 *   3. same origin as the page (when FastAPI serves the frontend folder)
 *
 * (Roman Urdu: pehle backend se poochta hai, na mile to browser mein hi hisaab lagata hai.)
 */
(function (root) {
  'use strict';
  const E = root.PlantifyEngine;

  const fromQuery = new URLSearchParams(location.search).get('api');
  if (fromQuery) safe(() => sessionStorage.setItem('plantify.api', fromQuery));
  const BASE = (fromQuery || safe(() => sessionStorage.getItem('plantify.api')) || root.PLANTIFY_API_BASE || '').replace(/\/$/, '');
  const TIMEOUT_MS = 6000;

  let backendUp = null;          // null = not checked yet
  let sitesCache = null, plantsCache = null;

  function safe(fn) { try { return fn(); } catch (e) { return null; } }

  async function http(path, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(BASE + path, {
        ...opts,
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      });
      if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function isBackendUp() {
    if (backendUp !== null) return backendUp;
    if (location.protocol === 'file:' && !BASE) return (backendUp = false);
    try {
      await http('/api/health');
      backendUp = true;
    } catch (e) {
      backendUp = false;
    }
    return backendUp;
  }

  async function localJson(name) {
    const res = await fetch(`data/${name}.json`);
    if (!res.ok) throw new Error(`Could not load data/${name}.json`);
    return res.json();
  }

  async function getPlants() {
    return plantsCache || (plantsCache = await localJson('plants'));
  }

  async function getSites() {
    if (sitesCache) return sitesCache;
    if (await isBackendUp()) {
      try { return (sitesCache = await http('/api/sites')); } catch (e) { /* fall through */ }
    }
    return (sitesCache = await localJson('sites'));
  }

  async function nearestSite(lat, lon) {
    if (await isBackendUp()) {
      try { return await http('/api/nearest-site', { method: 'POST', body: JSON.stringify({ lat, lon }) }); }
      catch (e) { /* fall through */ }
    }
    return E.nearestSite(lat, lon, await getSites());
  }

  /**
   * request = { lat, lon, site_id, site_salinity, water_days, space, care, purpose,
   *             children_or_animals, budget, salt_signs }
   * Returns a normalised result:
   * { source: 'model'|'rules', site, distance_km, site_salinity,
   *   recommendations: [{ plant, score, probability|null, sub|null }], excluded: [{ plant, code, reason }] }
   */
  async function recommend(request) {
    const plants = await getPlants();
    const byName = new Map(plants.map((p) => [p.scientific_name, p]));
    const sites = await getSites();
    const site = sites.find((s) => s.site_id === request.site_id) || E.nearestSite(request.lat, request.lon, sites).site;
    const scenario = { ...site, ...pick(request, ['site_salinity', 'water_days', 'space', 'care', 'purpose', 'children_or_animals']) };
    const local = E.recommend(scenario, plants, 6);

    if (await isBackendUp()) {
      try {
        const r = await http('/api/recommend', { method: 'POST', body: JSON.stringify(request) });
        const localSub = new Map(local.eligible.map((x) => [x.plant.scientific_name, x]));
        return {
          source: 'model',
          site: r.site || site,
          distance_km: r.distance_km ?? request.distance_km ?? null,
          site_salinity: r.site_salinity ?? request.site_salinity,
          recommendations: (r.recommendations || []).map((x) => {
            const plant = byName.get(x.scientific_name) || { ...x, scientific_name: x.scientific_name, common_name: x.common_name || x.scientific_name };
            const mine = localSub.get(x.scientific_name);
            return {
              plant,
              probability: typeof x.probability === 'number' ? x.probability : null,
              score: x.score ?? (mine ? mine.score : null),
              sub: x.sub || (mine ? mine.sub : null),
            };
          }),
          excluded: (r.excluded || []).map((x) => ({
            plant: byName.get(x.scientific_name) || { scientific_name: x.scientific_name, common_name: x.common_name || x.scientific_name },
            code: x.code || String(x.reason || '').split(':')[0],
            reason: x.reason || '',
          })),
        };
      } catch (e) {
        console.warn('Backend /api/recommend failed, using offline engine:', e);
      }
    }
    return {
      source: 'rules',
      site,
      distance_km: request.distance_km ?? null,
      site_salinity: request.site_salinity,
      recommendations: local.recommended.map((x) => ({ plant: x.plant, score: x.score, probability: null, sub: x.sub })),
      eligible: local.eligible.map((x) => ({ plant: x.plant, score: x.score, probability: null, sub: x.sub })),
      excluded: local.excluded,
    };
  }

  /** Returns { answer, source } or null when the backend has no chat endpoint. */
  async function chat(question, context) {
    if (!(await isBackendUp())) return null;
    try {
      return await http('/api/chat', { method: 'POST', body: JSON.stringify({ question, ...context }) });
    } catch (e) {
      return null;
    }
  }

  /** Today's weather from Open-Meteo (free, no key). null on any failure. */
  async function todayWeather(lat, lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
                  '&daily=temperature_2m_max,precipitation_sum,precipitation_probability_max&timezone=Asia%2FKarachi&forecast_days=1';
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const d = (await res.json()).daily;
      return { tmax: d.temperature_2m_max[0], rain_mm: d.precipitation_sum[0], rain_chance: d.precipitation_probability_max?.[0] ?? null };
    } catch (e) {
      return null;
    }
  }

  function pick(o, keys) {
    const r = {};
    for (const k of keys) r[k] = o[k];
    return r;
  }

  root.PlantifyApi = { getSites, getPlants, nearestSite, recommend, chat, todayWeather, isBackendUp, base: BASE };
})(self);
