# Cloudflare AI — Verified Knowledge (checked 2026-09-05)

Source of truth: https://developers.cloudflare.com/workers-ai/ and
https://developers.cloudflare.com/ai/models/ . Re-verify before relying on any
number below; pricing and catalog change often.

## Two catalogs, one call surface

| Catalog | Model id format | Hosted by | Billing | Count (Aug 2026) |
| --- | --- | --- | --- | --- |
| Workers AI | `@cf/author/model` | Cloudflare GPUs | Neurons ($0.011 / 1,000) or AI Gateway credits | 81 |
| Unified catalog (third-party via AI Gateway) | `author/model` (e.g. `vidu/q3-pro`) | OpenAI, Google, Runway, Vidu, PixVerse, ByteDance, Alibaba, xAI, Pruna, … | AI Gateway **Unified Billing** (prepaid credits) | 218 |

Both are called the same way:

- Worker binding: `env.AI.run(modelId, input)`
- REST: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run`
  with body `{ "model": "...", "input": { ... } }` and a token holding
  **Account → Workers AI → Read**. Third-party models route through the account's
  default gateway; add header `cf-aig-gateway-id` to pick a gateway. Workers AI
  models through a gateway also need that header.
- OpenAI-compatible `/ai/v1/chat/completions` and `/ai/v1/responses` exist for LLMs.
  `/ai/v1/messages` (Anthropic schema) does **not** accept `@cf/` models.

Implication for RaisAI: one `CloudflareAIProvider` can cover both catalogs. The
registry tracks `hosting: "workers-ai" | "third-party"` and `billingUnit` per
model. Do not build a second provider for video.

## Critical capability facts

- **Workers AI has NO video generation models.** All text-to-video and
  image-to-video (Veo 3.1, Runway Gen-4.5, Vidu Q3, PixVerse v6, Seedance 2.x,
  HappyHorse, Wan, Hailuo, LTX, Grok Imagine Video, Pruna P-Video) are
  third-party via the unified catalog. Music generation is also third-party.
- Third-party video calls can return `state: "Completed"` with a hosted
  `result.video` URL (Vidu example). Some models are async. The provider must
  handle both sync results and polling, and must copy output into R2 promptly
  (provider URLs expire).
- Third-party image models exist too (FLUX.2 pro/flex, Seedream, Recraft,
  gpt-image-2, nano-banana, Krea, Qwen-Image, Pruna P-Image / edit / upscale / try-on).
- Some Workers AI models require a paid billing method (kimi-k2.6, kimi-k2.7-code,
  glm-5.2/5.3, deepseek-v4-*).

## Workers AI catalog by task (Aug 2026 snapshot, ids without `@cf/` prefix)

- Text-to-Image: flux-1-schnell, flux-2-dev, flux-2-klein-4b, flux-2-klein-9b,
  lucid-origin, phoenix-1.0, dreamshaper-8-lcm, stable-diffusion-xl-base-1.0,
  stable-diffusion-xl-lightning, stable-diffusion-v1-5-img2img,
  stable-diffusion-v1-5-inpainting. (flux-2-klein-9b unifies generation + editing.)
- Image-to-Text / Vision: llava-1.5-7b-hf, moondream3.1-9B-A2B, uform-gen2-qwen-500m,
  llama-3.2-11b-vision-instruct, llama-4-scout-17b-16e-instruct, qwen3.8-27b,
  kimi-k2.5/2.6, glm-5.3-flash.
- Text generation (LLM): llama-3.x/4, gemma-3/4, qwen3.x, qwq-32b, deepseek-v4-*,
  gpt-oss-20b/120b, kimi-k2.x, glm-5.x, mistral-small-3.1, nemotron-3-120b, etc.
  JSON mode (`response_format`) supported; tool calling on many.
- Speech-to-Text: whisper, whisper-large-v3-turbo, whisper-tiny-en, nova-3,
  flux (Deepgram, WebSocket streaming).
- Text-to-Speech: melotts, aura-1, aura-2-en, aura-2-es.
- Embeddings: bge-small/base/large-en-v1.5, bge-m3, embeddinggemma-300m,
  qwen3-embedding-0.6b, plamo-embedding-1b.
- Other: bge-reranker-base, distilbert-sst-2-int8, resnet-50, detr-resnet-50,
  m2m100-1.2b, indictrans2, bart-large-cnn, smart-turn-v2, llama-guard-3-8b.

## Pricing shapes (drive `pricing.unit` in the registry)

| Shape | Example | Estimation input |
| --- | --- | --- |
| per 512×512 tile + per step | flux-1-schnell: $0.0000528/tile + $0.0001056/step | width, height, steps |
| per input tile per step + per output tile per step | flux-2-dev | in/out size, steps |
| per megapixel tiered | flux-2-klein-9b: $0.015 first MP, $0.002/MP after, $0.002/input MP | width, height, ref images |
| per M input / output tokens | LLMs | prompt tokens (estimate), max_tokens |
| per audio minute | whisper $0.0005/min, melotts $0.0002/min | audio duration / est. speech length |
| per 1k characters | aura-1 $0.015/1k chars | text length |
| per video (duration × resolution) | third-party video, priced in dashboard | duration, resolution |

Neurons: $0.011 per 1,000. 10,000 free per day per account (irrelevant to
customer pricing; treat as admin margin only).

## Asynchronous inference (verified 2026-09-05)

Long or capacity-constrained work goes through Cloudflare's async queue rather
than a synchronous call:

1. Submit with the `queueRequest: true` option; the response carries `request_id`.
2. Poll by calling the same model with `{ request_id }`.
3. While pending the result has `status: "queued"` or `"running"`; otherwise it
   is the finished result.

Event notifications (`cf.workersAi.model.batch.{queued,succeeded,failed}`) can
replace polling once queue subscriptions are wired.

Third-party models signal progress differently: their response carries a
`state` field, `Completed` when done. RaisAI treats a `request_id` with no
output as queued and a non-completed `state` as running, so the UI can say
which is true.

## Model metadata / discovery

- Per-model docs pages expose input/output JSON schema.
- REST `GET /accounts/{account_id}/ai/models/search` lists Workers AI models with
  task, name, description and (for most) schema; `?task=`, `?search=`,
  `?per_page=` filters. Verify the exact response shape when implementing the
  sync job (task 1.4.3). Third-party catalog metadata is on docs pages / dashboard;
  seed those by hand-curated JSON until an API is confirmed.
- Registry lifecycle from CLAUDE.md §125 applies: discovered → configured →
  enabled → deprecated. Sync only ever writes `discovered`.

## Execution and orchestration primitives

- **Cloudflare Workflows**: durable `step.do()` (30 min max per step, per-step
  retries with backoff, `ctx.attempt`), `step.sleep()`, `step.waitForEvent()`.
  Vitest integration can mock steps, disable sleeps, force timeouts. Good fit
  for one WorkflowRun = one Workflow instance (see ADR-003).
- **Queues**: fan-out, webhook delivery, thumbnail jobs, catalog sync.
- **Durable Objects**: only for per-run live status fan-out (WebSocket/SSE hub)
  if polling proves insufficient. Not for the engine itself.
- **AI Gateway**: logging, caching, rate limits, guardrails; Unified Billing
  credits are how third-party models get paid. Keep one gateway id in config.
- **R2**: all binaries. **D1**: metadata. **KV**: optional cache for model
  catalog and public template listings.

## Limits to remember

- Workers AI rate limits are per model/account; frontier models get higher
  limits with prepaid credits.
- Worker request CPU/time limits mean long generations must be async (queue or
  Workflow), never awaited inside an HTTP handler beyond a few seconds.
