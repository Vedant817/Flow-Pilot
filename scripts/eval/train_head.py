"""Train a frozen-encoder logistic-regression head (deployable in Node).
Embeddings: sentence-transformers all-MiniLM-L6-v2 (same weights as Xenova q8 runtime).
Input form: subject + '\\n' + lightly cleaned body (mirrors lib/nlp/preprocess).
Exports scripts/eval/head.json -> copied to lib/nlp/setfit-head.json for the app.
Writes scripts/eval/preds/lrhead.json"""
import json, os, re
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression

BASE = os.path.dirname(os.path.abspath(__file__))
DS = json.load(open(os.path.join(BASE, "dataset.json"), encoding="utf-8"))["emails"]
LABELS = ["new_order", "update_order", "feedback", "other"]


def clean(body):
    lines = (body or "").replace("\r", "").split("\n")
    kept = []
    for ln in lines:
        if ln.lstrip().startswith(">"):
            continue
        if kept and len(kept) > 2 and re.match(r"^\s*(On .{0,300}wrote:|ffentliche|-{2,}\s*(Original|Forwarded) Message|_{8,}|From:\s.+)$", ln, re.I):
            break
        kept.append(ln)
    return "\n".join(kept)


def text(e):
    return (e["subject"] + "\n" + clean(e["body"]))[:1200]


def is_train(e):
    return int(e["id"].split("-")[1]) <= 8


print("loading encoder...", flush=True)
enc = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
X = enc.encode([text(e) for e in DS], normalize_embeddings=True)
y = np.array([LABELS.index(e["expected"]) for e in DS])
tr = np.array([is_train(e) for e in DS])

clf = LogisticRegression(C=1.0, max_iter=2000, random_state=42)
clf.fit(X[tr], y[tr])

probs = clf.predict_proba(X)
pred = probs.argmax(axis=1)
conf = probs.max(axis=1)

# tune 'other'-fallback threshold on train only
best_thr, best_acc = 0.0, -1.0
for thr in [i / 100 for i in range(0, 95, 5)]:
    p = np.where(conf >= thr, pred, LABELS.index("other"))
    acc = (p[tr] == y[tr]).mean()
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

head = {
    "classes": LABELS,
    "threshold": round(float(best_thr), 3),
    "coef": clf.coef_.tolist(),
    "intercept": clf.intercept_.tolist(),
    "trained_on": "scripts/eval/dataset.json train-8/class, frozen all-MiniLM-L6-v2",
}
json.dump(head, open(os.path.join(BASE, "head.json"), "w"), indent=1)
out = {e["id"]: {"pred": LABELS[int(final[k])], "ms": 0} for k, e in enumerate(DS)}
json.dump(out, open(os.path.join(BASE, "preds", "lrhead.json"), "w"), indent=1)
print("wrote head.json + preds/lrhead.json", flush=True)
