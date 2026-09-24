import type { AIProvider, ChangePlan, CommandIntent } from "./provider";
import { IMPACT_ORDER } from "./provider";
import type { ChangeImpact, ImpactComponent } from "../types";

/**
 * Deterministic "AI" used in Demo mode. Produces realistic plans from keywords so the whole
 * Change Journey works without any external model. Clearly labelled DEMO in the UI.
 */
export class DemoPlanner implements AIProvider {
  readonly kind = "DEMO" as const;
  readonly model = "demo-planner-1";

  async planChange(intent: string, context: { applications: { slug: string; name: string; runtime: string }[] }): Promise<ChangePlan> {
    const t = intent.toLowerCase();
    const has = (...words: string[]) => words.some((w) => t.includes(w));
    const affected = new Set<ImpactComponent>();
    if (has("upload", "form", "page", "ui", "screen", "portal", "redesign", "button", "dashboard", "frontend", "react")) affected.add("Frontend");
    if (has("api", "endpoint", "service", "backend", "upload", "gateway", "integration", "auth", "login", "report", "notification", "email", "webhook", "search")) affected.add("Backend");
    if (has("upload", "store", "table", "column", "migration", "database", "record", "history", "audit", "index", "schema", "profile", "search")) affected.add("Database");
    if (has("upload", "document", "file", "image", "attachment", "storage", "pdf", "photo")) affected.add("File Storage");
    if (has("server", "vm", "docker", "nginx", "ssl", "dns", "infrastructure", "scale", "cluster", "proxmox", "kubernetes", "cache", "redis")) affected.add("Infrastructure");
    if (has("gateway", "third-party", "external", "provider", "stripe", "payment", "sms", "webhook", "oauth", "sso")) affected.add("External API");
    if (has("mobile", "android", "ios", "app store", "push")) affected.add("Mobile");
    if (affected.size === 0) { affected.add("Backend"); affected.add("Frontend"); }
    const impacts: ChangeImpact[] = IMPACT_ORDER.map((c) => ({ component: c, status: affected.has(c) ? "AFFECTED" : c === "Mobile" && affected.has("Frontend") ? "REVIEW" : "NO_CHANGE" }));

    const app = context.applications.find((a) => t.includes(a.slug.split("-")[0]) || t.includes(a.name.toLowerCase().split(" ")[0])) ?? context.applications[0];
    const isDeploy = has("deploy", "release", "ship", "roll out");
    const production = has("production", "prod", "live");
    const versionMatch = intent.match(/v?(\d+\.\d+(\.\d+)?)/i);
    const subject = intent.replace(/^(add|create|build|implement|deploy|release|upgrade|redesign|make|allow|enable)\s+/i, "").replace(/\.$/, "");
    const title = capitalize(isDeploy && app ? `${app.name} ${versionMatch ? "v" + versionMatch[1] : "release"}` : subject.length > 60 ? subject.slice(0, 57) + "…" : subject);

    const requirements = isDeploy
      ? ["Zero-downtime rolling deployment", "Health checks pass on all nodes", "Smoke tests pass after deployment", "Rollback available within 5 minutes", "Deployment recorded as evidence"]
      : dedupe([
        affected.has("Frontend") ? "User-facing UI is responsive and accessible (WCAG AA)" : null,
        affected.has("Backend") ? "API endpoints are versioned, validated and rate-limited" : null,
        affected.has("Database") ? "Schema migration is reversible and tested on staging" : null,
        affected.has("File Storage") ? "Files are virus-scanned, size-limited (10 MB) and stored in object storage" : null,
        affected.has("External API") ? "External calls have timeouts, retries and circuit breaking" : null,
        affected.has("Infrastructure") ? "Capacity, monitoring and backups verified before cutover" : null,
        "All actions are audited", "Feature can be disabled via configuration flag",
      ]);
    const key = (app?.slug ?? "chg").split("-")[0].toUpperCase().slice(0, 3);
    const jira = isDeploy
      ? [{ key: `${key}-${rnd(400, 499)}`, type: "Task" as const, title: `Release ${title} to ${production ? "production" : "staging"}`, status: "To Do" }]
      : [{ key: `${key}-${rnd(400, 499)}`, type: "Epic" as const, title, status: "To Do" },
        ...(affected.has("Frontend") ? [{ key: `${key}-${rnd(500, 599)}`, type: "Story" as const, title: `${title}: UI`, status: "To Do" }] : []),
        ...(affected.has("Backend") ? [{ key: `${key}-${rnd(500, 599)}`, type: "Story" as const, title: `${title}: API`, status: "To Do" }] : []),
        ...(affected.has("Database") ? [{ key: `${key}-${rnd(600, 699)}`, type: "Task" as const, title: `${title}: migration`, status: "To Do" }] : []),
        { key: `${key}-${rnd(600, 699)}`, type: "Task" as const, title: `${title}: tests`, status: "To Do" }];

    return {
      title, description: isDeploy ? `Deploy ${title} to ${production ? "Production" : "Staging"} with health validation, self-healing and rollback.` : `${capitalize(intent.replace(/\.$/, ""))}. Affects ${[...affected].join(", ")}.`,
      requirements, impacts, jira,
      developmentTasks: dedupe([affected.has("Backend") ? "Implement API changes and validation" : null, affected.has("Frontend") ? "Implement UI and client integration" : null, affected.has("Database") ? "Write forward and rollback migrations" : null, affected.has("File Storage") ? "Configure object storage bucket and scanning" : null, affected.has("External API") ? "Integrate provider SDK with retry/timeout" : null, "Write unit and integration tests"]),
      testTasks: dedupe(["Unit tests", affected.has("Backend") ? "API contract tests" : null, affected.has("Frontend") ? "Browser tests" : null, affected.has("Database") ? "Migration test on staging" : null, "Smoke test on staging"]),
      deploymentRequirements: dedupe([affected.has("Database") ? "Database backup before migration" : null, "Docker image built and scanned", "Health endpoint responding", production ? "Production readiness ≥ required checks" : null]),
      approvalRequirements: production ? dedupe(["Production deployment: 1 approval (Organization Owner)", affected.has("Database") ? "Production database migration: 2 approvals (Security Admin + Organization Owner)" : null]) : ["Automatic (non-production)"],
      rollbackPlan: dedupe([`Redeploy previous ${app?.name ?? "application"} image`, affected.has("Database") ? "Run down-migration" : null, "Disable feature flag", "Verify health"]),
      suggestedApplicationSlug: app?.slug, suggestedVersion: versionMatch ? "v" + versionMatch[1] : undefined,
      targetEnvironmentKind: production ? "PRODUCTION" : has("staging") ? "STAGING" : isDeploy ? "STAGING" : "PRODUCTION",
      confidence: 0.82,
    };
  }

