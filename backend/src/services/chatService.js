/**
 * Plantify Karachi chat assistant: Retrieval-Augmented Generation (RAG).
 *
 *   1. Retrieve: the question is embedded with BGE-small and the most similar passages are taken
 *      from the FAISS index (species data, site data, Karachi planting guide, project FAQ).
 *   2. Add the user's live context directly: their site profile, their top-6 plants and the
 *      plants excluded for them, with reasons (no retrieval needed for these).
 *   3. Generate: Gemini answers ONLY from those passages and that context, and names its sources.
 *
 * No model is trained or fine-tuned. If Gemini is unavailable (no key, error or 15 s timeout) the
 * best-matching passage is returned instead, with a short note. This module never throws.
 *
 * Request  { question, site_id?, plants?: [scientific names], history?: [{ role, text }],
 *            recommendation?: { top6: [...], excluded: [...], site_salinity? } }
 * Response { answer, source, sources: [titles], mode: 'gemini' | 'fallback' | 'declined' | 'unavailable' }
 */
const DEFAULTS = {
  k: 6, // passages retrieved per question
  historyTurns: 6, // previous turns sent to Gemini
  timeoutMs: 15000, // Gemini answer timeout
  rewriteTimeoutMs: 5000, // Gemini query-translation timeout (non-English questions)
  temperature: 0.2,
  offTopicSimilarity: 0.47, // best passage less similar than this => question is not about Plantify
  weakTopicSimilarity: 0.56, // below this, the question must also contain a plant / garden / site word
  maxQuestionChars: 1000,
  fallbackWords: 120,
};

const SYSTEM_INSTRUCTION = [
  'You are the Plantify Karachi assistant. Answer ONLY from the CONTEXT passages and the USER RECOMMENDATION below.',
  "If the answer is not in them, say you do not have that information in Plantify's data.",
  'Never recommend a plant that is on the do-not-plant list or was excluded for this user; if asked, explain why it was excluded.',
  'Salt decides what grows in Karachi, so mention salt when it is relevant.',
  'Keep answers short and simple (max ~120 words).',
  'Reply in the same language the user writes in (English, Urdu or Roman Urdu).',
  'End with the source title(s) you used.',
  // Format details so the backend can read the sources and the frontend can show them:
  'Questions that are not about plants, gardening, Karachi site data or how Plantify works are off-topic: politely decline them in one sentence.',
  'Write the sources as the very last line, exactly in this form: "Sources: <title>; <title>", copying the passage titles',
  '(use "Your recommendation" for facts taken from the USER RECOMMENDATION). Do not cite passages you did not use.',
].join(' ');

const DECLINE_MESSAGE =
  "Sorry, I can only help with plants and gardening in Karachi, your site's data, and how Plantify works.";
const UNAVAILABLE_MESSAGE = 'Sorry, the plant assistant is not available right now. Please try again in a moment.';
const FALLBACK_NOTE = "(The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)";
const FALLBACK_NOTE_EXCLUDED = '(The AI assistant is unavailable right now, so this answer comes from your recommendation.)';

const SALINITY = ['low (class 0)', 'medium (class 1)', 'high (class 2)'];
const EXCLUDED_REASON = {
  do_not_plant: 'it is on the do-not-plant list',
  poisonous: 'it is poisonous and children or animals use the site',
  salinity: 'the site is saltier than it can tolerate',
  ph: 'the soil pH is outside the range it survives',
  temperature: "Karachi's temperatures are outside the range it survives",
  water: 'it needs more watering days than can be given',
  space: 'it needs large root space and the plot does not have it',
};
const DNP_TAGS = {
  banned_invasive: 'banned or invasive',
  root_damage: 'damages pipes and drains',
  high_water_use: 'uses a lot of water',
  allergen: 'causes pollen allergy',
};
// Words that show a question is about plants, gardening, sites or Plantify (English and Roman Urdu).
const DOMAIN_WORDS = new Set(
  ('plant plants planting tree trees shrub shrubs palm grow grows growing garden gardening yard balcony pot pots plot ' +
    'soil soils salt salty saline salinity water watering irrigation drain drainage seed seeds leaf leaves flower flowers ' +
    'fruit fruits shade root roots fertiliser fertilizer compost manure pest pests disease sun heat climate weather rain ' +
    'karachi site sites ph lime gypsum mangrove nursery hedge lawn grass prune pruning plantify recommend recommended ' +
    'recommendation excluded model xgboost accuracy data score native crop crops vegetable vegetables ' +
    'paude paudhe pauda darakht drakht mitti pani paani namak phool phal kheti zameen samandar ghar baagh bagh').split(' '),
);
const ROMAN_URDU = new Set(
  'hai hain ka ki ke kya kaise kaun kaunsa kaunse konsa konse mera meri mere mujhe hum humein kar karna karun lagaun lagana paude paudhe pauda paani pani mein nahi nahin aur ko kitna kitni kab kyun kyon kahan yahan wahan bohat bahut thoda zameen mitti namak samandar qareeb acha achha'.split(' '),
);

