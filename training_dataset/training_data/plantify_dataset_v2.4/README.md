# Plantify Karachi clean dataset (v2.4)

## v2.4 change: salinity projected to 2026
- `site_salinity_default` is now a 2026 projection: the damped trend (half the observed rate) of the ISRIC salinity maps for 2005, 2009 and 2016, applied to the share of saline land within ~2 km of each site.
- The 2026 value is never lower than the 2016 value (salinity in Karachi has been rising). 11 sites outside the 18 town boundaries keep their 2016 value.
- Result: saline sites (level 1) rose from 43 (2016) to 62 (2026); 19 sites moved from 0 to 1.
- Back-test caution: projecting 2016 from 2005-2009 matched only 51-61% of sites, versus 62.5% for simply carrying the last map forward. The projection is an estimate; `site_salinity_2016` is kept in reference/sites_karachi_v2.csv as a fallback.
- Baseline after v2.4: Random Forest accuracy 0.9985 (69 errors), XGBoost 0.9998 (7 errors), top-6 overlap 0.44 / 0.53; suitable share 47.2%.


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
