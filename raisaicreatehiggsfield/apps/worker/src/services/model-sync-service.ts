import { AppError, MODEL_STATUSES, newId, type Capability, type ModelCategory, type ModelDefinition } from "@raisai/shared";
import { DISCOVERED_MODELS } from "@raisai/seed-models";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { ModelRepository } from "../repositories/models";
import { translateCatalogPricing, type CatalogRate } from "./catalog-pricing";

/** One entry as Cloudflare's catalog returns it. Fields are read defensively. */
interface CatalogEntry {
  id?: string;
  name?: string;
  description?: string;
  task?: { name?: string; id?: string } | string;
  properties?: { property_id?: string; value?: unknown }[];
  tags?: string[];
}

export interface ImportResult {
  added: number;
  describedAgain: number;
  untouched: number;
  total: number;
}

export interface SyncResult {
  discovered: number;
  updated: number;
  unchanged: number;
  /** Models whose provider rate was written or refreshed from the catalog. */
  priced: number;
  /** Models the catalog prices in a way this platform cannot yet estimate. */
  pricingSkipped: { modelId: string; reason: string }[];
  missingFromCatalog: string[];
  /** Populated when credentials are absent, so the admin sees why nothing ran. */
  skippedReason?: string;
}

const TASK_TO_CATEGORY: Record<string, ModelCategory> = {
  "text-to-image": "image",
  "image-to-image": "image",
  "text-to-video": "video",
  "image-to-video": "video",
  "text-generation": "text",
  "summarization": "text",
  "translation": "text",
  "image-to-text": "vision",
  "text-to-speech": "audio",
  "automatic-speech-recognition": "audio",
  "text-embeddings": "embedding",
};

const TASK_TO_CAPABILITIES: Record<string, Capability[]> = {
  "text-to-image": ["text-to-image"],
  "image-to-image": ["image-to-image", "image-input"],
  "text-to-video": ["text-to-video"],
  "image-to-video": ["image-to-video", "image-input"],
  "text-generation": ["text-generation"],
  "image-to-text": ["vision", "image-input", "text-generation"],
  "text-to-speech": ["text-to-speech", "audio-output"],
  "automatic-speech-recognition": ["speech-to-text"],
  "text-embeddings": ["embedding"],
};

/**
 * Keeps the model registry aware of Cloudflare's catalog (§125).
 *
 * Sync only ever writes `discovered` rows. Nothing it finds becomes usable, or
 * billable, until an admin configures its capabilities and pricing and enables
 * it. That is deliberate: the catalog gives a task name, not a verified price
 * or parameter schema, and a customer must never be charged against a guess.
 */
export class ModelSyncService {
  constructor(private readonly env: Pick<Env, "DB"> & Partial<Pick<Env, "CLOUDFLARE_ACCOUNT_ID" | "CLOUDFLARE_API_TOKEN">>) {}

