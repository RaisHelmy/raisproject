# rdsa — notes for AI operators

This tool is meant to be driven by Claude. Run from this directory with **node** (`node src/cli.ts …`). Do not execute it with `bun` directly: Bun's GC closes the pipe of any browser spawned after another browser was closed, and Playwright calls then hang (repro'd 2026-09-08).

## Commands (all print progress to stderr; add `--json` for stdout JSON)
- `node src/cli.ts scan <url>`       → discover menu/submenu links, writes scan.json + plan.json, prints the plan table
- `node src/cli.ts plan <scan.json>` → re-score with different flags without re-scanning
- `node src/cli.ts capture [plan.json|site] [--max-pages N] [--include re] [--exclude re]`
- `node src/cli.ts run <url>`        → everything; stdout = output dir
- `node src/cli.ts inspect <url>`    → JSON summary of nav structure (use when scan finds too few links)
- `node src/cli.ts latest [site]`    → newest output dir
- `node src/cli.ts login <url>`      → headed browser for manual login (needs a human; ask the user)
- auth modes: `login` (manual once, then headless forever — prefer this), `--chrome --chrome-live` (real profile in place, Chrome must be quit), `--chrome` (profile copy), `--cdp <url>` (attach to a debug Chrome).
  - macOS: BOTH `--chrome` and `--chrome --chrome-live` fail to carry a login. Chrome's cookies/tokens are encrypted with a login-Keychain key that a Playwright-launched Chrome cannot unlock; live mode logs `Failed to decrypt token` and hangs to the launch timeout. Verified 2026-09-08 in all four combinations. On macOS always steer the user to `login`. Do not re-debug this.
  - `--cdp` needs a Chrome started with BOTH `--remote-debugging-port` and a non-default `--user-data-dir`; Chrome 136+ ignores the port flag on the default profile. Check with `curl -s localhost:9222/json/version` first.
  - Do not read or copy raw cookie files to debug auth; that is correctly blocked. Judge login state from a screenshot or the page HTML instead.

## Reading results
- `<out>/plan.json`      — pages[] with score, priority, template, similarTo, reasons[]
- `<out>/manifest.json`  — pages[] with ok/error/status/timings/assetCount
- `<out>/pages/<id>/meta.json`, `page.html`, `screenshot.png` (view with Read), `links.json`
- `<out>/assets/<host>/…` — shared, deduped; `page.local.html` points at it with ../../assets

## Debugging playbook
1. Few/no links found → `inspect <url>`; check `bySource`. If nav is JS-rendered, raise `--settle`. If site needs auth, ask the user to run `login`.
2. Submenu missing → the trigger heuristic is in scan.ts `TRIGGERS` (aria-haspopup / nested ul / button inside nav). Add a selector there; use `--headed` to watch hover behaviour.
3. Wrong priority → adjust scoring in prioritize.ts; `reasons[]` in plan.json explains each score.
4. Blank/partial screenshot → raise `--settle` (lazy-loaded grids need scroll; not implemented yet).
5. Timeouts → `--timeout`, or `--no-assets` to isolate network from rendering.
6. Hangs with no browser process alive (`ps | grep headless_shell` empty) → the browser died; check you are on node, then rerun. Every page has a watchdog (`timeout+settle+asset-wait+30s`).
7. Never run `login` or anything requiring a human in non-interactive sessions; report instead.

## Conventions
- Typecheck: `bun run typecheck`. No test suite yet; validate with a real run on a small `--max-pages 5`.
- Output dirs are timestamped; never delete `out/` runs the user has not asked to remove.
- Do not add paid APIs or external services to this project.
