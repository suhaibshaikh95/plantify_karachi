/**
 * Keeps the Python retrieval worker (src/ml/rag_worker.py) running and sends it questions.
 * Same JSON-lines pattern as mlPredictor.js: one request line in, one response line out.
 *
 * search({ question, k, plants, site_id }) -> [{ id, source_type, title, text, scientific_name,
 *                                                 site_id, similarity, score }]
 * Never throws: if the worker is not available it returns [] (the chat service then degrades).
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const paths = require('../config/paths');

const STARTUP_TIMEOUT_MS = Number(process.env.RAG_STARTUP_TIMEOUT_MS) || 120000; // first run may download BGE-small
const REQUEST_TIMEOUT_MS = 10000;

function resolvePythonBin() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const candidates = [
    path.resolve(paths.BACKEND_ROOT, '.venv', 'bin', 'python3'),
    path.resolve(paths.BACKEND_ROOT, '.venv', 'bin', 'python'),
    path.resolve(paths.BACKEND_ROOT, '.venv', 'Scripts', 'python.exe'),
    path.resolve(paths.BACKEND_ROOT, '..', '.venv', 'bin', 'python3'),
    path.resolve(paths.BACKEND_ROOT, '..', '.venv', 'bin', 'python'),
    path.resolve(paths.BACKEND_ROOT, '..', '.venv', 'Scripts', 'python.exe'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return process.platform === 'win32' ? 'python' : 'python3';
}

class RagRetriever {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.status = 'not_started'; // not_started | starting | ready | unavailable
    this.reason = null;
    this.pending = [];
    this.initPromise = null;
  }

  init() {
    if (this.initPromise) return this.initPromise;
    this.status = 'starting';

    this.initPromise = new Promise((resolve) => {
      let settled = false;
      const done = (ok, reason) => {
        if (settled) return;
        settled = true;
        this.ready = ok;
        this.status = ok ? 'ready' : 'unavailable';
        this.reason = ok ? null : reason;
        if (!ok) {
          this.worker = null;
          this.failPending(reason);
        }
        resolve(ok);
      };

      if (!fs.existsSync(paths.FAISS_INDEX_PATH) || !fs.existsSync(paths.PASSAGES_PATH)) {
        done(false, 'knowledge index not built (run `npm run build:knowledge`)');
        return;
      }

      let child;
      try {
        child = spawn(resolvePythonBin(), [paths.RAG_SCRIPT_PATH, paths.KNOWLEDGE_DIR, '--serve'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, TOKENIZERS_PARALLELISM: 'false' },
        });
      } catch (err) {
        done(false, `could not start Python: ${err.message}`);
        return;
      }

      let stderr = '';
      child.stderr.on('data', (c) => {
        stderr = (stderr + c.toString()).slice(-2000);
      });
      child.on('error', (err) => done(false, `could not start Python: ${err.message}`));
      child.on('exit', (code) => {
        if (!settled) {
          done(false, `worker exited (code ${code}): ${lastLine(stderr)}`);
          return;
        }
        if (this.worker !== child) return; // an old worker replaced by restart()
        this.ready = false;
        this.status = 'unavailable';
        this.reason = `worker stopped (code ${code})`;
        this.worker = null;
        this.failPending('retrieval worker stopped');
      });

      readline.createInterface({ input: child.stdout }).on('line', (line) => {
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          return;
        }
        if (!settled && 'ready' in msg) {
          if (msg.ready) {
            this.worker = child;
            done(true);
          } else {
            done(false, msg.error || 'worker not ready');
          }
          return;
        }
        const job = this.pending.shift();
        if (!job) return;
        clearTimeout(job.timer);
        if (msg.error) job.reject(new Error(msg.error));
        else job.resolve(msg.passages || []);
      });

      setTimeout(() => {
        if (!settled) {
          child.kill();
          done(false, `worker startup timeout (${lastLine(stderr) || 'no output'})`);
        }
      }, STARTUP_TIMEOUT_MS).unref();
    });

    return this.initPromise;
  }

  failPending(reason) {
    while (this.pending.length) {
      const job = this.pending.shift();
      clearTimeout(job.timer);
      job.reject(new Error(reason));
    }
  }

  async search({ question, k = 6, plants = [], site_id = null }) {
    const ok = await this.init();
    if (!ok || !this.worker) return [];
    try {
      return await new Promise((resolve, reject) => {
        const job = { resolve, reject, timer: null };
        job.timer = setTimeout(() => {
          // Drop this job; a late answer would be matched to the next request, so restart cleanly.
          const i = this.pending.indexOf(job);
          if (i >= 0) this.pending.splice(i, 1);
          reject(new Error('retrieval timeout'));
          this.restart();
        }, REQUEST_TIMEOUT_MS);
        this.pending.push(job);
        this.worker.stdin.write(JSON.stringify({ question, k, plants, site_id }) + '\n');
      });
    } catch (err) {
      console.warn(`[rag] search failed: ${err.message}`);
      return [];
    }
  }

  restart() {
    if (this.worker) this.worker.kill();
    this.worker = null;
    this.ready = false;
    this.initPromise = null;
    this.init();
  }

  isReady() {
    return this.ready;
  }

  info() {
    return { status: this.status, reason: this.reason };
  }
}

function lastLine(text) {
  return text.trim().split('\n').filter(Boolean).pop() || '';
}

module.exports = { RagRetriever, ragRetriever: new RagRetriever() };
