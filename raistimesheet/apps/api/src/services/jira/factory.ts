import type { AppContext } from "../context";
import type { JiraClient, JiraUser } from "./client";
import { JiraCloudClient } from "./cloud";
import { DemoJiraClient, DEMO_ACCOUNT } from "./demo";
import { decryptString, encryptString } from "../../lib/crypto";
import { refreshToken } from "./oauth";
import { nowIso } from "../../lib/time";
import type { JiraConnectionRow } from "../../repositories/types";

export interface JiraHandle {
  client: JiraClient;
  demo: boolean;
  connection: JiraConnectionRow | null;
  reason: string;
}

/** Resolve the Jira client for this request: real Cloud client when connected, demo adapter otherwise. */
export async function getJiraClient(ctx: AppContext): Promise<JiraHandle> {
  const demoUsers = await demoUserList(ctx);
  if ((ctx.env.JIRA_MODE ?? "cloud").toLowerCase() === "demo") {
    return { client: new DemoJiraClient(ctx.repos.jira, ctx.repos.settings, demoUsers), demo: true, connection: null, reason: "JIRA_MODE=demo" };
  }
  const conn = await ctx.repos.jira.activeConnection();
  if (!conn) return { client: new DemoJiraClient(ctx.repos.jira, ctx.repos.settings, demoUsers), demo: true, connection: null, reason: "No Jira connection configured; demo mode active." };
  const secret = ctx.env.ENCRYPTION_KEY;
  if (!secret) return { client: new DemoJiraClient(ctx.repos.jira, ctx.repos.settings, demoUsers), demo: true, connection: conn, reason: "ENCRYPTION_KEY secret missing; cannot read stored credentials." };

  if (conn.auth_type === "API_TOKEN") {
    const token = await decryptString(conn.api_token_enc ?? "", secret);
    return { client: new JiraCloudClient({ type: "basic", site_url: conn.site_url, email: conn.account_email ?? "", api_token: token }, ctx.log), demo: false, connection: conn, reason: "API token connection." };
  }

  let access = await decryptString(conn.access_token_enc ?? "", secret);
  if (conn.token_expires_at && conn.token_expires_at <= nowIso() && conn.refresh_token_enc) {
    const refreshed = await refreshToken(ctx.env, await decryptString(conn.refresh_token_enc, secret));
    access = refreshed.access_token;
    await ctx.repos.jira.updateConnection(conn.id, {
      access_token_enc: await encryptString(refreshed.access_token, secret),
      refresh_token_enc: refreshed.refresh_token ? await encryptString(refreshed.refresh_token, secret) : conn.refresh_token_enc,
      token_expires_at: refreshed.expires_at,
      updated_at: nowIso(),
    });
    ctx.log.info("jira_token_refreshed");
  }
  return { client: new JiraCloudClient({ type: "oauth", cloud_id: conn.cloud_id ?? "", access_token: access, site_url: conn.site_url }, ctx.log), demo: false, connection: conn, reason: "OAuth connection." };
}

async function demoUserList(ctx: AppContext): Promise<JiraUser[]> {
  const users = await ctx.repos.users.list();
  const list: JiraUser[] = users.filter((u) => u.jira_account_id).map((u) => ({ account_id: u.jira_account_id!, display_name: u.name, email: u.email }));
  if (!list.some((u) => u.account_id === DEMO_ACCOUNT.account_id)) list.push(DEMO_ACCOUNT);
  return list;
}
