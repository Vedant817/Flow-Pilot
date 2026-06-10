# Flow Pilot App

This directory contains the Next.js implementation for **Flow Pilot**, an AI operations copilot for commerce fulfillment teams.

For the full product analysis, architecture review, domain-specific edge cases, AI/model strategy, and production implementation roadmap, see the repository-level [`../README.md`](../README.md).

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` after the development server starts.

## Useful commands

```bash
npm run lint
npm run test
npm run build
npm run ai:smoke
```

## Important implementation notes

- Keep route handlers thin; place business logic in domain services and repositories as the project is refactored.
- Prefer relative `/api/...` calls for same-origin application APIs.
- Do not hardcode model names, localhost URLs, fake metrics, tenant IDs, product names as SKU identifiers, or raw AI responses.
- Use validated environment configuration before initializing MongoDB, Gmail, Clerk, or model providers.
- Keep `GMAIL_WEBHOOK_TOKEN` configured outside local throwaway demos so the public Gmail webhook rejects spoofed requests.
- Prefer `AI_PROVIDER=local` with a downloaded open-weight model served through Ollama/vLLM/LM Studio; configure `LOCAL_LLM_BASE_URL` and `LOCAL_*_MODEL` instead of editing business logic.
- Use `AI_PROVIDER=gemini` only as an optional fallback path, with Gemini model names configured via environment variables.
- Use RAG and tool calling before fine-tuning; fine-tune only task-specific extraction/classification adapters after labeled data and evaluation thresholds exist.
