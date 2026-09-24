# runforge-agent

The RunForge Agent runs on your Linux server and gives the control plane a
safe, authenticated way to manage it — without RunForge ever needing inbound
SSH access or exposing an administrative endpoint on your machine (spec §11).

## Install (production)

```bash
curl -fsSL https://install.runforge.dev | sh
```

This downloads the agent binary, registers it with your RunForge
organization using a one-time enrollment token, and installs it as a
`systemd` service (`runforge-agent.service`) that starts on boot.

## Architecture

```text
Browser / MCP client
        │
        ▼
   RunForge API  ──never inbound──▶  RunForge Agent (outbound only)
        │                                   │
   Command Policy                     ┌─────┴─────┐
   (allowlist + signature)            │           │
                                   Docker      System metrics
                                   Engine API   (/proc, os.loadavg)
```

Every command the control plane sends to the agent passes through:

```text
Authentication → Authorization → Validation → Command policy → Execution → Audit event
```

The agent **never** executes arbitrary shell strings from the browser or the
control plane — see [src/command-policy.ts](src/command-policy.ts) for the
fixed, typed allowlist. Extending the agent means adding a new case to that
allowlist, not opening a generic exec channel.

## Modules

- `identity.ts` — enrollment/registration with the control plane.
- `heartbeat.ts` — periodic outbound heartbeat carrying live metrics.
- `metrics.ts` — server metrics collection abstraction.
- `docker.ts` — Docker Engine API client (over the local UNIX socket).
- `command-policy.ts` — the allowlisted command pipeline described above.

## Local development

```bash
bun run dev
```

Registers against `RUNFORGE_PUBLIC_URL` (defaults to the local API at
`http://localhost:8787`), falling back to a simulated identity if the API
isn't running, then starts heartbeating every 10 seconds.