// ------------------------------------------------------------------ helpers
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function truncateWords(text, n) {
  const w = clean(text).split(' ');
  return w.length <= n ? w.join(' ') : `${w.slice(0, n).join(' ')} …`;
}

/** True for Urdu script or Roman Urdu (two or more common Roman Urdu words). */
function isNonEnglish(question) {
  if (/[؀-ۿ]/.test(question)) return true;
  const words = question.toLowerCase().match(/[a-z]+/g) || [];
  return words.filter((w) => ROMAN_URDU.has(w)).length >= 2;
}

/** Short or pronoun follow-ups ("how often should I water it?") are searched together with the previous user turn. */
function isFollowUp(question) {
  const words = question.toLowerCase().match(/[a-z']+/g) || [];
  return words.length <= 5 || words.some((w) => ['it', 'its', "it's", 'this', 'that', 'these', 'those', 'them', 'they', 'ye', 'yeh', 'woh', 'isko', 'usko'].includes(w));
}

function normaliseRequest(body = {}) {
  const question = clean(body.question).slice(0, DEFAULTS.maxQuestionChars);
  const siteId = body.site_id === undefined || body.site_id === null || body.site_id === '' ? null : Number(body.site_id);
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t) => t && typeof t.text === 'string' && t.text.trim())
    .map((t) => ({ role: t.role === 'assistant' || t.role === 'model' ? 'assistant' : 'user', text: clean(t.text).slice(0, 2000) }));
  const rec = body.recommendation && typeof body.recommendation === 'object' ? body.recommendation : {};
  const top6 = (Array.isArray(rec.top6) ? rec.top6 : []).filter((p) => p && p.scientific_name).slice(0, 6);
  const excluded = (Array.isArray(rec.excluded) ? rec.excluded : []).filter((p) => p && p.scientific_name).slice(0, 100);
  const plants = (Array.isArray(body.plants) ? body.plants : top6.map((p) => p.scientific_name)).map(String).slice(0, 12);
  return {
    question,
    siteId: Number.isFinite(siteId) ? siteId : null,
    history,
    plants,
    top6,
    excluded,
    siteSalinity: Number.isInteger(rec.site_salinity) ? rec.site_salinity : null,
  };
}

/** The user's live situation, written into the prompt as "USER RECOMMENDATION". */
function userContext(req, store) {
  const lines = [];
  const site = req.siteId !== null && store?.sitesById ? store.sitesById.get(req.siteId) : null;
  if (site) {
    lines.push(
      `User's reference site: ${site.label || site.area_name}${site.town ? `, ${site.town} town` : ''} (site ${site.site_id}, ${String(site.site_type || '').replace('_', ' ')}). ` +
        `Soil pH ${site.ph}, texture ${site.texture}, drainage ${site.drainage}, fertility ${site.fertility}. ` +
        `Map salinity ${SALINITY[site.site_salinity_default] ?? 'unknown'}` +
        (req.siteSalinity !== null ? `; salinity used for this user after their salt answers: ${SALINITY[req.siteSalinity] ?? req.siteSalinity}` : '') +
        `. Mean temperature ${Number(site.t_mean).toFixed(1)} °C, hottest month ${Number(site.t_hottest_month).toFixed(1)} °C, coldest month ${Number(site.t_coldest_month).toFixed(1)} °C.`,
    );
  } else if (req.siteSalinity !== null) {
    lines.push(`Salinity used for this user: ${SALINITY[req.siteSalinity] ?? req.siteSalinity}.`);
  }

  const top6 = req.top6.length
    ? req.top6
    : req.plants.map((sci) => ({ scientific_name: sci, common_name: store?.plantsBySciName?.get(sci)?.common_name || sci }));
  if (top6.length) {
    lines.push(
      "User's recommended plants (best first): " +
        top6
          .map((p, i) => {
            const pct = typeof p.probability === 'number' ? `, model suitability ${(p.probability * 100).toFixed(1)}%` : '';
            const score = typeof p.score === 'number' ? `, rule score ${p.score}/100` : '';
            return `${i + 1}. ${p.common_name || p.scientific_name} (${p.scientific_name}${pct}${score})`;
          })
          .join('; ') +
        '.',
    );
  }
  if (req.excluded.length) {
    lines.push(
      'Plants EXCLUDED for this user (never recommend these): ' +
        req.excluded
          .map((x) => `${x.common_name || x.scientific_name} (${x.scientific_name}): ${excludedText(x)}`)
          .join('; ') +
        '.',
    );
  }
  return lines.join('\n');
}

