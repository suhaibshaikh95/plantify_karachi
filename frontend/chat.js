/*
 * Plantify Karachi - plain-language text and the offline plant Q&A.
 *
 * PlantifyText: turns plant traits and engine sub-scores into short sentences for the UI.
 * PlantifyChat: answers questions about plants from the species data (data/plants.json).
 *   It is keyword based, not an AI model. When the backend has POST /api/chat, app.js uses
 *   that first and this is only the fallback. Every answer names where it came from.
 *
 * (Roman Urdu: sawal mein se plant ka naam aur topic dhoondh kar data se jawab banata hai.)
 */
(function (root) {
  'use strict';

  const SALT_WORD = ['low', 'medium', 'high'];
  const WATER_DAYS = { 1: 1, 3: 3, 5: 7 };

  function displayName(p) {
    let c = String(p.common_name || p.scientific_name || '').trim()
      .replace(/^\((.*)\)$/, '$1').replace(/^E\.g\.\s*/i, '').replace(/\s+etc\.?$/i, '').trim();
    if (!c) c = p.scientific_name;
    return c.charAt(0).toUpperCase() + c.slice(1);
  }

  function waterTag(p) {
    const d = WATER_DAYS[p.water_need];
    if (!d) return null;
    return d >= 7 ? 'Water daily' : `Water ${d}×/week`;
  }

  function waterPhrase(p) {
    const d = WATER_DAYS[p.water_need];
    if (d === 1) return 'about once a week';
    if (d === 3) return 'about three times a week';
    if (d === 7) return 'daily, or nearly every day';
    return 'regularly';
  }

  function tags(p) {
    const t = [];
    if (p.native === 1) t.push('Native');
    const w = waterTag(p);
    if (w) t.push(w);
    if (p.low_maintenance === 1) t.push('Low care');
    if (p.urban_heat_tolerant === 1 && t.length < 4) t.push('Heat tolerant');
    if (p.proven_in_karachi === 1 && t.length < 4) t.push('Proven in Karachi');
    return t.slice(0, 4);
  }

  /** One short sentence: why this plant fits this site and these answers. */
  function why(p, sub, s) {
    const good = [];
    if (s.site_salinity >= 1 && p.salt_tolerance > s.site_salinity) good.push(`handles ${SALT_WORD[s.site_salinity]} salt`);
    else if (s.site_salinity >= 1 && p.salt_tolerance >= s.site_salinity) good.push(`tolerates ${SALT_WORD[s.site_salinity]} salt`);
    const purposeText = { shade: 'gives shade', fruit: 'bears fruit', ornamental: 'is ornamental', carbon: 'stores a lot of carbon' };
    if (s.purpose !== 'any' && p['purpose_' + s.purpose] === 1) good.push(purposeText[s.purpose]);
    if (p.water_need === 1) good.push('needs little water');
    if (p.urban_heat_tolerant === 1) good.push('copes with Karachi heat');
    if (Number(s.children_or_animals) === 1 && p.poisonous !== 1) good.push('safe around children and animals');
    if (p.guide_good === 1 && good.length < 2) good.push('recommended in the Karachi planting guide');
    if (p.native === 1 && good.length < 2) good.push('a native species');
    if (p.low_maintenance === 1 && good.length < 2) good.push('needs little care');

    let text = good.length ? cap(joinList(good.slice(0, 3))) + '.' : 'Passes every safety and survival check for your site.';
    if (sub) {
      if (sub.purpose !== undefined && sub.purpose < 1 && s.purpose !== 'any') text += ' Not a strong match for your main purpose.';
      else if (sub.water !== undefined && sub.water < 1) text += ' Water as often as you can.';
    }
    return text;
  }

  /** Plain reason a plant was removed in Stage 1. */
  function excludedReason(x) {
    const p = x.plant || {};
    switch (x.code) {
      case 'do_not_plant': {
        const t = String(p.do_not_plant_tags || '');
        if (t.includes('banned_invasive') && t.includes('root_damage')) return 'Banned: invasive, damages pipes';
        if (t.includes('banned_invasive')) return 'Invasive; spreads as a weed';
        return 'On the city’s do-not-plant list';
      }
      case 'poisonous': return 'Poisonous; children or animals use the site';
      case 'salinity': return 'Salt above its tolerance';
      case 'ph': return 'Soil pH outside its range';
      case 'temperature': return 'Karachi temperatures outside its range';
      case 'water': return 'Needs more watering than you can give';
      case 'space': return 'Needs large open land for its roots';
      default: return x.reason ? cap(String(x.reason).split(':')[0]) : 'Did not pass the safety checks';
    }
  }

  /** The guide note, only when it says more than the plant's own name. */
  function guideNote(p) {
    const n = String(p.guide_note || '').trim();
    if (n.length <= 12) return '';
    const names = [p.common_name, p.scientific_name].map((x) => String(x || '').toLowerCase());
    return names.includes(n.toLowerCase()) ? '' : n;
  }

  const SUB_LABELS = { salt: 'Salt', water: 'Water', temp: 'Climate', ph: 'Soil pH', texture: 'Soil type',
                       drainage: 'Drainage', fertility: 'Fertility', space: 'Space', care: 'Care',
                       purpose: 'Purpose', pollution: 'Heat & pollution' };

  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function joinList(a) {
    if (a.length <= 1) return a.join('');
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }

  // ------------------------------------------------------------------ offline Q&A
  const GENERIC = new Set(['tree', 'trees', 'palm', 'shrub', 'common', 'the', 'true', 'wild', 'indian', 'chinese', 'fig',
                           'plant', 'white', 'black', 'red', 'pink', 'royal', 'false', 'flame', 'gum', 'mock', 'sea']);

  function nameKeys(p) {
    const keys = new Set();
    const add = (s) => {
      const k = s.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (k.length >= 3 && !GENERIC.has(k)) keys.add(k);
    };
    add(p.scientific_name);
    String(p.common_name || '').split(/[\/(),]/).forEach((part) => {
      add(part.replace(/\b(e\.g\.|etc|shrub)\b/gi, ''));
    });
    return [...keys];
  }

  function findPlant(question, plants, preferred) {
    const q = ' ' + question.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
    let best = null, bestLen = 0;
    const consider = (p, bonus) => {
      for (const k of nameKeys(p)) {
        if (q.includes(' ' + k + ' ') || q.includes(' ' + k + 's ')) {
          const len = k.length + bonus;
          if (len > bestLen) { best = p; bestLen = len; }
        }
      }
    };
    preferred.forEach((p) => consider(p, 0.5));
    plants.forEach((p) => consider(p, 0));
    return best;
  }

  const has = (q, words) => words.some((w) => q.includes(w));

  /**
   * ctx = { plants, result, scenario, lastPlant }
   * Returns { text, source, plant }.
   */
  function answer(question, ctx) {
    const q = question.toLowerCase();
    const recs = (ctx.result?.recommendations || []).map((r) => r.plant);
    const excluded = ctx.result?.excluded || [];
    const s = ctx.scenario || {};
    const named = findPlant(question, ctx.plants || [], recs);
    const p = named || ctx.lastPlant || recs[0];

    if (!p) return { text: 'Get your plant list first, then ask me about any of the six plants.', source: 'Plantify', plant: null };
    const name = displayName(p);
    const species = `Species data · ${name}`;
    const general = 'General Karachi planting advice';

    // Asked about a plant that was ruled out?
    const ex = excluded.find((x) => x.plant.scientific_name === p.scientific_name);
    if (named && ex) {
      return { plant: p, source: `Safety checks · ${name}`,
        text: `${name} was left out for your plot: ${excludedReason(ex).toLowerCase()}.` +
              (guideNote(p) ? ` Guide note: ${guideNote(p)}.` : '') };
    }

    if (has(q, ['which', 'best plant', 'recommend', 'list', 'six', 'top'] ) && !named) {
      if (!recs.length) return { plant: null, source: 'Plantify', text: 'No plants passed every check for this site. Try more watering days or a larger space.' };
      return { plant: recs[0], source: 'Your results',
        text: `Your top plants are ${joinList(recs.slice(0, 6).map(displayName))}. ${displayName(recs[0])} scored highest for your site.` };
    }

    if (has(q, ['water', 'pani', 'irrigat', 'how often', 'drought'])) {
      let t = `Once it is established, water ${name} ${waterPhrase(p)}.`;
      t += ' For the first two to three months after planting, water more often, early morning or after sunset.';
      if (ctx.salt_signs?.borewell) t += ' With salty borewell water, water deeply so salt is pushed below the roots.';
      return { plant: p, text: t, source: species };
    }

    if (has(q, ['wall', 'root', 'pipe', 'foundation', 'space', 'big', 'tall', 'size', 'height', 'pot', 'balcony', 'house'])) {
      let t;
      if (p.needs_large_space === 1) t = `${name} has large, aggressive roots. Plant it in open ground, well away from walls, pipes and foundations. It is not suited to pots or small yards.`;
      else if ((p.form || []).includes('tree')) t = `${name} does not need a very large root space, but it is a tree: keep it a few metres from walls and pipes as it grows.`;
      else t = `${name} does not need a large root space and suits a small yard.`;
      if (has(q, ['pot', 'balcony'])) t += (p.needs_large_space === 1 || (p.form || []).includes('tree')) ? ' A pot will limit its growth.' : ' It can be grown in a large pot.';
      return { plant: p, text: t, source: species };
    }

    if (has(q, ['salt', 'saline', 'salinity', 'namak', 'sea', 'coast'])) {
      const tol = SALT_WORD[p.salt_tolerance] || 'unknown';
      let t = `${name} has ${tol} salt tolerance.`;
      if (s.site_salinity !== undefined) t += ` Your site is rated ${SALT_WORD[s.site_salinity]} salinity, so it ${p.salt_tolerance >= s.site_salinity ? 'can cope' : 'will struggle'}.`;
      return { plant: p, text: t, source: species };
    }

    if (has(q, ['poison', 'toxic', 'safe', 'child', 'kid', 'pet', 'dog', 'cat', 'goat', 'animal'])) {
      const t = p.poisonous === 1
        ? `${name} is poisonous. Keep it away from places children or animals reach.`
        : `${name} is not marked as poisonous in our species data, so it is fine where children and animals play.`;
      return { plant: p, text: t, source: species };
    }

    if (has(q, ['when', 'time to plant', 'season', 'month', 'plant it'])) {
      return { plant: p, source: general,
        text: 'In Karachi the best times to plant are the monsoon (July to September) and spring (February to March). Avoid May and June, when heat stress is highest. Plant in the evening and water straight after.' };
    }

    if (has(q, ['fertili', 'fertiliz', 'khad', 'compost', 'manure', 'feed', 'nutrient'])) {
      let t = 'Mix well-rotted compost or manure into the planting hole, then add a layer once a year before the monsoon. Avoid strong chemical fertiliser on young plants.';
      if (p.fertility_low === 1) t += ` ${name} copes with poor soil, so it needs little feeding.`;
      else if (p.guide_recommendation === 'needs_good_soil_water') t += ` ${name} needs good soil, so feeding matters more for it.`;
      return { plant: p, text: t, source: p.fertility_low === 1 ? `${general} · ${species}` : general };
    }

    if (has(q, ['pest', 'insect', 'bug', 'disease', 'termite', 'aphid', 'fung', 'keera', 'keeray'])) {
      return { plant: p, source: general,
        text: `Our species data has no pest records for ${name}. In general: check leaves weekly, wash off aphids and mealybugs with a soap-water spray, and use neem oil for heavier attacks. Termites are common in Karachi soil, so keep mulch away from the trunk.` };
    }

    if (has(q, ['sun', 'heat', 'hot', 'temperature', 'summer', 'winter', 'cold'])) {
      let t = `${name} grows best between ${p.temp_opt_min}°C and ${p.temp_opt_max}°C and survives ${p.temp_abs_min}°C to ${p.temp_abs_max}°C.`;
      if (p.urban_heat_tolerant === 1) t += ' It copes well with urban heat.';
      return { plant: p, text: t, source: species };
    }

    if (has(q, ['fruit', 'shade', 'flower', 'carbon', 'hedge', 'purpose', 'use'])) {
      const uses = [];
      if (p.purpose_shade === 1) uses.push('shade');
      if (p.purpose_fruit === 1) uses.push('fruit');
      if (p.purpose_ornamental === 1) uses.push('ornament and flowers');
      if (p.purpose_carbon === 1) uses.push('carbon storage');
      return { plant: p, source: species,
        text: uses.length ? `${name} is good for ${joinList(uses)}.` : `Our data does not list a main use for ${name}.` };
    }

    if (has(q, ['care', 'maint', 'easy', 'look after'])) {
      const t = p.low_maintenance === 1 ? `${name} is low maintenance once established.`
        : p.low_maintenance === 0 ? `${name} needs regular care: watering, pruning and checking for pests.`
        : `Our data does not say how much care ${name} needs.`;
      return { plant: p, text: t, source: species };
    }

    if (has(q, ['why', 'score', 'chosen', 'suit'])) {
      const r = (ctx.result?.recommendations || []).find((x) => x.plant.scientific_name === p.scientific_name);
      if (r) return { plant: p, source: 'Your results', text: `${name}: ${why(p, r.sub, s)}` };
    }

    // Fallback: what we know about the plant.
    const facts = [`${name} (${p.scientific_name})`];
    if ((p.form || []).length) facts.push(`is a ${p.form.join(', ')} plant`);
    let t = facts.join(' ') + '.';
    t += ` Water ${waterPhrase(p)}; ${SALT_WORD[p.salt_tolerance] || 'unknown'} salt tolerance.`;
    if (p.native === 1) t += ' Native species.';
    if (guideNote(p)) t += ` Guide note: ${guideNote(p)}.`;
    t += ' You can ask me about watering, space, salt, safety, planting time, fertiliser or pests.';
    return { plant: p, text: t, source: species };
  }

  root.PlantifyText = { displayName, guideNote, tags, why, excludedReason, waterTag, SUB_LABELS, SALT_WORD };
  root.PlantifyChat = { answer, findPlant };
})(self);
