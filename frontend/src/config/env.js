// Runtime configuration read from Vite environment variables (see .env.example).

/** Base address of the Node.js backend. Empty = same origin (dev proxy or backend serving the app). */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/** How long to wait for the backend before showing an error. */
export const REQUEST_TIMEOUT_MS = 20000;

/** Map defaults: the view of Karachi shown before a location is set. */
export const MAP_DEFAULT = { lat: 24.93, lon: 67.08, zoom: 10 };