function buildPrompt(question, passages, context) {
  const ctx = passages.length
    ? passages.map((p, i) => `[${i + 1}] ${p.title}\n${p.text}`).join('\n\n')
    : '(no passages found)';
  return [
    'CONTEXT passages:',
    ctx,
    '',
    'USER RECOMMENDATION:',
    context || '(the user has no recommendation yet)',
    '',
    `QUESTION: ${question}`,
  ].join('\n');
}

/** Splits Gemini's "Sources: a; b" last line off the answer and keeps only titles we actually gave it. */
function extractSources(text, passages) {
  const lines = String(text || '').trim().split('\n');
  let idx = -1;
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
    if (/^\s*(\*\*)?\s*(sources?|ماخذ|zariya|maakhaz)\s*(used)?\s*(\*\*)?\s*:/i.test(lines[i])) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return { answer: String(text || '').trim(), titles: [] };
  const raw = lines[idx].replace(/^[^:]*:/, '');
  const answer = lines.slice(0, idx).join('\n').trim();
  const cited = raw.split(/[;|]/).map((s) => s.replace(/[*"“”\[\]]/g, '').trim()).filter(Boolean);
  const titles = [];
  for (const c of cited) {
    const lc = c.toLowerCase();
    const match = passages.find((p) => p.title.toLowerCase() === lc) || passages.find((p) => lc.includes(p.title.toLowerCase()) || p.title.toLowerCase().includes(lc));
    if (match && !titles.includes(match.title)) titles.push(match.title);
    else if (/your recommendation/i.test(c) && !titles.includes('Your recommendation')) titles.push('Your recommendation');
  }
  return { answer, titles };
}

const GENERIC_NAME_WORDS = new Set('common tree trees palm shrub plant true wild white black indian chinese royal false flame mock sea gum fig'.split(' '));

/** Names a user might type for a plant: scientific name, genus, common-name parts and their distinctive words. */
function plantNames(scientificName, commonName) {
  const names = [scientificName, scientificName.split(' ')[0]];
  for (const part of String(commonName || '').split(/[/(),]/)) {
    const p = part.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!p) continue;
    names.push(p);
    for (const w of p.split(' ')) if (w.length >= 5 && !GENERIC_NAME_WORDS.has(w)) names.push(w);
  }
  return names.map((n) => n.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim()).filter((n) => n.length >= 4);
}

/** A plant from the user's excluded list named in the question, if any. */
function excludedPlantIn(question, excluded) {
  const q = ` ${question.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')} `;
  return excluded.find((x) => plantNames(x.scientific_name, x.common_name).some((n) => q.includes(` ${n} `)));
}

/** Plain-language exclusion reason; keeps the numbers (e.g. "site class 1 > plant tolerance 0") but not internal tags. */
function excludedText(x) {
  const plain = EXCLUDED_REASON[x.code] || 'it did not pass the safety checks';
  if (x.code === 'do_not_plant') {
    const tags = String(x.reason || '').replace(/^do_not_plant:\s*/, '').split('|').map((t) => DNP_TAGS[t.trim()]).filter(Boolean);
    return tags.length ? `${plain} (${tags.join(', ')})` : `${plain} in the Karachi planting guide`;
  }
  if (x.code === 'poisonous') return plain; // the stored detail only repeats the reason
  const detail = String(x.reason || '').replace(/^[a-z_]+:\s*/, '').trim();
  return detail ? `${plain} (${detail})` : plain;
}

/** True when the question mentions any plant, garden or site word, or one of the 85 plant names. */
function soundsOnTopic(question, store) {
  const words = question.toLowerCase().match(/[a-z]+/g) || [];
  if (words.some((w) => DOMAIN_WORDS.has(w))) return true;
  if (!store?.plants) return false;
  const q = ` ${question.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')} `;
  return store.plants.some((p) => plantNames(p.scientific_name, p.common_name).some((n) => q.includes(` ${n} `)));
}

function withTimeout(promiseFactory, ms) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`timed out after ${ms} ms`));
    }, ms);
  });
  return Promise.race([promiseFactory(controller.signal), timeout]).finally(() => clearTimeout(timer));
}

// ------------------------------------------------------------------ Gemini client
/**
 * Returns generate({ systemInstruction, contents, abortSignal }) -> text, or null when no API key is set.
 * Uses the official @google/genai SDK.
 */
function createGeminiGenerator({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL } = {}) {
  if (!apiKey) return null;
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const modelName = model || 'gemini-3.8-flash';
  const generate = async ({ systemInstruction, contents, abortSignal, temperature = DEFAULTS.temperature }) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: { systemInstruction, temperature, abortSignal },
    });
    return response.text;
  };
  generate.modelName = modelName;
  return generate;
}

// ------------------------------------------------------------------ service
/**
 * @param retriever  { search({ question, k, plants, site_id }) -> passages[] }
 * @param generate   Gemini generator from createGeminiGenerator(), or null
 * @param store      data store (sitesById, plantsBySciName) for the user's site profile
 */
