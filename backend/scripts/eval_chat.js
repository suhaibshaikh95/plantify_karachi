#!/usr/bin/env node
/**
 * Runs 20 fixed questions against the REAL chat API and saves the results for the report.
 *
 *   npm start                 (in one terminal: the backend, with GEMINI_API_KEY set)
 *   npm run eval:chat         (in another: writes tests/chat_eval_results.md;
 *                              without GEMINI_API_KEY it writes tests/chat_eval_results_no_llm.md instead)
 *
 * Set PLANTIFY_API_URL to test another server (default http://localhost:8000).
 * EVAL_DELAY_MS sets the pause between questions (default 15000: Gemini's free tier allows about
 * 5 requests a minute; set 0 on a paid key).
 * First it gets a real recommendation for one fixed scenario (a plot in Gulshan-e-Iqbal with salty
 * borewell water and children), then asks every question with that recommendation as context,
 * exactly as the React chat screen does.
 */
const fs = require('fs');
const path = require('path');

const API = (process.env.PLANTIFY_API_URL || 'http://localhost:8000').replace(/\/$/, '');
// Real runs (with Gemini) go to chat_eval_results.md; runs without a key are kept apart so they are never mistaken for it.
const outFile = (geminiOn) => path.join(__dirname, '..', 'tests', geminiOn ? 'chat_eval_results.md' : 'chat_eval_results_no_llm.md');

const SCENARIO = {
  lat: 24.9203,
  lon: 67.0912,
  salt_signs: { borewell: true },
  water_days: 3,
  space: 'medium',
  care: 'rarely',
  purpose: 'shade',
  children_or_animals: 1,
};
const SCENARIO_TEXT =
  'Plot at 24.9203 N, 67.0912 E (Gulshan-e-Iqbal), salty borewell water (one salt sign), 3 watering days a week, small yard, low care, purpose shade, children or animals use the site.';

const QUESTIONS = [
  // 10 plant care
  ['Plant care', 'How often should I water neem in summer?'],
  ['Plant care', 'Which of my plants can handle salty borewell water?'],
  ['Plant care', 'Is Jamun safe if children play in the garden?'],
  ['Plant care', 'Can I grow a date palm in a pot on my balcony?'],
  ['Plant care', 'What kind of soil does tamarind like?'],
  ['Plant care', 'The leaves of my plants are turning yellow. What could be the reason in Karachi soil?'],
  ['Plant care', 'How should I take a soil sample before getting it tested?'],
  ['Plant care', 'Which shade trees are good for a Karachi street?'],
  ['Plant care', 'Mera plot samandar ke qareeb hai, kaunse paude lagaun?'],
  ['Plant care', 'What is the soil pH and salinity of my site?'],
  // 5 why excluded / why this plant
  ['Why / why not', 'Why not Conocarpus?'],
  ['Why / why not', 'Can I plant gulmohar in a small pavement pit?'],
  ['Why / why not', 'Why was mango excluded for my plot?'],
  ['Why / why not', 'Why is date palm recommended for me?'],
  ['Why / why not', 'Why can I not plant oleander here?'],
  // 3 how Plantify works
  ['How Plantify works', 'How does Plantify choose my plants?'],
  ['How Plantify works', 'How accurate is the model, and how was it tested?'],
  ['How Plantify works', 'Where does the salinity data come from?'],
  // 2 off-topic
  ['Off-topic', 'Who won the 2022 FIFA World Cup?'],
  ['Off-topic', 'Write a Python function that sorts a list.'],
];

const DELAY_MS = process.env.EVAL_DELAY_MS !== undefined ? Number(process.env.EVAL_DELAY_MS) : 15000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(pathname, body) {
  const res = await fetch(`${API}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}: ${data.error || ''}`);
  return data;
}

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const cell = (s) => oneLine(s).replace(/\|/g, '\\|');

