import json

ds = json.load(open("scripts/eval/dataset.json", encoding="utf-8"))["emails"]


def grp(e):
    s = e["style"]
    if s.startswith("edge"):
        return "edge"
    return s if s in ("formal", "semi", "casual") else "other-style"


print("sys        formal   semi  casual   edge")
for sys in ["baseline", "quickwins", "proto", "laya", "setfit"]:
    p = json.load(open("scripts/eval/preds/%s.json" % sys, encoding="utf-8"))
    cells = []
    for g in ["formal", "semi", "casual", "edge"]:
        rows = [e for e in ds if grp(e) == g]
        acc = sum(1 for e in rows if p[e["id"]]["pred"] == e["expected"]) / len(rows) * 100
        cells.append("%5.1f%% (n=%d)" % (acc, len(rows)))
    print("%-10s %s" % (sys, " ".join(cells)))

# laya confidence stats
lp = json.load(open("scripts/eval/preds/laya.json", encoding="utf-8"))
confs = [v.get("conf", 0) for v in lp.values()]
print("\nlaya confidence: min=%.3f max=%.3f mean=%.3f" % (min(confs), max(confs), sum(confs) / len(confs)))
