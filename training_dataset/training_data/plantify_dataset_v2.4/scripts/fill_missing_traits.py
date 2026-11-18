"""
Fill trait values for the 31 plants that had none (30 observed-only + Nerium oleander with incomplete EcoCrop values).
Values are ESTIMATES from general horticultural references, not measurements. Every filled row is marked:
trait_source = 'estimated (horticultural references) - verify', trait_confidence = medium / low.
Run: python fill_missing_traits.py <dir with plants_master.csv>   (edits plants_master.csv in that dir)
"""
import sys, os
import numpy as np
import pandas as pd

D = sys.argv[1]
p = pd.read_csv(os.path.join(D, 'plants_master.csv'))

COLS = ['common_name', 'ph_opt_min', 'ph_opt_max', 'ph_abs_min', 'ph_abs_max', 'temp_opt_min', 'temp_opt_max',
        'temp_abs_min', 'temp_abs_max', 'salt_tolerance', 'water_need', 'soil_light', 'soil_medium', 'soil_heavy',
        'drainage_poor', 'drainage_well', 'drainage_excessive', 'fertility_low', 'fertility_medium', 'fertility_high',
        'pollution_tolerance', 'urban_heat_tolerant', 'low_maintenance', 'needs_large_space', 'trait_confidence']
N = np.nan
# name: common, pH opt, pH abs, temp opt, temp abs, salt(0-2), water(1/3/5), soil L M H, drainage P W E, fertility L M H,
#       pollution, heat, low_maint, large_space, confidence
T = {
 'Ficus virens':           ['White fig / Pilkhan', 5.5,7.5,5.0,8.5, 20,38,5,45, 1,3, 1,1,1, 0,1,0, 0,1,1, 1,1,1, 1,'medium'],
 'Albizia julibrissin':    ['Silk tree',           6.0,7.5,5.0,8.5, 15,30,-10,40, 1,3, 1,1,1, 0,1,1, 1,1,0, 1,0,1, 0,'medium'],
 'Ficus microcarpa':       ['Chinese banyan',      5.5,7.5,4.5,8.5, 20,35,2,45, 2,3, 1,1,1, 0,1,1, 1,1,1, 1,1,1, 1,'medium'],
 'Ficus rubiginosa':       ['Port Jackson fig',    5.5,7.5,5.0,8.5, 15,32,0,42, 1,3, 1,1,1, 0,1,1, 1,1,1, 1,1,1, 1,'low'],
 'Ziziphus jujuba':        ['Chinese jujube',      6.0,8.0,5.0,9.0, 20,35,-10,45, 1,1, 1,1,1, 0,1,1, 1,1,0, 1,1,1, 0,'medium'],
 'Crateva adansonii':      ['Barna / Sacred garlic pear', 6.0,8.0,5.0,8.5, 22,38,5,46, 1,3, 1,1,1, 1,1,0, 0,1,1, N,1,1, 0,'low'],
 'Ficus racemosa':         ['Gular / Cluster fig', 6.0,7.5,5.0,8.5, 20,38,2,45, 0,5, 1,1,1, 1,1,0, 0,1,1, 1,1,1, 1,'medium'],
 'Erythrina suberosa':     ['Corky coral tree',    6.0,7.5,5.0,8.5, 20,35,2,45, 1,1, 1,1,0, 0,1,1, 1,1,0, N,1,1, 0,'low'],
 'Roystonea regia':        ['Royal palm',          6.0,7.5,5.5,8.5, 22,35,5,42, 1,5, 1,1,1, 1,1,0, 0,1,1, 1,1,0, 0,'medium'],
 'Polyalthia longifolia':  ['False ashoka / Ashok', 6.0,7.5,5.5,8.5, 20,35,5,45, 1,3, 1,1,1, 0,1,0, 0,1,1, 1,1,1, 0,'medium'],
 'Cordia myxa':            ['Lasoora',             6.0,8.0,5.5,8.5, 22,38,3,46, 1,1, 1,1,1, 0,1,1, 1,1,0, 1,1,1, 0,'medium'],
 'Tabebuia heterophylla':  ['Pink trumpet tree',   6.0,7.5,5.5,8.5, 20,35,5,42, 2,3, 1,1,1, 0,1,1, 1,1,0, 1,1,1, 0,'medium'],
 'Ficus benjamina':        ['Weeping fig',         6.0,7.5,5.0,8.5, 18,32,5,40, 1,3, 1,1,0, 0,1,0, 0,1,1, 1,1,1, 1,'medium'],
 'Ficus amplissima':       ['Bat fig',             5.5,7.5,5.0,8.5, 22,38,5,45, 1,1, 1,1,1, 0,1,1, 1,1,0, 1,1,1, 1,'low'],
 'Livistona chinensis':    ['Chinese fan palm',    6.0,7.5,5.0,8.5, 18,32,-5,42, 1,3, 1,1,1, 0,1,0, 0,1,1, 1,1,1, 0,'medium'],
 'Ficus rumphii':          ['Mock bodhi tree',     6.0,7.5,5.0,8.5, 22,38,5,45, 1,3, 1,1,1, 0,1,1, 1,1,1, 1,1,1, 1,'low'],
 'Millingtonia hortensis': ['Indian cork tree / Akash neem', 6.0,7.5,5.5,8.5, 20,35,5,45, 0,3, 1,1,0, 0,1,1, 0,1,1, 1,1,1, 0,'medium'],
 'Cordia gharaf':          ['Gondi / Cordia sinensis', 6.5,8.5,6.0,9.0, 24,40,5,48, 2,1, 1,1,1, 0,1,1, 1,1,0, 1,1,1, 0,'medium'],
 'Fernandoa adenophylla':  ['Fernandoa / Marodphali', 6.0,7.5,5.5,8.5, 22,35,8,42, 0,3, 1,1,0, 0,1,0, 0,1,1, N,1,1, 0,'low'],
 'Washingtonia robusta':   ['Mexican fan palm',    6.0,8.0,5.5,8.5, 20,40,-5,48, 2,1, 1,1,1, 0,1,1, 1,1,0, 1,1,1, 0,'medium'],
 'Nerium oleander':        ['Oleander / Kaner',    6.0,8.0,5.0,8.5, 18,38,-5,48, 2,1, 1,1,1, 0,1,1, 1,1,0, 1,1,1, 0,'medium'],
 'Cordia macleodii':       ['Dahipalas',           6.0,7.5,5.5,8.5, 22,36,5,44, 0,1, 1,1,0, 0,1,1, 1,1,0, N,1,1, 0,'low'],
 'Saraca asoca':           ['Ashoka (true)',       5.5,7.0,5.0,8.0, 20,32,8,40, 0,5, 0,1,1, 0,1,0, 0,1,1, N,0,0, 0,'medium'],
 'Ficus lyrata':           ['Fiddle-leaf fig',     6.0,7.0,5.5,8.0, 18,30,10,38, 0,3, 1,1,0, 0,1,0, 0,1,1, N,0,0, 0,'medium'],
 'Mimosa hamata':          ['Hooked mimosa (shrub)', 6.5,8.5,6.0,9.0, 24,40,5,48, 1,1, 1,1,0, 0,1,1, 1,1,0, 1,1,1, 0,'low'],
 'Euphorbia caducifolia':  ['Leafless milk hedge / Thor (shrub)', 6.5,8.5,6.0,9.0, 24,42,5,50, 1,1, 1,1,0, 0,1,1, 1,0,0, 1,1,1, 0,'medium'],
 'Nannorrhops ritchiana':  ['Mazari palm',         7.0,8.5,6.0,9.0, 20,40,-10,50, 1,1, 1,1,0, 0,1,1, 1,1,0, N,1,1, 0,'medium'],
 'Searsia lancea':         ['African sumac / Karee', 6.0,8.0,5.5,8.5, 15,35,-8,45, 1,1, 1,1,1, 0,1,1, 1,1,0, 1,1,1, 0,'medium'],
 'Tecomella undulata':     ['Rohida / Desert teak', 7.0,8.5,6.5,9.0, 25,42,0,50, 1,1, 1,1,0, 0,1,1, 1,1,0, 1,1,1, 0,'medium'],
 'Ziziphus nummularia':    ['Jhar beri (shrub)',   7.0,8.5,6.0,9.0, 25,42,0,50, 1,1, 1,1,1, 0,1,1, 1,1,0, 1,1,1, 0,'medium'],
 'Quercus phellos':        ['Willow oak',          4.5,6.5,4.0,7.5, 10,30,-25,38, 0,3, 0,1,1, 1,1,0, 0,1,1, 1,0,1, 0,'medium'],
}
assert len(T) == 31 and all(len(v) == len(COLS) for v in T.values())
if 'trait_confidence' not in p.columns:
    p['trait_confidence'] = np.where(p['in_training'] == 1, 'source data', '')
