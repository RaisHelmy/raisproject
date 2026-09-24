# Model Registry

Models are data (§7–9, §125, §154–155). Nothing in the UI or engine checks a
model id; everything keys off `capabilities`, `parameterSchema`, `limits`.

## ModelDefinition (packages/shared)
```ts
interface ModelDefinition {
  id: string; provider: 'cloudflare'; hosting: 'workers-ai'|'third-party'
  displayName: string; description: string; category: ModelCategory; task: TaskType
  capabilities: Capability[]
  inputs: Record<string, PortType>           // e.g. { prompt: 'prompt', image: 'image[]' }
  outputs: Record<string, PortType>          // e.g. { image: 'image' }
  parameters: ParameterDef[]                 // drives forms: {name, type:'number'|'enum'|'boolean'|'string'|'range', label, default, min, max, step, options, advanced:boolean, mapsTo}
  limits: { maxReferenceImages?: number; maxPromptChars?: number; durations?: number[]; resolutions?: string[]; aspectRatios?: string[]; maxTokens?: number }
  pricing: CustomerPricing                   // customer-facing only in public DTO
  status: 'discovered'|'configured'|'enabled'|'deprecated'
  tags: ('recommended'|'fast'|'quality'|'cheap'|'cinematic'|'experimental')[]
  docUrl?: string; version: string
}
```

Capability vocabulary (extend, never special-case):
`text-to-image`, `image-to-image`, `inpainting`, `upscale`, `text-to-video`,
`image-to-video`, `reference-to-video`, `text-generation`, `vision`,
`tool-calling`, `json-mode`, `text-to-speech`, `speech-to-text`, `music`,
`embedding`, `image-input`, `multiple-images`, `negative-prompt`, `seed`,
`steps`, `guidance`, `aspect-ratio`, `resolution`, `duration`, `audio-output`,
`start-end-frame`, `streaming`, `async-job`.

## Provider adapter contract
```ts
interface AIProvider {
  id: string
  listModels(): Promise<DiscoveredModel[]>            // raw catalog for sync
  getModel(id): Promise<DiscoveredModel | null>
  validateInput(model, input): ValidationResult
  estimateCost(model, input): ProviderCostEstimate     // provider units + micro-USD
  execute(model, input, ctx): Promise<ProviderJob>     // sync result or job handle
  getJob(handle): Promise<ProviderJob>
  cancelJob(handle): Promise<void>
}
```
`CloudflareAIProvider` maps RaisAI canonical inputs (`prompt`, `negative_prompt`,
`images[]`, `width/height` or `aspect_ratio`, `duration`, `seed`, `steps`, …)
to each model's schema using `parameters[].mapsTo`. Binary inputs are fetched
from R2 and sent as base64/bytes as the model requires; binary outputs are
written to R2 before the provider call returns.

## Sync lifecycle
1. Cron → `ModelSyncService.run()` → provider `listModels()`.
2. New ids inserted as `discovered` with schema snapshot; existing ids get
   `input_schema_json` diff recorded; ids missing from catalog flagged
   `deprecated_candidate` in admin.
3. Admin "configure": maps schema → capabilities/parameters (assisted by
   `packages/seed-models` heuristics: task → default capabilities), sets pricing
   and tags, tests one generation, then **enable**.
4. Customers only ever see `enabled`. Templates referencing a `deprecated` model
   show a compatibility warning and offer compatible models (§91).

## Selection UX inputs
`GET /api/v1/models?task=text-to-image&capability=image-input&group=recommended`
returns enabled models with customer estimate for a "typical" request so the
selector can show `RM0.18` next to each (§92). Groups map to `tags`. "All models"
removes the group filter. Favorites and recently-used come from
`model_favorites` / `model_usage_stats`.
