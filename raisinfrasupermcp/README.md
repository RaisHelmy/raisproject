# Super MCP

**Autonomous Software Engineering & IT Operations Platform**
*Build it. Deploy it. Operate it. Fix it. Govern it.*

Super MCP is the control plane between AI and your engineering infrastructure. It turns natural-language
intent into a governed **Change Journey** — plan, Jira, git, CI, test, policy, approval, deploy, live
validation, UAT, close — then records what happened and converts repeated work into deterministic
automation so fewer AI calls are needed next time.

```
AI = BRAIN · Task Engine = HANDS · Agent = EXECUTION · Policy = IMMUNE SYSTEM
Telemetry = MEMORY · Optimization Engine = LEARNING LOOP
```

AI never touches infrastructure directly. Every action — from the web UI or from an MCP client —
goes through the same pipeline:

```
AI client → MCP → Authentication → Tenant isolation → Authorization → Policy → Risk
          → Approval → Task Engine → Agent → Infrastructure → Validation → Audit
```

---

## Quick start

```bash
bun install
bun run dev            # http://localhost:5173 — runs fully in the browser in DEMO mode
```

Sign in with any seeded demo user (password `demo1234`), or use the one-click buttons:

| User | Role | What their dashboard shows |
|---|---|---|
| ahmad@abc.example | Organization Owner | The pending production approval |
| sarah@abc.example | Security Admin | Policy, migration approval, audit |
| daniel@abc.example | DevOps + Developer | Active changes, escalated task |

Start at **Demo Lab** for the guided showcase.

### With the Cloudflare Worker

```bash
bun run build
bun run dev:worker     # http://localhost:8787 — REST API at /api, MCP at /mcp
bun run dev            # frontend proxies /api and /mcp to the worker
```

Open the app with `?mode=connected` to use the worker instead of the in-browser demo store.

### Deploy

```bash
wrangler d1 create super-mcp                 # put the id in wrangler.toml
bun run db:migrate                           # apply migrations/0001_init.sql
wrangler secret put SESSION_SECRET
bun run deploy                               # set DEMO_MODE = "false" in wrangler.toml first
```

## Verify

```bash
bun run typecheck   # tsc, no errors
bun test            # 62 tests: engines, services, demo lab, security
bun run build       # vite production build
```

---

## Architecture

```
src/
├── domain/                 pure TypeScript — no framework, no database coupling
│   ├── types.ts            the whole domain model
│   ├── permissions.ts      58 granular permissions, 9 default roles
│   ├── billing.ts          plans, limits, marketplace split, ROI (configuration, not logic)
│   ├── engines/            risk · policy · approval · task state machine · task engine
│   │                       change lifecycle · privacy filter · optimization
│   ├── services/           authorization + tenancy + audit on top of the engines
│   ├── repository/         DataStore abstraction + in-memory implementation
│   ├── ai/                 provider-neutral AIProvider; DemoPlanner for demo mode
│   ├── mcp/                27 high-level MCP tools + 7 resources
│   └── seed/               realistic demo data (ABC Sdn Bhd)
├── worker/                 Cloudflare Worker: D1 store, auth, REST API, MCP endpoint
├── services/api/           frontend boundary: DemoClient (browser) | HttpClient (worker)
├── components/ layouts/ pages/   React + Bootstrap 5 + Highcharts UI
└── styles/app.css          design tokens
```

The same domain code runs in the browser (demo mode), in the Worker, and in the tests. Swapping D1 for
PostgreSQL means reimplementing `src/worker/d1Store.ts` only — no SQL exists anywhere else.

### The engines

| Engine | Responsibility |
|---|---|
| **Risk** | Deterministic risk from task type + environment + destructiveness |
| **Policy** | Platform → Organization → Group → Environment → Resource inheritance; the most restrictive effect always wins |
| **Approval** | ANY / ALL / SEQUENTIAL / PARALLEL routing, separation of duties, typed confirmation |
| **Task Engine** | 12 versioned task definitions; discovery → preconditions → steps → validators → recovery → rollback |
| **Self-healing** | known recovery → retry → alternative → rollback → AI diagnosis → AI plan → approval → escalation |
| **Change lifecycle** | 12 stages, impact-driven checklists, readiness scoring, automatic transitions |
| **Privacy filter** | Secret and PII redaction before anything reaches telemetry, audit, export or AI |
| **Optimization** | Tool overuse, redundant calls, problem patterns, recommendations, heuristic efficiency score |

---

## What actually works

Demo mode is a working system, not a mock-up. End-to-end, verified by tests and browser runs:

- **Change Journey** — intent → AI plan (editable) → requirements → Jira → git events → CI → deployment
  preparation → policy → approval → deploy → live validation → UAT → close, with evidence and timeline
  collected at every stage.
- **Task Engine** — real state machine, real step execution, real recovery ladder. A production deployment
  fails its health check, applies a known recovery, retries, and succeeds; the rollback scenario rolls back,
  opens an incident, links Jira and notifies the owner.
- **Policy & approval** — production deployment needs 1 approval, production migration needs 2, VM deletion
  needs 2 plus typed confirmation. Execution is blocked while an approval is pending, from the UI *and* from MCP.
- **MCP server** — 27 high-level tools and 7 resources at `/mcp`, JSON-RPC 2.0 over Streamable HTTP,
  bearer-token identity mapped to user → organization → agent → resource.
- **Telemetry & optimization** — every AI run and MCP call recorded (metadata and decision summaries only,
  never chain-of-thought), with overuse detection, redundancy detection, problem patterns, knowledge records
  and optimization recommendations.
- **Tenancy & security** — tenant isolation, 58 permissions, audit with correlation ids, credential references
  only, agent quarantine and kill switch.

### Honest status labels

The UI never pretends. Every integration shows one of:

| Label | Meaning |
|---|---|
| `DEMO` | Backed by a mock adapter (MockAgent, MockGitHub, MockGitLab, MockJira, MockProxmox, MockDocker) |
| `CONNECTED` | A live integration |
| `NOT CONNECTED` | Configured but unreachable or not yet authorized |
| `COMING SOON` | Interface and configuration exist; the implementation is a later phase |

Phase 2 brings the real Agent binary, live Git provider adapters, Docker and Proxmox.
Phase 3 brings Jira, email, reports and the marketplace backend. Phase 4 brings SSO, SCIM and compliance.
Payment processing is mocked: plan changes record an invoice line but charge nothing.

---

## Connecting an AI client

Settings → **AI & MCP → Connected AI** issues a token and shows the config:

```json
{
  "mcpServers": {
    "super-mcp": {
      "url": "https://your-domain/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

Then ask your AI client to *"Deploy Claims Portal v2.8 to Production."* It will create a governed task and
report back that approval is required — it cannot deploy on its own.

## Demo scenario

**Demo Lab → Deploy Claims Portal v2.8 to Production**

1. The request creates a deployment task; the Policy Engine returns `WAITING_APPROVAL` (risk HIGH).
2. Pressing *Run scenario* first is refused — the approval gate is real.
3. Approve as the Organization Owner; the deployment unlocks.
4. The Task Engine runs 12 deterministic steps. The health check fails, a known recovery restarts the
   container, the retry succeeds, and production reports HEALTHY.
5. The summary shows 4 AI decisions, 12 task steps, 2 recovery actions and 8 AI calls avoided.

---

*The smarter Super MCP becomes, the less unnecessary AI reasoning it needs.*
