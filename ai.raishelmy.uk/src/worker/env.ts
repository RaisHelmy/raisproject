export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  AI_GATEWAY_ID: string;
  BUDGET_TIMEZONE: string;
  PUBLIC_BASE_URL: string;
  // secrets
  ADMIN_PASSWORD?: string;
  SAAS_SSO_SECRET?: string;
  SESSION_SECRET?: string;
  CLOUDFLARE_API_TOKEN?: string;
  AI_GATEWAY_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  [key: string]: unknown;
}

export const ACCOUNT_ID = "6af8ff18a864c2b56f1a3aa78cb24f80";
export const SSO_APP_ID = "ai";
export const ADMIN_EMAIL = "raishelmy97@gmail.com";