async function main() {
  const health = await fetch(`${API}/api/health`).then((r) => r.json());
  console.log(`API ${API}: rag_ready=${health.rag_ready}, gemini=${health.gemini_configured ? health.gemini_model : 'not configured'}`);
  if (!health.rag_ready) console.warn('WARNING: retrieval worker not ready; answers will be degraded.');

  const rec = await post('/api/recommend', SCENARIO);
  const recommendation = {
    top6: rec.recommendations.map(({ scientific_name, common_name, probability, score }) => ({ scientific_name, common_name, probability, score })),
    excluded: rec.excluded.map(({ scientific_name, common_name, code, reason }) => ({ scientific_name, common_name, code, reason })),
    site_salinity: rec.site_salinity,
  };
  const base = { site_id: rec.site.site_id, plants: recommendation.top6.map((p) => p.scientific_name), history: [], recommendation };
  console.log(`Site: ${rec.site.label} (${rec.distance_km} km); top 6: ${recommendation.top6.map((p) => p.common_name).join(', ')}\n`);

  const rows = [];
  if (health.gemini_configured && DELAY_MS) console.log(`Waiting ${DELAY_MS / 1000} s between questions (Gemini free-tier rate limit).\n`);
  for (const [i, [category, question]] of QUESTIONS.entries()) {
    if (i > 0 && health.gemini_configured) await sleep(DELAY_MS);
    const t0 = performance.now();
    let data;
    try {
      data = await post('/api/chat', { ...base, question });
    } catch (err) {
      data = { answer: `ERROR: ${err.message}`, source: null, mode: 'error' };
    }
    const ms = Math.round(performance.now() - t0);
    rows.push({ n: i + 1, category, question, ms, ...data });
    console.log(`#${i + 1} [${category}] ${question}\n   (${ms} ms, ${data.mode}) ${oneLine(data.answer)}\n   Sources: ${data.source || '-'}\n`);
  }

  const modes = rows.reduce((m, r) => ({ ...m, [r.mode]: (m[r.mode] || 0) + 1 }), {});
  const times = rows.map((r) => r.ms).sort((a, b) => a - b);
  const md = [
    '# Plantify Karachi chat assistant — evaluation run',
    '',
    `- Date: ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
    `- API: ${API}`,
    `- Retrieval: BAAI/bge-small-en-v1.5 embeddings + FAISS IndexFlatIP (top 6 passages), worker ready: ${health.rag_ready}`,
    `- Generation: ${health.gemini_configured ? `Gemini \`${health.gemini_model}\`, temperature 0.2` : 'none (no GEMINI_API_KEY): best-passage fallback'}`,
    `- Scenario: ${SCENARIO_TEXT}`,
    `- Matched site: ${rec.site.label} (site ${rec.site.site_id}, ${rec.distance_km} km away); salinity used: class ${rec.site_salinity}; ranked by: ${rec.source}`,
    `- Top 6: ${recommendation.top6.map((p) => p.common_name).join(', ')}`,
    `- Excluded: ${recommendation.excluded.length} plants`,
    `- Answer modes: ${Object.entries(modes).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    `- Response time: median ${times[Math.floor(times.length / 2)]} ms, max ${times[times.length - 1]} ms`,
    '',
    '## Summary',
    '',
    '| # | Category | Question | Mode | Time (ms) | Sources |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.n} | ${r.category} | ${cell(r.question)} | ${r.mode} | ${r.ms} | ${cell(r.source || '—')} |`),
    '',
    '## Answers',
    '',
    ...rows.flatMap((r) => [
      `### ${r.n}. ${r.question}`,
      '',
      `*${r.category} · ${r.mode} · ${r.ms} ms*`,
      '',
      ...String(r.answer || '').split('\n').map((l) => `> ${l}`),
      '',
      `**Sources:** ${r.source || '—'}`,
      '',
    ]),
  ].join('\n');
  const out = outFile(Boolean(health.gemini_configured));
  fs.writeFileSync(out, md);
  console.log(`Saved ${path.relative(process.cwd(), out)}`);
}

main().catch((err) => {
  console.error(`Evaluation failed: ${err.message}`);
  process.exit(1);
});