  async sync(options: { fetchImpl?: typeof fetch } = {}): Promise<SyncResult> {
    const accountId = this.env.CLOUDFLARE_ACCOUNT_ID;
    const token = this.env.CLOUDFLARE_API_TOKEN;
    const empty: SyncResult = { discovered: 0, updated: 0, unchanged: 0, priced: 0, pricingSkipped: [], missingFromCatalog: [] };

    if (!accountId || !token) {
      return {
        ...empty,
        skippedReason:
          "Catalog sync needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN. Set them as secrets to enable it.",
      };
    }

    const entries = await this.fetchCatalog(accountId, token, options.fetchImpl ?? fetch);
    const repo = new ModelRepository(this.env);
    const known = await repo.list({});
    const knownIds = new Set(known.map((m) => m.id));

    let discovered = 0;
    let updated = 0;
    let unchanged = 0;
    let priced = 0;
    const pricingSkipped: SyncResult["pricingSkipped"] = [];
    const seen = new Set<string>();

    for (const entry of entries) {
      const id = entry.name ?? entry.id;
      if (!id) continue;
      seen.add(id);

      const task = normalizeTask(entry.task);
      const existing = known.find((m) => m.id === id);

      // After the model row exists: the pricing row points at it.
      const price = async () => {
        const outcome = await this.applyCatalogPrice(id, entry, existing?.category ?? TASK_TO_CATEGORY[task]);
        if (outcome === "written") priced += 1;
        else if (outcome !== "unchanged" && outcome !== "none") pricingSkipped.push({ modelId: id, reason: outcome });
      };

      if (!existing) {
        await repo.upsert({
          id,
          provider: "cloudflare",
          hosting: id.startsWith("@cf/") ? "workers-ai" : "third-party",
          displayName: prettyName(id),
          description: entry.description ?? "",
          category: TASK_TO_CATEGORY[task] ?? "utility",
          task,
          // Suggestions only. An admin confirms them against the model's docs.
          capabilities: TASK_TO_CAPABILITIES[task] ?? [],
          inputs: {},
          outputs: {},
          parameters: [],
          limits: {},
          status: "discovered",
          tags: [],
          docUrl: `https://developers.cloudflare.com/workers-ai/models/${id.split("/").pop()}/`,
          version: "1",
          sortOrder: 1000,
        });
        discovered += 1;
        await price();
        continue;
      }

      await price();
      // A description change is worth recording; capabilities and pricing are
      // an admin's decision and are never overwritten by sync.
      if ((entry.description ?? "") !== existing.description) {
        await this.env.DB
          .prepare(`UPDATE models SET description = ?, updated_at = ? WHERE id = ?`)
          .bind(entry.description ?? "", nowIso(), id)
          .run();
        updated += 1;
      } else {
        unchanged += 1;
      }
    }

    // Flagged, never auto-deprecated: a catalog blip must not disable a model
    // that customers are using.
    const missingFromCatalog = [...knownIds].filter(
      (id) => !seen.has(id) && known.find((m) => m.id === id)?.hosting === "workers-ai",
    );

    return { discovered, updated, unchanged, priced, pricingSkipped, missingFromCatalog };
  }

  /**
   * Writes the provider rate the catalog publishes for a model (§72, §125).
   *
   * The rate is what Cloudflare will actually bill us, read from the account
   * rather than typed, which is the only way two hundred models get priced at
   * all and the only way a price stays current. Two rules keep it honest:
   *
   * - A rate an admin entered by hand is never overwritten. Only rows this
   *   sync wrote (source "cloudflare-api") are refreshed when the rate moves.
   * - Each refresh is a new row, never an edit, so every historical charge
   *   still points at the rate that was in force when it happened.
   *
   * Markup, minimum charge and rounding stay whatever the previous row for the
   * model used, or the defaults for a first row. Those are the admin's
   * decisions, not the provider's.
   */
  private async applyCatalogPrice(
    modelId: string,
    entry: CatalogEntry,
    category: string | undefined,
  ): Promise<"written" | "unchanged" | "none" | string> {
    const property = entry.properties?.find((p) => p.property_id === "price");
    // Cloudflare serialises the rate list as a JSON string inside the
    // property value; accept either that or an already-parsed array.
    let rates: CatalogRate[] | null = null;
    if (Array.isArray(property?.value)) rates = property.value as CatalogRate[];
    else if (typeof property?.value === "string") {
      try {
        const parsed = JSON.parse(property.value) as unknown;
        rates = Array.isArray(parsed) ? (parsed as CatalogRate[]) : null;
      } catch {
        return `Rate not understood: ${property.value.slice(0, 60)}`;
      }
    }
    if (!rates || rates.length === 0) return "none";

    const translated = translateCatalogPricing(rates, category);
    if (!translated.ok) return translated.reason;

    const current = await this.env.DB
      .prepare(
        `SELECT unit, provider_price_json, markup_percent, minimum_charge_sen, rounding_sen, fx_rate_usd_myr
           FROM model_pricing WHERE model_id = ? ORDER BY effective_from DESC, id DESC LIMIT 1`,
      )
      .bind(modelId)
      .first<{
        unit: string; provider_price_json: string; markup_percent: number;
        minimum_charge_sen: number; rounding_sen: number; fx_rate_usd_myr: number;
      }>();

    const stored = { ...translated.pricing.providerUsd, source: "cloudflare-api", verifiedOn: nowIso().slice(0, 10) };

    if (current) {
      const previous = JSON.parse(current.provider_price_json) as Record<string, unknown>;
      if (previous.source !== "cloudflare-api") return "unchanged"; // an admin's rate stands
      const same =
        current.unit === translated.pricing.unit &&
        Object.entries(translated.pricing.providerUsd).every(([k, v]) => previous[k] === v) &&
        Object.keys(previous).filter((k) => k !== "source" && k !== "verifiedOn").length ===
          Object.keys(translated.pricing.providerUsd).length;
      if (same) return "unchanged";
    }

    await this.env.DB
      .prepare(
        `INSERT INTO model_pricing (id, model_id, effective_from, unit, provider_price_json,
            markup_percent, minimum_charge_sen, rounding_sen, fx_rate_usd_myr, currency)
         VALUES (?,?,?,?,?,?,?,?,?, 'MYR')`,
      )
      .bind(
        newId(), modelId, nowIso(), translated.pricing.unit, JSON.stringify(stored),
        current?.markup_percent ?? 20, current?.minimum_charge_sen ?? 1,
        current?.rounding_sen ?? 1, current?.fx_rate_usd_myr ?? 4.7,
      )
      .run();
    return "written";
  }

