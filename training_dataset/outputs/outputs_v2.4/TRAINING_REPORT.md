# Plantify Karachi — Model Training Report (v2.4)

## 1. Data
- **Training dataset:** `dataset/plantify_dataset_v2.4/training_clean.csv`
- **Total rows:** 221,000 (104 sites × 25 user scenarios × 85 candidate plants)
- **Base features:** 49 (10 site, 6 user answers, 33 plant traits)
- **Categorical features:** 7 (one-hot encoded with `site_` prefix)
- **Final feature matrix columns:** 66 (missing traits imputed with `-1`)
- **Target variable:** `suitable` (Binary: 0 = Unsuitable, 1 = Suitable)

## 2. Split
- **Split method:** Site-based `GroupShuffleSplit` (`n_splits=1, test_size=0.2, random_state=42`)
- **Train rows:** 176,375 across 83 Karachi sites
- **Test rows:** 44,625 across 21 unseen Karachi sites
- **Zero Leakage:** Train and test site IDs are completely disjoint (`assert disjoint == True`).

## 3. Results (Evaluated on Unseen Test Sites)

| Model | Accuracy | Precision | Recall | F1-Score | ROC-AUC | Top-6 Overlap |
|---|---|---|---|---|---|---|
| **XGBoost** | 0.99987 | 0.99975 | 0.99995 | 0.99985 | 1.00000 | 0.50635 |


## 4. Top Features (XGBoost feature importance)
The top driving factors identified by tree feature importance:
1. **ph_opt_max** (0.1505)
2. **do_not_plant** (0.1452)
3. **site_salinity** (0.1114)
4. **salt_tolerance** (0.1068)
5. **needs_large_space** (0.0898)
6. **water_need** (0.0753)
7. **site_space_large** (0.0567)
8. **guide_good** (0.0386)
9. **water_days** (0.0365)
10. **low_maintenance** (0.0319)

## 5. Best Model and Why
**XGBoost** is selected as the production model for the Plantify Karachi backend.
- It achieved an F1-Score of **0.99985** on 21 unseen test sites.
- Its top-6 overlap with the rule engine's ranking is 0.506, higher than Random Forest baseline (0.44). The overlap is limited because many plants tie at the 100-point score cap, and the rule engine breaks these ties by list order; the model's choice among tied plants is not necessarily wrong.
- ROC-AUC (8 decimals): 0.99999993 (note: 1.00000 is due to standard 5-decimal rounding; the underlying computed value indicates near-perfect separability without claiming absolute perfection).

## 6. Limitations
1. **Rule Engine Labels:** The labels originate from the expert planting guide rule engine (not removed & score ≥ 70). Therefore, the near-perfect accuracy (~99.8–99.98%) demonstrates that the model faithfully learns to reproduce the guide's domain rules; it does not indicate field-tested biological survival.
2. **Score Cap Ties:** Top-6 overlap is reduced by score ties at the 100 cap; the rule engine breaks ties arbitrarily by list order, whereas the model ranks by learned probability.
3. **Salinity Ground Truth & User Form:** Salinity in the training data starts from the ISRIC Global Soil Salinity Map 2016 (250 m, validation accuracy 67-70%) with 2026 trend projections for each site and is varied around that value to represent the user's answers about visible salt signs.
4. **LST Proxy:** `lst_zone_celsius` represents an urban heat proxy derived from hottest-month air temperatures rather than direct satellite thermal sensor data.
5. **Estimated Traits:** 31 of the 85 plants have estimated traits from general horticultural references (`trait_source` contains 'estimated'). These estimates require verification by botanical supervisors.
