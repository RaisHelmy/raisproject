# create.raishelmy.uk — task list

Gaps found while redesigning the landing page and the in-app menu to the
shape Higgsfield users know (2026-09-07), and what has been done about them
since. Nothing on the live landing page claims a feature that is not built.

Legend: **P1** blocks the "familiar to a Higgsfield user" goal · **P2**
strong value · **P3** nice to have. ✅ done · 🟡 mechanism built, needs the
owner's action · ⛔ blocked by the platform · ☐ open.

## Landing page

- ✅ **P1 Real showcase media — mechanism.** Admin → Library → open an
      asset → "Feature on landing page" (with an optional prompt and the
      studio row it belongs in). `GET /api/v1/public/showcase` (no auth)
      lists featured assets; `/` reads it and puts real generations ahead of
      the prompt posters in the matching row. Images and videos both render.
- 🟡 **P1 Real showcase media — content.** Nothing is featured yet because
      featuring needs real generations and every generation is billed. When
      you have outputs you like, feature them; the page updates within 5 min
      (cache).
- ✅ **P2 Video tiles** — a featured video plays muted/looped in its tile.
- ✅ **P2 Public `/pricing`** — per-studio and per-model typical prices
      from the live estimate endpoint (`/api/v1/public/pricing`), top-up
      amounts, and the estimate → reserve → charge explanation.
- ☐ **P3 Per-model landing pages** (`/models/<slug>`) with samples and a
      "Generate with this model" button.

## Studios (one-form pages)

- ✅ **P1 Quick-create pages for every studio.** `/create/studio/<preset>`
      builds a form from the preset's ports: prompt/text, image(s), mask,
      video, audio. Auto-picks the best enabled model (or lets you choose;
      controls follow the model). Estimate before, exact charge after. Runs
      go through the same hidden-workflow path as Quick Create, so they show
      in History and can be opened on the canvas. Also added an `ai.text`
      ("Write") preset so text has a studio like everything else.
- ✅ **P1 Mask painter** for Inpaint — paint over the chosen image, brush
      size, erase, clear; the mask is exported at the image's pixel size and
      uploaded as an asset.
- ✅ **P2 Start & end frame picker** — when the chosen model declares
      `start-end-frame`, the picker takes exactly two numbered images.
- ✅ Video and audio input nodes (`input.video`, `input.audio`) for the
      canvas and templates.
- 🟡 Studios whose models are not enabled yet (Edit image, Upscale, all
      Video, Music) show a clear "no enabled model yet" notice with a link
      to Admin → Models. Enabling is per model and costs one test run.
- ⛔ **P2 Lipsync / talking avatar** — no Cloudflare model for it yet.
- ⛔ **P2 Background removal** — no segmentation model in Workers AI; the
      Images binding cannot do it.
- ⛔ **P2 Video compose / audio mix / transitions** — Workers cannot run
      ffmpeg; needs a small service on the VM. Blocks a real "export the
      timeline" in Movie mode.

## Apps (one-click templates)

- ✅ **P1 Curated app gallery.** 11 first-party public templates with typed
      inputs, all runnable on the models enabled today: Product shot,
      Poster, Headshot, Character sheet, Reframe for Reels (9:16), Subtitle
      a clip, Describe my product, Script to voice, Ad captions from a
      product photo, Logline & synopsis, Rewrite for social. Seeded via the
      API (`raisaicreatehiggsfield/scripts/seed-templates.py`, needs a logged-in cookie jar at `/tmp/rc.jar`; the templates live in
      the super-admin org, visibility public).
- ✅ **P2 Categories & tags** — Professional · Enhance & Style · Characters
      · Ads & Products · Video Editing · Voice & Audio · Trending, shown as
      chips only when they have templates.
- ✅ Typed inputs in the "Use" dialog: image/video/audio pick from the
      library or upload, enums become selects, numbers/booleans/text fields.
- 🟡 **Preview images on template cards** — `PUT /templates/:id/preview
      {assetId}` sets one; public previews are served without auth. Cards
      show a two-tone artwork until a preview is set. Needs real outputs.
- ☐ **P3 Marketing Studio / Shorts Studio** style guided multi-step apps.

## Community

- ✅ **P1 Public template gallery** — author name, usage count, price,
      Use / Remix on every card; "Community" in the sidebar lands here.
- ☐ **P2 Public generation feed & profiles** (opt-in sharing of a
      generation with its prompt/workflow, `/u/<handle>`, likes/remix count).
- ☐ **P3 Contests / film festival** banner and submission flow.

## Library

- ✅ **P2 Unified Library** — `/library` with Assets / History tabs and a
      Projects link; sidebar and phone bar point at it.
- ☐ **P3 Folders / collections** in the asset library.

## Models

- 🟡 **P1 Enable more models.** 226 in the catalog, 7 enabled. Per model:
      price (auto for Workers AI via live sync; manual for third-party) →
      one paid test run → enable. Owner's call; **no bulk testing**.
- ✅ **P2 Multipart request support** — the provider retries once with the
      same fields nested under `multipart` when Cloudflare rejects the shape
      (schema error, before any inference). Written for FLUX.2 Klein; not
      yet exercised against a live call because that would cost money.
- ☐ **P2 Third-party model pricing** — Cloudflare's API does not expose
      third-party rates; needs a checked-in rate table or a docs scrape.
- ☐ `@cf/bytedance/stable-diffusion-xl-lightning` returned a 500 from the
      worker on its one test call — check worker logs before enabling.

## Pricing / Account

- ✅ **P2 Public `/pricing` page** (see Landing).
- ☐ **P3 Team plan / shared balance** (organizations exist in the schema;
      no member/role UI).
- ☐ **P3 Public profile** (`/u/<handle>`).

## Housekeeping

- Local `vitest`/`wrangler dev` cannot reach Postgres (VM `pg_hba.conf`
  gap) — only pure unit tests run locally (web: 10 pass); everything else
  is verified against the deployed worker.
- Playwright e2e specs (`e2e/*.spec.ts`) predate the menu change and the
  Library page; re-run and update them once local dev works.
