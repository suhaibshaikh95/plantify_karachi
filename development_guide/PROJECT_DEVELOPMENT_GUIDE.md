# Plantify Karachi — Project Development Guide & Progress Tracker

> **Project Name:** Plantify Karachi (FYP-1)  
> **Architecture:** Hybrid Recommendation Engine (Deterministic Rule Filter + XGBoost ML Classifier)  
> **Last Updated:** October 25, 2026  
> **Overall Project Completion:** **40%** `[████████░░░░░░░░░░░░] 40% Complete`

---

## Progress Dashboard

| Phase | Description | Status | Completion |
|:---|:---|:---:|:---:|
| **Phase 1** | Dataset Audit, Preprocessing & Model Benchmark | ✅ **COMPLETED** | **100%** |
| **Phase 1.5** | Academic Reporting, Model Selection & Code Explanations | ✅ **COMPLETED** | **100%** |
| **Phase 2** | FastAPI Backend & Hybrid Recommender Implementation | ⏳ **READY TO START** | **0%** |d
| **Phase 3** | Responsive Modern Web Frontend Development | ⏸️ **PENDING** | **0%** |
| **Phase 4** | End-to-End System Testing & FYP Viva Presentation Prep | ⏸️ **PENDING** | **0%** |

---

## Detailed Phases & Sub-Steps Tracker

### ✅ Phase 1: Dataset Audit, Preprocessing & Model Benchmark (100% Completed)
- [x] **1.1 Dataset Integrity Verification**
  - Verified `training_clean.csv` shape: `(221,000, 54)` (104 Karachi sites × 25 user scenarios × 85 candidate plants).
  - Verified `plants_clean.csv` (85 plants) and `sites_clean.csv` (104 Karachi locations × 17 features, including ISRIC 2016 Global Soil Salinity classes).
- [x] **1.2 Zero-Leakage Feature Preprocessing**
  - Combined 10 site, 6 user, and 33 plant features (49 base features).
  - One-hot encoded 7 categorical features with `site_` prefix.
  - Handled missing trait values by imputing with `-1` (no rows dropped).
  - Built final 66-dimensional feature matrix $X$.
- [x] **1.3 Forbidden Columns Assertion**
  - Confirmed `suitable`, `top6`, `scenario_id`, `site_id`, `scientific_name` are excluded from $X$.
- [x] **1.4 Site-Based Stratified Split**
  - Executed `GroupShuffleSplit` on `site_id` (test size = 20%, random_state = 42).
  - Train: 176,375 rows across 83 sites.
  - Test: 44,625 rows across 21 completely unseen sites (`assert disjoint == True`).
- [x] **1.5 Model Benchmark & Training (v2.3 ISRIC Real Salinity Map)**
  - Trained **Random Forest Baseline** (200 trees, min_samples_leaf = 2):
    * Accuracy: `99.863%` (61 errors) | F1: `0.99861` | Top-6 Overlap: `0.41111`
  - Trained **XGBoost Classifier** (300 trees, max_depth = 6, lr = 0.1):
    * Accuracy: `99.984%` (only 7 errors) | F1: `0.99984` | Top-6 Overlap: `0.53619`
- [x] **1.6 Model Selection & Export**
  - Selected **XGBoost** as the winning production model based on F1-score and Top-6 Overlap.
  - Exported `outputs/plantify_model.joblib` and `outputs/feature_columns.json`.
  - Generated confusion matrix and feature importance charts (`outputs/*.png`).

---

### ✅ Phase 1.5: Academic Refinements & Code Documentation (100% Completed)
- [x] **1.5.1 Top-6 Overlap Clarification**
  - Replaced imprecise "confirmatory" claims with the honest academic explanation:
    * Overlap (53.7%) is bounded because many plants tie at the 100-point score cap in the rule engine; the rule engine breaks ties arbitrarily by list order, whereas the model ranks by learned continuous probability.
- [x] **1.5.2 Feature Importance Attribution**
  - Dynamically labeled Section 4 as `## 4. Top Features ({best_name} feature importance)`.
- [x] **1.5.3 Accuracy Range & ROC-AUC Precision**
  - Updated accuracy range to `~99.8–99.96%`.
  - Added explicit 8-decimal ROC-AUC precision: `0.99999900` to clarify 5-decimal rounding to 1.00000.
- [x] **1.5.4 Roman Urdu Code Explanations**
  - Added comprehensive Roman Urdu comments to every single section of `train.py` for effortless FYP defense.

---

### ⏳ Phase 2: FastAPI Backend & Hybrid Engine (0% - Ready to Start)
- [ ] **2.1 Backend Project Structure Setup**
  - Create `backend/app/` folder structure:
    * `backend/app/main.py`: FastAPI server setup with CORS and health endpoints.
    * `backend/app/schemas.py`: Pydantic input/output schemas with data validation.
    * `backend/app/hybrid_engine.py`: Core 2-stage recommendation logic.
