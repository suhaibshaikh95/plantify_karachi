// Small display formatters.

/** 24.9203, 67.0912 -> "24.92° N, 67.09° E" */
export function formatCoords(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

/** "Safari Park, …" + "Gulshan Iqbal" -> "Safari Park, …, Gulshan Iqbal" */
export function siteName(site) {
  if (!site) return '';
  return site.town ? `${site.label}, ${site.town}` : site.label;
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
