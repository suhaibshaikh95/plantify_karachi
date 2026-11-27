#!/usr/bin/env node
// `npm run build:knowledge`: runs src/ml/build_index.py with the same Python the server uses
// (PYTHON_BIN, then backend/.venv or ../.venv, then python3 / python on PATH).
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const candidates = [
  process.env.PYTHON_BIN,
  path.join(root, '.venv', 'bin', 'python3'),
  path.join(root, '.venv', 'Scripts', 'python.exe'),
  path.join(root, '..', '.venv', 'bin', 'python3'),
  path.join(root, '..', '.venv', 'Scripts', 'python.exe'),
].filter(Boolean);
const python = candidates.find((c) => fs.existsSync(c)) || (process.platform === 'win32' ? 'python' : 'python3');

console.log(`Using ${python}`);
const result = spawnSync(python, [path.join(root, 'src', 'ml', 'build_index.py'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
});
if (result.error) console.error(`Could not run Python (${result.error.message}). Set PYTHON_BIN to your Python.`);
process.exit(result.status ?? 1);
