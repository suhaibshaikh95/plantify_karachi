const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const paths = require('../config/paths');
const store = require('../data/store');

const MISSING_VALUE = -1;

function isMissing(val) {
  return val === null || val === undefined || val === '' || (typeof val === 'number' && Number.isNaN(val));
}

/**
 * Build a single 66-column feature vector aligned strictly to feature_columns.json,
 * matching schema.json (site_features + user_features + plant_features, -1 imputation,
 * and `site_` prefixed one-hot encoding for the 7 categorical features).
 */
function buildFeatureVector(site, userFeatures, plant) {
  const { schema, featureColumns } = store;
  const rowMap = Object.create(null);

  // 1. Site features (10)
  for (const col of schema.site_features) {
    if (!schema.categorical_features.includes(col)) {
      rowMap[col] = isMissing(site[col]) ? MISSING_VALUE : Number(site[col]);
    }
  }

  // 2. User features (6)
  for (const col of schema.user_features) {
    if (!schema.categorical_features.includes(col)) {
      rowMap[col] = isMissing(userFeatures[col]) ? MISSING_VALUE : Number(userFeatures[col]);
    }
  }

  // 3. Plant features (33, including computed purpose_match)
  for (const col of schema.plant_features) {
    if (col === 'purpose_match') {
      const p = userFeatures.purpose;
      rowMap[col] = p === 'any' || Number(plant[`purpose_${p}`]) === 1 ? 1 : 0;
    } else {
      rowMap[col] = isMissing(plant[col]) ? MISSING_VALUE : Number(plant[col]);
    }
  }

  // 4. Categorical features (7) -> one-hot with `site_` prefix
  const catSource = { ...site, ...userFeatures };
  for (const col of schema.categorical_features) {
    const val = catSource[col];
    if (!isMissing(val)) {
      rowMap[`site_${col}_${val}`] = 1;
    }
  }

  // 5. Align strictly to the 66 columns in feature_columns.json (default 0 for unseen one-hot cols)
  return featureColumns.map((colName) => {
    if (Object.prototype.hasOwnProperty.call(rowMap, colName)) {
      return rowMap[colName];
    }
    return colName.startsWith('site_') ? 0 : MISSING_VALUE;
  });
}

function resolvePythonBin() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const venvCandidates = [
    path.resolve(paths.BACKEND_ROOT, '.venv', 'bin', 'python3'),
    path.resolve(paths.BACKEND_ROOT, '.venv', 'bin', 'python'),
    path.resolve(paths.BACKEND_ROOT, '..', '.venv', 'bin', 'python3'),
    path.resolve(paths.BACKEND_ROOT, '..', '.venv', 'bin', 'python'),
  ];
  for (const candidate of venvCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'python3';
}

class MlPredictor {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.failed = false;
    this.pending = [];
    this.initPromise = null;
  }

  async init() {
    if (this.ready) return true;
    if (this.failed) return false;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      const pyBin = resolvePythonBin();
      let settled = false;
      let child;

      const failWorker = (reason) => {
        this.failed = true;
        this.ready = false;
        this.worker = null;
        while (this.pending.length > 0) {
          const { reject } = this.pending.shift();
          reject(new Error(reason));
        }
        if (!settled) {
          settled = true;
          resolve(false);
        }
      };

      try {
        child = spawn(pyBin, [paths.PREDICT_SCRIPT_PATH, paths.MODEL_PATH, '--serve'], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err) {
        failWorker(`Python worker spawn threw: ${err.message}`);
        return;
      }

      const rl = readline.createInterface({ input: child.stdout });

      child.on('error', (err) => failWorker(`Python worker spawn failed: ${err.message}`));
      child.on('exit', (code) => {
        if (!this.ready) failWorker(`Python worker exited early (code ${code})`);
        else {
          this.ready = false;
          this.worker = null;
        }
      });

      let stderrBuf = '';
      child.stderr.on('data', (chunk) => {
        stderrBuf += chunk.toString();
      });

      rl.on('line', (line) => {
        if (!line.trim()) return;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          return;
        }

        if (!settled && msg.ready) {
          settled = true;
          this.worker = child;
          this.ready = true;
          resolve(true);
          return;
        }

        const job = this.pending.shift();
        if (!job) return;
        if (msg.error) job.reject(new Error(msg.error));
        else job.resolve(msg.probabilities || []);
      });

      // Timeout safety if Python hangs on import
      setTimeout(() => {
        if (!settled) {
          child.kill();
          failWorker(`Python worker startup timeout (${stderrBuf.trim() || 'no stderr'})`);
        }
      }, 5000);
    });

    return this.initPromise;
  }

  async predictBatch(site, userFeatures, eligiblePlants) {
    if (!eligiblePlants.length) return { source: 'model', probabilities: [] };

    const ok = await this.init();
    if (!ok || !this.worker) {
      return { source: 'rules_fallback', probabilities: null };
    }

    const rows = eligiblePlants.map((plant) => buildFeatureVector(site, userFeatures, plant));

    const probabilities = await new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.worker.stdin.write(JSON.stringify({ rows }) + '\n');
    });

    return { source: 'model', probabilities };
  }

  isModelReady() {
    return this.ready;
  }
}

module.exports = {
  buildFeatureVector,
  mlPredictor: new MlPredictor(),
};
