"""
Build the frontend's data files from the active dataset (v2.4).

    python frontend/scripts/build_data.py

Writes frontend/data/sites.json and frontend/data/plants.json. Run it again
whenever plants_clean.csv or sites_clean.csv change.

(Roman Urdu: ye script CSV files ko JSON mein badalti hai taake browser
inhe bina backend ke bhi parh sake.)
"""
import csv
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "training_dataset" / "training_data" / "plantify_dataset_v2.4"
OUT = ROOT / "frontend" / "data"

SITE_NUM = ["lat", "lon", "ph", "t_mean", "t_hottest_month", "t_coldest_month",
            "industrial", "lst_zone_celsius", "site_salinity_default", "sal_class_2016"]
SITE_STR = ["area_name", "town", "site_type", "texture", "drainage", "fertility"]

PLANT_NUM = ["ph_opt_min", "ph_opt_max", "ph_abs_min", "ph_abs_max",
             "temp_opt_min", "temp_opt_max", "temp_abs_min", "temp_abs_max",
             "salt_tolerance", "water_need", "soil_light", "soil_medium", "soil_heavy",
             "drainage_poor", "drainage_well", "drainage_excessive",
             "fertility_low", "fertility_medium", "fertility_high",
             "pollution_tolerance", "urban_heat_tolerant", "low_maintenance", "native",
             "proven_in_karachi", "do_not_plant", "poisonous", "needs_large_space",
             "purpose_shade", "purpose_fruit", "purpose_ornamental", "purpose_carbon", "guide_good"]
PLANT_STR = ["scientific_name", "common_name", "guide_recommendation", "guide_note", "do_not_plant_tags"]
MASTER_EXTRA = {"Lifeform_tree": "tree", "Lifeform_shrub": "shrub", "Evergreen": "evergreen",
                "Deciduous": "deciduous"}


def num(v):
    """Empty or NaN -> None (JSON null), else a float (int when whole)."""
    if v is None or v.strip() == "":
        return None
    f = float(v)
    if math.isnan(f):
        return None
    return int(f) if f.is_integer() else round(f, 4)


PLUS_CODE = re.compile(r"\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,3}\b")


def clean_label(name):
    """Readable area name for the UI: drop Google plus codes, stray commas and spaces."""
    t = PLUS_CODE.sub("", name)
    t = re.sub(r"\s+,", ",", t)
    t = re.sub(r",\s*,+", ",", t)
    t = re.sub(r"\(\s+", "(", t)
    t = re.sub(r"\s+\)", ")", t)
    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r"\(\s*,\s*", "(", t)
    return t.strip(" ,")


def read(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    sites = []
    for r in read(DATA / "sites_clean.csv"):
        s = {"site_id": int(r["site_id"])}
        s.update({k: num(r[k]) for k in SITE_NUM})
        s.update({k: r[k].strip() for k in SITE_STR})
        s["label"] = clean_label(s["area_name"])
        sites.append(s)

    master = {r["scientific_name"]: r for r in read(DATA / "reference" / "plants_master.csv")}
    plants = []
    for r in read(DATA / "plants_clean.csv"):
        p = {k: r[k].strip() for k in PLANT_STR}
        p.update({k: num(r[k]) for k in PLANT_NUM})
        if not p["common_name"]:
            p["common_name"] = p["scientific_name"]
        m = master.get(p["scientific_name"], {})
        p["form"] = [label for col, label in MASTER_EXTRA.items() if num(m.get(col, "")) == 1]
        p["trait_confidence"] = (m.get("trait_confidence") or "").strip() or None
        plants.append(p)

    (OUT / "sites.json").write_text(json.dumps(sites, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "plants.json").write_text(json.dumps(plants, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"sites: {len(sites)}  plants: {len(plants)}  -> {OUT}")


if __name__ == "__main__":
    main()
