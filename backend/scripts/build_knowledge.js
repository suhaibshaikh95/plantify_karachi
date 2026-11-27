#!/usr/bin/env node
// `npm run build:knowledge`: runs src/ml/build_index.py with the same Python the server uses
// (PYTHON_BIN, then backend/.venv or ../.venv, then python on Windows / python3 elsewhere).
const { spawnSync } = require('child_process');
const path = require('path');
const { resolvePythonBin } = require('../src/config/python');

const root = path.resolve(__dirname, '..');
const python = resolvePythonBin();

console.log(`Using ${python}`);
const result = spawnSync(python, [path.join(root, 'src', 'ml', 'build_index.py'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, HF_HUB_DISABLE_SYMLINKS_WARNING: '1' },
});
if (result.error) console.error(`Could not run Python (${result.error.message}). Set PYTHON_BIN to your Python.`);
process.exit(result.status ?? 1);
