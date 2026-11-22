"""
Download one photo per plant from Wikimedia Commons into frontend/data/photos/.

    python frontend/scripts/fetch_photos.py               # plants with no photo yet
    python frontend/scripts/fetch_photos.py --limit 20    # at most 20 plants this run
    python frontend/scripts/fetch_photos.py --refresh     # download every photo again
    python frontend/scripts/fetch_photos.py --only "Azadirachta indica"

For each plant it searches Wikimedia Commons by scientific name and keeps the best
photo with a free licence (CC BY, CC BY-SA, CC0 or public domain), skipping herbarium
sheets, drawings and maps. A hand-picked file in photo_overrides.json always wins.
It saves a small JPEG (max 480 px) and records the photographer, licence and source
page in frontend/data/photos.json; the app shows these as the photo credit.
The manifest is saved after every plant, so an interrupted run loses nothing:
run it again and it carries on with the plants that still have no photo.

Wikimedia limits how fast one address may download, so the script goes slowly
and waits when asked to.

Needs: Pillow (pip install pillow) and internet access to commons.wikimedia.org
and upload.wikimedia.org.

(Roman Urdu: har plant ki ek free-licence tasveer Commons se download karti hai, credit ke saath.
Beech mein ruk jaaye to dobara chalayein, jahan chhoda tha wahin se shuru hogi.)
"""
import html
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
API = "https://commons.wikimedia.org/w/api.php"
UA = "PlantifyKarachi/1.0 (university final-year project; plant recommender)"
SIZE = 480
THUMB_WIDTH = 500          # a standard Wikimedia thumbnail size
PAUSE_BETWEEN_PLANTS = 6   # seconds; Wikimedia throttles fast downloaders
FREE = re.compile(r"^(cc[- ]by(-sa)?([- ][0-9.]+)?|cc0|cc zero|public domain|pd|gfdl)", re.I)
NOT_FREE = re.compile(r"\b(nc|nd)\b", re.I)
BAD_TITLE = re.compile(
    r"MHNT|herbar|specimen|\bBOT\b|K[oö]hler|illustrat|drawing|plate|\bmap\b|distribution|stamp|logo|"
    r"diagram|chart|scan|microscop|section|pollen|wood|timber|plank|furniture|bonsai|"
    r"\.svg|\.tiff?$|\.gif$|botanical|flora[ _]of|book|page", re.I)


def wait_time(e, attempt):
    return int(e.headers.get("Retry-After") or 0) or 15 * (attempt + 1)


def api(params):
    q = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    req = urllib.request.Request(f"{API}?{q}", headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == 5:
                raise
            print(f"  server busy (HTTP {e.code}), waiting {wait_time(e, attempt)}s", flush=True)
            time.sleep(wait_time(e, attempt))


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == 5:
                raise
            print(f"  image server busy, waiting {wait_time(e, attempt)}s", flush=True)
            time.sleep(wait_time(e, attempt))


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()


INFO = {"prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": THUMB_WIDTH,
        "iiextmetadatafilter": "Artist|LicenseShortName|LicenseUrl"}


def candidates_by_search(query, limit=12):
    d = api({"action": "query", "generator": "search", "gsrnamespace": 6, "gsrlimit": limit,
             "gsrsearch": f"{query} filetype:bitmap", **INFO})
    return sorted(d.get("query", {}).get("pages", []), key=lambda p: p.get("index", 99))


def candidate_by_title(title):
    d = api({"action": "query", "titles": title if title.startswith("File:") else "File:" + title, **INFO})
    return d.get("query", {}).get("pages", [])


def describe(page):
    """Turn an API page into a usable candidate, or None if it is not a free photo."""
    info = (page.get("imageinfo") or [None])[0]
    if not info or not info.get("thumburl"):
        return None
    meta = info.get("extmetadata", {})
    lic = clean(meta.get("LicenseShortName", {}).get("value"))
    if not FREE.search(lic) or NOT_FREE.search(lic):
        return None
    return {
        "title": page["title"],
        "thumb": urllib.parse.urlsplit(info["thumburl"])._replace(netloc="upload.wikimedia.org", query="").geturl(),
        "width": info.get("width", 0), "height": info.get("height", 0),
        "artist": clean(meta.get("Artist", {}).get("value"))[:120] or "Unknown author",
        "license": lic, "license_url": meta.get("LicenseUrl", {}).get("value") or None,
        "page": info.get("descriptionurl"),
    }


def score(c, rank, sci, commons):
    t = c["title"].lower()
    genus, _, species = sci.lower().partition(" ")
    s = 10 - rank
    s += 4 if genus in t else 0
    s += 3 if species and species in t else 0
    s += 2 if any(n in t for n in commons) else 0
    s += 2 if c["width"] >= 1000 else 0
    ratio = c["width"] / max(1, c["height"])
    s += 1 if 0.6 <= ratio <= 1.8 else -3
    return s


def common_names(p):
    out = []
    for part in re.split(r"[/(),]", p.get("common_name") or ""):
        part = re.sub(r"\b(e\.g\.|etc|shrub|tree)\b", "", part, flags=re.I).strip().lower()
        if len(part) >= 4:
            out.append(part)
    return out


def best_photo(p, overrides):
    sci = p["scientific_name"]
    if sci in overrides:
        for page in candidate_by_title(overrides[sci]):
            c = describe(page)
            if c:
                return c
        print(f"  override not usable: {sci} -> {overrides[sci]}", flush=True)
    commons = common_names(p)
    queries = [f'"{sci}"'] + [f'"{n}" plant' for n in commons[:2]]
    best, best_score = None, -99
    for q in queries:
        for rank, page in enumerate(candidates_by_search(q)):
            if BAD_TITLE.search(page.get("title", "")):
                continue
            c = describe(page)
            if not c:
                continue
            sc = score(c, rank, sci, commons)
            if sc > best_score:
                best, best_score = c, sc
        if best and best_score >= 12:
            break
        time.sleep(2)
    return best


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
            c = best_photo(p, overrides)
            if not c:
                print(f"  no free photo: {sci} ({p.get('common_name')})", flush=True)
                continue
            img = Image.open(io.BytesIO(download(c["thumb"]))).convert("RGB")
        except Exception as e:  # noqa: BLE001 - keep going with the next plant
            print(f"  failed: {sci}: {str(e)[:80]}", flush=True)
            time.sleep(PAUSE_BETWEEN_PLANTS)
            continue
        img.thumbnail((SIZE, SIZE))
        dest = PHOTOS / f"{slug(sci)}.jpg"
        img.save(dest, "JPEG", quality=80, optimize=True, progressive=True)
        manifest[sci] = {
            "src": f"data/photos/{dest.name}", "width": img.width, "height": img.height,
            "file": c["title"], "artist": c["artist"], "license": c["license"],
            "license_url": c["license_url"], "source_page": c["page"],
        }
        save_manifest(manifest)
        print(f"  ok: {sci} <- {c['title']} ({c['license']})", flush=True)
        time.sleep(PAUSE_BETWEEN_PLANTS)

    save_manifest(manifest)
    print(f"photos: {len(manifest)}/{len(plants)}", flush=True)


if __name__ == "__main__":
    main()
