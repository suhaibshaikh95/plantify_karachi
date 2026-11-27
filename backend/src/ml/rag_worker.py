"""
Retrieval worker for the Plantify Karachi chatbot (the "R" in RAG).

    python rag_worker.py <knowledge_dir> --serve

Loads the BGE-small embedding model and the FAISS index built by build_index.py once, then reads
one JSON request per line on stdin and writes one JSON response per line on stdout (the same
pattern as predict.py, so Node can keep it running).

Request:   {"question": "...", "k": 6, "plants": ["Azadirachta indica", ...], "site_id": 77}
Response:  {"passages": [{"id", "source_type", "title", "text", "scientific_name", "site_id",
                          "score", "similarity"}, ...]}
           or {"error": "..."}

`similarity` is the cosine similarity between the question and the passage. `score` adds a small
boost for passages about the user's own recommended plants and the user's own site. Results are
sorted by `score`. Passages that mention a plant named in the question get NAME_BOOST, so the
guide's paragraph about e.g. Conocarpus is found as well as the Conocarpus species passage.
At most MAX_PLANTS plant passages and MAX_OTHER_SITES passages about other sites are kept, so the
85 template-like plant passages and 104 site passages do not crowd out guide and FAQ passages.

(Roman Urdu: sawal ka embedding bana kar FAISS se sab se milte julte paragraphs dhoondta hai.)
"""
import json
import re
import sys
from pathlib import Path

MODEL_NAME = "BAAI/bge-small-en-v1.5"
# BGE v1.5 recommends this instruction for short queries that retrieve passages (passages are not prefixed).
QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "
PLANT_BOOST = 0.05   # passage about one of the user's current plants
SITE_BOOST = 0.05    # passage about the user's own reference site
NAME_BOOST = 0.06    # passage that mentions a plant named in the question (e.g. "gulmohar", "Conocarpus")
MAX_OTHER_SITES = 1  # at most this many passages about OTHER sites (104 similar site passages would crowd out answers)
MAX_PLANTS = 4       # at most this many plant passages, so guide and FAQ passages still get in
MAX_K = 20


def log(msg):
    sys.stderr.write(f"[rag_worker] {msg}\n")
    sys.stderr.flush()


def send(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


class Retriever:
    def __init__(self, knowledge_dir):
        import faiss
        from sentence_transformers import SentenceTransformer

        kdir = Path(knowledge_dir)
        self.passages = [json.loads(l) for l in (kdir / "passages.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        self.index = faiss.read_index(str(kdir / "index.faiss"))
        if self.index.ntotal != len(self.passages):
            raise RuntimeError(
                f"index.faiss has {self.index.ntotal} vectors but passages.jsonl has {len(self.passages)} lines; "
                "run `npm run build:knowledge` again"
            )
        try:
            # Use the cached model without contacting Hugging Face (fast, works offline)...
            self.model = SentenceTransformer(MODEL_NAME, local_files_only=True)
        except Exception:
            # ...and download it only the first time.
            log(f"downloading {MODEL_NAME} (first start only)")
            self.model = SentenceTransformer(MODEL_NAME)
        self.plant_names = self._plant_names()

    def _plant_names(self):
        """Lower-case names that identify a plant: scientific name, genus and each common-name part."""
        generic = {"tree", "trees", "palm", "shrub", "plant", "common", "true", "wild", "fig", "the", "etc"}
        names = set()
        for p in self.passages:
            if p["source_type"] != "plant":
                continue
            title = p["title"][len("Plant: "):]
            common = title[: title.rfind(" (")]
            names.add(p["scientific_name"].lower())
            names.add(p["scientific_name"].split()[0].lower())
            for part in re.split(r"[/(),]", common):
                part = part.strip().lower()
                if len(part) >= 3 and part not in generic:
                    names.add(part)
        return sorted(names, key=len, reverse=True)

    def names_in(self, question):
        q = " " + re.sub(r"[^a-z0-9 ]", " ", question.lower()) + " "
        return [n for n in self.plant_names if f" {n} " in q]

    def search(self, question, k=6, plants=None, site_id=None):
        import numpy as np

        k = max(1, min(int(k or 6), MAX_K))
        plants = set(plants or [])
        named = self.names_in(question)
        q = self.model.encode([QUERY_INSTRUCTION + question], normalize_embeddings=True)
        q = np.asarray(q, dtype="float32")
        # The index is small (a few hundred passages), so score all of them and re-rank with boosts.
        sims, ids = self.index.search(q, self.index.ntotal)
        results = []
        for sim, i in zip(sims[0].tolist(), ids[0].tolist()):
            if i < 0:
                continue
            p = self.passages[i]
            score = sim
            if p.get("scientific_name") and p["scientific_name"] in plants:
                score += PLANT_BOOST
            if site_id is not None and p.get("site_id") is not None and int(p["site_id"]) == int(site_id):
                score += SITE_BOOST
            if named:
                text = (p["title"] + " " + p["text"]).lower()
                if any(n in text for n in named):
                    score += NAME_BOOST
            results.append({
                "id": p["id"],
                "source_type": p["source_type"],
                "title": p["title"],
                "text": p["text"],
                "scientific_name": p.get("scientific_name"),
                "site_id": p.get("site_id"),
                "similarity": round(float(sim), 4),
                "score": round(float(score), 4),
            })
        results.sort(key=lambda r: r["score"], reverse=True)
        picked, other_sites, plant_count = [], 0, 0
        for r in results:
            if r["source_type"] == "site" and (site_id is None or int(r["site_id"]) != int(site_id)):
                if other_sites >= MAX_OTHER_SITES:
                    continue
                other_sites += 1
            if r["source_type"] == "plant":
                if plant_count >= MAX_PLANTS:
                    continue
                plant_count += 1
            picked.append(r)
            if len(picked) == k:
                break
        return picked


def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: rag_worker.py <knowledge_dir> [--serve]\n")
        sys.exit(1)
    knowledge_dir = sys.argv[1]
    serve = "--serve" in sys.argv[2:]

    try:
        retriever = Retriever(knowledge_dir)
    except Exception as exc:  # missing index, missing packages, model download failure...
        log(f"startup failed: {exc}")
        if serve:
            send({"ready": False, "error": str(exc)})
        sys.exit(2)

    if not serve:  # one-off: read a single request from stdin
        req = json.load(sys.stdin)
        send({"passages": retriever.search(req.get("question", ""), req.get("k"), req.get("plants"), req.get("site_id"))})
        return

    send({"ready": True, "passages": len(retriever.passages)})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            question = str(req.get("question") or "").strip()
            if not question:
                send({"passages": []})
                continue
            send({"passages": retriever.search(question, req.get("k"), req.get("plants"), req.get("site_id"))})
        except Exception as exc:
            send({"error": str(exc)})


if __name__ == "__main__":
    main()
