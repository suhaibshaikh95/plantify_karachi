/*
 * Checks that frontend/engine.js gives the same labels as the Python rule engine.
 * Every row of training_clean.csv carries the `suitable` and `top6` labels it made.
 *
 *   node frontend/tests/engine_parity.test.js
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const engine = require('../engine.js');

const ROOT = path.resolve(__dirname, '..', '..');
const CSV = path.join(ROOT, 'training_dataset/training_data/plantify_dataset_v2.4/training_clean.csv');
const plants = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'plants.json'), 'utf8'));
const byName = new Map(plants.map((p) => [p.scientific_name, p]));
const NUM = ['ph', 't_mean', 't_hottest_month', 't_coldest_month', 'industrial', 'lst_zone_celsius',
             'site_salinity', 'water_days', 'children_or_animals'];

(async () => {
  const rl = readline.createInterface({ input: fs.createReadStream(CSV) });
  let header = null, rows = 0, suitableBad = 0, top6Bad = 0;
  const scen = new Map();   // scenario_id -> [{score, removed, top6}]
  for await (const line of rl) {
    const f = line.split(',');
    if (!header) { header = f; continue; }
    const r = Object.fromEntries(header.map((h, i) => [h, f[i]]));
    const s = { ...r };
    for (const k of NUM) s[k] = Number(r[k]);
    const res = engine.evaluate(s, byName.get(r.scientific_name));
    const suitable = !res.removed && res.score >= engine.SUITABLE_SCORE ? 1 : 0;
    if (suitable !== Number(r.suitable)) suitableBad++;
    if (!scen.has(r.scenario_id)) scen.set(r.scenario_id, []);
    scen.get(r.scenario_id).push({ score: res.score, removed: res.removed, top6: Number(r.top6) });
    rows++;
  }
  // Rebuild top-6 the way the generator did (rank by score, method='first', not removed).
  for (const list of scen.values()) {
    const order = list.map((x, i) => i).sort((a, b) => list[b].score - list[a].score || a - b);
    order.forEach((idx, rank) => {
      const mine = rank < 6 && !list[idx].removed ? 1 : 0;
      if (mine !== list[idx].top6) top6Bad++;
    });
  }
  console.log(`rows: ${rows}  scenarios: ${scen.size}`);
  console.log(`suitable mismatches: ${suitableBad}`);
  console.log(`top6 mismatches: ${top6Bad}`);
  process.exit(suitableBad === 0 && top6Bad === 0 ? 0 : 1);
})();
