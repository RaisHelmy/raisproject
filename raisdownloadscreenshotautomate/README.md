# Rais Download Screenshot Automate (`rdsa`)

Point it at a site. It finds the main menu and every submenu, ranks the pages,
drops near-duplicates, then opens each page and — the moment the DOM is ready —
saves the HTML, a viewport screenshot, a full-page screenshot and every
stylesheet/script/font/image the page loaded.

Built with Node 25 (native TypeScript) + Playwright; Bun is used only as the package manager. No paid APIs. Everything is written as JSON so an
AI (Claude) can drive it, read the results, and fix it when a site trips it up.

## Quick start

```bash
bun install
bun run browsers                 # once: installs Chromium for Playwright
node src/cli.ts run https://higgsfield.ai      # or: bun run rdsa run <url>
open out/higgsfield.ai/<timestamp>/index.html
```

> Run the CLI with **node**, not `bun src/cli.ts`. Under Bun, a garbage
> collection after the first browser closes breaks the next browser's
> DevTools pipe (pages hang, then time out). Node 25 runs the `.ts` files
> directly; the `bun run <script>` aliases in package.json already call node.

## Pipeline

| step | command | output |
|---|---|---|
| 1. scan | `rdsa scan <url>` | `scan.json` — every internal link tagged `main-nav / sub-nav / sidebar / hero-cta / footer / body` (hovers & clicks nav items to open dropdowns) |
| 2. plan | `rdsa plan <url\|scan.json>` | `plan.json` — score per page, `high/medium/low/skip`, similar URL patterns collapsed (`similarTo`) |
| 3. capture | `rdsa capture [plan.json\|site]` | `pages/<id>/{page.html, page.local.html, screenshot.png, full.png, meta.json, links.json, assets.json}` + shared `assets/` |
| 4. report | (automatic) | `manifest.json`, `index.html` gallery |

`rdsa run <url>` does all four. `scan` already writes `plan.json`, so
`scan` → tweak flags → `capture` is the fast edit loop.

## How prioritising works

- Base score by where the link lives: main nav 100, sidebar 90, submenu 85,
  hero CTA 70, footer 35, anywhere else 20. Start page +50.
- Penalties: deep paths, legal pages, login/signup, query strings, no label.
- **Similarity:** URLs are reduced to a template (`/ai/image?model`,
  `/blog/:slug`, `/user/:uuid`). Only the first `--per-template` pages (default 1)
  of each template keep their score; the rest drop to 15 and record
  `similarTo` so you can see which page represents them. Folders with 6+
  siblings are also demoted.
- `high ≥ 70`, `medium ≥ 40`, `low > 0`, else `skip`. Capture takes
  `--min-priority` (default `medium`) up to `--max-pages` (default 40).

## Speed

Navigation returns at `DOMContentLoaded`; the page then gets at most
`--settle` ms (default 2500) to fire `load`/go network-idle. HTML, both
screenshots and the link dump are taken in parallel. Assets are captured from
the network responses the page already made (no second fetch), deduplicated
across pages in one shared `assets/` folder, capped by `--asset-budget` MB per
page, and video/`media` is skipped unless you pass `--asset-types ...,media`.

Higgsfield reference run: 207 links scanned in ~14 s, 40 pages captured in
~55 s with 4 workers (~150 MB incl. deduped assets).

## Logged-in sites

```bash
bun run rdsa login https://app.example.com     # log in by hand, press Enter
bun run rdsa run https://app.example.com       # picks up .auth/app.example.com.json
```

## Options

See `bun run rdsa --help`. Most useful: `--headed` (watch it),
`--depth 1` (also scan menus on each main-nav page), `--include/--exclude <regex>`,
`--per-template 2`, `--max-pages`, `--min-priority low`, `--settle 5000`
(for lazy-loading galleries), `--json` (machine output on stdout).

## Layout

```
src/cli.ts         commands & flags
src/scan.ts        link discovery + submenu hover/click
src/prioritize.ts  scoring + similarity collapse
src/capture.ts     per-page capture + shared asset store
src/report.ts      index.html
src/browser.ts     Chromium launch, storage state, overlay dismissal
out/<site>/<timestamp>/   one folder per run
.auth/<site>.json  saved login sessions (git-ignored)
```

## Using a logged-in session

Three ways, most reliable first.

**1. `login` (recommended, works headless afterwards)**

```bash
node src/cli.ts login https://higgsfield.ai   # log in by hand, press Enter
node src/cli.ts run https://higgsfield.ai     # reuses .auth/higgsfield.ai.json
```
One manual login. Your own Chrome is never touched, and every later run is headless.

**2. `--chrome --chrome-live` (your real Chrome profile, in place)** — *does not work on macOS, see below*

```bash
# quit Chrome first (Cmd-Q)
node src/cli.ts run https://higgsfield.ai --chrome --chrome-live
```
Drives real Chrome on your actual profile directory, so your logins apply exactly as
they do when you browse. Chrome must stay closed for the whole run; the tool refuses
to start otherwise.

**3. `--chrome` (a copy of your profile)**

```bash
node src/cli.ts run https://higgsfield.ai --chrome
```
Copies session data only (cookies, local/session storage, preferences, and the target
site's IndexedDB) into the git-ignored `.chrome-profile/`. Never copies saved passwords,
autofill or history, and runs alongside your open Chrome.

> **macOS limitation — both Chrome modes are unreliable here.** Chrome encrypts its
> cookies and tokens with a key in the login Keychain. A Chrome launched by Playwright
> cannot unlock that key, so sessions decrypt to nothing and the page renders logged out.
> Confirmed on 2026-09-08 against higgsfield.ai in all four combinations (copy and live
> profile, headless and headed); the live-profile launch logs
> `ERROR:token_service_table.cc: Failed to decrypt token` and then hangs until the
> launch timeout. **Use option 1 (`login`) on macOS.** The Chrome modes are kept because
> they work on Linux and Windows, where cookie encryption is not Keychain-gated.

### Why `--cdp` fails on modern Chrome

`open -a "Google Chrome" --args --remote-debugging-port=9222` does nothing useful:
`--args` is ignored when Chrome is already running, and since Chrome 136 the flag is
ignored entirely on the default profile. The port never opens. `--cdp` still works
against a debug Chrome started on its own profile:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 --user-data-dir="$HOME/chrome-debug"
node src/cli.ts run https://higgsfield.ai --cdp
```
That profile starts logged out, so sign in once inside it.