  async interpretCommand(text: string): Promise<CommandIntent> {
    const t = text.toLowerCase().trim();
    const has = (...w: string[]) => w.some((x) => t.includes(x));
    if (has("pending approval", "show approvals", "approvals")) return { kind: "SHOW", target: "APPROVALS" };
    if (has("blocking", "blocked", "blocker")) return { kind: "SHOW", target: "BLOCKERS" };
    if (has("optimize ai", "ai calls", "optimization", "too many ai")) return { kind: "SHOW", target: "OPTIMIZATION" };
    if (has("report")) return { kind: "SHOW", target: "REPORT" };
    if (has("agents", "agent health")) return { kind: "SHOW", target: "AGENTS" };
    if (has("incident")) return { kind: "SHOW", target: "INCIDENTS" };
    if (has("check all servers", "server health", "system health", "check servers", "health")) return { kind: "HEALTH_CHECK" };
    if (has("why is", "slow", "fix the", "fix ", "failed docker", "failed container", "diagnose")) return { kind: "DIAGNOSE", subject: text };
    if (has("create a .net", "create .net", "dotnet project", ".net project")) return { kind: "CREATE_PROJECT", name: (text.match(/(?:called|named)\s+([\w-]+)/i)?.[1] ?? "new-service"), architecture: has("cqrs") ? "CQRS" : has("vertical") ? "Vertical Slice" : has("minimal") ? "Minimal API" : "Clean Architecture" };
    if (has("deploy", "release", "roll out")) {
      const vm = text.match(/vm\s*(\d+)/i)?.[1];
      const version = text.match(/v?(\d+\.\d+(\.\d+)?)/i)?.[1];
      const slug = has("claims") ? "claims-portal" : has("payment") ? "payments-api" : has("customer") ? "customer-portal" : has("api") ? "payments-api" : undefined;
      return { kind: "DEPLOY", applicationSlug: slug, version: version ? "v" + version : undefined, environmentKind: has("production", "prod", "live") ? "PRODUCTION" : has("dev") ? "DEVELOPMENT" : "STAGING", targetVm: vm };
    }
    if (has("show changes", "my changes", "active changes")) return { kind: "SHOW", target: "CHANGES" };
    if (has("deployments")) return { kind: "SHOW", target: "DEPLOYMENTS" };
    if (has("tasks")) return { kind: "SHOW", target: "TASKS" };
    if (has("add ", "create ", "build ", "implement ", "upgrade ", "redesign ", "allow ", "enable ", "change ", "migrate ", "improve ", "make ")) return { kind: "CREATE_CHANGE", intent: text };
    return { kind: "UNKNOWN", text };
  }

  async diagnose(input: { error: string; taskType: string; context: string[] }) {
    const e = input.error.toLowerCase();
    if (e.includes("peer dependency") || e.includes("npm err")) return { diagnosis: "Dependency mismatch in lockfile vs. base image.", recoveryPlan: ["Clear build cache", "Pin peer dependency", "Rebuild image"] };
    if (e.includes("503") || e.includes("warming")) return { diagnosis: "Container exceeded the health-check window during warm-up.", recoveryPlan: ["Restart container", "Wait for warm-up", "Re-run health check"] };
    if (e.includes(".net")) return { diagnosis: "SDK version drift between project and Agent.", recoveryPlan: ["Install required SDK", "Re-run check"] };
    return { diagnosis: "Unknown failure — collected logs and metrics for review.", recoveryPlan: ["Retry once", "Rollback if still failing", "Escalate"] };
  }
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function dedupe<T>(list: (T | null)[]): T[] { return [...new Set(list.filter((x): x is T => x !== null))]; }
let n = 0;
function rnd(min: number, max: number) { n += 7; return min + (n % (max - min)); }
