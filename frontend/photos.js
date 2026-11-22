/*
 * Plantify Karachi - plant photos.
 *
 * The photos are stored in the project (data/photos/*.jpg) and listed in
 * data/photos.json with each photographer and licence, so they show without
 * internet. They come from Wikipedia / Wikimedia Commons (free licences only) and
 * are downloaded by scripts/fetch_photos.py.
 * A plant with no photo keeps its tree / shrub / palm icon.
 *
 * (Roman Urdu: har plant ki tasveer project ke andar se dikhata hai, credit ke saath.)
 */
(function (root) {
  'use strict';

  let manifest = null;

  async function load() {
    if (manifest) return manifest;
    try {
      const res = await fetch('data/photos.json');
      manifest = res.ok ? await res.json() : {};
    } catch (e) {
      manifest = {};
    }
    return manifest;
  }

  /**
   * names: scientific names. Resolves to Map(name -> photo|null), where
   * photo = { thumb, page, artist, license }. Never rejects.
   */
  async function get(names) {
    const m = await load();
    return new Map(names.map((n) => {
      const p = m[n];
      return [n, p ? { thumb: p.src, page: p.source_page || p.article, artist: p.artist, license: p.license } : null];
    }));
  }

  root.PlantifyPhotos = { get };
})(self);
