"""
Download one photo per plant from iNaturalist into frontend/data/photos/.

    python frontend/scripts/fetch_photos.py               # plants with no photo yet
    python frontend/scripts/fetch_photos.py --limit 20    # at most 20 plants this run
    python frontend/scripts/fetch_photos.py --refresh     # download every photo again
    python frontend/scripts/fetch_photos.py --only "Azadirachta indica"

For each plant it finds the species on iNaturalist and takes a photo that the
photographer has shared under a Creative Commons licence. It prefers the most open
licences (CC0, CC BY, CC BY-SA) and otherwise uses CC BY-NC / CC BY-NC-SA, which allow
non-commercial use such as this university project. "All rights reserved" and
no-derivatives (ND) photos are never used. It first looks at the species' curated
photos, then at research-grade observations.

A hand-picked iNaturalist photo id in photo_overrides.json wins (it must be one of the
species' own photos or a research-grade observation photo with an open licence),
e.g. {"Azadirachta indica": 46478533}.

It saves a small JPEG (max 480 px) and records the photographer, licence and source
page in frontend/data/photos.json; the app shows these as the photo credit.
The manifest is saved after every plant, so an interrupted run loses nothing.

Needs: Pillow (pip install pillow) and internet access to api.inaturalist.org and
inaturalist-open-data.s3.amazonaws.com.

(Roman Urdu: har plant ki ek Creative Commons tasveer iNaturalist se download karti hai,
photographer ke naam aur licence ke saath. Ruk jaaye to dobara chalayein.)
"""
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "frontend" / "data"
PHOTOS = DATA / "photos"
MANIFEST = DATA / "photos.json"
OVERRIDES = Path(__file__).with_name("photo_overrides.json")
API = "https://api.inaturalist.org/v1"
PHOTO_HOST = "inaturalist-open-data.s3.amazonaws.com"   # where openly licensed photos live
UA = "PlantifyKarachi/1.0 (university final-year project; plant recommender)"
SIZE = 480
PAUSE = 1.2   # iNaturalist asks for at most about one request per second

# Lower number = preferred. ND licences and "all rights reserved" are not listed, so never used.
LICENCE_RANK = {"cc0": 0, "cc-by": 1, "cc-by-sa": 2, "cc-by-nc": 3, "cc-by-nc-sa": 4}
LICENCE_NAME = {"cc0": "CC0", "cc-by": "CC BY 4.0", "cc-by-sa": "CC BY-SA 4.0",
                "cc-by-nc": "CC BY-NC 4.0", "cc-by-nc-sa": "CC BY-NC-SA 4.0"}
LICENCE_URL = {"cc0": "https://creativecommons.org/publicdomain/zero/1.0/",
               "cc-by": "https://creativecommons.org/licenses/by/4.0/",
               "cc-by-sa": "https://creativecommons.org/licenses/by-sa/4.0/",
               "cc-by-nc": "https://creativecommons.org/licenses/by-nc/4.0/",
               "cc-by-nc-sa": "https://creativecommons.org/licenses/by-nc-sa/4.0/"}


def get(url, as_json=True):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r) if as_json else r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503) or attempt == 5:
                raise
            wait = int(e.headers.get("Retry-After") or 0) or 10 * (attempt + 1)
            print(f"  server busy (HTTP {e.code}), waiting {wait}s", flush=True)
            time.sleep(wait)
        finally:
            time.sleep(PAUSE)


def api(path, **params):
    return get(f"{API}/{path}?{urllib.parse.urlencode(params)}")


def find_taxon(sci):
    """The iNaturalist taxon for a scientific name (follows synonyms)."""
    res = api("taxa", q=sci, per_page=10, is_active="true").get("results", [])
    want = sci.lower()
    for t in res:
        if t.get("name", "").lower() == want or (t.get("matched_term") or "").lower() == want:
            return t
    genus = want.split()[0]
    for t in res:
        if t.get("rank") in ("species", "subspecies", "variety", "hybrid") and t.get("name", "").lower().startswith(genus):
            return t
    return None


def usable(photo):
    lic = (photo.get("license_code") or "").lower()
    url = photo.get("medium_url") or photo.get("url") or ""
    if lic not in LICENCE_RANK or PHOTO_HOST not in url:
        return None
    dims = photo.get("original_dimensions") or {}
    w, h = dims.get("width", 0), dims.get("height", 0)
    return {
        "id": photo["id"], "licence": lic,
        "url": re.sub(r"/(square|small|thumb|original|large)\.", "/medium.", url),
        "attribution": photo.get("attribution") or "",
        "ratio_ok": 0.6 <= (w / h if h else 1) <= 1.8,
    }


