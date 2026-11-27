# Plantify Karachi chat assistant — evaluation run

- Date: 2026-11-27 16:20 UTC
- API: http://localhost:8000
- Retrieval: BAAI/bge-small-en-v1.5 embeddings + FAISS IndexFlatIP (top 6 passages), worker ready: true
- Generation: none (no GEMINI_API_KEY): best-passage fallback
- Scenario: Plot at 24.9203 N, 67.0912 E (Gulshan-e-Iqbal), salty borewell water (one salt sign), 3 watering days a week, small yard, low care, purpose shade, children or animals use the site.
- Matched site: Safari Park, Main University Rd, Gulshan-e-Iqbal (site 77, 2.2 km away); salinity used: class 1; ranked by: model
- Top 6: Date palm, Ber, Jamun, Tamarind, Babul / Kikar, Wild almond / Pilu / Bada Pilu
- Excluded: 44 plants
- Answer modes: fallback 18, declined 2
- Response time: median 17 ms, max 66 ms

## Summary

| # | Category | Question | Mode | Time (ms) | Sources |
|---|---|---|---|---|---|
| 1 | Plant care | How often should I water neem in summer? | fallback | 29 | Plant: Neem (Azadirachta indica) |
| 2 | Plant care | Which of my plants can handle salty borewell water? | fallback | 66 | Karachi Planting Guide: 8. Three worked examples (part 2) |
| 3 | Plant care | Is Jamun safe if children play in the garden? | fallback | 21 | Plant: Jamun (Syzygium cumini) |
| 4 | Plant care | Can I grow a date palm in a pot on my balcony? | fallback | 17 | Plant: Date palm (Phoenix dactylifera) |
| 5 | Plant care | What kind of soil does tamarind like? | fallback | 17 | Plant: Tamarind (Tamarindus indica) |
| 6 | Plant care | The leaves of my plants are turning yellow. What could be the reason in Karachi soil? | fallback | 17 | Karachi Planting Guide: 2. What Karachi is like for plants |
| 7 | Plant care | How should I take a soil sample before getting it tested? | fallback | 17 | Karachi Planting Guide: 9. Tests we should get done |
| 8 | Plant care | Which shade trees are good for a Karachi street? | fallback | 18 | Karachi Planting Guide: 6. What to plant |
| 9 | Plant care | Mera plot samandar ke qareeb hai, kaunse paude lagaun? | fallback | 22 | Site: Jumma Hamaiti Village Station Near Shah Latif Town sector 16-B, Bin Qasim town |
| 10 | Plant care | What is the soil pH and salinity of my site? | fallback | 16 | Plantify FAQ: How is the salinity of my plot decided? |
| 11 | Why / why not | Why not Conocarpus? | fallback | 16 | Your recommendation |
| 12 | Why / why not | Can I plant gulmohar in a small pavement pit? | fallback | 19 | Your recommendation |
| 13 | Why / why not | Why was mango excluded for my plot? | fallback | 20 | Your recommendation |
| 14 | Why / why not | Why is date palm recommended for me? | fallback | 16 | Plant: Date palm (Phoenix dactylifera) |
| 15 | Why / why not | Why can I not plant oleander here? | fallback | 17 | Your recommendation |
| 16 | How Plantify works | How does Plantify choose my plants? | fallback | 16 | Plantify FAQ: How does Plantify Karachi recommend plants? |
| 17 | How Plantify works | How accurate is the model, and how was it tested? | fallback | 19 | Plantify FAQ: How well does the model perform, and how does XGBoost compare with Random Forest? |
| 18 | How Plantify works | Where does the salinity data come from? | fallback | 17 | Plantify FAQ: Where does the site, salinity and climate data come from? |
| 19 | Off-topic | Who won the 2022 FIFA World Cup? | declined | 24 | — |
| 20 | Off-topic | Write a Python function that sorts a list. | declined | 17 | — |

## Answers

### 1. How often should I water neem in summer?

*Plant care · fallback · 29 ms*

