import sys
import json
import joblib
import numpy as np


def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: predict.py <model_path> [--serve]\n")
        sys.exit(1)

    model_path = sys.argv[1]
    serve_mode = "--serve" in sys.argv[2:]
    model = joblib.load(model_path)

    if serve_mode:
        # Signal readiness to Node.js parent process
        sys.stdout.write(json.dumps({"ready": True}) + "\n")
        sys.stdout.flush()

        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
                rows = payload.get("rows", [])
                if not rows:
                    probs = []
                else:
                    X = np.asarray(rows, dtype=np.float32)
                    probs = [float(p) for p in model.predict_proba(X)[:, 1]]
                sys.stdout.write(json.dumps({"probabilities": probs}) + "\n")
                sys.stdout.flush()
            except Exception as exc:
                sys.stdout.write(json.dumps({"error": str(exc)}) + "\n")
                sys.stdout.flush()
    else:
        payload = json.load(sys.stdin)
        rows = payload.get("rows", [])
        if not rows:
            probs = []
        else:
            X = np.asarray(rows, dtype=np.float32)
            probs = [float(p) for p in model.predict_proba(X)[:, 1]]
        sys.stdout.write(json.dumps({"probabilities": probs}))


if __name__ == "__main__":
    main()

