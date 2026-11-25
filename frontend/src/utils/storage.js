// Safe wrappers around sessionStorage/localStorage (they can throw in private mode).

export function readJson(key, storage = window.sessionStorage) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJson(key, value, storage = window.sessionStorage) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key, storage = window.sessionStorage) {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}