> Neem (Azadirachta indica) is an evergreen tree on Plantify's Karachi plant list. Salt tolerance is moderate: it tolerates slightly saline sites (salinity class up to 1). Water need is low (about one watering day a week once established). Best soil pH is 5.5 to 7 and it survives pH 5 to 7.5. Best temperature is 26 °C to 40 °C and it survives 14 °C to 46 °C. Soil texture: suits sandy (light) soil, loam (medium) soil and clay (heavy) soil. Drainage: suits good drainage and very fast drainage; not poor drainage. Soil fertility: suits low fertility; not medium fertility and high fertility. It is native to the region. It is proven to grow in Karachi. It is not recorded …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Plant: Neem (Azadirachta indica)

### 2. Which of my plants can handle salty borewell water?

*Plant care · fallback · 66 ms*

> - C. Farm in Gadap. The soil is moderately salty and the borewell water has an RSC of 3.1, above the safe limit. Date palm, guava, sorghum, cowpea and beetroot all work well. Tomato will lose about a quarter of its yield. Onion, orange and beans are out. The real advice is to fix the water first with gypsum and add extra water for leaching; otherwise, within a few seasons, even the good crops will start failing.
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Karachi Planting Guide: 8. Three worked examples (part 2)

### 3. Is Jamun safe if children play in the garden?

*Plant care · fallback · 21 ms*

> Jamun (Syzygium cumini) is an evergreen tree on Plantify's Karachi plant list. Salt tolerance is moderate: it tolerates slightly saline sites (salinity class up to 1). Water need is low (about one watering day a week once established). Best soil pH is 5.5 to 7 and it survives pH 4.5 to 8. Best temperature is 20 °C to 32 °C and it survives 12 °C to 48 °C. Soil texture: suits sandy (light) soil, loam (medium) soil and clay (heavy) soil. Drainage: suits poor drainage, good drainage and very fast drainage. Soil fertility: suits low fertility, medium fertility and high fertility. It is native to the region. It is proven to grow in Karachi. It is not recorded as poisonous. …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Plant: Jamun (Syzygium cumini)

### 4. Can I grow a date palm in a pot on my balcony?

*Plant care · fallback · 17 ms*

> Date palm (Phoenix dactylifera) is an evergreen tree on Plantify's Karachi plant list. Salt tolerance is high: it tolerates highly saline sites (salinity class up to 2). Water need is low (about one watering day a week once established). Best soil pH is 6.5 to 8 and it survives pH 6 to 8.5. Best temperature is 26 °C to 45 °C and it survives 10 °C to 52 °C. Soil texture: suits sandy (light) soil, loam (medium) soil and clay (heavy) soil. Drainage: suits good drainage and very fast drainage; not poor drainage. Soil fertility: suits medium fertility and high fertility; not low fertility. It is native to the region. It is proven to grow in Karachi. It is not …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Plant: Date palm (Phoenix dactylifera)

### 5. What kind of soil does tamarind like?

*Plant care · fallback · 17 ms*

> Tamarind (Tamarindus indica) is an evergreen tree on Plantify's Karachi plant list. Salt tolerance is high: it tolerates highly saline sites (salinity class up to 2). Water need is low (about one watering day a week once established). Best soil pH is 5.5 to 6.5 and it survives pH 4.5 to 8.5. Best temperature is 20 °C to 35 °C and it survives 12 °C to 45 °C. Soil texture: suits sandy (light) soil, loam (medium) soil and clay (heavy) soil. Drainage: suits good drainage and very fast drainage; not poor drainage. Soil fertility: suits low fertility and medium fertility; not high fertility. It is not native. It is proven to grow in Karachi. It is not recorded as poisonous. …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Plant: Tamarind (Tamarindus indica)

### 6. The leaves of my plants are turning yellow. What could be the reason in Karachi soil?

*Plant care · fallback · 17 ms*

> - Rainfall: about 310 mm a year, and 77% of it falls in July–August. Every planting needs irrigation. - Temperature: normally 13 °C to 35 °C. It never freezes. There are two hot peaks, in May and in October. - Record heat: 47.8 °C. Heat waves happen; the 2015 heat wave killed over 1,200 people. - Humidity: 45% in winter and 70% in the monsoon. High humidity causes fungus and disease on vegetables. - Soil: sandy, pH 7.4–7.9, i.e. alkaline, not acidic. - Lime in soil: 13% to 31%. The soil is very chalky, which blocks iron and zinc, so leaves turn yellow. - Salt-affected land in Sindh: 2.6 million hectares; nearly half of the surveyed land in Sindh has …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Karachi Planting Guide: 2. What Karachi is like for plants