  /**
   * Loads Cloudflare's published catalog from the copy in docs/ (§7, §125).
   *
   * The same rules as a live sync, and for the same reason: everything arrives
   * `discovered`, a model already in the registry is never downgraded or
   * re-shaped, and no price is invented. What this buys is that an admin can
   * see and configure the whole catalog without account credentials.
   */
  async importDocumented(models: ModelDefinition[] = DISCOVERED_MODELS): Promise<ImportResult> {
    const repo = new ModelRepository(this.env);
    const known = await repo.list({ statuses: [...MODEL_STATUSES] });
    const byId = new Map(known.map((m) => [m.id, m]));

    let added = 0;
    let describedAgain = 0;
    let untouched = 0;

    for (const model of models) {
      const existing = byId.get(model.id);
      if (!existing) {
        await repo.upsert(model);
        added += 1;
        continue;
      }

      // An existing row may have been priced, tested and enabled, or hand
      // written with real parameters and a description written for customers.
      // The catalog copy is a scrape, so it only ever fills a blank; it never
      // replaces what someone wrote.
      if (model.description && existing.description.trim() === "") {
        await this.env.DB
          .prepare(`UPDATE models SET description = ?, updated_at = ? WHERE id = ?`)
          .bind(model.description, nowIso(), model.id)
          .run();
        describedAgain += 1;
      } else {
        untouched += 1;
      }
    }

    return { added, describedAgain, untouched, total: models.length };
  }

  private async fetchCatalog(accountId: string, token: string, fetchImpl: typeof fetch): Promise<CatalogEntry[]> {
    const entries: CatalogEntry[] = [];
    const perPage = 100;

    for (let page = 1; page <= 10; page++) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?per_page=${perPage}&page=${page}`;
      const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });

      if (!response.ok) {
        throw new AppError("provider_error", `The model catalog could not be read (HTTP ${response.status}).`, {
          action: "Check that the API token has Workers AI read permission.",
        });
      }
      const body = (await response.json()) as { success?: boolean; result?: CatalogEntry[]; errors?: unknown };
      if (body.success === false) {
        throw new AppError("provider_error", "Cloudflare rejected the catalog request.", {
          details: { errors: body.errors },
        });
      }
      const page_entries = body.result ?? [];
      entries.push(...page_entries);
      if (page_entries.length < perPage) break;
    }
    return entries;
  }
}

/** "Text Generation" and "text-generation" both arrive; normalise to our vocabulary. */
function normalizeTask(task: CatalogEntry["task"]): string {
  const raw = typeof task === "string" ? task : (task?.name ?? task?.id ?? "");
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

function prettyName(id: string): string {
  const last = id.split("/").pop() ?? id;
  return last
    .split(/[-_]/)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}
