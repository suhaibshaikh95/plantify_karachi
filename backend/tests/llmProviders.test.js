// Tests for the Gemini -> Gemini backup -> Groq chain (no network: every model is mocked).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createFallbackChain,
  createGroqGenerator,
  createGeminiGenerator,
  createDefaultGenerator,
  _internal: { toChatMessages },
} = require('../src/services/llmProviders');
const { createChatService } = require('../src/services/chatService');

const ARGS = {
  systemInstruction: 'Answer only from the passages.',
  contents: [
    { role: 'user', parts: [{ text: 'Hi' }] },
    { role: 'model', parts: [{ text: 'Hello' }] },
    { role: 'user', parts: [{ text: 'How often should I water neem?' }] },
  ],
  temperature: 0.2,
};

function provider(name, behaviour, timeoutMs = 200) {
  const calls = [];
  const fn = async (args) => {
    calls.push(args);
    return behaviour(args);
  };
  fn.provider = name.split(':')[0];
  fn.modelName = name.split(':')[1];
  fn.timeoutMs = timeoutMs;
  fn.calls = calls;
  return fn;
}

test('chain: first provider answers, the others are not called', async () => {
  const gemini = provider('gemini:g1', () => 'Once a week.');
  const groq = provider('groq:llama', () => 'should not be used');
  const out = await createFallbackChain([gemini, null, groq])(ARGS);
  assert.deepEqual(out, { text: 'Once a week.', provider: 'gemini', model: 'g1' });
  assert.equal(groq.calls.length, 0);
});

test('chain: Gemini quota error (429) -> Groq answers', async () => {
  const gemini = provider('gemini:g1', () => {
    const e = new Error('429 RESOURCE_EXHAUSTED: quota exceeded');
    e.status = 429;
    throw e;
  });
  const groq = provider('groq:llama', () => 'Water neem weekly.');
  const out = await createFallbackChain([gemini, groq])(ARGS);
  assert.equal(out.provider, 'groq');
  assert.equal(out.text, 'Water neem weekly.');
  assert.equal(groq.calls[0].systemInstruction, ARGS.systemInstruction); // same instruction and passages
  assert.deepEqual(groq.calls[0].contents, ARGS.contents);
});

test('chain: a slow provider is cut off at its own time limit and the next one answers', async () => {
  const slow = provider('gemini:g1', (a) => new Promise((_, rej) => a.abortSignal.addEventListener('abort', () => rej(new Error('aborted')))), 50);
  const backup = provider('gemini:g2', () => '');                 // empty answer -> skip
  const groq = provider('groq:llama', () => 'From Groq.');
  const t0 = Date.now();
  const out = await createFallbackChain([slow, backup, groq])(ARGS);
  assert.equal(out.model, 'llama');
  assert.ok(Date.now() - t0 < 1000);
});

test('chain: every provider fails -> throws, and chat falls back to the best passage', async () => {
  const fail = (n) => provider(n, () => { throw new Error('503 overloaded'); });
  const chain = createFallbackChain([fail('gemini:g1'), fail('groq:llama')]);
  await assert.rejects(chain(ARGS), /gemini\/g1.*groq\/llama/);

  const NEEM = { id: 'p1', source_type: 'plant', title: 'Plant: Neem (Azadirachta indica)', text: 'Neem is an evergreen tree. Water weekly.', scientific_name: 'Azadirachta indica', similarity: 0.8, score: 0.8 };
  const chat = createChatService({ retriever: { search: async () => [NEEM] }, generate: chain });
  const { status, body } = await chat.answer({ question: 'How often should I water neem?' });
  assert.equal(status, 200);
  assert.equal(body.mode, 'fallback');
});

test('chat reports which provider wrote the answer', async () => {
  const NEEM = { id: 'p1', source_type: 'plant', title: 'Plant: Neem (Azadirachta indica)', text: 'Neem is an evergreen tree. Water weekly.', scientific_name: 'Azadirachta indica', similarity: 0.8, score: 0.8 };
  const chain = createFallbackChain([
    provider('gemini:g1', () => { throw new Error('429 quota'); }),
    provider('groq:llama', () => 'Water it weekly.\nSources: Plant: Neem (Azadirachta indica)'),
  ]);
  const chat = createChatService({ retriever: { search: async () => [NEEM] }, generate: chain });
  const { body } = await chat.answer({ question: 'How often should I water neem?' });
  assert.equal(body.mode, 'groq');
  assert.equal(body.model, 'llama');
  assert.equal(body.answer, 'Water it weekly.');
  assert.equal(body.source, 'Plant: Neem (Azadirachta indica)');
});

test('Groq request: OpenAI-style messages, bearer key, model and temperature', async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, init };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Weekly.' } }] }) };
  };
  const groq = createGroqGenerator({ apiKey: 'test-key', model: 'some-model', fetchImpl });
  assert.equal(await groq(ARGS), 'Weekly.');
  assert.equal(sent.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(sent.init.headers.Authorization, 'Bearer test-key');
  const body = JSON.parse(sent.init.body);
  assert.equal(body.model, 'some-model');
  assert.equal(body.temperature, 0.2);
  assert.deepEqual(body.messages.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
  assert.equal(body.messages[0].content, ARGS.systemInstruction);
});

test('Groq error status becomes an error (so the chain moves on)', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429, statusText: 'Too Many Requests', json: async () => ({ error: { message: 'Rate limit reached' } }) });
  const groq = createGroqGenerator({ apiKey: 'k', fetchImpl });
  await assert.rejects(groq(ARGS), /Groq 429: Rate limit reached/);
});

test('no keys -> no generator; keys -> chain in the documented order', () => {
  assert.equal(createGroqGenerator({ apiKey: '' }), null);
  assert.equal(createGeminiGenerator({ apiKey: '' }), null);
  assert.equal(createDefaultGenerator({}), null);
  const chain = createDefaultGenerator({ GEMINI_API_KEY: 'a', GEMINI_FALLBACK_MODEL: 'gemini-2.5-flash', GROQ_API_KEY: 'b' });
  assert.deepEqual(chain.providers, ['gemini:gemini-3.5-flash-lite', 'gemini:gemini-2.5-flash', 'groq:llama-3.3-70b-versatile']);
  assert.deepEqual(createDefaultGenerator({ GROQ_API_KEY: 'b', GROQ_MODEL: 'm' }).providers, ['groq:m']);
});

test('toChatMessages joins parts and maps model -> assistant', () => {
  const m = toChatMessages('sys', [{ role: 'model', parts: [{ text: 'a' }, { text: 'b' }] }]);
  assert.deepEqual(m, [{ role: 'system', content: 'sys' }, { role: 'assistant', content: 'a\nb' }]);
});
