"""SetFit few-shot: train on first 8 ids per class, eval held-out + full set.
Writes scripts/eval/preds/setfit.json"""
import json, time, os
from datasets import Dataset
from setfit import SetFitModel, SetFitTrainer

BASE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(BASE, "dataset.json"), encoding="utf-8") as f:
    DS = json.load(f)["emails"]

LABELS = ["new_order", "update_order", "feedback", "other"]


def text(e):
    return f"{e['subject']}\n{e['body']}"


def is_train(e):
    return int(e["id"].split("-")[1]) <= 8


train = [e for e in DS if is_train(e)]
print(f"train size: {len(train)} ({len(train)//4}/class)", flush=True)

train_ds = Dataset.from_dict({
    "text": [text(e) for e in train],
    "label": [LABELS.index(e["expected"]) for e in train],
})

t0 = time.time()
model = SetFitModel.from_pretrained(
    "sentence-transformers/all-MiniLM-L6-v2",
    labels=LABELS,
    multilabel=False,
)
trainer = SetFitTrainer(
    model=model,
    train_dataset=train_ds,
    metric="accuracy",
    column_mapping={"text": "text", "label": "label"},
    num_iterations=20,
    num_epochs=1,
    batch_size=16,
    seed=42,
)
trainer.train()
print(f"setfit train time: {time.time() - t0:.1f}s", flush=True)

out, lats = {}, []
for e in DS:
    t = time.time()
    pred = model.predict([text(e)])[0]
    try:
        pred = str(pred[0]) if not isinstance(pred, str) else pred
    except Exception:  # noqa: BLE001
        pred = str(pred)
    dt = (time.time() - t) * 1000
    out[e["id"]] = {"pred": pred, "ms": round(dt, 1)}
    lats.append(dt)

lats.sort()
print(f"setfit warm avg={sum(lats)/len(lats):.1f}ms p50={lats[len(lats)//2]:.1f}ms")
with open(os.path.join(BASE, "preds", "setfit.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1)
