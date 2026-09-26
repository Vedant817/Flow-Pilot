"""Compare Laya prompts on a fixed 32-train / 48-held-out synthetic set.

Selection uses training examples only. No weights or production code are changed.
Run: scripts/eval/.venv/Scripts/python scripts/eval/laya_variants.py
"""
import json
import re
import time
from pathlib import Path

import laya

ROOT = Path(__file__).resolve().parent
emails = json.loads((ROOT / "dataset.json").read_text(encoding="utf-8"))["emails"]

original = {
    "intent": {"type": "choice", "instructions": "What is the sender's intent in this email? Read subject and body.",
               "criteria": {
                   "new_order": "placing a NEW purchase: quantities, items to buy, delivery date for a fresh order",
                   "update_order": "changing an EXISTING order: cancel, amend quantity, reschedule, revise a previous order",
                   "feedback": "review or opinion: complaint, compliment, quality issue, delivery experience, rating",
                   "other": "none of the above: invites, newsletters, catalog requests, greetings, payments, spam, admin"}}
}
targeted = {
    "intent": {"type": "choice", "instructions": "Which ONE action is requested now? Distinguish completed orders, edits, inquiries and reviews. Choose other if no explicit action or review.",
               "criteria": {
                   "new_order": "Commit to buying/dispatching goods NOW; fresh purchase or repeat purchase. Not a future intention or just asking a price.",
                   "update_order": "Edit an already placed order or delivery: cancel, reduce or replace items, revise quantities, change delivery time/date/address; hata do, badha do.",
                   "feedback": "Evaluate past service/products: praise, shukriya, badhiya, appreciation, complaint about received delivery or quality. No order change requested.",
                   "other": "Inquiry about rates/freight/catalog, future possible order, greeting, unrelated mail, or insufficient context such as 'as discussed please proceed'."}}
}

def clean(body):
    lines = []
    for line in body.replace("\r", "").split("\n"):
        if line.lstrip().startswith(">"):
            continue
        if lines and (re.match(r"\s*On .{0,300}wrote:\s*$", line, re.I) or
                      re.match(r"\s*-{2,}\s*(Original|Forwarded) Message", line, re.I)):
            break
        lines.append(line)
    return "\n".join(lines)

variants = {
    "original_raw": (original, lambda e: {"subject": e["subject"], "body": e["body"]}),
    "targeted_raw": (targeted, lambda e: {"subject": e["subject"], "body": e["body"]}),
    "targeted_clean": (targeted, lambda e: {"subject": e["subject"], "body": clean(e["body"])}),
}

print("Loading Laya English checkpoint...", flush=True)
agent = laya.load("convaiinnovations/laya")
results = {}
for name, (questions, state_fn) in variants.items():
    out = {}
    for e in emails:
        started = time.perf_counter()
        a = agent.predict(state_fn(e), questions)["answers"]["intent"]
        out[e["id"]] = {"pred": a["choice"], "ms": round(1000 * (time.perf_counter() - started), 1)}
    results[name] = out
    train = [e for e in emails if int(e["id"].split("-")[1]) <= 8]
    test = [e for e in emails if int(e["id"].split("-")[1]) > 8]
    for label, subset in [("train", train), ("heldout", test)]:
        correct = sum(out[e["id"]]["pred"] == e["expected"] for e in subset)
        print(f"{name} {label}: {correct}/{len(subset)} = {correct/len(subset):.1%}", flush=True)
    (ROOT / "preds" / f"laya_{name}.json").write_text(json.dumps(out, indent=1), encoding="utf-8")

baseline = json.loads((ROOT / "preds" / "baseline.json").read_text(encoding="utf-8"))
test = [e for e in emails if int(e["id"].split("-")[1]) > 8]
print("SetFit heldout:", sum(baseline[e["id"]]["pred"] == e["expected"] for e in test), "/", len(test))
