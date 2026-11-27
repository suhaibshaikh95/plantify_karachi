/**
 * Finds the Python used by the ML workers (predict.py, rag_worker.py) and `npm run build:knowledge`.
 *
 * Order: PYTHON_BIN, then a virtual environment in backend/.venv or ../.venv, then `python` on
 * Windows / `python3` elsewhere. Works on Windows (Scripts\python.exe) and macOS/Linux (bin/python3).
 *
 * A venv copied from another computer is skipped: e.g. the repo's committed macOS .venv, whose
 * bin/python3 is a symlink that Git checks out on Windows as a tiny text file, not a program.
 */
const fs = require('fs');
const path = require('path');
const paths = require('./paths');

const isWin = process.platform === 'win32';

function isRealExecutable(file) {
  try {
    const st = fs.statSync(file); // follows symlinks; a broken symlink throws
    return st.isFile() && st.size > 1024; // a symlink saved as a text file is only a few bytes
  } catch {
    return false;
  }
}

function venvCandidates(dir) {
  return isWin
    ? [path.join(dir, 'Scripts', 'python.exe')]
    : [path.join(dir, 'bin', 'python3'), path.join(dir, 'bin', 'python')];
}

function resolvePythonBin() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const dirs = [path.join(paths.BACKEND_ROOT, '.venv'), path.join(paths.BACKEND_ROOT, '..', '.venv')];
  for (const dir of dirs) {
    const found = venvCandidates(dir).find(isRealExecutable);
    if (found) return found;
  }
  return isWin ? 'python' : 'python3';
}

module.exports = { resolvePythonBin };