function createChatService({ retriever, generate = null, store = null, options = {} } = {}) {
  const opt = { ...DEFAULTS, ...options };

  async function retrievalQuery(req) {
    let query = req.question;
    if (generate && isNonEnglish(query)) {
      // Translate for retrieval only (BGE-small is an English model); the answer stays in the user's language.
      try {
        const english = await withTimeout(
          (abortSignal) =>
            generate({
              systemInstruction: 'Translate the user message into one short English search query about plants or gardening. Reply with the query only.',
              contents: [{ role: 'user', parts: [{ text: query }] }],
              abortSignal,
              temperature: 0,
            }),
          opt.rewriteTimeoutMs,
        );
        if (clean(english)) query = `${clean(english)} (${query})`;
      } catch {
        /* keep the original question */
      }
    }
    if (isFollowUp(req.question)) {
      const lastUser = [...req.history].reverse().find((t) => t.role === 'user');
      if (lastUser) query = `${lastUser.text} ${query}`;
    }
    return query;
  }

  function fallback(req, passages, reason) {
    const excluded = excludedPlantIn(req.question, req.excluded);
    if (excluded) {
      const name = excluded.common_name && excluded.common_name !== excluded.scientific_name
        ? `${excluded.common_name} (${excluded.scientific_name})`
        : excluded.scientific_name;
      return {
        answer: `${name} was not recommended for your plot because ${excludedText(excluded)}. ${FALLBACK_NOTE_EXCLUDED}`,
        source: 'Your recommendation',
        sources: ['Your recommendation'],
        mode: 'fallback',
        note: reason,
      };
    }
    if (!passages.length) return { answer: UNAVAILABLE_MESSAGE, source: null, sources: [], mode: 'unavailable', note: reason };
    const best = passages[0];
    return {
      answer: `${truncateWords(best.text, opt.fallbackWords)}\n\n${FALLBACK_NOTE}`,
      source: best.title,
      sources: [best.title],
      mode: 'fallback',
      note: reason,
    };
  }

  async function answer(body) {
    const req = normaliseRequest(body);
    if (!req.question) return { status: 400, body: { error: 'Please type a question.' } };

    try {
      const query = await retrievalQuery(req);
      let passages = [];
      try {
        passages = (await retriever.search({ question: query, k: opt.k, plants: req.plants, site_id: req.siteId })) || [];
      } catch {
        passages = [];
      }

      // Off-topic: nothing in Plantify's knowledge is even close to the question.
      const best = passages.reduce((m, p) => Math.max(m, Number(p.similarity ?? p.score ?? 0)), 0);
      const offTopic =
        passages.length &&
        !excludedPlantIn(req.question, req.excluded) &&
        (best < opt.offTopicSimilarity || (best < opt.weakTopicSimilarity && !soundsOnTopic(req.question, store)));
      if (offTopic) {
        return { status: 200, body: { answer: DECLINE_MESSAGE, source: null, sources: [], mode: 'declined' } };
      }

      if (!generate) return { status: 200, body: fallback(req, passages, 'no GEMINI_API_KEY set') };

      const contents = [
        ...req.history.slice(-opt.historyTurns).map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] })),
        { role: 'user', parts: [{ text: buildPrompt(req.question, passages, userContext(req, store)) }] },
      ];
      let text;
      try {
        text = await withTimeout(
          (abortSignal) => generate({ systemInstruction: SYSTEM_INSTRUCTION, contents, abortSignal, temperature: opt.temperature }),
          opt.timeoutMs,
        );
      } catch (err) {
        console.warn(`[chat] Gemini failed: ${err.message}`);
        return { status: 200, body: fallback(req, passages, `Gemini error: ${err.message}`) };
      }
      if (!clean(text)) return { status: 200, body: fallback(req, passages, 'Gemini returned an empty answer') };

      const { answer: reply, titles } = extractSources(text, passages);
      const sources = titles.length ? titles : passages.slice(0, 2).map((p) => p.title);
      return { status: 200, body: { answer: reply || clean(text), source: sources.join('; ') || null, sources, mode: 'gemini' } };
    } catch (err) {
      console.error(`[chat] unexpected error: ${err.stack || err.message}`);
      return { status: 200, body: { answer: UNAVAILABLE_MESSAGE, source: null, sources: [], mode: 'unavailable' } };
    }
  }

  return { answer };
}

module.exports = {
  createChatService,
  createGeminiGenerator,
  SYSTEM_INSTRUCTION,
  DECLINE_MESSAGE,
  FALLBACK_NOTE,
  _internal: { normaliseRequest, userContext, buildPrompt, extractSources, excludedPlantIn, excludedText, soundsOnTopic, isNonEnglish, isFollowUp },
};
