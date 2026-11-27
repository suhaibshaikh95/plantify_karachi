"""
Build the Plantify Karachi chatbot knowledge base (RAG index).

    npm run build:knowledge          (from backend/)
    python src/ml/build_index.py     (same thing)
    python src/ml/build_index.py --passages-only   (write passages.jsonl, skip embedding)

Reads four sources and turns each into short plain-English passages (about 80-200 words):
  1. plants   backend/assets/data/plants.json                 one passage per plant (85)
  2. sites    backend/assets/data/sites.json                  one passage per site (104)
  3. guide    backend/assets/knowledge/karachi_planting_guide.md   split by "## " sections
  4. faq      backend/assets/knowledge/project_faq.md         one passage per "## " question

Writes:
  backend/assets/knowledge/passages.jsonl   one JSON object per passage:
      id, source_type, title, text, scientific_name, site_id, words
  backend/assets/knowledge/index.faiss      FAISS IndexFlatIP over normalized BGE-small embeddings
                                            (row i = line i of passages.jsonl; inner product = cosine)
  backend/assets/knowledge/index_meta.json  model name, dimension, passage counts, build time

Nothing is invented: every sentence comes from a value in the source files, and a missing
(null) trait is written as "unknown". No model is trained or fine-tuned here.

(Roman Urdu: ye script data ko chhote paragraphs mein badal kar unke embeddings ka FAISS index
banati hai, taake chatbot sirf hamare data se jawab de.)
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
DATA = BACKEND / "assets" / "data"
KNOWLEDGE = BACKEND / "assets" / "knowledge"
GUIDE_MD = KNOWLEDGE / "karachi_planting_guide.md"
FAQ_MD = KNOWLEDGE / "project_faq.md"
PASSAGES_OUT = KNOWLEDGE / "passages.jsonl"
INDEX_OUT = KNOWLEDGE / "index.faiss"
META_OUT = KNOWLEDGE / "index_meta.json"

MODEL_NAME = "BAAI/bge-small-en-v1.5"
MIN_WORDS, MAX_WORDS = 80, 200


# ------------------------------------------------------------------ helpers
def words(text):
    return len(text.split())


def yes_no(value, yes, no, unknown):
    if value is None:
        return unknown
    return yes if int(value) == 1 else no


def join_list(items):
    items = [i for i in items if i]
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def display_name(p):
    """Same cleaning as the backend's formatDisplayName()."""
    c = (p.get("common_name") or p["scientific_name"]).strip()
    c = re.sub(r"^\((.*)\)$", r"\1", c)
    c = re.sub(r"^E\.g\.\s*", "", c, flags=re.I)
    c = re.sub(r"\s+etc\.?$", "", c, flags=re.I)
    c = re.sub(r"\s*\((shrub|tree)\)\s*$", "", c, flags=re.I).strip()
    if not c:
        c = p["scientific_name"]
    return c[0].upper() + c[1:]


def num(v, unit=""):
    if v is None:
        return None
    v = float(v)
    s = str(int(v)) if v.is_integer() else f"{v:g}"
    return s + unit


def range_text(lo, hi, unit=""):
    if lo is None or hi is None:
        return "unknown"
    return f"{num(lo, unit)} to {num(hi, unit)}"


# ------------------------------------------------------------------ 1. plants
SALT = {
    0: "low: it does not tolerate saline soil and only suits non-saline sites (salinity class 0)",
    1: "moderate: it tolerates slightly saline sites (salinity class up to 1)",
    2: "high: it tolerates highly saline sites (salinity class up to 2)",
}
WATER = {
    1: "low (about one watering day a week once established)",
    3: "medium (about three watering days a week)",
    5: "high (watering almost every day)",
}
DNP_TAGS = {
    "banned_invasive": "it is banned or invasive",
    "root_damage": "its roots damage pipes and drains",
    "high_water_use": "it uses a lot of water",
    "allergen": "its pollen causes allergy",
}
GUIDE_REC = {
    "good": "The Karachi planting guide lists it as a good choice.",
    "needs_good_soil_water": "The Karachi planting guide says it needs good soil and water.",
    "needs_large_space": "The Karachi planting guide says to plant it only where there is big root space.",
    "poisonous": "The Karachi planting guide warns that it is poisonous.",
    "do_not_plant": "The Karachi planting guide lists it as do not plant.",
}


def suited(p, prefix, labels):
    good, bad, unknown = [], [], []
    for key, label in labels:
        v = p.get(f"{prefix}_{key}")
        (unknown if v is None else good if int(v) == 1 else bad).append(label)
    parts = []
    if good:
        parts.append(f"suits {join_list(good)}")
    if bad:
        parts.append(f"not {join_list(bad)}")
    if unknown:
        parts.append(f"unknown for {join_list(unknown)}")
    return "; ".join(parts) if parts else "unknown"


