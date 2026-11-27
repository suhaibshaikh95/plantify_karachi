# Plantify Karachi chat assistant — evaluation run

- Date: 2026-11-27 17:16 UTC
- API: http://localhost:8000
- Retrieval: BAAI/bge-small-en-v1.5 embeddings + FAISS IndexFlatIP (top 6 passages), worker ready: true
- Generation: Gemini `gemini-3.5-flash-lite`, temperature 0.2
- Scenario: Plot at 24.9203 N, 67.0912 E (Gulshan-e-Iqbal), salty borewell water (one salt sign), 3 watering days a week, small yard, low care, purpose shade, children or animals use the site.
- Matched site: Safari Park, Main University Rd, Gulshan-e-Iqbal (site 77, 2.2 km away); salinity used: class 1; ranked by: model
- Top 6: Date palm, Ber, Jamun, Tamarind, Babul / Kikar, Wild almond / Pilu / Bada Pilu
- Excluded: 44 plants
- Answer modes: gemini 18, declined 2
- Response time: median 716 ms, max 1312 ms

## Summary

| # | Category | Question | Mode | Time (ms) | Sources |
|---|---|---|---|---|---|
| 1 | Plant care | How often should I water neem in summer? | gemini | 780 | Plant: Neem (Azadirachta indica) |
| 2 | Plant care | Which of my plants can handle salty borewell water? | gemini | 846 | Karachi Planting Guide: 8. Three worked examples (part 2); Plantify FAQ: Why does salinity matter so much in Karachi? |
| 3 | Plant care | Is Jamun safe if children play in the garden? | gemini | 766 | Plant: Jamun (Syzygium cumini); Your recommendation |
| 4 | Plant care | Can I grow a date palm in a pot on my balcony? | gemini | 691 | Plant: Date palm (Phoenix dactylifera); Karachi Planting Guide: 6. What to plant |
| 5 | Plant care | What kind of soil does tamarind like? | gemini | 771 | Plant: Tamarind (Tamarindus indica); Your recommendation |
| 6 | Plant care | The leaves of my plants are turning yellow. What could be the reason in Karachi soil? | gemini | 711 | Karachi Planting Guide: 2. What Karachi is like for plants; Karachi Planting Guide: 1. The one thing to understand: salt decides what grows |
| 7 | Plant care | How should I take a soil sample before getting it tested? | gemini | 685 | Karachi Planting Guide: 9. Tests we should get done |
| 8 | Plant care | Which shade trees are good for a Karachi street? | gemini | 670 | Karachi Planting Guide: 6. What to plant |
| 9 | Plant care | Mera plot samandar ke qareeb hai, kaunse paude lagaun? | gemini | 1312 | Karachi Planting Guide: 3. Four kinds of sites; Karachi Planting Guide: 6. What to plant; Your recommendation |
| 10 | Plant care | What is the soil pH and salinity of my site? | gemini | 716 | Site: Safari Park, Main University Rd, Gulshan-e-Iqbal, Gulshan Iqbal town; Plantify FAQ: How is the salinity of my plot decided?; Your recommendation |
| 11 | Why / why not | Why not Conocarpus? | gemini | 558 | Plant: Conocarpus (Conocarpus lancifolius); Plant: Buttonwood (Conocarpus erectus); Your recommendation |
| 12 | Why / why not | Can I plant gulmohar in a small pavement pit? | gemini | 708 | Karachi Planting Guide: 6. What to plant; Your recommendation |
| 13 | Why / why not | Why was mango excluded for my plot? | gemini | 948 | Plant: Mango (Mangifera indica); Your recommendation |
| 14 | Why / why not | Why is date palm recommended for me? | gemini | 704 | Plant: Date palm (Phoenix dactylifera); Your recommendation |
| 15 | Why / why not | Why can I not plant oleander here? | gemini | 816 | Your recommendation |
| 16 | How Plantify works | How does Plantify choose my plants? | gemini | 917 | Plantify FAQ: How does Plantify Karachi recommend plants?; Your recommendation |
| 17 | How Plantify works | How accurate is the model, and how was it tested? | gemini | 734 | Plantify FAQ: How well does the model perform, and how does XGBoost compare with Random Forest?; Plantify FAQ: What data was the model trained on? |
| 18 | How Plantify works | Where does the salinity data come from? | gemini | 636 | Plantify FAQ: Where does the site, salinity and climate data come from? |
| 19 | Off-topic | Who won the 2022 FIFA World Cup? | declined | 26 | — |
| 20 | Off-topic | Write a Python function that sorts a list. | declined | 25 | — |

