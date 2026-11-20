/*
 * Reads GPS coordinates from a JPEG photo's EXIF block, no library needed.
 * Returns { lat, lon } or null (no EXIF, no GPS, or not a JPEG, e.g. HEIC).
 *
 * (Roman Urdu: photo ke andar chhupi GPS location nikalta hai.)
 */
(function (root) {
  'use strict';

  async function readGps(file) {
    try {
      const buf = await file.slice(0, 256 * 1024).arrayBuffer();   // EXIF lives at the start
      return parse(new DataView(buf));
    } catch (e) {
      return null;
    }
  }

  function parse(v) {
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;   // not a JPEG
    let off = 2;
    while (off + 4 <= v.byteLength) {
      const marker = v.getUint16(off);
      const size = v.getUint16(off + 2);
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {   // "Exif"
        return parseTiff(v, off + 10);
      }
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;   // start of scan: no more headers
      off += 2 + size;
    }
    return null;
  }

  function parseTiff(v, t) {
    const little = v.getUint16(t) === 0x4949;
    const u16 = (o) => v.getUint16(o, little);
    const u32 = (o) => v.getUint32(o, little);
    const ifd0 = t + u32(t + 4);
    const gpsPtr = findTag(ifd0, 0x8825);
    if (gpsPtr === null) return null;
    const gps = t + gpsPtr;
    const latRef = ascii(findEntry(gps, 0x0001));
    const lat = rationals(findEntry(gps, 0x0002));
    const lonRef = ascii(findEntry(gps, 0x0003));
    const lon = rationals(findEntry(gps, 0x0004));
    if (!lat || !lon) return null;
    let la = lat[0] + lat[1] / 60 + lat[2] / 3600;
    let lo = lon[0] + lon[1] / 60 + lon[2] / 3600;
    if (latRef === 'S') la = -la;
    if (lonRef === 'W') lo = -lo;
    if (!isFinite(la) || !isFinite(lo) || (la === 0 && lo === 0)) return null;
    return { lat: la, lon: lo };

    function findEntry(ifd, tag) {
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (u16(e) === tag) return e;
      }
      return null;
    }
    function findTag(ifd, tag) {
      const e = findEntry(ifd, tag);
      return e === null ? null : u32(e + 8);
    }
    function ascii(e) {
      return e === null ? '' : String.fromCharCode(v.getUint8(e + 8));
    }
    function rationals(e) {
      if (e === null || u16(e + 2) !== 5 || u32(e + 4) < 3) return null;
      const p = t + u32(e + 8);
      const r = [];
      for (let i = 0; i < 3; i++) {
        const den = u32(p + i * 8 + 4);
        r.push(den ? u32(p + i * 8) / den : 0);
      }
      return r;
    }
  }

  const api = { readGps, parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PlantifyExif = api;
})(typeof self !== 'undefined' ? self : this);