def plant_passage(p):
    name, sci = display_name(p), p["scientific_name"]
    form = [f for f in (p.get("form") or []) if f in ("tree", "shrub")]
    leaf = [f for f in (p.get("form") or []) if f in ("evergreen", "deciduous")]
    kind = " or ".join(form) if form else "plant"
    desc = f"{' and '.join(leaf)} {kind}" if leaf else kind
    article = "an" if desc[0] in "aeiou" else "a"
    s = []
    s.append(f"{name} ({sci}) is {article} {desc} on Plantify's Karachi plant list.")
    s.append(f"Salt tolerance is {SALT.get(p.get('salt_tolerance'), 'unknown')}.")
    s.append(f"Water need is {WATER.get(p.get('water_need'), 'unknown')}.")
    s.append(f"Best soil pH is {range_text(p.get('ph_opt_min'), p.get('ph_opt_max'))} and it survives pH {range_text(p.get('ph_abs_min'), p.get('ph_abs_max'))}.")
    s.append(
        f"Best temperature is {range_text(p.get('temp_opt_min'), p.get('temp_opt_max'), ' °C')} and it survives "
        f"{range_text(p.get('temp_abs_min'), p.get('temp_abs_max'), ' °C')}."
    )
    s.append(f"Soil texture: {suited(p, 'soil', [('light', 'sandy (light) soil'), ('medium', 'loam (medium) soil'), ('heavy', 'clay (heavy) soil')])}.")
    s.append(f"Drainage: {suited(p, 'drainage', [('poor', 'poor drainage'), ('well', 'good drainage'), ('excessive', 'very fast drainage')])}.")
    s.append(f"Soil fertility: {suited(p, 'fertility', [('low', 'low fertility'), ('medium', 'medium fertility'), ('high', 'high fertility')])}.")
    s.append(yes_no(p.get("native"), "It is native to the region.", "It is not native.", "Whether it is native is unknown."))
    s.append(yes_no(p.get("proven_in_karachi"), "It is proven to grow in Karachi.", "It is not recorded as proven in Karachi.", "Whether it is proven in Karachi is unknown."))
    s.append(yes_no(p.get("poisonous"), "It is POISONOUS: do not plant it where children or animals can reach it.", "It is not recorded as poisonous.", "Whether it is poisonous is unknown."))
    s.append(yes_no(p.get("needs_large_space"), "It needs large root space: plant it only in large open ground, never in pots, small yards or pavement pits.", "It does not need very large root space.", "Its root space need is unknown."))
    s.append(yes_no(p.get("low_maintenance"), "It is low maintenance.", "It needs regular care.", "Its care need is unknown."))
    s.append(yes_no(p.get("urban_heat_tolerant"), "It tolerates urban heat.", "It is not recorded as heat tolerant.", "Its heat tolerance is unknown."))
    s.append(yes_no(p.get("pollution_tolerance"), "It tolerates pollution.", "It is not recorded as pollution tolerant.", "Its pollution tolerance is unknown."))
    uses = [u for key, u in [("shade", "shade"), ("fruit", "fruit"), ("ornamental", "ornament and flowers"), ("carbon", "carbon storage")] if p.get(f"purpose_{key}") == 1]
    s.append(f"Main uses: {join_list(uses)}." if uses else "No main use is recorded.")

    if p.get("do_not_plant") == 1:
        tags = [t for t in (p.get("do_not_plant_tags") or "").split("|") if t]
        reasons = [DNP_TAGS[t] for t in tags if t in DNP_TAGS]
        if reasons:
            s.append(f"DO NOT PLANT: Plantify never recommends it because {join_list(reasons)}.")
        else:
            s.append("DO NOT PLANT: Plantify never recommends it; the planting guide lists it as do not plant without a recorded reason.")
    rec = p.get("guide_recommendation") or ""
    if rec in GUIDE_REC and rec != "do_not_plant":
        s.append(GUIDE_REC[rec])
    note = (p.get("guide_note") or "").strip()
    if note:
        s.append(f'Planting guide note: "{note}".')

    conf = p.get("trait_confidence")
    if conf in ("medium", "low"):
        s.append(f"Caution: these traits are ESTIMATED from general horticultural references, not measured (confidence: {conf}); they need checking by an expert.")
    else:
        s.append("Traits are from the project's source data.")

    return {
        "id": f"plant:{sci}",
        "source_type": "plant",
        "title": f"Plant: {name} ({sci})",
        "text": " ".join(s),
        "scientific_name": sci,
        "site_id": None,
    }