### 7. How should I take a soil sample before getting it tested?

*Plant care · fallback · 17 ms*

> Two cheap test panels turn a guess into a real answer. Minimum soil test: - ECe (salt level): the single most important number; nothing works without it. - pH: shows lime and sodic problems. - Texture (sand, silt or clay): affects drainage and watering. - SAR or sodium: shows whether washing the soil will work or make it worse. - Lime (CaCO3): explains yellow leaves and locked-up nutrients. - Organic matter: soil health and water holding. Minimum water test: - EC and pH: basic salt level of the water. - Sodium, calcium and magnesium: needed to calculate SAR. - Carbonate and bicarbonate: needed to calculate RSC, the number everyone forgets. - Chloride and boron: cause leaf burn and toxicity. - …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Karachi Planting Guide: 9. Tests we should get done

### 8. Which shade trees are good for a Karachi street?

*Plant care · fallback · 18 ms*

> The full report covers about 65 plants. Short version by group: - Vegetables and field crops. Good choices: barley, cotton, sorghum, guar, wheat, cowpea, beetroot, zucchini, bermuda grass. Risky: tomato, cucumber, spinach, cabbage, okra, chilli, brinjal. Avoid on salty soil: lettuce, onion, beans. - Fruit trees. Good choices: date palm, guava, chikoo, ber, pomegranate, jamun. Need good soil and water: banana, mango, coconut, papaya. Poor in Karachi: orange, grape. - Shade and street trees. Good choices: neem, Pongamia (sukhchain), babul, kandi, siris, arjun, jangli badam, amaltas, Casuarina. Only with big root space: peepal, banyan. Do not plant: Conocarpus, gulmohar. - Coastal and salty sites. Good choices: mangrove (tidal areas only), peelu, farash, Cordia, kirir, saltbush, moringa. Prosopis juliflora works but …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Karachi Planting Guide: 6. What to plant

### 9. Mera plot samandar ke qareeb hai, kaunse paude lagaun?

*Plant care · fallback · 22 ms*

> Reference site 63: Jumma Hamaiti Village Station Near Shah Latif Town sector 16-B, Bin Qasim town, Karachi, at latitude 24.8478 and longitude 67.2781. Plantify uses this site's data for any plot whose nearest reference site it is. Site type: dense urban (main problem: little root space, heat and pollution). Soil pH is 8.1, texture heavy (clay), drainage well and fertility medium. Default salinity is class 1 (saline) from the 2026 projection; the ISRIC 2016 map gives class 1 (slightly saline). Reported salt signs can raise salinity for a plot, never lower it. Mean temperature is 26.3 °C, the hottest month averages 30.9 °C and the coldest month 18.8 °C. It is in an industrial area. It is in a high …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Site: Jumma Hamaiti Village Station Near Shah Latif Town sector 16-B, Bin Qasim town

### 10. What is the soil pH and salinity of my site?

*Plant care · fallback · 16 ms*

> Q: How is the salinity of my plot decided? A: Salinity is a class from 0 to 2: low, medium or high. Every reference site has a default class from the 2026 salinity projection. In the 2026 projection, 62 of the 104 sites are saline (class 1), up from 43 in 2016, because salinity in Karachi has been rising. Your answers can raise your plot's class but never lower it. The four signs are a white crust on the soil, salty borewell water, burnt leaf edges on nearby plants, and being within 2 km of the sea. One "yes" raises salinity to at least medium. Three "yes" answers, or two on a site that is already saline on the map, …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Plantify FAQ: How is the salinity of my plot decided?

### 11. Why not Conocarpus?

*Why / why not · fallback · 16 ms*

