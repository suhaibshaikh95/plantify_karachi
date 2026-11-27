# How Plantify Karachi works (project FAQ)

Short question-and-answer passages for the chatbot, written from the project's own files:
README.md, core_info/ACADEMIC_DEFENSE_AND_ML_JUSTIFICATION.md,
training_dataset/outputs/outputs_v2.4/TRAINING_REPORT.md, backend/assets/model/metrics.json,
training_dataset/training_data/plantify_dataset_v2.4/README.md and
training_dataset/training_data/plantify_dataset_v2.4/reference/sites_karachi_v2.csv,
and the backend's recommendation engine (backend/src/services/hybridEngine.js).
Each "## " heading is one passage. Every number here is taken from those files.

## How does Plantify Karachi recommend plants?
Plantify works in five steps. First, you give the location of your plot: GPS read from a photo, your current location, a pin on the map, or an area from the list. Second, the system finds the nearest of its 104 Karachi reference sites and uses that site's soil pH, texture, drainage, fertility, salinity and temperatures. Third, your answers to the site questions (signs of salt, watering days, space, care, purpose, and whether children or animals use the site) are combined with the site data. Fourth, a rule filter removes every one of the 85 candidate plants that cannot survive or is unsafe there, and each removed plant gets a reason. Fifth, the remaining plants are ranked by an XGBoost model, and the top 6 are shown with their scores, while the removed plants are listed with the reason each one was excluded.
Source: backend/src/services/hybridEngine.js; README.md.

## Which plants does the rule filter remove, and why?
Before any scoring, a plant is removed completely if any one of these is true: it is on the do-not-plant list (for example Conocarpus, which is banned); it is poisonous and children or animals use the site; the site's salinity class is higher than the plant's salt tolerance; the soil pH is more than 1 unit outside the plant's absolute pH range; the coldest month is more than 3 °C below, or the hottest month more than 3 °C above, the plant's absolute temperature range; you can water fewer days than the plant needs (about 1, 3 or 7 days a week for low, medium or high water need, with one day of slack), or not at all when the plant needs more than low water; or the plant needs large root space and your space is not large. A good score elsewhere cannot bring a removed plant back.
Source: backend/src/services/hybridEngine.js; training_dataset/training_data/plantify_dataset_v2.4/scripts/generate_training_data_v23.py.

## How is a plant's score out of 100 calculated?
Plants that pass the filter get a rule score out of 100 built from eleven parts. The weights are: salt 22, water 18, temperature 14, soil pH 8, space 8, purpose 8, care 6, soil texture 4, drainage 4, fertility 4, and pollution and urban heat 4. Each part is a fraction between 0 and 1 of its weight; for example, a plant whose salt tolerance is at least one class above the site's salinity gets the full salt weight, and one that only just tolerates it gets 70% of it. Bonuses are then added: +5 if the plant is native, +5 if the Karachi planting guide rates it good, and +3 if it is proven in Karachi. The score is capped at 100. A plant counts as suitable when it passes the filter and scores 70 or more; these labels are what the model was trained on.
Source: training_dataset/training_data/plantify_dataset_v2.4/scripts/generate_training_data_v23.py; backend/src/services/hybridEngine.js.

## What does the XGBoost model do, and why use it if the labels come from rules?
The XGBoost model takes 66 features for each site, user answers and plant, and predicts the probability that the plant is suitable. Plantify ranks plants by this probability. The training labels came from the planting guide's rule engine, so the model learns to reproduce those rules; its very high accuracy shows fidelity to the rules, not proof that plants survive in the field. The project gives four reasons for using it anyway: many plants tie at the 100-point cap and the rule engine can only break ties by list order, while the model gives a continuous probability; the model has smooth boundaries instead of hard cutoffs such as pH 6.49 versus 6.50; it predicts in milliseconds; and it can later be retrained on real survival data collected in FYP-2.
Source: core_info/ACADEMIC_DEFENSE_AND_ML_JUSTIFICATION.md; training_dataset/outputs/outputs_v2.4/TRAINING_REPORT.md.

## What data was the model trained on?
There is no database of planting outcomes for Karachi, so the project built 221,000 training scenarios: 104 Karachi reference sites × 25 user answer profiles × 85 candidate plants. Each row combines 10 site features, 6 user answers and 33 plant traits; 7 categorical features are one-hot encoded, giving 66 columns, and missing traits are filled with -1. The target is "suitable" (1) or "unsuitable" (0), labelled by the planting guide's rule engine. The data was split by site, not by random rows, so the test sites were never seen in training: 176,375 rows from 83 sites for training and 44,625 rows from 21 unseen sites for testing.
Source: training_dataset/outputs/outputs_v2.4/TRAINING_REPORT.md; core_info/ACADEMIC_DEFENSE_AND_ML_JUSTIFICATION.md.

