// Tests for the RAG chat service with a mocked retriever and a mocked Gemini.
// Run: npm test   (node:test, no network, no Python, no API key needed)
const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatService, DECLINE_MESSAGE, FALLBACK_NOTE } = require('../src/services/chatService');

// ---------------------------------------------------------------- fixtures
const NEEM = {
  id: 'plant:Azadirachta indica',
  source_type: 'plant',
  title: 'Plant: Neem (Azadirachta indica)',
  text: 'Neem (Azadirachta indica) is an evergreen tree on Plantify\'s Karachi plant list. Salt tolerance is moderate. Water need is low (about one watering day a week once established).',
  scientific_name: 'Azadirachta indica',
  site_id: null,
  similarity: 0.70,
  score: 0.75,
};
const GUIDE_CONOCARPUS = {
  id: 'guide:6',
  source_type: 'guide',
  title: 'Karachi Planting Guide: 6. What to plant',
  text: "On Conocarpus: it makes up 62% of Karachi's street trees and was banned in 2016. It damages pipes and drains, uses a lot of water and causes pollen allergy.",
  scientific_name: null,
  site_id: null,
  similarity: 0.62,
  score: 0.68,
};
const SITE = {
  site_id: 77, label: 'Safari Park, Main University Rd, Gulshan-e-Iqbal', town: 'Gulshan Iqbal', site_type: 'dense_urban',
  ph: 8.2, texture: 'light', drainage: 'excessive', fertility: 'medium', site_salinity_default: 0,
  t_mean: 26.2, t_hottest_month: 30.9, t_coldest_month: 18.5,
};
const store = { sitesById: new Map([[77, SITE]]), plantsBySciName: new Map() };

const RECOMMENDATION = {
  top6: [
    { scientific_name: 'Azadirachta indica', common_name: 'Neem', probability: 0.98, score: 100 },
    { scientific_name: 'Phoenix dactylifera', common_name: 'Date palm', probability: 0.97, score: 100 },
  ],
  excluded: [
    { scientific_name: 'Conocarpus erectus', common_name: 'Buttonwood', code: 'do_not_plant', reason: 'do_not_plant: banned_invasive|root_damage|high_water_use|allergen' },
    { scientific_name: 'Mangifera indica', common_name: 'Mango', code: 'salinity', reason: 'salinity: site class 1 > plant tolerance 0' },
  ],
  site_salinity: 1,
};

function fakeRetriever(passages) {
  const calls = [];
  return {
    calls,
    async search(args) {
      calls.push(args);
      return passages;
    },
  };
}

function fakeGemini(reply) {
  const calls = [];
  const generate = async (args) => {
    calls.push(args);
    return typeof reply === 'function' ? reply(args) : reply;
  };
  generate.calls = calls;
  return generate;
}

const promptOf = (call) => call.contents[call.contents.length - 1].parts[0].text;

