# ADR-002: One CloudflareAIProvider covering Workers AI and the AI Gateway unified catalog

**Status**: accepted (2026-09-05)

Workers AI has no video or music models; those exist only as third-party models
in Cloudflare's unified catalog, reachable through the same `env.AI.run()` /
`POST /ai/run` surface and paid via AI Gateway Unified Billing.

**Decision**: `CloudflareAIProvider` handles both; `ModelDefinition.hosting`
distinguishes them; the gateway id is a config value. No separate video provider.

**Consequences**: registry sync covers Workers AI automatically; third-party
models are seeded from curated JSON until a metadata API is confirmed. Provider
must support sync results, async job polling, and expiring output URLs (copy to R2).