## How well does the model perform, and how does XGBoost compare with Random Forest?
On the 21 unseen test sites, XGBoost scored accuracy 0.99987, precision 0.99975, recall 0.99995, F1 0.99985 and ROC-AUC 0.99999993. Its confusion matrix has 24,299 true negatives, 5 false positives, 1 false negative and 20,320 true positives. The Random Forest baseline had accuracy 0.9985 with 69 errors, against 7 errors for XGBoost. Top-6 overlap with the rule engine's ranking was 0.506 for XGBoost and 0.44 for Random Forest; the overlap is limited because many plants tie at the 100-point cap and the rule engine breaks those ties by list order. XGBoost was chosen for the backend. These numbers show the model reproduces the rules, not real-world survival.
Source: backend/assets/model/metrics.json; training_dataset/outputs/outputs_v2.4/TRAINING_REPORT.md; training_dataset/training_data/plantify_dataset_v2.4/README.md.

## Which factors matter most to the model?
By XGBoost feature importance, the ten most important features are: the plant's maximum optimal pH (0.1505), whether the plant is on the do-not-plant list (0.1452), the site's salinity (0.1114), the plant's salt tolerance (0.1068), whether the plant needs large space (0.0898), the plant's water need (0.0753), whether the user's space is large (0.0567), whether the planting guide rates the plant good (0.0386), the number of days the user can water (0.0365), and whether the plant is low maintenance (0.0319). Salinity and salt tolerance together are among the strongest drivers, which matches the planting guide's message that salt decides what grows in Karachi.
Source: backend/assets/model/metrics.json; training_dataset/outputs/outputs_v2.4/TRAINING_REPORT.md.

## Where does the site, salinity and climate data come from?
Each of the 104 reference sites has soil data from SoilGrids 2.0 (pH, clay, sand, organic carbon and bulk density), plus texture, drainage and fertility classes. Salinity starts from the ISRIC Global Soil Salinity Map 2016 (Ivushkin et al. 2019, 250 m resolution, validation accuracy 67–70%). Version 2.4 projects salinity to 2026 using the damped trend of the ISRIC maps for 2005, 2009 and 2016, and never sets it below the 2016 value. Climate uses 10-year averages; the urban heat measure uses the hottest-month mean air temperature for 2015–2024 as a proxy, not satellite land-surface temperature. The 85 plants come from the team's species file, Karachi research papers and the EcoCrop database.
Source: training_dataset/training_data/plantify_dataset_v2.4/README.md; core_info/ACADEMIC_DEFENSE_AND_ML_JUSTIFICATION.md; training_dataset/training_data/plantify_dataset_v2.4/reference/sites_karachi_v2.csv; generate_training_data_v23.py.

## How is the salinity of my plot decided?
Salinity is a class from 0 to 2: low, medium or high. Every reference site has a default class from the 2026 salinity projection. In the 2026 projection, 62 of the 104 sites are saline (class 1), up from 43 in 2016, because salinity in Karachi has been rising. Your answers can raise your plot's class but never lower it. The four signs are a white crust on the soil, salty borewell water, burnt leaf edges on nearby plants, and being within 2 km of the sea. One "yes" raises salinity to at least medium. Three "yes" answers, or two on a site that is already saline on the map, raise it to high. Salinity matters because a plant whose salt tolerance is below your plot's class is removed outright.
Source: backend/src/services/hybridEngine.js; training_dataset/training_data/plantify_dataset_v2.4/README.md.

## Why does salinity matter so much in Karachi?
The project's planting guide says that in Karachi salt decides what grows, not heat: the city never freezes, so almost every plant can handle the temperature, but salt in the soil and water, poor drainage and bad irrigation water kill plants. Plantify therefore checks salt first. Salt has the largest weight in the score (22 of 100), a plant less salt tolerant than the site is removed before scoring, and site salinity and plant salt tolerance are among the model's four most important features. Salinity is also rising: in the 2026 projection 62 of the 104 reference sites are saline, compared with 43 in 2016.
Source: backend/assets/knowledge/karachi_planting_guide.md; training_dataset/training_data/plantify_dataset_v2.4/README.md; backend/assets/model/metrics.json.

## What are the limitations of Plantify's recommendations?
First, the training labels come from the planting guide's rules, not from records of which plants actually survived, so the model's accuracy shows that it follows the rules, not that plants will live. Second, 31 of the 85 plants have estimated traits taken from general horticultural references rather than measurements (23 with medium and 8 with low confidence), and they need expert checking. Third, your plot is matched to the nearest of 104 reference sites, which can be several kilometres away, so local soil may differ. Fourth, the salinity map has 250 m resolution and 67–70% validation accuracy, and the 2026 projection is an estimate. Fifth, the heat measure is a proxy from air temperature. A soil test gives a more reliable answer than any of these estimates.
Source: training_dataset/outputs/outputs_v2.4/TRAINING_REPORT.md; training_dataset/training_data/plantify_dataset_v2.4/README.md.

## How does the Plantify chat assistant answer questions?
The assistant uses retrieval-augmented generation. Plantify's species data, site data, the Karachi planting guide and this FAQ are split into short passages. Each passage is turned into a vector with the BGE-small embedding model and stored in a FAISS index. When you ask a question, it is embedded the same way, the most similar passages are retrieved (with extra weight for your own recommended plants and your own site), and the Gemini model writes an answer using only those passages and your current recommendation. It names the sources it used. If the information is not in Plantify's data, it says so instead of guessing. No model was fine-tuned.
Source: backend/src/services/chatService.js; backend/src/ml/rag_worker.py.
