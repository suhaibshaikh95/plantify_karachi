/*
 * Plantify Karachi - app logic for the five screens:
 *   #/welcome -> #/location -> #/questions -> #/results -> #/chat
 *
 * State lives in sessionStorage so a refresh keeps your answers.
 * "Save" keeps the last result on this device (localStorage).
 *
 * (Roman Urdu: screens ke beech navigation, form answers aur results yahan handle hote hain.)
 */
(function () {
  'use strict';
  const E = window.PlantifyEngine;
  const Api = window.PlantifyApi;
  const T = window.PlantifyText;
  const Chat = window.PlantifyChat;

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Design answers -> model inputs (see frontend/README.md, "How answers map to the model").
  const PURPOSE_MAP = { shade: 'shade', flowers: 'ornamental', fruit: 'fruit', hedge: 'ornamental', greenery: 'carbon' };
  const REQUIRED = { water_days: 'watering days', space: 'space', care: 'care', purpose: 'purpose', children_or_animals: 'children or animals' };
  const TEXTURE_WORD = { light: 'Sandy', medium: 'Loam', heavy: 'Clay' };
  const SALT_LABEL = ['Low', 'Medium', 'High'];
  const EXCLUDE_ORDER = ['do_not_plant', 'poisonous', 'salinity', 'space', 'water', 'ph', 'temperature'];
  const FILTERS = [
    { key: 'native', label: 'Native', test: (p) => p.native === 1 },
    { key: 'lowwater', label: 'Low water', test: (p) => p.water_need === 1 },
    { key: 'lowcare', label: 'Low care', test: (p) => p.low_maintenance === 1 },
    { key: 'shade', label: 'Shade', test: (p) => p.purpose_shade === 1 },
    { key: 'fruit', label: 'Fruit', test: (p) => p.purpose_fruit === 1 },
    { key: 'flowers', label: 'Flowers', test: (p) => p.purpose_ornamental === 1 },
  ];
  const PALMS = ['Phoenix', 'Cocos', 'Roystonea', 'Livistona', 'Washingtonia', 'Nannorrhops'];
  const FORM_ICON = {
    Tree: '<path d="M12 22v-6"/><path d="M7.5 16h9a4 4 0 0 0 1.2-7.8A5.5 5.5 0 0 0 6.3 8.2 4 4 0 0 0 7.5 16z"/>',
    Shrub: '<path d="M3 20h18"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M9 14.5a3 3 0 0 1 6 0"/>',
    Palm: '<path d="M12.5 22c0-5 .5-9 .5-13"/><path d="M13 9C11 5 7 4 3 6"/><path d="M13 9c2-4 6-5 9-3"/><path d="M13 9c-3-1-7 1-8 5"/><path d="M13 9c3-1 6 1 7 5"/>',
  };
  const SKELETON = `<div class="results-layout" aria-busy="true" aria-label="Checking 85 plants against your site">
      <aside class="results-side"><div class="sk sk-title"></div><div class="sk sk-line"></div><div class="sk sk-card"></div></aside>
      <div class="results-main"><div class="sk sk-line short"></div><div class="plant-list">
        ${'<div class="sk sk-plant"></div>'.repeat(4)}</div>
        <p class="loading-text">Checking 85 plants against your site…</p></div></div>`;

  // ------------------------------------------------------------------ state
  const KEY = 'plantify.state.v1', SAVED = 'plantify.saved.v1';
  const store = {
    get(k, area = sessionStorage) { try { return JSON.parse(area.getItem(k)); } catch (e) { return null; } },
    set(k, v, area = sessionStorage) { try { area.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del(k, area = sessionStorage) { try { area.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const fresh = () => ({ loc: null, site: null, distance_km: null, photo: null,
                         answers: { signs: {} }, request: null, result: null, chat: [], weather: null });
  let state = Object.assign(fresh(), store.get(KEY) || {});
  const save = () => store.set(KEY, state);

  // ------------------------------------------------------------------ theme (light / dark)
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function isDark() {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : !!(darkQuery && darkQuery.matches);
  }
  function syncThemeButtons() {
    const dark = isDark();
    $$('.theme-toggle').forEach((b) => {
      b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      b.dataset.mode = dark ? 'dark' : 'light';
    });
  }
  $$('.theme-toggle').forEach((b) => b.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('plantify.theme', next); } catch (e) { /* ignore */ }
    syncThemeButtons();
  }));
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', syncThemeButtons);
  syncThemeButtons();

  // ------------------------------------------------------------------ router
  const SCREENS = ['welcome', 'location', 'questions', 'results', 'chat'];
  let loading = false;   // true while /api/recommend is running
  const filters = new Set();   // active results filters
  function route() {
    let name = (location.hash.replace(/^#\/?/, '') || 'welcome').split('?')[0];
    if (!SCREENS.includes(name)) name = 'welcome';
    if (name === 'results' && !state.result && !loading) {
      const saved = store.get(SAVED, localStorage);
      if (saved) { state = Object.assign(fresh(), saved.state); save(); }
    }
    if (name === 'questions' && !state.loc) name = 'location';
    if (name === 'results' && !state.result && !loading) name = state.loc ? 'questions' : 'location';
    if (name === 'chat' && !state.result) name = 'welcome';
    if (location.hash !== '#/' + name) history.replaceState(null, '', '#/' + name);

    $$('.screen').forEach((s) => { s.hidden = s.dataset.screen !== name; });
    document.body.dataset.screen = name;
    updateSavedLinks();
    window.scrollTo(0, 0);
    ({ welcome: showWelcome, location: showLocation, questions: showQuestions, results: showResults, chat: showChat })[name]();
    const h = $(`#screen-${name} h1`) || $(`#screen-${name} .nav-title`);
    if (h && document.activeElement && document.activeElement !== document.body) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  window.addEventListener('hashchange', route);

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ------------------------------------------------------------------ 1 · Welcome
  function showWelcome() {
    updateSavedLinks();
  }

  function updateSavedLinks() {
    const has = !!store.get(SAVED, localStorage);
    $$('.saved-link').forEach((a) => { a.hidden = !has; });
  }

  // ------------------------------------------------------------------ 2 · Photo & location
  let map = null, marker = null, moving = false, sitesLoaded = false, photoUrl = null;

  function pinIcon() {
    return L.divIcon({
      className: 'pin-icon', iconSize: [32, 40], iconAnchor: [16, 39],
      html: '<svg width="32" height="40" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 29s9-9.5 9-17A9 9 0 0 0 3 12c0 7.5 9 17 9 17z" fill="#2F6B3F"/><circle cx="12" cy="12" r="3.5" fill="#FFFFFF"/></svg>',
    });
  }

  function initMap() {
    if (map || typeof L === 'undefined') {
      if (typeof L === 'undefined') { $('#map').hidden = true; $('#move-pin').hidden = true; }
      return;
    }
    const b = E.KARACHI_BOUNDS;
    map = L.map('map', { zoomControl: false, attributionControl: true, maxBounds: [[b.south - 0.3, b.west - 0.3], [b.north + 0.3, b.east + 0.3]] })
      .setView([24.93, 67.08], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, minZoom: 9, attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    map.on('click', (e) => { if (moving) setLocation(e.latlng.lat, e.latlng.lng, 'map'); });
  }

  function placeMarker(lat, lon) {
    if (!map) return;
    if (!marker) {
      marker = L.marker([lat, lon], { icon: pinIcon(), draggable: true, keyboard: true, title: 'Your plot' }).addTo(map);
      marker.on('dragend', () => { const p = marker.getLatLng(); setLocation(p.lat, p.lng, 'map'); });
    } else {
      marker.setLatLng([lat, lon]);
    }
    map.setView([lat, lon], Math.max(map.getZoom(), 14));
  }

  async function loadSiteOptions() {
    if (sitesLoaded) return;
    try {
      const sites = await Api.getSites();
      const sel = $('#site-select');
      const sorted = [...sites].sort((a, b) => a.area_name.localeCompare(b.area_name));
      sel.insertAdjacentHTML('beforeend', sorted.map((s) =>
        `<option value="${s.site_id}">${esc(s.label || s.area_name)}${s.town ? ' · ' + esc(s.town) : ''}</option>`).join(''));
      sitesLoaded = true;
      if (state.site && state.loc?.source === 'list') sel.value = String(state.site.site_id);
    } catch (e) {
      setMsg('#location-msg', 'Could not load the list of Karachi areas. Check your connection and refresh.', true);
    }
  }

  function placeLabel(site) {
    return site ? (site.label || site.area_name) + (site.town ? `, ${site.town}` : '') : 'Set your location';
  }

  function fmtCoords(lat, lon) {
    return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
  }

  async function setLocation(lat, lon, source) {
    if (!E.inKarachi(lat, lon)) {
      setMsg('#location-msg', `That point (${fmtCoords(lat, lon)}) is outside Karachi. Plantify only covers Karachi; move the pin or choose your area.`, true);
      if (source !== 'photo') { state.loc = null; state.site = null; save(); renderLocation(); }
      return;
    }
    setMsg('#location-msg', '');
    const near = await Api.nearestSite(lat, lon);
    state.loc = { lat, lon, source };
    state.site = near.site;
    state.distance_km = near.distance_km;
    state.result = null;
    save();
    renderLocation();
    if (source !== 'list') $('#site-select').value = '';
  }

  function renderLocation() {
    const ok = !!(state.loc && state.site);
    $('#place-name').textContent = ok ? placeLabel(state.site) : 'Set your location';
    $('#place-coords').textContent = ok ? `${fmtCoords(state.loc.lat, state.loc.lon)} · inside Karachi`
      : 'Use a photo with GPS, your current location, or tap the map';
    $('#location-continue').disabled = !ok;
    if (ok) placeMarker(state.loc.lat, state.loc.lon);
    const ph = state.photo;
    $('#photo-empty').hidden = !!(ph && photoUrl);
    $('#photo-img').hidden = !(ph && photoUrl);
    $('#photo-replace').hidden = !(ph && photoUrl);
    $('#photo-chips').hidden = !ph;
    if (ph) {
      $('#photo-name').textContent = ph.name;
      const g = $('#photo-gps');
      g.textContent = ph.gps ? 'GPS found in photo' : 'No GPS in photo';
      g.classList.toggle('ok', !!ph.gps);
    }
  }

  function setMsg(sel, text, isError = false) {
    const m = $(sel);
    m.textContent = text;
    m.classList.toggle('error', !!isError);
  }

  function showLocation() {
    initMap();
    loadSiteOptions();
    renderLocation();
    if (map) setTimeout(() => map.invalidateSize(), 0);
  }

  $('#photo-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(file);
    const img = $('#photo-img');
    img.src = photoUrl;
    img.onerror = () => { img.hidden = true; $('#photo-empty').hidden = false; };
    const gps = await window.PlantifyExif.readGps(file);
    state.photo = { name: file.name, gps: !!gps };
    save();
    renderLocation();
    if (gps) {
      await setLocation(gps.lat, gps.lon, 'photo');
      if (!E.inKarachi(gps.lat, gps.lon)) setMsg('#location-msg', 'The photo was taken outside Karachi. Set your plot’s location below.', true);
    } else if (!state.loc) {
      setMsg('#location-msg', 'This photo has no location in it. Use your current location, tap the map or choose your area.');
    }
  });

  $('#use-location').addEventListener('click', () => {
    if (!navigator.geolocation) { setMsg('#location-msg', 'Your browser cannot share its location. Choose your area from the list.', true); return; }
    const btn = $('#use-location');
    btn.disabled = true;
    setMsg('#location-msg', 'Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => { btn.disabled = false; setLocation(pos.coords.latitude, pos.coords.longitude, 'gps'); },
      (err) => {
        btn.disabled = false;
        setMsg('#location-msg', err.code === 1 ? 'Location permission was blocked. Allow it in your browser, or choose your area from the list.'
          : 'Could not find your location. Try again outside, or choose your area from the list.', true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });

  $('#move-pin').addEventListener('click', () => {
    moving = !moving;
    $('#map').classList.toggle('moving', moving);
    $('#move-pin').textContent = moving ? 'Done' : 'Move pin';
    if (moving) setMsg('#location-msg', 'Tap the map or drag the pin to your plot.');
    else if ($('#location-msg').textContent.startsWith('Tap the map')) setMsg('#location-msg', '');
  });

  $('#site-select').addEventListener('change', async (e) => {
    if (!e.target.value) return;
    const sites = await Api.getSites();
    const s = sites.find((x) => String(x.site_id) === e.target.value);
    if (s) setLocation(s.lat, s.lon, 'list');
  });

  $('#location-continue').addEventListener('click', () => { location.hash = '#/questions'; });

  // ------------------------------------------------------------------ 3 · Questions
  function renderQuestions() {
    const a = state.answers;
    $$('.yn-row').forEach((row) => {
      const v = a.signs[row.dataset.sign];
      $$('button', row).forEach((b) => b.setAttribute('aria-pressed', String(v === undefined ? false : (b.dataset.v === 'yes') === v)));
    });
    $$('fieldset[data-field]').forEach((fs) => {
      const v = a[fs.dataset.field];
      $$('.c', fs).forEach((b) => b.setAttribute('aria-pressed', String(v !== undefined && String(v) === b.dataset.v)));
    });
  }

  function showQuestions() {
    renderQuestions();
    setMsg('#questions-msg', '');
    $$('fieldset.missing').forEach((f) => f.classList.remove('missing'));
  }

  $('#questions-form').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const row = b.closest('.yn-row');
    const fs = b.closest('fieldset[data-field]');
    if (row) {
      const v = b.dataset.v === 'yes';
      if (state.answers.signs[row.dataset.sign] === v) delete state.answers.signs[row.dataset.sign];
      else state.answers.signs[row.dataset.sign] = v;
    } else if (fs) {
      const f = fs.dataset.field;
      state.answers[f] = ['water_days', 'children_or_animals'].includes(f) ? Number(b.dataset.v) : b.dataset.v;
      fs.classList.remove('missing');
    }
    state.result = null;
    save();
    renderQuestions();
  });

  $('#get-plants').addEventListener('click', () => {
    const missing = Object.keys(REQUIRED).filter((k) => state.answers[k] === undefined);
    $$('fieldset[data-field]').forEach((fs) => fs.classList.toggle('missing', missing.includes(fs.dataset.field)));
    if (missing.length) {
      setMsg('#questions-msg', `Please answer: ${missing.map((k) => REQUIRED[k]).join(', ')}.`, true);
      $(`fieldset[data-field="${missing[0]}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    runRecommendation();
  });

  function buildRequest() {
    const a = state.answers, site = state.site;
    const signs = { crust: a.signs.crust === true, borewell: a.signs.borewell === true, burnt: a.signs.burnt === true, sea: a.signs.sea === true };
    return {
      lat: state.loc.lat,
      lon: state.loc.lon,
      site_id: site.site_id,
      distance_km: state.distance_km,
      salt_signs: signs,
      site_salinity: E.salinityFromSigns(site.site_salinity_default, signs),
      water_days: a.water_days,
      space: a.space,
      care: a.care,
      purpose: PURPOSE_MAP[a.purpose] || 'any',
      purpose_answer: a.purpose,
      children_or_animals: a.children_or_animals,
      budget: a.budget || null,
    };
  }

  async function runRecommendation() {
    state.request = buildRequest();
    filters.clear();
    state.result = null;
    state.chat = [];
    state.weather = null;
    save();
    loading = true;
    location.hash = '#/results';
    $('#results-body').innerHTML = SKELETON;
    try {
      state.result = await Api.recommend(state.request);
      loading = false;
      save();
      if (location.hash === '#/results') showResults();
      else route();
    } catch (e) {
      loading = false;
      console.error(e);
      $('#results-body').innerHTML = `<div class="loading">Something went wrong while getting your plants.<br><br>
        <button type="button" class="btn btn-primary" id="retry">Try again</button></div>`;
      $('#retry').addEventListener('click', runRecommendation);
    }
  }

  // ------------------------------------------------------------------ 4 · Results
  function scenario() {
    return { ...state.site, ...state.request };
  }

  function showResults() {
    const r = state.result;
    if (!r) {
      if (loading) $('#results-body').innerHTML = SKELETON;
      return;
    }
    const s = scenario();
    const recs = r.recommendations;
    const site = r.site || state.site;
    const mapSal = Number(site.site_salinity_default);
    const raised = s.site_salinity > mapSal;

    const excluded = [...r.excluded].sort((a, b) => EXCLUDE_ORDER.indexOf(a.code) - EXCLUDE_ORDER.indexOf(b.code));

    const actions = (cls) => `<div class="actions ${cls}">
        ${recs.length ? '<a href="#/chat" class="btn btn-primary">Ask about a plant</a>' : ''}
        <button type="button" class="btn btn-secondary start-over">Start over</button>
      </div>`;
    const source = `<p class="source">Based on mapped soil and salt data, not a soil test.
        ${r.source === 'model' ? 'Ranked by the XGBoost model.' : 'Scored by Plantify’s rule engine.'}</p>`;

    $('#results-body').innerHTML = `<div class="results-layout"><aside class="results-side">
      <h1 class="results-title">${recs.length ? `${recs.length} plant${recs.length === 1 ? '' : 's'} for your plot` : 'No safe plants found'}</h1>
      <p class="results-sub">${esc(site.label || site.area_name)}${r.distance_km !== null && r.distance_km !== undefined ? ` · nearest reference site ${esc(r.distance_km)} km` : ''}</p>

      <div class="card stats">
        <div class="stat"><b>${SALT_LABEL[s.site_salinity] || '–'}</b><span>Salinity</span></div>
        <div class="stat"><b>pH ${esc(site.ph)}</b><span>Soil</span></div>
        <div class="stat"><b>${TEXTURE_WORD[site.texture] || esc(site.texture)}</b><span>Texture</span></div>
        <div class="stat"><b>${Math.round(site.t_mean)} °C</b><span>Avg temp</span></div>
      </div>
      ${raised ? `<p class="fine">You reported signs of salt, so we raised salinity from ${SALT_LABEL[mapSal].toLowerCase()} (soil map) to ${SALT_LABEL[s.site_salinity].toLowerCase()}.</p>` : ''}
      <div id="weather-tip"></div>
      ${actions('desk-only')}
      ${source.replace('class="source"', 'class="source desk-only"')}
      </aside>
      <div class="results-main">

      ${recs.length ? `<div class="list-head">
        <p class="section-label" id="list-label">Recommended</p>
        <div class="filters" role="group" aria-label="Filter plants">${FILTERS.map((f) =>
          `<button type="button" class="fc" data-f="${f.key}" aria-pressed="${filters.has(f.key)}">${esc(f.label)}</button>`).join('')}</div>
      </div>
      <p class="filter-note" id="filter-note" aria-live="polite"></p>
      <div class="plant-list" id="plant-list"></div>` : `<div class="tip warn" style="margin-top:20px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>
        <div>None of the 85 plants passed every safety and survival check. More watering days or a larger space usually helps.</div></div>`}

      ${excluded.length ? `<details class="excluded"${excluded.length <= 5 ? ' open' : ''}>
        <summary>Not recommended here (${excluded.length})</summary>
        ${excluded.map((x) => `<div class="rm"><span>${esc(T.displayName(x.plant))}</span><span>${esc(T.excludedReason(x))}</span></div>`).join('')}
      </details>` : ''}

      ${actions('mob-only')}
      ${source.replace('class="source"', 'class="source mob-only"')}
      </div></div>`;

    if (recs.length) {
      renderPlantList();
      $('#results-body .filters').addEventListener('click', (e) => {
        const b = e.target.closest('.fc');
        if (!b) return;
        if (filters.has(b.dataset.f)) filters.delete(b.dataset.f); else filters.add(b.dataset.f);
        b.setAttribute('aria-pressed', String(filters.has(b.dataset.f)));
        renderPlantList();
      });
    }

    $$('#results-body .start-over').forEach((b) => b.addEventListener('click', () => {
      filters.clear();
      state = fresh();
      save();
      if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = null; }
      $('#photo-input').value = '';
      location.hash = '#/welcome';
    }));
    updateSaveButton();
    loadWeather();
  }

  function plantForm(p) {
    if (PALMS.some((g) => p.scientific_name.startsWith(g + ' '))) return 'Palm';
    const f = p.form || [];
    if (/\(shrub\)/i.test(p.common_name || '')) return 'Shrub';
    if (f.includes('shrub') && !f.includes('tree')) return 'Shrub';
    return 'Tree';
  }

  function gauge(v, top) {
    const C = 2 * Math.PI * 20;
    const off = C * (1 - Math.max(0, Math.min(100, v)) / 100);
    return `<div class="gauge${top ? ' top' : ''}" role="img" aria-label="Suitability ${v} out of 100">
      <svg viewBox="0 0 48 48" aria-hidden="true"><circle class="g-track" cx="24" cy="24" r="20"/>
      <circle class="g-fill" cx="24" cy="24" r="20" stroke-dasharray="${C.toFixed(1)}" style="--len:${C.toFixed(1)};--off:${off.toFixed(1)}"/></svg>
      <span>${v}</span></div>`;
  }

  function plantCard(x, rank, source, s) {
    const p = x.plant;
    const tags = T.tags(p);
    const form = plantForm(p);
    const v = (x.probability !== null && x.probability !== undefined) ? Math.round(x.probability * 100) : Math.round(x.score);
    return `<details class="pl">
      <summary>
        <div class="ph" data-sci="${esc(p.scientific_name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FORM_ICON[form]}</svg>
        </div>
        <div class="pl-main">
          <div class="nm">${esc(T.displayName(p))}</div>
          <div class="lt"><span class="form-ic" title="${form}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FORM_ICON[form]}</svg>${form}</span> · <i>${esc(p.scientific_name)}</i></div>
          <p class="why">${esc(T.why(p, x.sub, s))}</p>
          ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="pl-side">
          ${gauge(v, rank < 3)}
          <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </summary>
      ${breakdown(x, source)}
    </details>`;
  }

  /** Top 6 by default; with filters, the best 6 of every suitable plant that matches all of them. */
  function renderPlantList() {
    const r = state.result;
    const s = scenario();
    const active = FILTERS.filter((f) => filters.has(f.key));
    const pool = (r.eligible && r.eligible.length) ? r.eligible : r.recommendations;
    let items, note = '';
    if (!active.length) {
      items = r.recommendations.map((x, i) => ({ x, rank: i }));
    } else {
      const words = active.map((f) => f.label.toLowerCase()).join(' + ');
      const matches = pool.map((x, i) => ({ x, rank: i })).filter(({ x }) => active.every((f) => f.test(x.plant)));
      items = matches.slice(0, 6);
      note = matches.length
        ? `Showing the best ${items.length} of ${matches.length} suitable plant${matches.length === 1 ? '' : 's'} that ${matches.length === 1 ? 'is' : 'are'} ${words}.`
        : `No suitable plants are ${words}. Remove a filter to see more.`;
    }
    $('#list-label').textContent = active.length ? 'Filtered' : 'Recommended';
    $('#filter-note').textContent = note;
    $('#plant-list').innerHTML = items.map(({ x, rank }) => plantCard(x, rank, r.source, s)).join('');
    fillPhotos();
  }

  /** Swap each plant's icon for its Wikipedia photo once it loads; add the photo credit. */
  async function fillPhotos() {
    if (!window.PlantifyPhotos) return;
    const slots = $$('#plant-list .ph[data-sci]');
    const photos = await window.PlantifyPhotos.get(slots.map((el) => el.dataset.sci));
    for (const el of slots) {
      const ph = photos.get(el.dataset.sci);
      if (!ph || !el.isConnected || el.querySelector('img')) continue;
      const card = el.closest('.pl');
      const img = new Image();
      img.alt = 'Photo of ' + ($('.nm', card) ? $('.nm', card).textContent : el.dataset.sci);
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => { el.classList.add('has-photo'); img.classList.add('loaded'); };
      img.onerror = () => img.remove();
      img.src = ph.thumb;
      el.appendChild(img);
      const credit = $('.credit', card);
      if (credit) {
        credit.innerHTML = `Photo: <a href="${esc(ph.page)}" target="_blank" rel="noopener">${esc(ph.artist)}</a>, ${esc(ph.license)}, via Wikimedia Commons.`;
        credit.hidden = false;
      }
    }
  }

  function breakdown(x, source) {
    const p = x.plant;
    let html = '<div class="breakdown"><h3>Why this score</h3>';
    if (x.sub) {
      html += Object.keys(T.SUB_LABELS).filter((k) => x.sub[k] !== undefined).map((k) => {
        const v = Math.round(x.sub[k] * 100);
        return `<div class="bar"><span>${T.SUB_LABELS[k]}</span><div class="bar-track"><div style="width:${v}%"></div></div><span class="bar-val">${v}%</span></div>`;
      }).join('');
    }
    const bonus = [];
    if (p.native === 1) bonus.push('+5 native');
    if (p.guide_recommendation === 'good') bonus.push('+5 Karachi planting guide');
    if (p.proven_in_karachi === 1) bonus.push('+3 proven in Karachi');
    const notes = [];
    if (source === 'model' && x.probability !== null) notes.push(`Model: ${(x.probability * 100).toFixed(1)}% likely to suit your site.${x.score !== null && x.score !== undefined ? ` Rule score ${x.score}/100.` : ''}`);
    else if (x.score !== null && x.score !== undefined) notes.push(`Rule score ${x.score}/100.`);
    if (bonus.length) notes.push(`Bonuses: ${bonus.join(', ')}.`);
    if (T.guideNote(p) && p.guide_recommendation !== 'good') notes.push(`Guide: ${T.guideNote(p)}.`);
    if (p.trait_confidence === 'low' || p.trait_confidence === 'medium') notes.push('Some traits for this plant are estimates; check with a nursery.');
    html += notes.map((n) => `<p>${esc(n)}</p>`).join('');
    return html + '<p class="credit" hidden></p></div>';
  }

  async function loadWeather() {
    const box = $('#weather-tip');
    if (!box || !state.loc) return;
    const w = state.weather || await Api.todayWeather(state.loc.lat, state.loc.lon);
    if (!w || !$('#weather-tip')) return;
    state.weather = w;
    save();
    const t = Math.round(w.tmax);
    const rain = w.rain_mm >= 2 || (w.rain_chance !== null && w.rain_chance >= 60);
    let head, tip;
    if (rain) { head = `Today ${t} °C, rain likely.`; tip = 'You can skip watering new plants today.'; }
    else if (t >= 35) { head = `Today ${t} °C, no rain.`; tip = 'Water new plants early morning or after sunset.'; }
    else { head = `Today ${t} °C, no rain.`; tip = 'Water new plants in the morning or evening.'; }
    $('#weather-tip').innerHTML = `<div class="tip">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      <div><b>${esc(head)}</b> ${esc(tip)}</div></div>`;
  }

  function updateSaveButton() {
    const saved = store.get(SAVED, localStorage);
    const on = !!(saved && state.result && JSON.stringify(saved.state.request) === JSON.stringify(state.request));
    $('#save-btn').setAttribute('aria-pressed', String(on));
  }

  $('#save-btn').addEventListener('click', () => {
    if ($('#save-btn').getAttribute('aria-pressed') === 'true') {
      store.del(SAVED, localStorage);
      toast('Removed from this device');
    } else {
      const { photo, ...rest } = state;
      store.set(SAVED, { savedAt: new Date().toISOString(), state: rest }, localStorage);
      toast(store.get(SAVED, localStorage) ? 'Saved on this device' : 'Could not save: storage is blocked in this browser');
    }
    updateSaveButton();
    updateSavedLinks();
  });

  // ------------------------------------------------------------------ 5 · Chat
  let plantsAll = null;
  let lastPlant = null;

  function showChat() {
    if (!state.chat.length) {
      state.chat.push({ who: 'bot', text: `Hi. I can answer questions about the ${state.result.recommendations.length} plants we suggested for your plot.` });
      save();
    }
    renderChat();
    const top = state.result.recommendations[0];
    const sugg = ['Best time to plant?', 'Fertiliser?', 'Pests'];
    if (top) sugg.unshift(`How often to water ${T.displayName(top.plant)}?`);
    $('#suggestions').innerHTML = sugg.map((q) => `<button type="button" class="sg">${esc(q)}</button>`).join('');
  }

  function renderChat(typing = false) {
    const log = $('#chat-log');
    log.innerHTML = state.chat.map((m) => m.who === 'me'
      ? `<div class="me">${esc(m.text)}</div>`
      : `<div class="bot">${esc(m.text)}${m.source ? `<span class="src">From: ${esc(m.source)}</span>` : ''}</div>`).join('')
      + (typing ? '<div class="bot typing">Thinking…</div>' : '');
    log.scrollTop = log.scrollHeight;
  }

  async function ask(question) {
    question = question.trim();
    if (!question) return;
    state.chat.push({ who: 'me', text: question });
    renderChat(true);
    plantsAll = plantsAll || await Api.getPlants();
    const recs = state.result.recommendations;
    const remote = await Api.chat(question, {
      site_id: state.site.site_id,
      plants: recs.map((x) => x.plant.scientific_name),
      history: state.chat.slice(-8),
    });
    let reply;
    if (remote && remote.answer) {
      reply = { who: 'bot', text: remote.answer, source: remote.source || 'Plantify assistant' };
    } else {
      const a = Chat.answer(question, {
        plants: plantsAll, result: state.result, scenario: scenario(),
        salt_signs: state.request.salt_signs, lastPlant,
      });
      if (a.plant) lastPlant = a.plant;
      reply = { who: 'bot', text: a.text, source: a.source };
    }
    state.chat.push(reply);
    save();
    renderChat();
  }

  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#chat-input');
    const q = input.value;
    input.value = '';
    ask(q);
  });
  $('#suggestions').addEventListener('click', (e) => {
    const b = e.target.closest('.sg');
    if (b) ask(b.textContent);
  });

  // ------------------------------------------------------------------ start
  route();
})();
