# Plantify Karachi — Model Training Plan (Instructions for the Agent)

Read this whole file before doing anything. Follow it step by step. If something in this file does not match what you find in the data, **stop and report it**. Do not guess, and do not invent columns, values, files or results.

---

## 0. Ground rules (apply to every step)

1. **Use only the files listed in Section 2.** Do not download, create or simulate any other dataset.
2. **Do not edit the CSV files.** Treat them as read-only. All cleaning happens in code, in memory.
3. **Use only the column names written in this file.** Before using a column, check that it exists. If a column is missing, stop and report its name. Never rename columns or create look-alikes.
4. **Never use the forbidden columns in Section 4.3 as features.** They are the answer key.
5. **Report only numbers your code actually printed.** Copy them from the output. Never estimate or round up results that were not computed.
6. **Do not claim real-world accuracy.** The labels come from rules (Section 1). Every report must say this.
7. **One step at a time.** Finish a step, check its "Done when" line, then move to the next.
8. **If an error happens, fix the code, not the data.** If you cannot fix it in 2 tries, stop and report the full error.
9. **Fixed randomness:** use `random_state=42` everywhere.

---

## 1. Project context (what this model is for)

**Plantify Karachi** recommends trees and plants for a location in Karachi.

App flow:

1. The user uploads a photo. Its EXIF GPS gives the location. There is no image analysis.
2. The nearest site in `sites_karachi_v2.csv` gives soil and climate.
3. The user answers a short form: signs of soil salinity (the map value from the ISRIC Global Soil Salinity Map is the default), watering days, space, care, purpose, and whether children or animals are there.
4. A rule engine based on the supervisor's planting guide removes unsuitable plants, then scores the rest out of 100.
5. The app shows the top 6 plants. A RAG chatbot explains why.

**What the model does:** it learns to predict `suitable` (0/1) for one *(site, user answers, plant)* row. In the app, the model's probability is used to rank plants.

**Important:** the `suitable` label was made by the rule engine: not removed and score ≥ 70. So the model is learning to **reproduce the rule engine**. Very high accuracy (around 99%) is expected and does **not** mean real-world accuracy.

---

## 2. Input files (the only data allowed)

Folder: `plantify_dataset_clean/`

| File | Shape | Role |
|---|---|---|
| `training_clean.csv` | 221,000 rows × 54 columns | **The only file needed for training.** 104 sites × 25 simulated users × 85 plants. Plant traits are already joined, so no merge is needed. |
| `schema.json` | — | The exact list of ID, feature, categorical, target and evaluation-only columns. Load it and use it; do not retype the lists. |
| `plants_clean.csv` | 85 rows × 37 columns | Plant traits and names, for the app and the chatbot. Not needed for training. |
| `sites_clean.csv` | 104 rows × 17 columns | Site location, soil, climate and the map salinity default (`site_salinity_default`, `sal_class_2016`), for the app's GPS lookup. Not needed for training. |

**Done when:** you have loaded all three CSVs and printed their shapes, and they match the table above. If they don't match, stop and report.

---

## 3. Goal and success criteria

**Goal:** train and compare classifiers that predict `suitable`, evaluated on sites never seen in training. Then save the best model for the FastAPI backend.

Success means all of these are true:

- [ ] The train/test split is by `site_id` (Section 5), with no site in both train and test.
- [ ] No forbidden column (Section 4.3) is in the feature matrix.
- [ ] At least 2 models are trained: a Random Forest, plus one of XGBoost, LightGBM or Logistic Regression.
- [ ] For each model, these are reported on the test sites: accuracy, precision, recall, F1, ROC-AUC, confusion matrix and **top-6 overlap** (Section 7).
- [ ] The Random Forest accuracy is close to the baseline (about 0.9986). XGBoost should be about 0.9998. If it is far off (below 0.97), investigate before going further.
- [ ] The best model and its exact feature column list are saved (Section 8).
- [ ] A short `TRAINING_REPORT.md` is written (Section 9).

---

## 4. Features

### 4.1 Load

```python
import json, pandas as pd
df = pd.read_csv("plantify_dataset_clean/training_clean.csv")
schema = json.load(open("plantify_dataset_clean/schema.json"))
```

Check that `df.shape == (221000, 54)`. If not, stop.

### 4.2 Feature columns (all taken from schema.json)

**Site (10):** `ph, t_mean, t_hottest_month, t_coldest_month, industrial, lst_zone_celsius, site_type, texture, drainage, fertility`

**User answers (6):** `site_salinity, water_days, space, care, purpose, children_or_animals`

**Plant (33):** `ph_opt_min, ph_opt_max, ph_abs_min, ph_abs_max, temp_opt_min, temp_opt_max, temp_abs_min, temp_abs_max, salt_tolerance, water_need, soil_light, soil_medium, soil_heavy, drainage_poor, drainage_well, drainage_excessive, fertility_low, fertility_medium, fertility_high, pollution_tolerance, urban_heat_tolerant, low_maintenance, native, proven_in_karachi, do_not_plant, poisonous, needs_large_space, purpose_shade, purpose_fruit, purpose_ornamental, purpose_carbon, guide_good, purpose_match`

**Categorical (one-hot encode with the prefix `site_`):** `site_type, texture, drainage, fertility, space, care, purpose`

`guide_good` and `purpose_match` are already in the file. Do not recompute them.

**Encoding:**

```python
CAT = schema["categorical_features"]
FEATS = schema["site_features"] + schema["user_features"] + schema["plant_features"]
X = pd.get_dummies(df[FEATS], columns=CAT, prefix=["site_" + c for c in CAT]).fillna(-1)
y = df[schema["target"]]
```