def pick(photos):
    """Most open licence first; among equals keep the taxon's own order; prefer non-extreme shapes."""
    best = None
    for i, p in enumerate(photos):
        c = usable(p)
        if not c:
            continue
        key = (LICENCE_RANK[c["licence"]], 0 if c["ratio_ok"] else 1, i)
        if best is None or key < best[0]:
            best = (key, c)
    return best[1] if best else None


def observation_photos(taxon_id, per_page=12):
    obs = api("observations", taxon_id=taxon_id, photo_license="cc0,cc-by,cc-by-sa,cc-by-nc,cc-by-nc-sa",
              quality_grade="research", order_by="votes", per_page=per_page).get("results", [])
    return [ph for o in obs for ph in o.get("photos", [])[:1]]


def photo_for(p, overrides):
    sci = p["scientific_name"]
    taxon = find_taxon(sci)
    if not taxon:
        return None, None
    full = api(f"taxa/{taxon['id']}").get("results", [{}])[0]
    taxon_photos = [tp["photo"] for tp in full.get("taxon_photos", [])]
    if sci in overrides:
        # A hand-picked photo: look for it among the species' photos and observations.
        want = int(overrides[sci])
        for ph in taxon_photos + observation_photos(taxon["id"]):
            if ph.get("id") == want:
                c = usable(ph)
                if c:
                    return c, taxon
        print(f"  override not found or not openly licensed: {sci} -> {want}; using the automatic pick", flush=True)
    c = pick(taxon_photos)
    if not c:
        c = pick(observation_photos(taxon["id"], per_page=10))
    return c, taxon


def credit_name(attribution):
    """'(c) Jane Doe, some rights reserved (CC BY-NC), uploaded by jdoe' -> 'Jane Doe'."""
    m = re.match(r"\(c\)\s*(.*?),\s*(some|no) rights reserved", attribution)
    name = (m.group(1) if m else attribution).strip()
    return name[:120] or "iNaturalist user"


def slug(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def save_manifest(manifest):
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    args = sys.argv[1:]
    refresh = "--refresh" in args
    limit = int(args[args.index("--limit") + 1]) if "--limit" in args else None
    only = args[args.index("--only") + 1] if "--only" in args else None

    plants = json.loads((DATA / "plants.json").read_text(encoding="utf-8"))
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.exists() else {}
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    PHOTOS.mkdir(parents=True, exist_ok=True)

    if only:
        todo = [p for p in plants if p["scientific_name"] == only]
    else:
        todo = [p for p in plants if refresh or p["scientific_name"] not in manifest
                or not (DATA.parent / manifest[p["scientific_name"]]["src"]).exists()]
    if limit:
        todo = todo[:limit]
    print(f"plants: {len(plants)}  with photo: {len(manifest)}  this run: {len(todo)}", flush=True)

    for p in todo:
        sci = p["scientific_name"]
        try:
            c, taxon = photo_for(p, overrides)
            if not c:
                print(f"  no open-licence photo: {sci} ({p.get('common_name')})", flush=True)
                continue
            img = Image.open(io.BytesIO(get(c["url"], as_json=False))).convert("RGB")
        except Exception as e:  # noqa: BLE001 - keep going with the next plant
            print(f"  failed: {sci}: {str(e)[:100]}", flush=True)
            continue
        img.thumbnail((SIZE, SIZE))
        dest = PHOTOS / f"{slug(sci)}.jpg"
        img.save(dest, "JPEG", quality=80, optimize=True, progressive=True)
        manifest[sci] = {
            "src": f"data/photos/{dest.name}", "width": img.width, "height": img.height,
            "artist": credit_name(c["attribution"]),
            "license": LICENCE_NAME[c["licence"]], "license_url": LICENCE_URL[c["licence"]],
            "source_page": f"https://www.inaturalist.org/photos/{c['id']}",
            "inat_taxon": taxon["name"] if taxon else None,
        }
        save_manifest(manifest)
        print(f"  ok: {sci} <- photo {c['id']} ({LICENCE_NAME[c['licence']]}, {manifest[sci]['artist']})", flush=True)

    save_manifest(manifest)
    print(f"photos: {len(manifest)}/{len(plants)}", flush=True)


if __name__ == "__main__":
    main()
