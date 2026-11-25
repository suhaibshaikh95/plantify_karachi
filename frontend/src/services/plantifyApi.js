// One function per backend endpoint used by the app. Shapes are documented in docs/BACKEND_API.md.
import { request } from './apiClient';

/** GET /api/sites: the 104 Karachi reference areas. */
export async function getSites({ signal } = {}) {
  const data = await request('/api/sites', { signal });
  return Array.isArray(data) ? data : data?.sites || [];
}

/** POST /api/nearest-site: { site, distance_km } for a point. */
export function getNearestSite(lat, lon) {
  return request('/api/nearest-site', { method: 'POST', body: { lat, lon } });
}

/** POST /api/recommend: top plants and excluded plants for a site and answers (raw backend response). */
export function getRecommendations(body) {
  return request('/api/recommend', { method: 'POST', body });
}

/** POST /api/chat: answer a question about the recommended plants. */
export function askPlantQuestion({ question, siteId, plants, history }) {
  return request('/api/chat', {
    method: 'POST',
    body: { question, site_id: siteId, plants, history },
  });
}