## Answers

### 1. How often should I water neem in summer?

*Plant care · gemini · 780 ms*

> In Karachi, salt determines what grows, and neem tolerates slightly saline sites. Once established, neem has a low water need and should be watered about once a week.

**Sources:** Plant: Neem (Azadirachta indica)

### 2. Which of my plants can handle salty borewell water?

*Plant care · gemini · 846 ms*

> In Karachi, salt decides what grows. For handling moderately salty borewell water specifically, the Karachi Planting Guide notes that date palm, guava, sorghum, cowpea, and beetroot all work well. However, the real advice is to fix the water first with gypsum and add extra water for leaching; otherwise, even good crops will start failing within a few seasons.

**Sources:** Karachi Planting Guide: 8. Three worked examples (part 2); Plantify FAQ: Why does salinity matter so much in Karachi?

### 3. Is Jamun safe if children play in the garden?

*Plant care · gemini · 766 ms*

> Yes, Jamun is safe because it is not recorded as poisonous, unlike plants such as Oleander. In Karachi, salt decides what grows, and Jamun tolerates slightly saline sites (salinity class up to 1).

**Sources:** Plant: Jamun (Syzygium cumini); Your recommendation

### 4. Can I grow a date palm in a pot on my balcony?

*Plant care · gemini · 691 ms*

> Yes, you can grow a date palm in Karachi, as it is a good choice and tolerates salt. However, we do not have specific information in Plantify's data about growing it in a pot on a balcony.

**Sources:** Plant: Date palm (Phoenix dactylifera); Karachi Planting Guide: 6. What to plant

### 5. What kind of soil does tamarind like?

*Plant care · gemini · 771 ms*

> Tamarind (Tamarindus indica) suits sandy (light) soil, loam (medium) soil, and clay (heavy) soil. Since salt decides what grows in Karachi, it is worth noting that it tolerates highly saline sites (salinity class up to 2). Its best soil pH is 5.5 to 6.5, and it survives pH 4.5 to 8.5. It also suits low fertility and medium fertility, but not high fertility.

**Sources:** Plant: Tamarind (Tamarindus indica); Your recommendation

### 6. The leaves of my plants are turning yellow. What could be the reason in Karachi soil?

*Plant care · gemini · 711 ms*

> In Karachi, the soil is very chalky, containing 13% to 31% lime. This high lime content blocks iron and zinc, which causes plant leaves to turn yellow. Additionally, salt decides what grows in Karachi, so salt and soil conditions are critical factors to consider.

**Sources:** Karachi Planting Guide: 2. What Karachi is like for plants; Karachi Planting Guide: 1. The one thing to understand: salt decides what grows

### 7. How should I take a soil sample before getting it tested?

*Plant care · gemini · 685 ms*

> Take 8 to 12 small scoops across your plot and mix them together. Take samples at two separate depths: 0 to 30 cm and 30 to 60 cm. Sample at the end of the dry season before the monsoon, when salt levels are highest. Do not mix salty patches with clean soil; always test them separately.

**Sources:** Karachi Planting Guide: 9. Tests we should get done

### 8. Which shade trees are good for a Karachi street?

*Plant care · gemini · 670 ms*

> For Karachi street trees, good choices include neem, Pongamia (sukhchain), babul, kandi, siris, arjun, jangli badam, amaltas, and Casuarina. Peepal and banyan also work if they have big root space. Salt decides what grows in Karachi because salinity levels affect which plants can survive, as many plants cannot tolerate salty soil. Conocarpus and gulmohar must not be planted; Conocarpus is banned because it damages pipes and drains, uses a lot of water, and causes pollen allergies.

**Sources:** Karachi Planting Guide: 6. What to plant

### 9. Mera plot samandar ke qareeb hai, kaunse paude lagaun?

*Plant care · gemini · 1312 ms*

> Aap ka plot samandar ke qareeb hai, is liye wahan ki mitti aur hawa mein namak (salt) ek bara masla hai. Aise coastal maqamat ke liye behtareen paude hain: mangrove (tidal areas only), peelu, farash, Cordia, kirir, saltbush aur moringa. Salt decides what grows in Karachi, is liye namak ka khayal rakhna zaroori hai. Conocarpus ko mat lagayen kyunke yeh banned hai aur pipe kharab karta hai.

**Sources:** Karachi Planting Guide: 3. Four kinds of sites; Karachi Planting Guide: 6. What to plant; Your recommendation

