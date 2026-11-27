const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const ASSETS_DIR = path.join(BACKEND_ROOT, 'assets');
const DATA_DIR = path.join(ASSETS_DIR, 'data');
const MODEL_DIR = path.join(ASSETS_DIR, 'model');
const KNOWLEDGE_DIR = path.join(ASSETS_DIR, 'knowledge');

module.exports = {
  BACKEND_ROOT,
  DATA_DIR,
  MODEL_DIR,
  SITES_PATH: path.join(DATA_DIR, 'sites.json'),
  PLANTS_PATH: path.join(DATA_DIR, 'plants.json'),
  PHOTOS_JSON_PATH: path.join(DATA_DIR, 'photos.json'),
  PHOTOS_DIR: path.join(DATA_DIR, 'photos'),
  SCHEMA_PATH: path.join(MODEL_DIR, 'schema.json'),
  FEATURE_COLUMNS_PATH: path.join(MODEL_DIR, 'feature_columns.json'),
  METRICS_PATH: path.join(MODEL_DIR, 'metrics.json'),
  MODEL_PATH: path.join(MODEL_DIR, 'plantify_model.joblib'),
  PREDICT_SCRIPT_PATH: path.join(BACKEND_ROOT, 'src', 'ml', 'predict.py'),
  // Chatbot (RAG) knowledge base, built by src/ml/build_index.py
  KNOWLEDGE_DIR,
  PASSAGES_PATH: path.join(KNOWLEDGE_DIR, 'passages.jsonl'),
  FAISS_INDEX_PATH: path.join(KNOWLEDGE_DIR, 'index.faiss'),
  RAG_SCRIPT_PATH: path.join(BACKEND_ROOT, 'src', 'ml', 'rag_worker.py'),
};

