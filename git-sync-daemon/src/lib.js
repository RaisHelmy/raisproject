'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HOME_DIR = path.join(os.homedir(), '.git-sync-daemon');
const CONFIG_PATH = path.join(HOME_DIR, 'config.json');
const LOG_PATH = path.join(HOME_DIR, 'daemon.log');

const DEFAULTS = {
  roots: [],
  intervalSec: 15,
  cooldownSec: 60,
  commitMessage: 'chore: auto-sync',
};

function ensureHomeDir() {
  fs.mkdirSync(HOME_DIR, { recursive: true });
}

function loadConfig() {
  ensureHomeDir();
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return { ...DEFAULTS, ...raw };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function saveConfig(cfg) {
  ensureHomeDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
}

function log(line) {
  ensureHomeDir();
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  try {
    fs.appendFileSync(LOG_PATH, stamped + '\n');
  } catch (e) {
    // logging is best-effort only
  }
}

function git(dir, gitArgs, timeoutMs = 30000) {
  return spawnSync('git', ['-C', dir, ...gitArgs], { encoding: 'utf8', timeout: timeoutMs });
}

function isGitRepo(dir) {
  const r = git(dir, ['rev-parse', '--is-inside-work-tree']);
  return r.status === 0 && r.stdout.trim() === 'true';
}

// Repos are discovered fresh on every tick so newly-added or newly-`git init`-ed
// project folders under a root are picked up without restarting the daemon.
function discoverRepos(roots) {
  const repos = new Set();
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    if (isGitRepo(root)) {
      repos.add(path.resolve(root));
      continue;
    }
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
      const full = path.join(root, ent.name);
      if (fs.existsSync(path.join(full, '.git'))) {
        repos.add(path.resolve(full));
      }
    }
  }
  return Array.from(repos);
}

function isMidOperation(dir) {
  for (const marker of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD']) {
    if (fs.existsSync(path.join(dir, '.git', marker))) return true;
  }
  return false;
}

function currentBranch(dir) {
  const r = git(dir, ['symbolic-ref', '--short', '-q', 'HEAD']);
  if (r.status !== 0) return null; // detached HEAD
  return r.stdout.trim();
}

function statusPorcelain(dir) {
  const r = git(dir, ['status', '--porcelain']);
  if (r.status !== 0) return null; // not a usable/valid repo right now
  return r.stdout;
}

function hasRemote(dir) {
  const r = git(dir, ['remote']);
  return r.status === 0 && r.stdout.trim().length > 0;
}

// Attempt add -> commit -> push. Any failure (no remote, no upstream, auth,
// network) is logged once per repo and swallowed so the daemon keeps running.
function syncRepo(dir, cfg, warned) {
  if (isMidOperation(dir)) return;

  const branch = currentBranch(dir);
  if (!branch) {
    warnOnce(warned, dir, 'detached', `skip ${dir}: detached HEAD, not syncing`);
    return;
  }

  const add = git(dir, ['add', '-A']);
  if (add.status !== 0) return;

  const message = `${cfg.commitMessage} ${new Date().toISOString()}`;
  const commit = git(dir, ['commit', '-m', message]);
  if (commit.status !== 0) return; // most likely nothing staged after all

  log(`committed changes in ${dir} (${branch})`);
  clearWarning(warned, dir, 'pushfail');

  if (!hasRemote(dir)) {
    warnOnce(warned, dir, 'noremote', `skip push for ${dir}: no git remote configured, ignoring`);
    return;
  }

  let push = git(dir, ['push']);
  if (push.status !== 0) {
    push = git(dir, ['push', '-u', 'origin', branch]);
  }
  if (push.status !== 0) {
    const reason = (push.stderr || push.error?.message || '').trim().split('\n')[0];
    warnOnce(warned, dir, 'pushfail', `push failed for ${dir}: ${reason || 'unknown error'} (ignoring, will keep retrying)`);
    return;
  }

  clearWarning(warned, dir, 'pushfail');
  log(`pushed ${dir} (${branch})`);
}

function warnOnce(warned, dir, key, message) {
  const full = `${dir}:${key}`;
  if (warned.has(full)) return;
  warned.add(full);
  log(message);
}

function clearWarning(warned, dir, key) {
  warned.delete(`${dir}:${key}`);
}

function runLoop(opts = {}) {
  const cfg = loadConfig();
  const intervalMs = (opts.interval != null ? opts.interval : cfg.intervalSec) * 1000;
  const cooldownMs = (opts.cooldown != null ? opts.cooldown : cfg.cooldownSec) * 1000;
  const roots = opts.roots && opts.roots.length ? opts.roots : cfg.roots;

  if (!roots.length) {
    log('no roots configured. Run `git-sync init --root <dir>` first.');
    return;
  }

  log(`git-sync-daemon starting. roots=${roots.join(', ')} interval=${intervalMs / 1000}s cooldown=${cooldownMs / 1000}s`);

  const state = new Map(); // dir -> { lastStatus, lastChangeAt }
  const warned = new Set();

  function tick() {
    const repos = discoverRepos(roots);
    const now = Date.now();
    for (const dir of repos) {
      const output = statusPorcelain(dir);
      if (output === null) continue; // git not usable here right now, ignore

      let st = state.get(dir);
      if (!st) {
        st = { lastStatus: null, lastChangeAt: now };
        state.set(dir, st);
      }
      if (output !== st.lastStatus) {
        st.lastStatus = output;
        st.lastChangeAt = now;
      }
      if (output.trim() !== '' && now - st.lastChangeAt >= cooldownMs) {
        syncRepo(dir, cfg, warned);
        st.lastStatus = '';
        st.lastChangeAt = now;
      }
    }
  }

  tick();
  if (opts.once) return;
  setInterval(tick, intervalMs);
}

module.exports = {
  HOME_DIR,
  CONFIG_PATH,
  LOG_PATH,
  loadConfig,
  saveConfig,
  discoverRepos,
  runLoop,
  log,
};
