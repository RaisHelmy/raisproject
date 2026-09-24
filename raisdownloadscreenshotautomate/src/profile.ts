import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { log } from "./util.ts";

/** Where Chrome keeps its user data, per platform. */
export function chromeUserDataDir(): string | null {
  const home = os.homedir();
  const candidates =
    process.platform === "darwin"
      ? [path.join(home, "Library/Application Support/Google/Chrome")]
      : process.platform === "win32"
        ? [path.join(process.env.LOCALAPPDATA ?? path.join(home, "AppData/Local"), "Google/Chrome/User Data")]
        : [path.join(home, ".config/google-chrome"), path.join(home, ".config/chromium")];
  return candidates.find((c) => existsSync(c)) ?? null;
}

/**
 * Copy just enough of the user's Chrome profile to reuse their logged-in sessions.
 *
 * Session state only: cookies, local/session storage, preferences. It never copies
 * `Login Data` (saved passwords), `Web Data` (autofill and cards) or `History`.
 * IndexedDB is copied only for origins belonging to the site being captured, since
 * some apps keep their auth token there and the whole directory is often hundreds of MB.
 */
export async function prepareChromeProfile(dest: string, profile: string, host: string, fresh: boolean): Promise<string> {
  const src = chromeUserDataDir();
  if (!src) throw new Error("Could not find a Chrome user data directory on this machine");
  const srcProfile = path.join(src, profile);
  if (!existsSync(srcProfile)) {
    const available = (await readdir(src)).filter((d) => d === "Default" || d.startsWith("Profile "));
    throw new Error(`Chrome profile "${profile}" not found. Available: ${available.join(", ") || "none"}`);
  }

  if (fresh && existsSync(dest)) await rm(dest, { recursive: true, force: true });
  const destProfile = path.join(dest, "Default"); // always land in Default so Chrome opens it without a flag
  await mkdir(destProfile, { recursive: true });

  const copyInto = async (from: string, intoDir: string) => {
    if (!existsSync(from)) return false;
    await mkdir(intoDir, { recursive: true });
    await cp(from, path.join(intoDir, path.basename(from)), { recursive: true, force: true }).catch(() => {});
    return true;
  };

  // Top-level state: profile list and the os_crypt key wrapper.
  await copyInto(path.join(src, "Local State"), dest);

  // Cookies live at Default/Network/Cookies on modern Chrome, Default/Cookies on older builds.
  for (const f of ["Cookies", "Cookies-journal", "Cookies-wal", "Preferences", "Secure Preferences"]) {
    await copyInto(path.join(srcProfile, f), destProfile);
  }
  for (const f of ["Cookies", "Cookies-journal", "Cookies-wal"]) {
    await copyInto(path.join(srcProfile, "Network", f), path.join(destProfile, "Network"));
  }
  for (const d of ["Local Storage", "Session Storage"]) {
    await copyInto(path.join(srcProfile, d), destProfile);
  }

  // IndexedDB: only this host's origins (dirs are named like https_higgsfield.ai_0.indexeddb.leveldb).
  const idbSrc = path.join(srcProfile, "IndexedDB");
  if (existsSync(idbSrc)) {
    const bare = host.replace(/^www\./, "");
    const wanted = (await readdir(idbSrc).catch(() => [])).filter((d) => d.includes(bare));
    for (const d of wanted) await copyInto(path.join(idbSrc, d), path.join(destProfile, "IndexedDB"));
    if (wanted.length) log(`copied ${wanted.length} IndexedDB origin(s) for ${bare}`);
  }

  // A lock left by a previous run would stop Chrome from starting.
  for (const lock of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    await rm(path.join(dest, lock), { force: true, recursive: true }).catch(() => {});
  }
  return dest;
}
