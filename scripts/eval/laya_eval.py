"""Laya zero-shot eval (ENGLISH checkpoint only) on the local email dataset.
Resumable: skips ids already present in preds/laya.json. Saves incrementally.
Writes scripts/eval/preds/laya.json"""
import json, time, os
import laya

BASE = os.path.dirname(os.path.abspath(__file__))
PREDS = os.path.join(BASE, "preds", "laya.json")
with open(os.path.join(BASE, "dataset.json"), encoding="utf-8") as f:
    DS = json.load(f)["emails"]

QUESTIONS = {
    "intent": {
        "type": "choice",
        "instructions": "What is the sender's intent in this email? Read subject and body.",
        "criteria": {
            "new_order": "placing a NEW purchase: quantities, items to buy, delivery date for a fresh order",
            "update_order": "changing an EXISTING order: cancel, amend quantity, reschedule, revise a previous order",
            "feedback": "review or opinion: complaint, compliment, quality issue, delivery experience, rating",
            "other": "none of the above: invites, newsletters, catalog requests, greetings, payments, spam, admin",
        },
    }
}

out = {}
if os.path.exists(PREDS):
    with open(PREDS, encoding="utf-8") as f:
        out = json.load(f)
print(f"resuming: {len(out)} already done", flush=True)

t0 = time.time()
agent = laya.load("convaiinnovations/laya")
print(f"laya load: {time.time() - t0:.1f}s", flush=True)

lats = []
for e in DS:
    if e["id"] in out:
        continue
    state = {"subject": e["subject"], "body": e["body"]}
    t = time.time()
    try:
        res = agent.predict(state, QUESTIONS)
        ans = res["answers"]["intent"]
        out[e["id"]] = {"pred": ans["choice"], "conf": round(float(ans.get("confidence", 0)), 4)}
    except Exception as ex:  # noqa: BLE001 - record failure, don't stop the run
        out[e["id"]] = {"pred": "__ERROR__", "conf": 0.0, "error": str(ex)[:200]}
    dt = (time.time() - t) * 1000
    out[e["id"]]["ms"] = round(dt, 1)
    lats.append(dt)
    with open(PREDS, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(f"{e['id']}: pred={out[e['id']]['pred']} conf={out[e['id']]['conf']} ({dt:.0f}ms)", flush=True)

if lats:
    lats.sort()
    print(f"laya warm avg={sum(lats)/len(lats):.0f}ms p50={lats[len(lats)//2]:.0f}ms")
print(f"done: {len(out)}/{len(DS)}")