Expected: 66 columns after encoding.

`pollution_tolerance`, `urban_heat_tolerant`, `low_maintenance` and `native` have missing values for some plants. That is real "unknown" data. Fill it with `-1` and keep the rows.

The `site_` prefix is needed. Without it, `site_drainage`/`site_fertility` dummies clash with plant columns like `drainage_poor`.

Missing plant traits are filled with `-1`. Do not drop rows.

### 4.3 FORBIDDEN columns (never features)

- `suitable` is the target only.
- `top6` is for evaluation only (Section 7).
- `scenario_id`, `site_id` and `scientific_name` are IDs, used only for splitting, grouping and ranking.

Rule outputs (`score`, `removed`, `sub_*`) were already deleted from the clean file. Do not bring them back from older files.

**Done when:** you print `X.shape` and the list of columns, and assert that none of `suitable, top6, scenario_id, site_id, scientific_name` is in `X.columns`.

---

## 5. Train/test split (must be by site)

```python
from sklearn.model_selection import GroupShuffleSplit
tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42).split(X, y, groups=df["site_id"]))
assert set(df.iloc[tr].site_id).isdisjoint(set(df.iloc[te].site_id))
```

Expected: about 176,375 train rows, 44,625 test rows and 21 test sites.

**Do not use a random row split.** The same site would land in both train and test, and the score would be inflated.

If you tune hyperparameters, use `GroupKFold(n_splits=5)` on the **train part only**. Never tune on the test sites.

---

## 6. Models to train

1. **Random Forest (required baseline):** `RandomForestClassifier(n_estimators=200, min_samples_leaf=2, n_jobs=-1, random_state=42)`.
2. **At least one of:**
   - XGBoost `XGBClassifier(n_estimators=300, max_depth=6, learning_rate=0.1, random_state=42)`
   - LightGBM with similar settings
   - Logistic Regression with `StandardScaler`, `max_iter=2000`

Optional: if the user asks for TCRM, use the **same X, y and split**, so the results are comparable. Do not change the features for one model only.

---

## 7. Evaluation (on test sites only)

For each model, print:

- accuracy, precision, recall, F1 and ROC-AUC (use `predict_proba`)
- confusion matrix
- the 10 most important features (tree models)
- **top-6 overlap**, the metric that matters for the app:

```python
test = df.iloc[te].copy()
test["prob"] = model.predict_proba(X.iloc[te])[:, 1]
test["pred_rank"] = test.groupby("scenario_id")["prob"].rank(ascending=False, method="first")
overlap = (test[test.pred_rank <= 6].groupby("scenario_id")["top6"].sum() / 6).mean()
```

The `top6` column is used **only here**, for checking, never as a feature.

**Expected (from the baseline):**

- Random Forest accuracy about 0.9986 and F1 about 0.9986; XGBoost about 0.9998 (66 features). Top-6 overlap about 0.41 (RF) and 0.54 (XGBoost).
- The top features are `site_salinity`, `water_days`, `salt_tolerance` and `water_need`.

If your numbers differ a lot, report it. Do not adjust anything to force a match.

---

## 8. Save outputs

Create the folder `outputs/` with:

| File | Content |
|---|---|
| `plantify_model.joblib` | The best model, chosen by F1 on test sites, with top-6 overlap as the tie-break |
| `feature_columns.json` | The exact ordered list of `X.columns`. The backend must build features in this order. |
| `metrics.json` | All metrics for every model |
| `confusion_matrix_<model>.png` | One per model |
| `feature_importance_<model>.png` | One per tree model |
| `train.py` | One clean script that reproduces everything from the CSVs |

---

## 9. TRAINING_REPORT.md (write at the end)

Keep it short, with these headings:

1. **Data:** files used, row counts, the number of features.
2. **Split:** by site; train and test row counts and the number of test sites.
3. **Results:** a table with the models as rows and accuracy, precision, recall, F1, ROC-AUC and top-6 overlap as columns. Copy the numbers from the output.
4. **Top features.**
5. **Best model and why.**
6. **Limitations.** Include all of these:
   - The labels come from the guide's rule engine, so the high accuracy means the model reproduces the rules. It is not real-world accuracy, which needs field outcomes or expert review.
   - Salinity in the training data starts from the ISRIC Global Soil Salinity Map 2016 (250 m, validation accuracy 67-70%) for each site and is varied around that value to represent the user's answers about visible salt signs.
   - `lst_zone_celsius` is a proxy from hottest-month air temperature, not satellite LST.
   - 31 of the 85 plants have ESTIMATED traits (`trait_source` starts with "estimated", `trait_confidence` medium or low). They come from horticultural references, not measurements, and need expert verification.

---

## 10. Things you must NOT do

- Do not change, regenerate or "clean" the CSV files. Do not use the older files (`training_pairs_v2_1.csv`, `plants_master.csv`) for training.
- Do not add plants, sites or data from the internet.
- Do not use a forbidden column as a feature.
- Do not split rows randomly.
- Do not report results you did not compute, or describe ~99% accuracy as real-world performance.
- Do not change these goals. If something seems wrong, stop and ask the user.

---

## 11. Checklist to show the user at the end

- [ ] Shapes verified (Section 2)
- [ ] No forbidden columns in X (assert passed)
- [ ] Site-based split, no overlap (assert passed)
- [ ] At least 2 models trained
- [ ] Metrics + top-6 overlap reported for each
- [ ] Best model + `feature_columns.json` saved
- [ ] `TRAINING_REPORT.md` written with limitations
