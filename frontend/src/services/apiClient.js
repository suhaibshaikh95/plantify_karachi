// Low-level HTTP helper: JSON in/out, timeout, and readable errors.
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config/env';

/** Error thrown for any failed request; `message` is safe to show to users. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError(
      controller.signal.aborted
        ? 'The server took too long to answer. Please try again.'
        : 'Could not reach the Plantify server. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // The backend sends { error: "message" } (older shape: { error: { message, code } }).
    const err = data?.error;
    const message = (typeof err === 'string' ? err : err?.message) || `Something went wrong on the server (error ${res.status}).`;
    throw new ApiError(message, { status: res.status, code: (typeof err === 'object' && err?.code) || data?.status || null });
  }
  return data;
}

/** Full URL for a file the backend serves (e.g. "/static/photos/neem.jpg"). */
export function backendUrl(path) {
  if (!path || /^https?:\/\//.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}