> Buttonwood (Conocarpus erectus) was not recommended for your plot because it is on the do-not-plant list (banned or invasive, damages pipes and drains, uses a lot of water, causes pollen allergy). (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Your recommendation

### 12. Can I plant gulmohar in a small pavement pit?

*Why / why not · fallback · 19 ms*

> Gulmohar (Flame tree) (Delonix regia) was not recommended for your plot because it is on the do-not-plant list in the Karachi planting guide. (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Your recommendation

### 13. Why was mango excluded for my plot?

*Why / why not · fallback · 20 ms*

> Mango (Mangifera indica) was not recommended for your plot because the site is saltier than it can tolerate (site class 1 > plant tolerance 0). (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Your recommendation

### 14. Why is date palm recommended for me?

*Why / why not · fallback · 16 ms*

> Date palm (Phoenix dactylifera) is an evergreen tree on Plantify's Karachi plant list. Salt tolerance is high: it tolerates highly saline sites (salinity class up to 2). Water need is low (about one watering day a week once established). Best soil pH is 6.5 to 8 and it survives pH 6 to 8.5. Best temperature is 26 °C to 45 °C and it survives 10 °C to 52 °C. Soil texture: suits sandy (light) soil, loam (medium) soil and clay (heavy) soil. Drainage: suits good drainage and very fast drainage; not poor drainage. Soil fertility: suits medium fertility and high fertility; not low fertility. It is native to the region. It is proven to grow in Karachi. It is not …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Plant: Date palm (Phoenix dactylifera)

### 15. Why can I not plant oleander here?

*Why / why not · fallback · 17 ms*

> Common oleander (Nerium oleander) was not recommended for your plot because it is poisonous and children or animals use the site (children or animals at the site). (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Your recommendation

### 16. How does Plantify choose my plants?

*How Plantify works · fallback · 16 ms*

> Q: How does Plantify Karachi recommend plants? A: Plantify works in five steps. First, you give the location of your plot: GPS read from a photo, your current location, a pin on the map, or an area from the list. Second, the system finds the nearest of its 104 Karachi reference sites and uses that site's soil pH, texture, drainage, fertility, salinity and temperatures. Third, your answers to the site questions (signs of salt, watering days, space, care, purpose, and whether children or animals use the site) are combined with the site data. Fourth, a rule filter removes every one of the 85 candidate plants that cannot survive or is unsafe there, and each removed plant gets a reason. Fifth, …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Plantify FAQ: How does Plantify Karachi recommend plants?

### 17. How accurate is the model, and how was it tested?

*How Plantify works · fallback · 19 ms*

> Q: How well does the model perform, and how does XGBoost compare with Random Forest? A: On the 21 unseen test sites, XGBoost scored accuracy 0.99987, precision 0.99975, recall 0.99995, F1 0.99985 and ROC-AUC 0.99999993. Its confusion matrix has 24,299 true negatives, 5 false positives, 1 false negative and 20,320 true positives. The Random Forest baseline had accuracy 0.9985 with 69 errors, against 7 errors for XGBoost. Top-6 overlap with the rule engine's ranking was 0.506 for XGBoost and 0.44 for Random Forest; the overlap is limited because many plants tie at the 100-point cap and the rule engine breaks those ties by list order. XGBoost was chosen for the backend. These numbers show the model reproduces the rules, not …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Plantify FAQ: How well does the model perform, and how does XGBoost compare with Random Forest?

### 18. Where does the salinity data come from?

*How Plantify works · fallback · 17 ms*

> Q: Where does the site, salinity and climate data come from? A: Each of the 104 reference sites has soil data from SoilGrids 2.0 (pH, clay, sand, organic carbon and bulk density), plus texture, drainage and fertility classes. Salinity starts from the ISRIC Global Soil Salinity Map 2016 (Ivushkin et al. 2019, 250 m resolution, validation accuracy 67–70%). Version 2.4 projects salinity to 2026 using the damped trend of the ISRIC maps for 2005, 2009 and 2016, and never sets it below the 2016 value. Climate uses 10-year averages; the urban heat measure uses the hottest-month mean air temperature for 2015–2024 as a proxy, not satellite land-surface temperature. The 85 plants come from the team's species file, Karachi research papers …
> 
> (The AI assistant is unavailable right now, so this is the closest passage from Plantify's data.)

**Sources:** Plantify FAQ: Where does the site, salinity and climate data come from?

### 19. Who won the 2022 FIFA World Cup?

*Off-topic · declined · 24 ms*

> Sorry, I can only help with plants and gardening in Karachi, your site's data, and how Plantify works.

**Sources:** —

### 20. Write a Python function that sorts a list.

*Off-topic · declined · 17 ms*

> Sorry, I can only help with plants and gardening in Karachi, your site's data, and how Plantify works.

**Sources:** —
