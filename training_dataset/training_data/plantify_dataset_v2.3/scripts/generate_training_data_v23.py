"""
Plantify Karachi - training data generator, version 2.3 (salinity from ISRIC map, one-hot purposes, water need 1/3/5, heat zone).

Uses plants_master.csv (team species file + Karachi papers + EcoCrop) and sites_karachi_v2.csv
(SoilGrids points + weather + Shams 2019 towns). Labels come from the supervisor guide's rules:
Step 1 remove, Step 2 score out of 100.

Run: python generate_training_data_v2.py <dir with plants_master.csv and sites_karachi_v2.csv> <output dir>
"""
import sys, os
import numpy as np
import pandas as pd

IN, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(42)
SCENARIOS_PER_SITE = 25

plants = pd.read_csv(os.path.join(IN, 'plants_master.csv'))
plants = plants[plants.in_training == 1].reset_index(drop=True)
plants['do_not_plant_tags'] = plants['do_not_plant_tags'].fillna('')
sites = pd.read_csv(os.path.join(IN, 'sites_karachi_v2.csv'))
sites['town'] = sites['town'].fillna('')

# ---------------------------------------------------------------- user scenarios
# Salinity: the map value (ISRIC Global Soil Salinity Map 2016, 250 m) is the default for the site.
# The user's answers about visible salt signs can raise it, so the scenario salinity is drawn around the map value.
SALT_GIVEN_MAP = {0: [0.6, 0.3, 0.1], 1: [0.1, 0.6, 0.3], 2: [0.0, 0.2, 0.8]}
rows = []
for i, s in sites.iterrows():
    for k in range(SCENARIOS_PER_SITE):
        rows.append({'site_id': i, 'scenario_id': f'{i}-{k}',
                     'site_salinity': int(rng.choice([0, 1, 2], p=SALT_GIVEN_MAP[int(s.site_salinity_default)])),
                     'water_days': int(rng.integers(0, 8)),
                     'space': str(rng.choice(['small', 'medium', 'large'], p=[0.35, 0.4, 0.25])),
                     'care': str(rng.choice(['rarely', 'few_times_week', 'daily'], p=[0.35, 0.45, 0.2])),
                     'purpose': str(rng.choice(['any', 'shade', 'fruit', 'ornamental', 'carbon'], p=[0.3, 0.25, 0.2, 0.15, 0.1])),
                     'children_or_animals': int(rng.random() < 0.25)})
scen = pd.DataFrame(rows).merge(sites.reset_index().rename(columns={'index': 'site_id'}), on='site_id')

# ---------------------------------------------------------------- rule engine
W = {'salt': 22, 'water': 18, 'temp': 14,                       # from the supervisor guide
     'ph': 8, 'texture': 4, 'drainage': 4, 'fertility': 4, 'space': 8, 'care': 6, 'purpose': 8, 'pollution': 4}
assert sum(W.values()) == 100
BONUS_NATIVE, BONUS_GUIDE_GOOD, BONUS_PROVEN = 5, 5, 3
WATER_DAYS_NEEDED = {1: 1, 3: 3, 5: 7}       # water_need 1 low/weekly, 3 medium, 5 high/daily (days per week)
PH_MARGIN, T_MARGIN, UNKNOWN = 1.0, 3.0, 0.7

def known(*v):
    return all(pd.notna(x) for x in v)

def closeness(x, lo, hi, width):
    if not known(lo, hi): return UNKNOWN
    if lo <= x <= hi: return 1.0
    d = lo - x if x < lo else x - hi
    return max(0.0, 1 - d / width)

def band(x, olo, ohi, alo, ahi, margin):
    if not known(olo, ohi, alo, ahi): return UNKNOWN
    if olo <= x <= ohi: return 1.0
    if alo <= x <= ahi: return 0.7
    d = alo - x if x < alo else x - ahi
    return max(0.0, 0.7 * (1 - d / margin))

def yes(v):
    return pd.notna(v) and v == 1

