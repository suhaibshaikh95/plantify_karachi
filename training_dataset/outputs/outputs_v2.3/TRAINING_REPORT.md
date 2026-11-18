# Plantify Karachi — Model Training Report (v2.3)

## 1. Data
- **Training dataset:** `dataset/plantify_dataset_clean/training_clean.csv`
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
| **Random Forest** | 0.99863 | 0.99759 | 0.99964 | 0.99861 | 0.99999 | 0.41111 |
| **XGBoost** | 0.99984 | 0.99973 | 0.99995 | 0.99984 | 1.00000 | 0.53619 |

## 4. Top Features (XGBoost feature importance)
The top driving factors identified by tree feature importance:
1. **do_not_plant** (0.1795)
2. **site_salinity** (0.1260)
3. **salt_tolerance** (0.1204)
4. **needs_large_space** (0.1053)
5. **water_need** (0.0958)
6. **site_space_large** (0.0612)
7. **ph_opt_max** (0.0525)
8. **water_days** (0.0416)
9. **guide_good** (0.0296)
10. **poisonous** (0.0254)

## 5. Best Model and Why
**XGBoost** is selected as the production model for the Plantify Karachi backend.
- It achieved an F1-Score of **0.99984** on 21 unseen test sites.
- Its top-6 overlap with the rule engine's ranking is 0.536, higher than Random Forest (0.411). The overlap is limited because many plants tie at the 100-point score cap, and the rule engine breaks these ties by list order; the model's choice among tied plants is not necessarily wrong.
- ROC-AUC (8 decimals): 0.99999979 (note: 1.00000 is due to standard 5-decimal rounding; the underlying computed value indicates near-perfect separability without claiming absolute perfection).

## 6. Limitations
1. **Rule Engine Labels:** The labels originate from the expert planting guide rule engine (not removed & score ≥ 70). Therefore, the near-perfect accuracy (~99.8–99.98%) demonstrates that the model faithfully learns to reproduce the guide's domain rules; it does not indicate field-tested biological survival.
2. **Score Cap Ties:** Top-6 overlap is reduced by score ties at the 100 cap; the rule engine breaks ties arbitrarily by list order, whereas the model ranks by learned probability.
3. **Salinity Ground Truth & User Form:** Salinity in the training data starts from the ISRIC Global Soil Salinity Map 2016 (250 m, validation accuracy 67-70%) for each site and is varied around that value to represent the user's answers about visible salt signs.
4. **LST Proxy:** `lst_zone_celsius` represents an urban heat proxy derived from hottest-month air temperatures rather than direct satellite thermal sensor data.
5. **Estimated Traits:** 31 of the 85 plants have estimated traits from general horticultural references (`trait_source` contains 'estimated'). These estimates require verification by botanical supervisors.
