"""Retrain SetFit on train-32, save fine-tuned encoder, export transformer to ONNX.
Outputs: scripts/eval/st-model/ (sentence-transformers dir), scripts/eval/onnx-src/model.onnx"""
import json, os, shutil
import torch
from datasets import Dataset
from setfit import SetFitModel, SetFitTrainer

BASE = os.path.dirname(os.path.abspath(__file__))
DS = json.load(open(os.path.join(BASE, "dataset.json"), encoding="utf-8"))["emails"]
LABELS = ["new_order", "update_order", "feedback", "other"]


def text(e):
    return (e["subject"] + "\n" + e["body"])[:1200]


def is_train(e):
    return int(e["id"].split("-")[1]) <= 8


train = [e for e in DS if is_train(e)]
train_ds = Dataset.from_dict({
    "text": [text(e) for e in train],
    "label": [LABELS.index(e["expected"]) for e in train],
})

model = SetFitModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2", labels=LABELS)
trainer = SetFitTrainer(
    model=model, train_dataset=train_ds, metric="accuracy",
    column_mapping={"text": "text", "label": "label"},
    num_iterations=20, num_epochs=1, batch_size=16, seed=42,
)
trainer.train()
print("trained", flush=True)

# locate the SentenceTransformer body
st = None
for attr in ("model_body", "model", "sentence_transformer_model", "first_module"):
    cand = getattr(trainer.model, attr, None)
    if cand is not None and hasattr(cand, "encode"):
        st = cand
        print("encoder accessor:", attr, flush=True)
        break
if st is None:
    for a in dir(trainer.model):
        try:
            cand = getattr(trainer.model, a)
        except Exception:  # noqa: BLE001
            continue
        if hasattr(cand, "encode") and hasattr(cand, "save"):
            st = cand
            print("encoder accessor (scan):", a, flush=True)
            break
assert st is not None, "could not find SentenceTransformer body"

st_dir = os.path.join(BASE, "st-model")
shutil.rmtree(st_dir, ignore_errors=True)
st.save(st_dir)
print("saved", st_dir, sorted(os.listdir(st_dir)), flush=True)

# export transformer submodule to ONNX (direct load: transformers v5 hub check rejects Win paths)
tr_dir = st_dir  # sentence-transformers>=6 saves the transformer flat at root
print("st-model files:", sorted(os.listdir(tr_dir)), flush=True)
from transformers import BertModel, BertConfig
from safetensors.torch import load_file
from tokenizers import Tokenizer as FastTok

config = BertConfig.from_json_file(os.path.join(tr_dir, "config.json"))
bert = BertModel(config)
bert.load_state_dict(load_file(os.path.join(tr_dir, "model.safetensors")))
bert.eval()
ftok = FastTok.from_file(os.path.join(tr_dir, "tokenizer.json"))
ids = ftok.encode("hello world, this is an export probe").ids
input_ids = torch.tensor([ids], dtype=torch.long)
attention_mask = torch.ones_like(input_ids)
onnx_dir = os.path.join(BASE, "onnx-src")
os.makedirs(onnx_dir, exist_ok=True)
onnx_path = os.path.join(onnx_dir, "model.onnx")
with torch.no_grad():
    torch.onnx.export(
        bert,
        (input_ids, attention_mask),
        onnx_path,
        input_names=["input_ids", "attention_mask"],
        output_names=["last_hidden_state"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "seq"},
            "attention_mask": {0: "batch", 1: "seq"},
            "last_hidden_state": {0: "batch", 1: "seq"},
        },
        opset_version=14,
    )
print("exported", onnx_path, os.path.getsize(onnx_path) // 1024 // 1024, "MB", flush=True)
