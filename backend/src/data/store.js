const fs = require('fs');
const paths = require('../config/paths');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const sites = readJson(paths.SITES_PATH);
const plants = readJson(paths.PLANTS_PATH);
const photosManifest = readJson(paths.PHOTOS_JSON_PATH);
const schema = readJson(paths.SCHEMA_PATH);
const featureColumns = readJson(paths.FEATURE_COLUMNS_PATH);
const metrics = readJson(paths.METRICS_PATH);

const sitesById = new Map(sites.map((s) => [Number(s.site_id), s]));
const plantsBySciName = new Map(plants.map((p) => [p.scientific_name, p]));

module.exports = {
  sites,
  plants,
  photosManifest,
  schema,
  featureColumns,
  metrics,
  sitesById,
  plantsBySciName,
};

