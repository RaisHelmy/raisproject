/** Minimal fakes for unit tests (no database). */
import type { AppContext, AuthUser } from "../src/services/context";
import { Logger } from "../src/lib/logger";
import type { PlanRow, ModelRow, ModeRow } from "../src/repositories/types";

export const user = (o: Partial<AuthUser> = {}): AuthUser => ({ id: "u1", email: "a@b.c", name: "A", role: "user", locale: "en", auth_method: "session", org_ids: [], email_verified: true, ...o });

export const plan = (o: Partial<PlanRow> = {}): PlanRow => ({
  id: "p-free", code: "free", name: "Free", description: null, price_monthly: 0, currency: "USD", message_limit_daily: 30, knowledge_search_limit_daily: 20, context_window_tokens: 8000, max_upload_files_per_day: 0, max_conversations: 30,
  allow_file_upload: false, allow_advanced_modes: false, allow_premium_knowledge: false, allow_api_access: false, priority: 0, features: [], stripe_price_id: null, is_active: true, sort_order: 1, created_at: new Date(), updated_at: new Date(), ...o,
});
export const model = (o: Partial<ModelRow> = {}): ModelRow => ({
  id: "m1", provider_id: "pr1", name: "Basic", model_identifier: "basic", description: null, context_window: 32000, max_output_tokens: 1024, input_cost_per_million: 1, output_cost_per_million: 2, tier: "basic", supports_streaming: true, is_active: true, is_default: true, priority: 0,
  created_at: new Date(), updated_at: new Date(), provider_code: "workers_ai", provider_name: "Workers AI", provider_active: true, ...o,
});
export const mode = (o: Partial<ModeRow> = {}): ModeRow => ({ id: "mo1", code: "iching", name: "I Ching", name_zh: "易经", name_zh_tw: "易經", description: "", description_zh: "", description_zh_tw: "", icon: "", prompt_id: null, knowledge_filter: [], is_advanced: false, is_active: true, sort_order: 0, created_at: new Date(), updated_at: new Date(), ...o });

export function fakeCtx(repos: Record<string, unknown>, env: Record<string, unknown> = {}): AppContext {
  return { env: env as never, repos: repos as never, log: new Logger({}), correlationId: "test", user: null, ip: "127.0.0.1", enqueue: async () => undefined, waitUntil: () => undefined };
}
