# Local Open-Source Model and Fine-Tuning Plan

Flow Pilot can run without paid model APIs by pointing the app at a downloaded open-weight model served through an OpenAI-compatible local endpoint such as Ollama, vLLM, LM Studio, or Text Generation Inference.

## Recommended base model

Use **Qwen3 8B Instruct** as the default local model for this project profile:

- small enough for local development with quantization;
- strong structured-output behavior for email classification and JSON extraction;
- practical LoRA/QLoRA fine-tuning target for order extraction, feedback taxonomy, and SKU alias resolution;
- can be served locally through Ollama for demos or through vLLM/TGI for production GPU hosting.

Larger open-weight models such as Qwen3 14B/32B, Llama 4 Scout/Maverick, Mistral, DeepSeek, or Gemma can be evaluated later, but they need more VRAM and a license review before production use.

## Local inference setup

Example with Ollama:

```bash
ollama pull qwen3:8b
ollama serve
```

Configure the Next.js app:

```bash
AI_PROVIDER=local
LOCAL_LLM_BASE_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=qwen3:8b
LOCAL_CLASSIFICATION_MODEL=qwen3:8b
LOCAL_EXTRACTION_MODEL=qwen3:8b
LOCAL_CHAT_MODEL=qwen3:8b
```

Any OpenAI-compatible server can be used by changing `LOCAL_LLM_BASE_URL` and model names.

## What to fine-tune

Do **not** fine-tune a generic chatbot first. Fine-tune narrow adapters where Flow Pilot has clear labels and measurable quality targets:

1. **Email intent classification**: `new_order`, `update_order`, `feedback`, `other`.
2. **Order extraction**: email body -> validated order JSON.
3. **Feedback taxonomy**: review -> sentiment, issue category, urgency.
4. **SKU alias resolution**: raw product text -> canonical SKU.

## Dataset format

Create JSONL files under `ml/fine-tuning/datasets/`:

```jsonl
{"messages":[{"role":"system","content":"Classify Flow Pilot commerce emails."},{"role":"user","content":"...email..."},{"role":"assistant","content":"new_order"}]}
{"messages":[{"role":"system","content":"Extract Flow Pilot order JSON."},{"role":"user","content":"...email..."},{"role":"assistant","content":"{\"name\":\"Asha Rao\",\"phone\":\"...\",\"products\":[{\"name\":\"USB Cable\",\"quantity\":2}],\"date\":\"2026-06-12\",\"time\":\"14:30\"}"}]}
```

## Fine-tuning command pattern

Use LoRA/QLoRA with Unsloth, Axolotl, or TRL. Keep the exact framework out of app runtime so the web app remains portable.

Example high-level command pattern:

```bash
python -m axolotl.cli.train ml/fine-tuning/qwen3-flow-pilot-lora.yml
```

After training, serve the adapter merged or loaded on top of the base model through an OpenAI-compatible server and point `LOCAL_*_MODEL` to that served model name.

## Acceptance gates before using the fine-tuned model

- Email classification macro F1 >= 0.90.
- New-order false negative rate < 2%.
- Order extraction field-level F1 >= 0.95 for required fields.
- Invalid JSON rate < 0.5%.
- Hallucinated SKU/product rate < 1%.
- p95 local inference latency meets the demo/production SLO.

If a fine-tuned adapter misses those gates, keep using the base local model plus validation and human review.