- [ ] **2.2 Stage 1: Deterministic Rule Filter Implementation**
  - Filter out banned invasive species (`do_not_plant == 1`, e.g., Conocarpus in small areas).
  - Filter out poisonous plants when children/pets are present (`children_or_animals == 1` & `poisonous == 1`).
  - Filter out plants exceeding soil salinity threshold (`site_salinity > salt_tolerance`).
  - Filter out aggressive root trees in small spaces (`needs_large_space == 1` & `space != 'large'`).
  - Filter out water-intensive plants if watering days are insufficient.
  - Return detailed exclusion reasons for every filtered plant (100% explainability).
- [ ] **2.3 Stage 2: XGBoost Probabilistic Inference**
  - Format the remaining eligible candidate plants into the 66-column feature vector.
  - Run `plantify_model.predict_proba()` to compute exact continuous suitability percentages.
  - Sort descending by probability to break all 100-point ties.
  - Select the **Top 6 recommendations**.
- [ ] **2.4 REST API Endpoints**
  - `GET /api/sites`: Return 104 Karachi locations with GPS coordinates and soil/climate properties.
  - `POST /api/nearest-site`: Calculate nearest Karachi site using latitude and longitude.
  - `POST /api/recommend`: Run full hybrid recommendation pipeline and return JSON response.
  - `GET /api/model/info`: Expose model metrics, confusion matrix, and feature importances.
- [ ] **2.5 Automated API Smoke Testing**
  - Verify API responds in $< 30\text{ ms}$ with zero runtime errors.

---

### ⏸️ Phase 3: Responsive Modern Web Frontend (0% - Pending Phase 2)
- [ ] **3.1 Frontend Foundation & Styling**
  - Create modern, responsive layout (`frontend/index.html`, `frontend/style.css`, `frontend/app.js`).
  - Karachi green & urban nature aesthetic with dark/light glassmorphic card design.
- [ ] **3.2 Location Selector & GPS Integration**
  - Dropdown of all 104 Karachi neighborhoods (Clifton, DHA, Gulshan, Malir, Korangi, etc.).
  - Coordinates / nearest-site auto-detection.
- [ ] **3.3 Interactive Questionnaire Form**
  - Salinity selector (Normal, Low, High).
  - Space available (Pot, Balcony, Small Garden, Large Open Ground).
  - Watering frequency (Days per week).
  - Children & Pets toggle (Safety filter).
  - Planting purpose (Shade, Fruit, Ornamental, Carbon sequestration).
- [ ] **3.4 Top 6 Plant Cards Display**
  - High-resolution card per plant showing:
    * Common Name, Scientific Name, Urdu context.
    * XGBoost Suitability Percentage gauge (e.g. 98.4%).
    * Badges: *Native to Karachi*, *Drought Tolerant*, *Urban Heat Tolerant*, *Low Maintenance*.
    * Seasonal watering and soil care instructions.
- [ ] **3.5 Explainability & Transparency Drawers**
  - *"Why these plants?"* explanation breakdown.
  - *"Excluded Plants Drawer"*: Explicit list showing which species were eliminated and why (proving hybrid safety).
- [ ] **3.6 Model Evaluation & Viva Defense Tab**
  - Live interactive tab showing Random Forest vs XGBoost benchmark metrics, confusion matrix, and top feature importances for examiner presentation.

---

### ⏸️ Phase 4: Integration, Testing & FYP Deliverables (0% - Pending Phase 3)
- [ ] **4.1 End-to-End System Integration**
  - Connect web frontend with FastAPI backend.
  - Test live scenarios (e.g., coastal Clifton flat vs. Malir farmhouse).
- [ ] **4.2 Edge Case Validation**
  - Verify 0 poisonous plants are recommended when pets are enabled.
  - Verify 0 banned species are recommended under any circumstance.
- [ ] **4.3 FYP Documentation & Walkthrough**
  - Generate complete user guide, API documentation, and viva defense cheat sheet.

---

## Key Files Reference

| File | Purpose | Status |
|:---|:---|:---:|
| [`train.py`](file:///Users/mac/Desktop/plantify-FYP1/train.py) | Model training, benchmarking & report generation script (with Roman Urdu comments) | ✅ Done |
| [`outputs/plantify_model.joblib`](file:///Users/mac/Desktop/plantify-FYP1/outputs/plantify_model.joblib) | Serialized XGBoost production model | ✅ Done |
| [`outputs/feature_columns.json`](file:///Users/mac/Desktop/plantify-FYP1/outputs/feature_columns.json) | 66-dimensional feature ordering schema | ✅ Done |
| [`outputs/TRAINING_REPORT.md`](file:///Users/mac/Desktop/plantify-FYP1/outputs/TRAINING_REPORT.md) | Official academic training and limitations report | ✅ Done |
| `backend/app/hybrid_engine.py` | Two-stage hybrid recommendation engine | ⏳ Next |
| `backend/app/main.py` | FastAPI REST API endpoints | ⏳ Next |
| `frontend/index.html` | Interactive web dashboard | ⏸️ Queued |
| `frontend/app.js` | Frontend logic & API connection | ⏸️ Queued |