// ---------------------------------------------------------------- tests
test('normal answer: uses retrieved passages and the user context, returns { answer, source }', async () => {
  const retriever = fakeRetriever([NEEM, GUIDE_CONOCARPUS]);
  const generate = fakeGemini('Water neem about once a week once it is established. Salt: it tolerates slightly saline soil.\nSources: Plant: Neem (Azadirachta indica)');
  const chat = createChatService({ retriever, generate, store });

  const { status, body } = await chat.answer({
    question: 'How often should I water neem?',
    site_id: 77,
    plants: ['Azadirachta indica', 'Phoenix dactylifera'],
    history: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hello! Ask me about your plants.' }],
    recommendation: RECOMMENDATION,
  });

  assert.equal(status, 200);
  assert.equal(body.mode, 'gemini');
  assert.equal(body.answer, 'Water neem about once a week once it is established. Salt: it tolerates slightly saline soil.');
  assert.equal(body.source, 'Plant: Neem (Azadirachta indica)');
  assert.deepEqual(body.sources, ['Plant: Neem (Azadirachta indica)']);

  // Retrieval got the user's plants and site for boosting.
  assert.deepEqual(retriever.calls[0].plants, ['Azadirachta indica', 'Phoenix dactylifera']);
  assert.equal(retriever.calls[0].site_id, 77);
  assert.equal(retriever.calls[0].k, 6);

  // Gemini got the system instruction, temperature 0.2, history and a prompt with passages + live context.
  const call = generate.calls[0];
  assert.match(call.systemInstruction, /Answer ONLY from the CONTEXT passages and the USER RECOMMENDATION/);
  assert.equal(call.temperature, 0.2);
  assert.equal(call.contents.length, 3); // 2 history turns + the question
  assert.equal(call.contents[1].role, 'model');
  const prompt = promptOf(call);
  assert.match(prompt, /\[1\] Plant: Neem \(Azadirachta indica\)/);
  assert.match(prompt, /Safari Park/);
  assert.match(prompt, /salinity used for this user after their salt answers: medium/);
  assert.match(prompt, /1\. Neem \(Azadirachta indica, model suitability 98\.0%/);
  assert.match(prompt, /QUESTION: How often should I water neem\?/);
});

test('old request shape still works (no recommendation object)', async () => {
  const chat = createChatService({ retriever: fakeRetriever([NEEM]), generate: fakeGemini('Once a week.\nSources: Plant: Neem (Azadirachta indica)'), store });
  const { status, body } = await chat.answer({ question: 'Water neem?', site_id: 77, plants: ['Azadirachta indica'], history: [] });
  assert.equal(status, 200);
  assert.equal(body.answer, 'Once a week.');
  assert.equal(body.source, 'Plant: Neem (Azadirachta indica)');
});

test('Gemini failure: falls back to the best passage with a note, never an error', async () => {
  const generate = async () => {
    throw new Error('503 model overloaded');
  };
  const chat = createChatService({ retriever: fakeRetriever([NEEM, GUIDE_CONOCARPUS]), generate, store });
  const { status, body } = await chat.answer({ question: 'How often should I water neem?', plants: ['Azadirachta indica'] });

  assert.equal(status, 200);
  assert.equal(body.mode, 'fallback');
  assert.ok(body.answer.startsWith('Neem (Azadirachta indica) is an evergreen tree'));
  assert.ok(body.answer.includes(FALLBACK_NOTE));
  assert.equal(body.source, 'Plant: Neem (Azadirachta indica)');
});

test('Gemini timeout: falls back after the time limit', async () => {
  const generate = (args) =>
    new Promise((resolve, reject) => {
      args.abortSignal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  const chat = createChatService({ retriever: fakeRetriever([NEEM]), generate, store, options: { timeoutMs: 50 } });
  const started = Date.now();
  const { status, body } = await chat.answer({ question: 'How often should I water neem?' });
  assert.equal(status, 200);
  assert.equal(body.mode, 'fallback');
  assert.ok(Date.now() - started < 2000);
});

test('no API key: answers with the best passage', async () => {
  const chat = createChatService({ retriever: fakeRetriever([NEEM]), generate: null, store });
  const { body } = await chat.answer({ question: 'How often should I water neem?' });
  assert.equal(body.mode, 'fallback');
  assert.equal(body.source, 'Plant: Neem (Azadirachta indica)');
});

test('off-topic question is declined without calling Gemini', async () => {
  const unrelated = { ...NEEM, similarity: 0.41, score: 0.41 };
  const generate = fakeGemini('should not be called');
  const chat = createChatService({ retriever: fakeRetriever([unrelated]), generate, store });
  const { status, body } = await chat.answer({ question: 'Who won the 2022 FIFA World Cup?' });

  assert.equal(status, 200);
  assert.equal(body.mode, 'declined');
  assert.equal(body.answer, DECLINE_MESSAGE);
  assert.equal(body.source, null);
  assert.equal(generate.calls.length, 0);
});

test('excluded plant: the exclusion reason is in the prompt and Gemini is told never to recommend it', async () => {
  const generate = fakeGemini(
    'Conocarpus was excluded: it is on the do-not-plant list because it is banned and damages pipes.\nSources: Your recommendation; Karachi Planting Guide: 6. What to plant',
  );
  const chat = createChatService({ retriever: fakeRetriever([GUIDE_CONOCARPUS, NEEM]), generate, store });
  const { body } = await chat.answer({ question: 'Why not Conocarpus?', site_id: 77, recommendation: RECOMMENDATION });

  const call = generate.calls[0];
  assert.match(call.systemInstruction, /Never recommend a plant that is on the do-not-plant list or was excluded for this user/);
  const prompt = promptOf(call);
  assert.match(prompt, /Plants EXCLUDED for this user \(never recommend these\): Buttonwood \(Conocarpus erectus\): it is on the do-not-plant list \(banned or invasive, damages pipes and drains, uses a lot of water, causes pollen allergy\)/);
  assert.match(prompt, /Mango \(Mangifera indica\): the site is saltier than it can tolerate/);
  assert.equal(body.mode, 'gemini');
  assert.deepEqual(body.sources, ['Your recommendation', 'Karachi Planting Guide: 6. What to plant']);
});

test('excluded plant with Gemini down: answers from the user\'s exclusion reason', async () => {
  const generate = async () => {
    throw new Error('network down');
  };
  const chat = createChatService({ retriever: fakeRetriever([NEEM]), generate, store });
  const { body } = await chat.answer({ question: 'Why was mango excluded?', recommendation: RECOMMENDATION });
  assert.equal(body.mode, 'fallback');
  assert.match(body.answer, /^Mango \(Mangifera indica\) was not recommended for your plot because the site is saltier than it can tolerate \(site class 1 > plant tolerance 0\)/);
  assert.equal(body.source, 'Your recommendation');
});

test('follow-up question is searched together with the previous user turn', async () => {
  const retriever = fakeRetriever([NEEM]);
  const chat = createChatService({ retriever, generate: fakeGemini('Once a week.\nSources: Plant: Neem (Azadirachta indica)'), store });
  await chat.answer({
    question: 'How often should I water it?',
    history: [{ role: 'user', text: 'Tell me about neem' }, { role: 'assistant', text: 'Neem is a shade tree.' }],
  });
  assert.equal(retriever.calls[0].question, 'Tell me about neem How often should I water it?');
});

test('weakly related question without any plant or garden word is declined', async () => {
  const weak = { ...NEEM, similarity: 0.52, score: 0.52 };
  const chat = createChatService({ retriever: fakeRetriever([weak]), generate: fakeGemini('x'), store });
  assert.equal((await chat.answer({ question: 'Write a Python function that sorts a list.' })).body.mode, 'declined');
  // ...but the same similarity with a gardening word goes through.
  assert.equal((await chat.answer({ question: 'How deep should the soil be?' })).body.mode, 'gemini');
});

test('excluded plant is found by a distinctive word of its common name ("oleander")', async () => {
  const rec = { excluded: [{ scientific_name: 'Nerium oleander', common_name: 'common oleander', code: 'poisonous', reason: 'poisonous: children or animals at the site' }] };
  const chat = createChatService({ retriever: fakeRetriever([NEEM]), generate: null, store });
  const { body } = await chat.answer({ question: 'Why can I not plant oleander here?', recommendation: rec });
  assert.match(body.answer, /^common oleander \(Nerium oleander\) was not recommended for your plot because it is poisonous and children or animals use the site/);
});

test('empty question gets 400; retriever failure never crashes', async () => {
  const chat = createChatService({ retriever: fakeRetriever([]), generate: null, store });
  assert.equal((await chat.answer({ question: '   ' })).status, 400);

  const broken = { search: async () => { throw new Error('worker died'); } };
  const chat2 = createChatService({ retriever: broken, generate: null, store });
  const { status, body } = await chat2.answer({ question: 'How often should I water neem?' });
  assert.equal(status, 200);
  assert.equal(body.mode, 'unavailable');
});