# ------------------------------------------------------------------ 2. sites
TEXTURE = {"light": "light (sandy)", "medium": "medium (loam)", "heavy": "heavy (clay)"}
SITE_TYPE = {
    "coastal": "coastal (main problem: salt in the soil and sea air)",
    "dense_urban": "dense urban (main problem: little root space, heat and pollution)",
    "periurban_farm": "peri-urban farmland (main problem: irrigation water quality)",
    "inland_dry": "inland dry land (main problem: not enough water)",
}
SAL_DEFAULT = {0: "class 0 (non-saline)", 1: "class 1 (saline)", 2: "class 2 (highly saline)"}
SAL_2016 = {0: "class 0 (non-saline)", 1: "class 1 (slightly saline)", 2: "class 2 (moderately saline)",
            3: "class 3 (strongly saline)", 4: "class 4 (extremely saline)"}


def site_passage(s):
    area = s.get("label") or s.get("area_name")
    town = s.get("town") or ""
    where = f"{area}{', ' + town + ' town' if town else ''}"
    t = []
    t.append(f"Reference site {s['site_id']}: {where}, Karachi, at latitude {s['lat']:.4f} and longitude {s['lon']:.4f}.")
    t.append(f"Plantify uses this site's data for any plot whose nearest reference site it is.")
    t.append(f"Site type: {SITE_TYPE.get(s.get('site_type'), s.get('site_type') or 'unknown')}.")
    t.append(f"Soil pH is {num(s.get('ph')) or 'unknown'}, texture {TEXTURE.get(s.get('texture'), 'unknown')}, drainage {s.get('drainage') or 'unknown'} and fertility {s.get('fertility') or 'unknown'}.")
    t.append(
        f"Default salinity is {SAL_DEFAULT.get(s.get('site_salinity_default'), 'unknown')} from the 2026 projection; "
        f"the ISRIC 2016 map gives {SAL_2016.get(s.get('sal_class_2016'), 'unknown')}. "
        f"Reported salt signs can raise salinity for a plot, never lower it."
    )
    t.append(
        f"Mean temperature is {s['t_mean']:.1f} °C, the hottest month averages {s['t_hottest_month']:.1f} °C "
        f"and the coldest month {s['t_coldest_month']:.1f} °C."
    )
    t.append("It is in an industrial area." if s.get("industrial") == 1 else "It is not in an industrial area.")
    if s.get("lst_zone_celsius") == 3:
        t.append("It is in a high urban-heat zone, so heat-tolerant plants are favoured.")
    elif s.get("lst_zone_celsius") is not None:
        t.append("It is not in the highest urban-heat zone.")
    return {
        "id": f"site:{s['site_id']}",
        "source_type": "site",
        "title": f"Site: {where}",
        "text": " ".join(t),
        "scientific_name": None,
        "site_id": s["site_id"],
    }


# ------------------------------------------------------------------ 3 + 4. markdown documents
def split_sections(md_text):
    """[(heading, body)] for each '## ' section; text before the first section is ignored."""
    sections, current, body = [], None, []
    for line in md_text.splitlines():
        if line.startswith("## "):
            if current:
                sections.append((current, "\n".join(body).strip()))
            current, body = line[3:].strip(), []
        elif current is not None:
            body.append(line)
    if current:
        sections.append((current, "\n".join(body).strip()))
    return sections


def blocks_of(body):
    """Split a section body into paragraphs and bullet / numbered items (keeps lead-in lines)."""
    blocks, buf = [], []
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            if buf:
                blocks.append(" ".join(buf))
                buf = []
            continue
        if re.match(r"^([-*]|\d+\.)\s+", stripped) and buf:
            blocks.append(" ".join(buf))
            buf = []
        buf.append(stripped)
    if buf:
        blocks.append(" ".join(buf))
    return blocks


