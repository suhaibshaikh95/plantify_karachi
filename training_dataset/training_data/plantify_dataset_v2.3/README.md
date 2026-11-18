# Plantify Karachi clean dataset (v2.3)

## v2.3 change: salinity from a real map
Each of the 104 sites now has a salinity value from the ISRIC Global Soil Salinity Map 2016 (Ivushkin et al. 2019, Remote Sensing of Environment 231, 111260; 250 m; validation accuracy 67-70%; CC BY 4.0).
- `sal_class_2016`: map class at the site (0 = non-saline, 1 = slightly saline; classes 2-4 = moderately to extremely saline). Karachi sites: 61 class 0, 43 class 1.
- `site_salinity_default`: our 0/1/2 scale (class 0 -> 0, classes 1-2 -> 1, classes 3-4 -> 2).
- Training scenarios now draw salinity around the map value (map 0: 60% 0 / 30% 1 / 10% 2; map 1: 10% / 60% / 30%) to represent the user raising it after seeing salt signs.
- Note: sea pixels are also 0 in the map, and the map is coarse for a city, so the app still asks the user about salt signs.

Baseline after v2.3: Random Forest accuracy 0.9986 (61 errors), XGBoost 0.9998 (7 errors), top-6 overlap 0.41 / 0.54.


Model-ready files. Give `PLANTIFY_TRAINING_PLAN.md` to the training agent.

| File | Rows | Use |
|---|---|---|
| training_clean.csv | 221,000 (104 sites x 25 users x 85 plants) | Training (only file needed) |
| schema.json | - | Feature, target, ID column lists |
| plants_clean.csv | 85 | App + chatbot plant info |
| sites_clean.csv | 104 | GPS lookup |
| estimated_plants_to_verify.csv | 31 | Plants whose traits are estimates - verify with supervisor |
| reference/plants_master.csv | 85 | Full plant table incl. paper data, trait_source, trait_confidence |

## v2.2 change: 31 plants filled
30 plants observed in Karachi papers had no trait data, and Nerium oleander had incomplete EcoCrop values.
Their traits were filled with ESTIMATES from general horticultural references (not measurements):
trait_source = "estimated (horticultural references) - verify", trait_confidence = medium (23) or low (8).
Also: large Ficus species marked needs_large_space = 1 (aggressive roots, like peepal/banyan in the guide);
Euphorbia caducifolia marked poisonous (irritant latex); oleander's EcoCrop salt/water values replaced
(it is salt and drought tolerant).

Baseline Random Forest: accuracy 0.998, F1 0.998 on 21 unseen sites (reproduces the rules; not real-world accuracy).
