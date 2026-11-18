"""
Plantify Karachi - clean, model-ready dataset (v2.2).
Keeps only the columns the rule engine and the model actually use; drops IDs/names that are not needed,
duplicate columns, columns the rules never read, and rule outputs (answer leaks).
Run: python make_clean_dataset.py <v2.1 dir> <output dir>
"""
import sys, os, json
import pandas as pd

IN, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
pairs = pd.read_csv(os.path.join(IN, 'training_pairs_v2_4.csv'))
plants = pd.read_csv(os.path.join(IN, 'plants_master.csv'))
sites = pd.read_csv(os.path.join(IN, 'sites_karachi_v2.csv'))

IDS = ['scenario_id', 'site_id', 'scientific_name']
SITE = ['ph', 't_mean', 't_hottest_month', 't_coldest_month', 'industrial', 'lst_zone_celsius',
        'site_type', 'texture', 'drainage', 'fertility']
USER = ['site_salinity', 'water_days', 'space', 'care', 'purpose', 'children_or_animals']
PLANT = ['ph_opt_min', 'ph_opt_max', 'ph_abs_min', 'ph_abs_max',
         'temp_opt_min', 'temp_opt_max', 'temp_abs_min', 'temp_abs_max',
         'salt_tolerance', 'water_need', 'soil_light', 'soil_medium', 'soil_heavy',
         'drainage_poor', 'drainage_well', 'drainage_excessive', 'fertility_low', 'fertility_medium', 'fertility_high',
         'pollution_tolerance', 'urban_heat_tolerant', 'low_maintenance', 'native', 'proven_in_karachi',
         'do_not_plant', 'poisonous', 'needs_large_space',
         'purpose_shade', 'purpose_fruit', 'purpose_ornamental', 'purpose_carbon']

# plants: model columns + what the app/chatbot shows
plants['guide_good'] = (plants['guide_recommendation'] == 'good').astype(int)
p = plants[plants.in_training == 1]
plants_clean = p[['scientific_name', 'common_name'] + PLANT + ['guide_good', 'guide_recommendation', 'guide_note',
                                                               'do_not_plant_tags']].reset_index(drop=True)
plants_clean.to_csv(os.path.join(OUT, 'plants_clean.csv'), index=False)

# sites: location for GPS lookup + model columns
sites_clean = sites[['area_name', 'lat', 'lon', 'town'] + SITE + ['site_salinity_default', 'sal_class_2016']].copy()
sites_clean.insert(0, 'site_id', range(len(sites_clean)))
sites_clean.to_csv(os.path.join(OUT, 'sites_clean.csv'), index=False)

# training table: one flat file, plant traits already joined
t = pairs[IDS + SITE + USER + ['suitable', 'top6']].merge(
    plants_clean[['scientific_name'] + PLANT + ['guide_good']], on='scientific_name', how='left')
assert len(t) == len(pairs)
t['purpose_match'] = 1
for k in ['shade', 'fruit', 'ornamental', 'carbon']:
    m = t.purpose == k
    t.loc[m, 'purpose_match'] = t.loc[m, 'purpose_' + k]
t['purpose_match'] = t['purpose_match'].astype(int)
t = t[IDS + SITE + USER + PLANT + ['guide_good', 'purpose_match', 'suitable', 'top6']]
t.to_csv(os.path.join(OUT, 'training_clean.csv'), index=False)

schema = {'id_columns_not_features': IDS, 'site_features': SITE, 'user_features': USER,
          'plant_features': PLANT + ['guide_good', 'purpose_match'],
          'categorical_features': ['site_type', 'texture', 'drainage', 'fertility', 'space', 'care', 'purpose'],
          'target': 'suitable', 'evaluation_only_not_feature': 'top6'}
json.dump(schema, open(os.path.join(OUT, 'schema.json'), 'w'), indent=2)
print('training_clean', t.shape, '| plants_clean', plants_clean.shape, '| sites_clean', sites_clean.shape)
print('missing values per plant column (rows):'); print(t[PLANT].isna().sum()[lambda x: x > 0].to_string())
