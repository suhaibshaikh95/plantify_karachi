/**
 * Language models that write the chat answer (the "G" in RAG), with backups.
 *
 * Every provider is a function generate({ systemInstruction, contents, abortSignal, temperature })
 * that returns the answer text. `contents` is the Gemini-style chat history:
 * [{ role: 'user' | 'model', parts: [{ text }] }].
 *
 * createDefaultGenerator() builds the chain from environment variables, tried in this order:
 *   1. Gemini           GEMINI_API_KEY, GEMINI_MODEL           (default gemini-3.5-flash-lite)
 *   2. Gemini backup    GEMINI_FALLBACK_MODEL                  (optional; a second Gemini model has its own quota)
 *   3. Groq             GROQ_API_KEY, GROQ_MODEL               (optional; used when Gemini fails or hits its limit)
 * Each provider gets its own time limit, so one slow provider cannot use up the time of the next.
 * Every provider receives the same system instruction, passages and user context.
 */
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
// Groq model id: check https://console.groq.com/docs/models for the models available to your key.
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 12000;
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS) || 10000;
const RETRY_DELAY_MS = 800;

/**
 * True for errors worth one quick retry on the same model: it is momentarily busy (503). Quota errors
 * (429) are not retried there: a retry would fail again, so the chain moves on to the next provider.
 */
function isBusyError(err) {
  const text = `${err?.status ?? ''} ${err?.code ?? ''} ${err?.message ?? ''}`;
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(text)) return false;
  return /\b503\b|UNAVAILABLE|overloaded|high demand/i.test(text);
}

// ------------------------------------------------------------------ Gemini
/**
 * Gemini through the official @google/genai SDK, on the v1beta API (on v1, system instructions are
 * rejected for some models and the "-latest" aliases do not exist). Returns null without an API key.
 */
function createGeminiGenerator({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL, client } = {}) {
  if (!apiKey && !client) return null;
  const ai = client || new (require('@google/genai').GoogleGenAI)({ apiKey, httpOptions: { apiVersion: 'v1beta' } });
  const modelName = model || DEFAULT_GEMINI_MODEL;
  const call = ({ systemInstruction, contents, abortSignal, temperature }) =>
    ai.models.generateContent({ model: modelName, contents, config: { systemInstruction, temperature, abortSignal } });

  const generate = async ({ systemInstruction, contents, abortSignal, temperature = 0.2 }) => {
    let response;
    try {
      response = await call({ systemInstruction, contents, abortSignal, temperature });
    } catch (err) {
      if (!isBusyError(err) || abortSignal?.aborted) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      if (abortSignal?.aborted) throw err;
      response = await call({ systemInstruction, contents, abortSignal, temperature }); // one retry, same time limit
    }
    return response.text;
  };
  generate.provider = 'gemini';
  generate.modelName = modelName;
  generate.timeoutMs = GEMINI_TIMEOUT_MS;
  return generate;
}

// ------------------------------------------------------------------ Groq
/** Gemini-style history -> OpenAI-style messages (Groq's chat API is OpenAI-compatible). */
function toChatMessages(systemInstruction, contents) {
  return [
    { role: 'system', content: systemInstruction },
    ...contents.map((c) => ({
      role: c.role === 'model' ? 'assistant' : 'user',
      content: (c.parts || []).map((p) => p.text || '').join('\n'),
    })),
  ];
}

/** Groq chat completions over plain HTTPS (no extra package). Returns null without an API key. */
function createGroqGenerator({ apiKey = process.env.GROQ_API_KEY, model = process.env.GROQ_MODEL, fetchImpl = fetch } = {}) {
  if (!apiKey) return null;
  const modelName = model || DEFAULT_GROQ_MODEL;
  const generate = async ({ systemInstruction, contents, abortSignal, temperature = 0.2 }) => {
    const res = await fetchImpl(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelName, temperature, messages: toChatMessages(systemInstruction, contents) }),
      signal: abortSignal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`Groq ${res.status}: ${data?.error?.message || res.statusText}`);
      err.status = res.status;
      throw err;
    }
    return data?.choices?.[0]?.message?.content ?? '';
  };
  generate.provider = 'groq';
  generate.modelName = modelName;
  generate.timeoutMs = GROQ_TIMEOUT_MS;
  return generate;
}

// ------------------------------------------------------------------ chain
/**
 * Tries each provider in order until one returns a non-empty answer. Each gets its own time limit
 * (provider.timeoutMs) and stops early if the caller aborts. Returns { text, provider, model };
 * throws the last error if every provider fails.
 */
function createFallbackChain(providers) {
  const list = providers.filter(Boolean);
  if (!list.length) return null;

  const generate = async ({ abortSignal, ...args }) => {
    const errors = [];
    for (const p of list) {
      if (abortSignal?.aborted) break;
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      abortSignal?.addEventListener('abort', onAbort, { once: true });
      let timer;
      try {
        const text = await Promise.race([
          p({ ...args, abortSignal: controller.signal }),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error(`timed out after ${p.timeoutMs || 15000} ms`));
            }, p.timeoutMs || 15000);
          }),
        ]);
        if (String(text || '').trim()) return { text, provider: p.provider, model: p.modelName };
        errors.push(`${p.provider}/${p.modelName}: empty answer`);
      } catch (err) {
        errors.push(`${p.provider}/${p.modelName}: ${String(err.message || err).slice(0, 160)}`);
        console.warn(`[chat] ${p.provider} (${p.modelName}) failed: ${String(err.message || err).slice(0, 200)}`);
      } finally {
        clearTimeout(timer);
        abortSignal?.removeEventListener('abort', onAbort);
      }
    }
    throw new Error(errors.join(' | ') || 'no provider answered');
  };
  generate.providers = list.map((p) => `${p.provider}:${p.modelName}`);
  generate.modelName = list[0].modelName;
  // Enough time for every provider in turn, plus a little slack.
  generate.timeoutMs = list.reduce((sum, p) => sum + (p.timeoutMs || 15000), 0) + 1000 * list.length;
  return generate;
}

/** The chain configured by environment variables (see the top of this file), or null if no key is set. */
function createDefaultGenerator(env = process.env) {
  // `|| ''`: an unset key must mean "off", not fall back to process.env via the default parameters.
  const gemini = createGeminiGenerator({ apiKey: env.GEMINI_API_KEY || '', model: env.GEMINI_MODEL || '' });
  const geminiBackup =
    env.GEMINI_API_KEY && env.GEMINI_FALLBACK_MODEL && env.GEMINI_FALLBACK_MODEL !== (env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL)
      ? createGeminiGenerator({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_FALLBACK_MODEL })
      : null;
  const groq = createGroqGenerator({ apiKey: env.GROQ_API_KEY || '', model: env.GROQ_MODEL || '' });
  return createFallbackChain([gemini, geminiBackup, groq]);
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  createGeminiGenerator,
  createGroqGenerator,
  createFallbackChain,
  createDefaultGenerator,
  _internal: { toChatMessages, isBusyError },
};