def pack(blocks, max_words=MAX_WORDS):
    """Split blocks into the fewest chunks of at most max_words, with chunk sizes as even as possible.
    Blocks are never cut, so a single block longer than max_words stays whole."""
    total = sum(words(b) for b in blocks)
    n = max(1, -(-total // max_words))
    while True:
        target = -(-total // n)
        chunks, cur = [], []
        for b in blocks:
            if cur and (words(" ".join(cur)) >= target or words(" ".join(cur + [b])) > max_words):
                chunks.append(" ".join(cur))
                cur = []
            cur.append(b)
        if cur:
            chunks.append(" ".join(cur))
        if all(words(c) <= max_words for c in chunks) or n >= len(blocks):
            return chunks
        n += 1


def clean_md(text):
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def guide_passages(path):
    if not path.exists():
        print(f"WARNING: {path} not found: the planting guide is NOT in the index.", file=sys.stderr)
        return []
    sections = split_sections(path.read_text(encoding="utf-8"))
    out = []
    pending = None  # a short section waiting to be merged with the next one
    for heading, body in sections:
        text = clean_md(body)
        if pending:
            if words(pending[1]) + words(text) <= MAX_WORDS:
                heading = f"{pending[0]} / {heading}"
                text = pending[1] + " " + text
                body = pending[2] + "\n\n" + body
            else:  # merging would be too long: keep the short section as its own passage
                out.append({"title": f"Karachi Planting Guide: {pending[0]}", "text": pending[1]})
            pending = None
        if words(text) < MIN_WORDS:
            pending = (heading, text, body)
            continue
        chunks = [text] if words(text) <= MAX_WORDS else [clean_md(c) for c in pack(blocks_of(body))]
        for i, chunk in enumerate(chunks, 1):
            title = f"Karachi Planting Guide: {heading}" + (f" (part {i})" if len(chunks) > 1 else "")
            out.append({"title": title, "text": chunk})
    if pending:  # last section was short: attach it to the previous passage
        if out:
            out[-1]["title"] += f" / {pending[0]}"
            out[-1]["text"] += " " + pending[1]
        else:
            out.append({"title": f"Karachi Planting Guide: {pending[0]}", "text": pending[1]})
    return [
        {"id": f"guide:{i}", "source_type": "guide", "title": p["title"], "text": p["text"], "scientific_name": None, "site_id": None}
        for i, p in enumerate(out, 1)
    ]


def faq_passages(path):
    if not path.exists():
        print(f"WARNING: {path} not found: the project FAQ is NOT in the index.", file=sys.stderr)
        return []
    out = []
    for i, (question, body) in enumerate(split_sections(path.read_text(encoding="utf-8")), 1):
        answer = "\n".join(l for l in body.splitlines() if not l.startswith("Source:"))
        out.append({
            "id": f"faq:{i}",
            "source_type": "faq",
            "title": f"Plantify FAQ: {question}",
            "text": f"Q: {question} A: {clean_md(answer)}",
            "scientific_name": None,
            "site_id": None,
        })
    return out


# ------------------------------------------------------------------ main
def build_passages():
    plants = json.loads((DATA / "plants.json").read_text(encoding="utf-8"))
    sites = json.loads((DATA / "sites.json").read_text(encoding="utf-8"))
    passages = (
        [plant_passage(p) for p in plants]
        + [site_passage(s) for s in sites]
        + guide_passages(GUIDE_MD)
        + faq_passages(FAQ_MD)
    )
    for p in passages:
        p["words"] = words(p["text"])
    return passages


def report(passages):
    by_type = {}
    for p in passages:
        by_type.setdefault(p["source_type"], []).append(p["words"])
    print("Passages per source:")
    for t in ("plant", "site", "guide", "faq"):
        w = by_type.get(t, [])
        if w:
            print(f"  {t:6s} {len(w):4d}   words min {min(w)}, mean {sum(w) / len(w):.0f}, max {max(w)}")
        else:
            print(f"  {t:6s}    0")
    print(f"  total  {len(passages):4d}")
    outside = [p for p in passages if not MIN_WORDS <= p["words"] <= MAX_WORDS]
    for p in outside:
        print(f"  note: {p['id']} has {p['words']} words (target {MIN_WORDS}-{MAX_WORDS}): {p['title']}")


def embed_and_index(passages):
    import faiss  # noqa: E402  (imported here so --passages-only works without them)
    import numpy as np
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(MODEL_NAME)
    # Passages are embedded as-is (BGE's query instruction is only for queries, see rag_worker.py).
    texts = [f"{p['title']}. {p['text']}" for p in passages]
    vectors = model.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=False)
    vectors = np.asarray(vectors, dtype="float32")
    index = faiss.IndexFlatIP(vectors.shape[1])
    index.add(vectors)
    faiss.write_index(index, str(INDEX_OUT))
    return vectors.shape[1]


def main():
    passages = build_passages()
    KNOWLEDGE.mkdir(parents=True, exist_ok=True)
    with PASSAGES_OUT.open("w", encoding="utf-8") as f:
        for p in passages:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    report(passages)
    print(f"Wrote {PASSAGES_OUT.relative_to(BACKEND)}")
    if "--passages-only" in sys.argv:
        return
    dim = embed_and_index(passages)
    counts = {}
    for p in passages:
        counts[p["source_type"]] = counts.get(p["source_type"], 0) + 1
    META_OUT.write_text(json.dumps({
        "model": MODEL_NAME,
        "dimension": dim,
        "metric": "inner product on normalized vectors (cosine similarity)",
        "passages": len(passages),
        "by_source": counts,
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }, indent=1), encoding="utf-8")
    print(f"Wrote {INDEX_OUT.relative_to(BACKEND)} ({len(passages)} vectors, dimension {dim}) and {META_OUT.relative_to(BACKEND)}")


if __name__ == "__main__":
    main()
