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

  // ------------------------------------------------------------------ router
  const SCREENS = ['welcome', 'location', 'questions', 'results', 'chat'];
  let loading = false;   // true while /api/recommend is running
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
    state.result = null;
    state.chat = [];
    state.weather = null;
    save();
    loading = true;
    location.hash = '#/results';
    $('#results-body').innerHTML = '<div class="loading"><div class="spinner"></div>Checking 85 plants against your site…</div>';
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
      if (loading) $('#results-body').innerHTML = '<div class="loading"><div class="spinner"></div>Checking 85 plants against your site…</div>';
      return;
    }
    const s = scenario();
    const recs = r.recommendations;
    const site = r.site || state.site;
    const mapSal = Number(site.site_salinity_default);
    const raised = s.site_salinity > mapSal;
    const shown = (x) => (x.probability !== null && x.probability !== undefined) ? Math.round(x.probability * 100) : Math.round(x.score);

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

      ${recs.length ? `<p class="section-label">Recommended</p>
      <div class="plant-list">${recs.map((x, i) => {
        const p = x.plant;
        const tags = T.tags(p);
        return `<details class="pl">
          <summary>
            <div class="sc${i < 3 ? ' top' : ''}" aria-label="Suitability ${shown(x)} out of 100">${shown(x)}</div>
            <div class="pl-main">
              <div class="nm">${esc(T.displayName(p))}</div><div class="lt">${esc(p.scientific_name)}</div>
              <p class="why">${esc(T.why(p, x.sub, s))}</p>
              ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
            </div>
            <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          ${breakdown(x, r.source)}
        </details>`;
      }).join('')}</div>` : `<div class="tip warn" style="margin-top:20px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>
        <div>None of the 85 plants passed every safety and survival check. More watering days or a larger space usually helps.</div></div>`}

      ${excluded.length ? `<details class="excluded"${excluded.length <= 5 ? ' open' : ''}>
        <summary>Not recommended here (${excluded.length})</summary>
        ${excluded.map((x) => `<div class="rm"><span>${esc(T.displayName(x.plant))}</span><span>${esc(T.excludedReason(x))}</span></div>`).join('')}
      </details>` : ''}

      ${actions('mob-only')}
      ${source.replace('class="source"', 'class="source mob-only"')}
      </div></div>`;

    $$('#results-body .start-over').forEach((b) => b.addEventListener('click', () => {
      state = fresh();
      save();
      if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = null; }
      $('#photo-input').value = '';
      location.hash = '#/welcome';
    }));
    updateSaveButton();
    loadWeather();
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
    return html + '</div>';
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
