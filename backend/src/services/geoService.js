function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle Haversine distance in kilometers.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Find the nearest Karachi reference site from a list of sites.
 */
function findNearestSite(lat, lon, sites) {
  let best = null;
  let bestKm = Infinity;

  for (const site of sites) {
    const km = haversineKm(lat, lon, site.lat, site.lon);
    if (km < bestKm) {
      bestKm = km;
      best = site;
    }
  }

  return {
    site: best,
    distance_km: Math.round(bestKm * 10) / 10,
  };
}

module.exports = {
  haversineKm,
  findNearestSite,
};