### 10. What is the soil pH and salinity of my site?

*Plant care · gemini · 716 ms*

> Your site's soil pH is 8.2. Salinity matters because a plant whose salt tolerance is below your plot's class is removed outright; your plot's default map salinity is low (class 0), but your salt answers raised it to medium (class 1).

**Sources:** Site: Safari Park, Main University Rd, Gulshan-e-Iqbal, Gulshan Iqbal town; Plantify FAQ: How is the salinity of my plot decided?; Your recommendation

### 11. Why not Conocarpus?

*Why / why not · gemini · 558 ms*

> Salt decides what grows in Karachi. Conocarpus is excluded because it is on the do-not-plant list: it is banned or invasive, its roots damage pipes and drains, it uses a lot of water, and its pollen causes allergies.

**Sources:** Plant: Conocarpus (Conocarpus lancifolius); Plant: Buttonwood (Conocarpus erectus); Your recommendation

### 12. Can I plant gulmohar in a small pavement pit?

*Why / why not · gemini · 708 ms*

> No, you cannot plant Gulmohar. Salt decides what grows in Karachi, and Gulmohar is on the do-not-plant list in the Karachi planting guide and was excluded for your site because it is banned or invasive.

**Sources:** Karachi Planting Guide: 6. What to plant; Your recommendation

### 13. Why was mango excluded for my plot?

*Why / why not · gemini · 948 ms*

> Mango was excluded because the site is saltier than it can tolerate (the site has medium salinity of class 1, while mango only tolerates non-saline sites of salinity class 0). Salt decides what grows in Karachi!

**Sources:** Plant: Mango (Mangifera indica); Your recommendation

### 14. Why is date palm recommended for me?

*Why / why not · gemini · 704 ms*

> Date palm is recommended for you because it is well-suited to Karachi's conditions and your site. Salt decides what grows in Karachi, and the date palm has high salt tolerance, handling saline sites well. It also has a low water need, survives the local temperatures, and fits your soil and urban environment.

**Sources:** Plant: Date palm (Phoenix dactylifera); Your recommendation

### 15. Why can I not plant oleander here?

*Why / why not · gemini · 816 ms*

> You cannot plant Common oleander here because it is excluded due to being poisonous in a site where children or animals use it. Salt is also relevant because it decides what grows in Karachi, but for this plant, toxicity is the reason it was excluded.

**Sources:** Your recommendation

### 16. How does Plantify choose my plants?

*How Plantify works · gemini · 917 ms*

> Plantify chooses your plants using a five-step process combining your location, reference site data (including soil and temperature), and your answers about space, care, and purpose. Salt decides what grows in Karachi, so site salinity and plant salt tolerance are key factors. A rule filter removes any plants that cannot survive, are unsafe, or do not match your site conditions. Finally, an XGBoost model ranks the remaining suitable plants by predicting their suitability probability.

**Sources:** Plantify FAQ: How does Plantify Karachi recommend plants?; Your recommendation

### 17. How accurate is the model, and how was it tested?

*How Plantify works · gemini · 734 ms*

> The XGBoost model achieved high test scores on 21 unseen test sites: accuracy 0.99987, precision 0.99975, recall 0.99995, F1 0.99985, and ROC-AUC 0.99999993. It was tested on 44,625 rows from 21 unseen reference sites that were never seen during training. Salt is important to check as it decides what grows in Karachi.

**Sources:** Plantify FAQ: How well does the model perform, and how does XGBoost compare with Random Forest?; Plantify FAQ: What data was the model trained on?

### 18. Where does the salinity data come from?

*How Plantify works · gemini · 636 ms*

> Salinity data comes from the ISRIC Global Soil Salinity Map 2016 (Ivushkin et al. 2019, 250 m resolution). Version 2.4 projects salinity to 2026 using the damped trend of ISRIC maps for 2005, 2009, and 2016, and never sets it below the 2016 value. In Karachi, salt decides what grows.

**Sources:** Plantify FAQ: Where does the site, salinity and climate data come from?

### 19. Who won the 2022 FIFA World Cup?

*Off-topic · declined · 26 ms*

> Sorry, I can only help with plants and gardening in Karachi, your site's data, and how Plantify works.

**Sources:** —

### 20. Write a Python function that sorts a list.

*Off-topic · declined · 25 ms*

> Sorry, I can only help with plants and gardening in Karachi, your site's data, and how Plantify works.

**Sources:** —
