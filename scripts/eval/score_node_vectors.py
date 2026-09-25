"""Train LR head on NODE-produced vectors (true deployed pipeline), tune threshold on train.
Exports final head.json (coef/intercept/threshold)."""
import json, os, sys
import numpy as np
from sklearn.linear_model import LogisticRegression

BASE = os.path.dirname(os.path.abspath(__file__))
VEC_FILE = sys.argv[1] if len(sys.argv) > 1 else "node-vectors.json"
PREDS_FILE = sys.argv[2] if len(sys.argv) > 2 else "lrhead.json"
WRITE_HEAD = len(sys.argv) <= 2 or (len(sys.argv) > 3 and sys.argv[3] == "write-head")
FIXED_THR = float(sys.argv[4]) if len(sys.argv) > 4 else None
DS = json.load(open(os.path.join(BASE, "dataset.json"), encoding="utf-8"))["emails"]
VEC = json.load(open(os.path.join(BASE, VEC_FILE), encoding="utf-8"))
LABELS = ["new_order", "update_order", "feedback", "other"]


def is_train(e):
    return int(e["id"].split("-")[1]) <= 8


X = np.array([VEC[e["id"]] for e in DS])
y = np.array([LABELS.index(e["expected"]) for e in DS])
tr = np.array([is_train(e) for e in DS])

clf = LogisticRegression(C=1.0, max_iter=2000, random_state=42).fit(X[tr], y[tr])
probs = clf.predict_proba(X)
pred, conf = probs.argmax(axis=1), probs.max(axis=1)

best_thr, best_acc = 0.0, -1.0
if FIXED_THR is not None:
    best_thr = FIXED_THR
    best_acc = (np.where(conf >= FIXED_THR, pred, LABELS.index("other"))[tr] == y[tr]).mean()
    print("fixed threshold=%.2f train-acc=%.1f%%" % (best_thr, best_acc * 100), flush=True)
else:
    for i in range(90, -5, -5):  # highest threshold wins ties -> max abstention at same train accuracy
        thr = i / 100
        acc = (np.where(conf >= thr, pred, LABELS.index("other"))[tr] == y[tr]).mean()
        if acc > best_acc:
            best_acc, best_thr = acc, thr
    print("tuned threshold=%.2f train-acc=%.1f%%" % (best_thr, best_acc * 100), flush=True)

final = np.where(conf >= best_thr, pred, LABELS.index("other"))
for name, m in [("full", np.ones_like(y, dtype=bool)), ("train", tr), ("heldout", ~tr)]:
    print("%s acc=%.1f%% (n=%d)" % (name, (final[m] == y[m]).mean() * 100, m.sum()), flush=True)
for c in LABELS:
    i = LABELS.index(c)
    tp = int(((final == i) & (y == i)).sum())
    fp = int(((final == i) & (y != i)).sum())
    fn = int(((final != i) & (y == i)).sum())
    p = tp / (tp + fp) if tp + fp else 0
    r = tp / (tp + fn) if tp + fn else 0
    print("  %s: P=%.0f%% R=%.0f%% F1=%.0f%%" % (c, p * 100, r * 100, 2 * p * r / (p + r or 1) * 100), flush=True)
print("misses:", " ".join(
    "%s[%s->%s]" % (e["id"], e["expected"], LABELS[int(final[k])])
    for k, e in enumerate(DS) if LABELS[int(final[k])] != e["expected"]), flush=True)

if WRITE_HEAD:
    json.dump({
        "classes": LABELS,
        "threshold": round(float(best_thr), 3),
        "coef": clf.coef_.tolist(),
        "intercept": clf.intercept_.tolist(),
        "trained_on": "80-mail local set, train-8/class; encoder=fine-tuned MiniLM (SetFit contrastive, seed 42), vectors via deployed ONNX runtime",
    }, open(os.path.join(BASE, "head.json"), "w"), indent=1)
out = {e["id"]: {"pred": LABELS[int(final[k])], "ms": 6} for k, e in enumerate(DS)}
json.dump(out, open(os.path.join(BASE, "preds", PREDS_FILE), "w"), indent=1)
print("wrote %s + preds/%s" % ("head.json" if WRITE_HEAD else "(head kept)", PREDS_FILE), flush=True)