p['common_name'] = p['common_name'].astype(object)
for name, vals in T.items():
    i = p.index[p.scientific_name == name]
    assert len(i) == 1, name
    for c, v in zip(COLS, vals):
        if c == 'common_name' and pd.notna(p.loc[i[0], c]):
            continue
        p.loc[i[0], c] = v
    p.loc[i[0], 'trait_source'] = 'estimated (horticultural references) - verify'
    p.loc[i[0], 'in_training'] = 1
# extra facts used by the rules
p.loc[p.scientific_name == 'Euphorbia caducifolia', 'poisonous'] = 1          # irritant milky latex
p.loc[p.scientific_name.isin(['Saraca asoca', 'Searsia lancea', 'Quercus phellos']), 'native'] = 0
p.loc[p.scientific_name.isin(['Ziziphus nummularia']), 'purpose_fruit'] = 1
p.loc[p.scientific_name.isin(['Tecomella undulata', 'Millingtonia hortensis', 'Roystonea regia']), 'purpose_ornamental'] = 1
key = ['ph_opt_min', 'ph_abs_max', 'temp_opt_min', 'temp_abs_max', 'salt_tolerance', 'water_need', 'soil_light',
       'drainage_well', 'fertility_low', 'pollution_tolerance', 'urban_heat_tolerant', 'low_maintenance']
p['trait_completeness'] = p[key].notna().mean(axis=1).round(2)
p.to_csv(os.path.join(D, 'plants_master.csv'), index=False)
print('in_training:', int(p.in_training.sum()), '| estimated rows:', int((p.trait_source.str.startswith('estimated')).sum()))
print(p.trait_confidence.value_counts().to_string())
