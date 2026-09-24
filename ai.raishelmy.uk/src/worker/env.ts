export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  AI_GATEWAY_ID: string;
  CF_ACCOUNT_ID: string;   // account that owns the AI Gateway / Workers AI billing
  EDGE_SECRET?: string;    // if set, only requests carrying x-rais-edge: <secret> are accepted (the ai.raishelmy.uk proxy)
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

export const SSO_APP_ID = "ai";
export const ADMIN_EMAIL = "raishelmy97@gmail.com";
