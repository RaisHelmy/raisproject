import type { Db } from "../db/client";
import { ApiKeysRepo, EmailTokensRepo, OAuthRepo, RateLimitsRepo, SessionsRepo, UsersRepo } from "./identity";
import { ModelsRepo, ModesRepo, PlansRepo, PromptsRepo, ProvidersRepo } from "./catalog";
import { ConversationsRepo, MessageSourcesRepo, MessagesRepo } from "./chat";
import { CategoriesRepo, ChunksRepo, DocumentsRepo, FileUploadsRepo, KnowledgeBasesRepo } from "./knowledge";
import { AnalyticsRepo, AuditRepo, OrganizationsRepo, SettingsRepo, SubscriptionsRepo, UsageRepo } from "./platform";

export function createRepositories(db: Db) {
  return {
    db,
    users: new UsersRepo(db), sessions: new SessionsRepo(db), oauth: new OAuthRepo(db), emailTokens: new EmailTokensRepo(db), apiKeys: new ApiKeysRepo(db), rateLimits: new RateLimitsRepo(db),
    plans: new PlansRepo(db), providers: new ProvidersRepo(db), models: new ModelsRepo(db), modes: new ModesRepo(db), prompts: new PromptsRepo(db),
    conversations: new ConversationsRepo(db), messages: new MessagesRepo(db), messageSources: new MessageSourcesRepo(db),
    categories: new CategoriesRepo(db), knowledgeBases: new KnowledgeBasesRepo(db), documents: new DocumentsRepo(db), chunks: new ChunksRepo(db), uploads: new FileUploadsRepo(db),
    organizations: new OrganizationsRepo(db), subscriptions: new SubscriptionsRepo(db), usage: new UsageRepo(db), settings: new SettingsRepo(db), audit: new AuditRepo(db), analytics: new AnalyticsRepo(db),
  };
}
export type Repositories = ReturnType<typeof createRepositories>;
