// Turns the raw POST /api/recommend response into what the results screen shows.
// Presentation only: labels, rounding and wording. Every decision (which plants, their order,
// scores, exclusions, salinity) is already made by the backend.
import { backendUrl } from './apiClient';

const SALINITY_LABEL = ['Low', 'Medium', 'High'];
const TEXTURE_LABEL = { light: 'Sandy', medium: 'Loam', heavy: 'Clay' };
const WATER_TAG = { 1: 'Water 1×/week', 3: 'Water 3×/week', 5: 'Water daily' };
const BREAKDOWN_LABELS = {
  salt: 'Salt',
  water: 'Water',
  temp: 'Climate',
  ph: 'Soil pH',
  texture: 'Soil type',
  drainage: 'Drainage',
  fertility: 'Fertility',
  space: 'Space',
  care: 'Care',
  purpose: 'Purpose',
  pollution: 'Heat & pollution',
};
const EXCLUDED_REASON = {
  do_not_plant: 'On the do-not-plant list',
  poisonous: 'Poisonous; children or animals use the site',
  salinity: 'Salt above its tolerance',
  ph: 'Soil pH outside its range',
  temperature: 'Karachi temperatures outside its range',
  water: 'Needs more watering than you can give',
  space: 'Needs large open land for its roots',
};
// Genera drawn with the palm icon (the backend's `form` only says tree or shrub).
const PALM_GENERA = ['Phoenix', 'Cocos', 'Roystonea', 'Livistona', 'Washingtonia', 'Nannorrhops'];
const FAR_FROM_SITE_KM = 15;

const is1 = (v) => Number(v) === 1;

function formOf(plant) {
  if (PALM_GENERA.some((g) => plant.scientific_name.startsWith(`${g} `))) return 'palm';
  const form = plant.traits?.form || [];
  if (form.includes('shrub') && !form.includes('tree')) return 'shrub';
  return 'tree';
}

function joinList(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function summaryOf(t) {
  const parts = [];
  if (is1(t.purpose_shade)) parts.push('gives shade');
  if (is1(t.purpose_fruit)) parts.push('bears fruit');
  if (is1(t.purpose_ornamental) && parts.length < 2) parts.push('is ornamental');
  if (is1(t.water_need)) parts.push('needs little water');
  if (is1(t.urban_heat_tolerant) && parts.length < 3) parts.push('copes with Karachi heat');
  if (!parts.length) return t.guide_note ? capitalise(t.guide_note) + '.' : null;
  const s = joinList(parts.slice(0, 3));
  return capitalise(s) + '.';
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tagsOf(t) {
  const tags = [];
  if (is1(t.native)) tags.push('Native');
  if (WATER_TAG[t.water_need]) tags.push(WATER_TAG[t.water_need]);
  if (is1(t.low_maintenance)) tags.push('Low care');
  if (is1(t.urban_heat_tolerant)) tags.push('Heat tolerant');
  if (is1(t.proven_in_karachi)) tags.push('Proven in Karachi');
  return tags.slice(0, 4);
}

function filterTraitsOf(t) {
  return {
    native: is1(t.native),
    low_water: is1(t.water_need),
    low_care: is1(t.low_maintenance),
    shade: is1(t.purpose_shade),
    fruit: is1(t.purpose_fruit),
    flowers: is1(t.purpose_ornamental),
  };
}

function plantView(p, source) {
  const t = p.traits || {};
  const prob = typeof p.probability === 'number' ? p.probability : null;
  const notes = [];
  if (source === 'model' && prob !== null) notes.push(`Model: ${(prob * 100).toFixed(1)}% likely to suit your site.`);
  if (typeof p.score === 'number') notes.push(`Rule score ${p.score}/100.`);
  return {
    scientific_name: p.scientific_name,
    common_name: p.common_name || p.scientific_name,
    form: formOf(p),
    score: prob !== null ? Math.round(prob * 100) : Math.round(p.score ?? 0),
    summary: summaryOf(t),
    tags: tagsOf(t),
    traits: filterTraitsOf(t),
    score_breakdown: Object.keys(BREAKDOWN_LABELS)
      .filter((k) => typeof p.sub?.[k] === 'number')
      .map((k) => ({ label: BREAKDOWN_LABELS[k], value: p.sub[k] })),
    notes,
    image: p.photo?.url
      ? { url: backendUrl(p.photo.url), credit: p.photo.artist, license: p.photo.license, source_url: p.photo.source_page }
      : null,
  };
}

function siteView(res) {
  const site = res.site || {};
  const stats = [];
  if (typeof res.site_salinity === 'number') stats.push({ label: 'Salinity', value: SALINITY_LABEL[res.site_salinity] ?? String(res.site_salinity) });
  if (site.ph != null) stats.push({ label: 'Soil', value: `pH ${site.ph}` });
  if (site.texture) stats.push({ label: 'Texture', value: TEXTURE_LABEL[site.texture] || site.texture });
  if (site.t_mean != null) stats.push({ label: 'Avg temp', value: `${Math.round(site.t_mean)} °C` });

  const notes = [];
  const mapSal = site.site_salinity_default;
  if (typeof mapSal === 'number' && res.site_salinity > mapSal) {
    notes.push(
      `You reported signs of salt, so salinity was raised from ${SALINITY_LABEL[mapSal].toLowerCase()} (soil map) to ${SALINITY_LABEL[res.site_salinity].toLowerCase()}.`,
    );
  }
  if (res.distance_km > FAR_FROM_SITE_KM) {
    notes.push(`Your plot is ${res.distance_km} km from the nearest Karachi reference site, so these results may fit less well.`);
  }
  return { site_id: site.site_id, label: site.label || site.area_name, town: site.town, distance_km: res.distance_km, stats, notes };
}

/** Raw backend response -> { site, ranked_by, recommendations, excluded }. */
export function toResultsView(res) {
  if (!res) return null;
  return {
    site: siteView(res),
    ranked_by: res.source === 'model' ? 'the XGBoost model' : res.source ? 'rule scores (model offline)' : null,
    recommendations: (res.recommendations || []).map((p) => plantView(p, res.source)),
    excluded: (res.excluded || []).map((x) => ({
      scientific_name: x.scientific_name,
      common_name: x.common_name || x.scientific_name,
      reason: EXCLUDED_REASON[x.code] || x.reason,
    })),
  };
}
