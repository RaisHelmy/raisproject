import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Options } from "./types.ts";
import { hostOf, log } from "./util.ts";
import { prepareChromeProfile, chromeUserDataDir } from "./profile.ts";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const sh = promisify(exec);

async function chromeIsRunning(): Promise<boolean> {
  const cmd =
    process.platform === "win32"
      ? 'tasklist /FI "IMAGENAME eq chrome.exe"'
      // Match the process NAME, never the full command line: -f would also match the shell
      // running this very check, so the guard would always claim Chrome was running.
      : 'pgrep -x "Google Chrome" || pgrep -x chrome || pgrep -x google-chrome || true';
  const { stdout } = await sh(cmd).catch(() => ({ stdout: "" }));
  return /\d/.test(stdout.trim());
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/**
 * A browsing session. Three shapes behind one interface:
 *  - default    : bundled Chromium, one fresh context per worker
 *  - --chrome   : real Chrome on a copy of the user's profile (their logins), one shared context
 *  - --cdp      : attach to an already-running Chrome, one shared context
 * Shared modes reuse a single context so the pages share cookies, which is the point.
 */
export interface Session {
  readonly shared: boolean;
  context(i: number): Promise<BrowserContext>;
  isAlive(): boolean;
  restart(): Promise<void>;
  close(): Promise<void>;
  preparePage(page: Page): Promise<void>;
}

async function makeContext(browser: Browser, opts: Options): Promise<BrowserContext> {
  const storageState = opts.storageState && existsSync(opts.storageState) ? opts.storageState : undefined;
  if (opts.storageState && !storageState) log(`storage state not found, continuing logged-out: ${opts.storageState}`);
  const ctx = await browser.newContext({
    viewport: opts.viewport,
    deviceScaleFactor: 1,
    storageState,
    userAgent: UA,
    locale: "en-US",
    ignoreHTTPSErrors: true,
  });
  ctx.setDefaultTimeout(opts.timeoutMs);
  ctx.setDefaultNavigationTimeout(opts.timeoutMs);
  return ctx;
}

function tune(ctx: BrowserContext, opts: Options) {
  ctx.setDefaultTimeout(opts.timeoutMs);
  ctx.setDefaultNavigationTimeout(opts.timeoutMs);
  return ctx;
}

/** One shared context (CDP or persistent profile): pages must set their own viewport. */
function sharedSession(get: () => BrowserContext, closeAll: () => Promise<void>, alive: () => boolean, opts: Options): Session {
  return {
    shared: true,
    async context() {
      return get();
    },
    isAlive: alive,
    async restart() {
      throw new Error("session died and cannot be restarted in shared mode; re-run the command");
    },
    close: closeAll,
    async preparePage(page: Page) {
      await page.setViewportSize(opts.viewport).catch(() => {});
    },
  };
}

export async function openSession(opts: Options, workers: number, targetUrl?: string): Promise<Session> {
  // Attach to a Chrome the user already started with --remote-debugging-port.
  if (opts.cdp) {
    log(`attaching to Chrome at ${opts.cdp}`);
    let browser: Browser;
    try {
      browser = await chromium.connectOverCDP(opts.cdp);
    } catch (e) {
      throw new Error(
        `Could not attach to Chrome at ${opts.cdp}: ${(e as Error).message.split("\n")[0]}\n` +
          `Chrome 136+ ignores --remote-debugging-port when it runs on your default profile, so the port never opens.\n` +
          `Use --chrome instead (real Chrome on a copy of your profile, no restart needed), or start a debug Chrome with its own profile:\n` +
          `  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$HOME/chrome-debug"`,
      );
    }
    const ctx = tune(browser.contexts()[0] ?? (await browser.newContext()), opts);
    return sharedSession(
      () => ctx,
      async () => {
        // Never close the user's own browser; just drop the connection.
        await browser.close().catch(() => {});
      },
      () => browser.isConnected(),
      opts,
    );
  }

  // Real Chrome with the user's own profile: their logins apply.
  if (opts.chromeProfile) {
    const host = targetUrl ? hostOf(targetUrl) : "";
    let dir: string;
    if (opts.liveProfile) {
      // In place: identical profile path, so Chrome decrypts its own cookies exactly as it normally does.
      const src = chromeUserDataDir();
      if (!src) throw new Error("Could not find a Chrome user data directory on this machine");
      if (await chromeIsRunning()) {
        throw new Error(
          "Chrome is running, and --chrome-live needs exclusive use of your real profile.\n" +
            "Quit Chrome (Cmd-Q) and re-run, or drop --chrome-live to work from a copy instead.",
        );
      }
      dir = src;
      log(`using your live Chrome profile at ${src} (Chrome must stay closed during the run)`);
    } else {
      dir = path.resolve(opts.profileDir);
      log(`preparing Chrome profile copy in ${opts.profileDir} (session data only, no passwords)`);
      await prepareChromeProfile(dir, opts.chromeProfile, host, opts.freshProfile);
    }
    const ctx = await chromium.launchPersistentContext(dir, {
      channel: "chrome", // must be real Chrome: it owns the Keychain key that decrypts the cookies
      headless: !opts.headed,
      viewport: opts.viewport,
      ignoreHTTPSErrors: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
        ...(opts.liveProfile && opts.chromeProfile !== "Default" ? [`--profile-directory=${opts.chromeProfile}`] : []),
      ],
    });
    tune(ctx, opts);
    return sharedSession(
      () => ctx,
      async () => {
        await ctx.close().catch(() => {});
      },
      () => true,
      opts,
    );
  }

  // Default: bundled Chromium, an isolated context per worker.
  let browser = await chromium.launch({ headless: !opts.headed, args: ["--disable-blink-features=AutomationControlled"] });
  let contexts = await Promise.all(Array.from({ length: workers }, () => makeContext(browser, opts)));
  return {
    shared: false,
    async context(i: number) {
      return contexts[i % contexts.length];
    },
    isAlive: () => browser.isConnected(),
    async restart() {
      log("browser disconnected — relaunching");
      await browser.close().catch(() => {});
      browser = await chromium.launch({ headless: !opts.headed, args: ["--disable-blink-features=AutomationControlled"] });
      contexts = await Promise.all(Array.from({ length: workers }, () => makeContext(browser, opts)));
    },
    async close() {
      await browser.close().catch(() => {});
    },
    async preparePage() {},
  };
}

/** Best-effort: dismiss cookie banners / modals that would cover screenshots. */
export async function dismissOverlays(page: Page) {
  const labels = [/accept all/i, /^accept$/i, /agree/i, /got it/i, /i understand/i, /allow all/i, /^ok$/i, /close/i];
  for (const re of labels) {
    try {
      const btn = page.getByRole("button", { name: re }).first();
      if (await btn.isVisible({ timeout: 150 })) {
        await btn.click({ timeout: 800 });
        return;
      }
    } catch {}
  }
}
