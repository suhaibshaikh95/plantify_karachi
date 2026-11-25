// Reads GPS coordinates from a JPEG photo's EXIF block, in the browser, with no library.
// Returns { lat, lon } or null (no EXIF, no GPS, or not a JPEG such as HEIC).

export async function readPhotoGps(file) {
  try {
    const buffer = await file.slice(0, 256 * 1024).arrayBuffer(); // EXIF sits at the start
    return parseJpeg(new DataView(buffer));
  } catch {
    return null;
  }
}

function parseJpeg(view) {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) return parseTiff(view, offset + 10);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
    offset += 2 + size;
  }
  return null;
}

function parseTiff(view, tiff) {
  const little = view.getUint16(tiff) === 0x4949;
  const u16 = (o) => view.getUint16(o, little);
  const u32 = (o) => view.getUint32(o, little);

  const findEntry = (ifd, tag) => {
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === tag) return entry;
    }
    return null;
  };
  const ascii = (entry) => (entry === null ? '' : String.fromCharCode(view.getUint8(entry + 8)));
  const rationals = (entry) => {
    if (entry === null || u16(entry + 2) !== 5 || u32(entry + 4) < 3) return null;
    const p = tiff + u32(entry + 8);
    return [0, 1, 2].map((i) => {
      const den = u32(p + i * 8 + 4);
      return den ? u32(p + i * 8) / den : 0;
    });
  };

  const gpsEntry = findEntry(tiff + u32(tiff + 4), 0x8825);
  if (gpsEntry === null) return null;
  const gps = tiff + u32(gpsEntry + 8);
  const lat = rationals(findEntry(gps, 0x0002));
  const lon = rationals(findEntry(gps, 0x0004));
  if (!lat || !lon) return null;

  let la = lat[0] + lat[1] / 60 + lat[2] / 3600;
  let lo = lon[0] + lon[1] / 60 + lon[2] / 3600;
  if (ascii(findEntry(gps, 0x0001)) === 'S') la = -la;
  if (ascii(findEntry(gps, 0x0003)) === 'W') lo = -lo;
  if (!Number.isFinite(la) || !Number.isFinite(lo) || (la === 0 && lo === 0)) return null;
  return { lat: la, lon: lo };
}