def evaluate(s, p):
    # Step 1 - remove
    if p.do_not_plant == 1:
        return 'do_not_plant: ' + p.do_not_plant_tags, 0.0, {}
    if s.children_or_animals and p.poisonous == 1:
        return 'poisonous: children or animals at the site', 0.0, {}
    if s.site_salinity > p.salt_tolerance:
        return f'salinity: site class {s.site_salinity} > plant tolerance {int(p.salt_tolerance)}', 0.0, {}
    if s.ph > p.ph_abs_max + PH_MARGIN or s.ph < p.ph_abs_min - PH_MARGIN:
        return f'pH: {s.ph} far outside {p.ph_abs_min}-{p.ph_abs_max}', 0.0, {}
    if s.t_coldest_month < p.temp_abs_min - T_MARGIN or s.t_hottest_month > p.temp_abs_max + T_MARGIN:
        return (f'temperature: monthly {s.t_coldest_month:.1f}-{s.t_hottest_month:.1f} C far outside '
                f'{p.temp_abs_min}-{p.temp_abs_max}'), 0.0, {}
    need = WATER_DAYS_NEEDED[int(p.water_need)]
    if s.water_days < need - 1 or (s.water_days == 0 and p.water_need > 1):
        return f'water: {s.water_days} day(s)/week, plant needs about {need}', 0.0, {}
    if p.needs_large_space == 1 and s.space != 'large':
        return f'space: needs large root space, site is {s.space}', 0.0, {}

    # Step 2 - score
    sub = {}
    sub['salt'] = 1.0 if p.salt_tolerance - s.site_salinity >= 1 else 0.7
    sub['water'] = min(1.0, s.water_days / need)
    sub['temp'] = (closeness(s.t_mean, p.temp_opt_min, p.temp_opt_max, 10) +
                   closeness(s.t_hottest_month, p.temp_opt_min, p.temp_opt_max, 10)) / 2
    sub['ph'] = band(s.ph, p.ph_opt_min, p.ph_opt_max, p.ph_abs_min, p.ph_abs_max, PH_MARGIN)
    tex = p['soil_' + s.texture]
    sub['texture'] = UNKNOWN if pd.isna(tex) else (1.0 if tex == 1 else 0.3)
    dcol = {'poor': 'drainage_poor', 'well': 'drainage_well', 'excessive': 'drainage_excessive'}[s.drainage]
    sub['drainage'] = UNKNOWN if pd.isna(p[dcol]) else (1.0 if p[dcol] == 1 else 0.4)
    fcol = p['fertility_' + s.fertility]
    sub['fertility'] = UNKNOWN if pd.isna(fcol) else (1.0 if fcol == 1 else 0.5)
    if p.guide_recommendation == 'needs_good_soil_water' and s.fertility == 'low':
        sub['fertility'] = min(sub['fertility'], 0.4)
    sub['space'] = 1.0
    if pd.isna(p.low_maintenance):
        sub['care'] = UNKNOWN if s.care == 'rarely' else 1.0
    else:
        sub['care'] = 1.0 if (s.care != 'rarely' or p.low_maintenance == 1) else 0.3
    sub['purpose'] = 1.0 if (s.purpose == 'any' or p['purpose_' + s.purpose] == 1) else 0.2
    if s.industrial or s.site_type == 'dense_urban':
        if pd.isna(p.pollution_tolerance) and pd.isna(p.urban_heat_tolerant):
            sub['pollution'] = UNKNOWN
        else:
            sub['pollution'] = 1.0 if (yes(p.pollution_tolerance) or yes(p.urban_heat_tolerant)) else 0.4
    else:
        sub['pollution'] = 1.0
    if s.lst_zone_celsius == 3:                       # high urban-heat zone: favour heat-tolerant plants
        if pd.isna(p.urban_heat_tolerant):
            sub['pollution'] = min(sub['pollution'], UNKNOWN)
        elif p.urban_heat_tolerant != 1:
            sub['pollution'] = min(sub['pollution'], 0.5)
    score = sum(W[k] * sub[k] for k in W)
    score += BONUS_NATIVE * (1 if yes(p.native) else 0)
    score += BONUS_GUIDE_GOOD * (1 if p.guide_recommendation == 'good' else 0)
    score += BONUS_PROVEN * (1 if p.proven_in_karachi == 1 else 0)
    return '', round(min(100.0, score), 1), sub

out = []
plist = [plants.iloc[i] for i in range(len(plants))]
for s in scen.itertuples(index=False):
    for p in plist:
        reason, score, sub = evaluate(s, p)
        out.append({
            'scenario_id': s.scenario_id, 'site_id': s.site_id, 'area_name': s.area_name, 'town': s.town,
            'town_socioeconomic_class': s.town_socioeconomic_class, 'town_treeless_transect_pct': s.town_treeless_transect_pct,
            'site_type': s.site_type, 'industrial': s.industrial, 'lat': s.lat, 'lon': s.lon,
            'heat_temp_celsius': s.heat_temp_celsius, 'lst_zone_celsius': s.lst_zone_celsius,
            'ph': s.ph, 'clay_pct': s.clay_pct, 'sand_pct': s.sand_pct, 'ocd': s.ocd, 'bulk_density': s.bulk_density,
            'texture': s.texture, 'drainage': s.drainage, 'fertility': s.fertility,
            't_coldest_month': round(s.t_coldest_month, 2), 't_hottest_month': round(s.t_hottest_month, 2),
            't_mean': round(s.t_mean, 2), 'humidity': round(s.humidity, 1), 'wind': round(s.wind, 1),
            'site_salinity': s.site_salinity, 'site_salinity_default': s.site_salinity_default, 'water_days': s.water_days, 'space': s.space, 'care': s.care,
            'purpose': s.purpose, 'children_or_animals': s.children_or_animals,
            'scientific_name': p.scientific_name, 'common_name': p.common_name, 'trait_source': p.trait_source,
            'removed': int(reason != ''), 'removed_reason': reason, 'score': score,
            'suitable': int(reason == '' and score >= 70),
            **{'sub_' + k: round(v, 2) for k, v in sub.items()},
        })
pairs = pd.DataFrame(out)
pairs['rank_in_scenario'] = pairs.groupby('scenario_id')['score'].rank(ascending=False, method='first').astype(int)
pairs['top6'] = ((pairs['rank_in_scenario'] <= 6) & (pairs['removed'] == 0)).astype(int)
pairs.to_csv(os.path.join(OUT, 'training_pairs_v2_3.csv'), index=False)

print('plants used:', len(plants), '| sites:', len(sites), '| scenarios:', scen.shape[0], '| rows:', len(pairs))
print('removed share:', round(pairs.removed.mean(), 3), '| suitable share:', round(pairs.suitable.mean(), 3))
print(pairs[pairs.removed == 1].removed_reason.str.split(':').str[0].value_counts().to_string())
summary = pairs.groupby(['scientific_name', 'common_name']).agg(removed=('removed', 'mean'), score=('score', 'mean'),
                                                                top6=('top6', 'mean')).sort_values('top6', ascending=False).round(2)
print(summary.head(25).to_string())
