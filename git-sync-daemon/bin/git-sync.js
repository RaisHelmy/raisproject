#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const lib = require('../src/lib');

const SCRIPT_PATH = path.resolve(__dirname, 'git-sync.js');
const LABEL = 'com.gitsyncdaemon.agent';
const TASK_NAME = 'GitSyncDaemon';

function parseFlags(rest) {
  const flags = { roots: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--root') flags.roots.push(path.resolve(rest[++i]));
    else if (a === '--interval') flags.interval = Number(rest[++i]);
    else if (a === '--cooldown') flags.cooldown = Number(rest[++i]);
    else if (a === '--once') flags.once = true;
  }
  return flags;
}

function cmdInit(rest) {
  const flags = parseFlags(rest);
  const cfg = lib.loadConfig();
  if (flags.roots.length) cfg.roots = Array.from(new Set([...(cfg.roots || []), ...flags.roots]));
  if (flags.interval) cfg.intervalSec = flags.interval;
  if (flags.cooldown) cfg.cooldownSec = flags.cooldown;
  lib.saveConfig(cfg);
  console.log('Saved config to', lib.CONFIG_PATH);
  console.log(JSON.stringify(cfg, null, 2));
}

function cmdRun(rest) {
  const flags = parseFlags(rest);
  lib.runLoop(flags);
}

function cmdOnce(rest) {
  const flags = parseFlags(rest);
  flags.once = true;
  lib.runLoop(flags);
}

function cmdLogs() {
  if (!fs.existsSync(lib.LOG_PATH)) {
    console.log('No log file yet at', lib.LOG_PATH);
    return;
  }
  const lines = fs.readFileSync(lib.LOG_PATH, 'utf8').split('\n').filter(Boolean);
  console.log(lines.slice(-100).join('\n'));
}

// ---- platform service install/uninstall/status ----

function macPlistPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
}

function installMac(node) {
  lib.log('installing macOS launchd agent');
  const plistPath = macPlistPath();
  const outLog = path.join(lib.HOME_DIR, 'launchd.out.log');
  const errLog = path.join(lib.HOME_DIR, 'launchd.err.log');
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${SCRIPT_PATH}</string>
    <string>run</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key><false/>
  </dict>
  <key>StandardOutPath</key><string>${outLog}</string>
  <key>StandardErrorPath</key><string>${errLog}</string>
</dict>
</plist>
`;
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.writeFileSync(plistPath, plist);
  spawnSync('launchctl', ['unload', plistPath]); // ignore errors if not loaded yet
  const r = spawnSync('launchctl', ['load', '-w', plistPath], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('launchctl load failed:', r.stderr || r.stdout);
    process.exit(1);
  }
  console.log('Installed and started launchd agent:', plistPath);
}

function uninstallMac() {
  const plistPath = macPlistPath();
  if (fs.existsSync(plistPath)) {
    spawnSync('launchctl', ['unload', plistPath]);
    fs.unlinkSync(plistPath);
    console.log('Removed launchd agent:', plistPath);
  } else {
    console.log('No launchd agent installed.');
  }
}

function statusMac() {
  const r = spawnSync('launchctl', ['list', LABEL], { encoding: 'utf8' });
  console.log(r.stdout || r.stderr || 'not running');
}

function linuxUnitPath() {
  return path.join(os.homedir(), '.config', 'systemd', 'user', 'git-sync-daemon.service');
}

function installLinux(node) {
  lib.log('installing systemd --user service');
  const unitPath = linuxUnitPath();
  const unit = `[Unit]
Description=Git Sync Daemon (auto-sync local repos)
After=default.target

[Service]
ExecStart=${node} ${SCRIPT_PATH} run
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
`;
  fs.mkdirSync(path.dirname(unitPath), { recursive: true });
  fs.writeFileSync(unitPath, unit);
  spawnSync('systemctl', ['--user', 'daemon-reload']);
  const r = spawnSync('systemctl', ['--user', 'enable', '--now', 'git-sync-daemon.service'], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('systemctl enable failed:', r.stderr || r.stdout);
    process.exit(1);
  }
  console.log('Installed and started systemd user service:', unitPath);
  console.log('Tip: run `loginctl enable-linger $USER` so it keeps running after you log out.');
}

function uninstallLinux() {
  const unitPath = linuxUnitPath();
  spawnSync('systemctl', ['--user', 'disable', '--now', 'git-sync-daemon.service']);
  if (fs.existsSync(unitPath)) fs.unlinkSync(unitPath);
  spawnSync('systemctl', ['--user', 'daemon-reload']);
  console.log('Removed systemd user service.');
}

function statusLinux() {
  const r = spawnSync('systemctl', ['--user', 'status', 'git-sync-daemon.service', '--no-pager'], { encoding: 'utf8' });
  console.log(r.stdout || r.stderr || 'not running');
}

function windowsVbsPath() {
  return path.join(lib.HOME_DIR, 'run-hidden.vbs');
}

function installWindows(node) {
  lib.log('installing Windows scheduled task');
  const vbsPath = windowsVbsPath();
  const vbs = `Set objShell = CreateObject("WScript.Shell")\r\nobjShell.Run """${node}"" ""${SCRIPT_PATH}"" run", 0, False\r\n`;
  fs.mkdirSync(path.dirname(vbsPath), { recursive: true });
  fs.writeFileSync(vbsPath, vbs);
  const tr = `wscript.exe "${vbsPath}"`;
  spawnSync('schtasks', ['/Delete', '/TN', TASK_NAME, '/F']); // ignore errors if absent
  const r = spawnSync('schtasks', ['/Create', '/TN', TASK_NAME, '/TR', tr, '/SC', 'ONLOGON', '/RL', 'LIMITED', '/F'], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('schtasks /Create failed:', r.stderr || r.stdout);
    process.exit(1);
  }
  console.log('Installed scheduled task:', TASK_NAME);
  spawnSync('schtasks', ['/Run', '/TN', TASK_NAME]); // start it now too
  console.log('Started scheduled task. It will also auto-start at next logon.');
}

function uninstallWindows() {
  spawnSync('schtasks', ['/Delete', '/TN', TASK_NAME, '/F']);
  const vbsPath = windowsVbsPath();
  if (fs.existsSync(vbsPath)) fs.unlinkSync(vbsPath);
  console.log('Removed scheduled task:', TASK_NAME);
}

function statusWindows() {
  const r = spawnSync('schtasks', ['/Query', '/TN', TASK_NAME, '/V', '/FO', 'LIST'], { encoding: 'utf8' });
  console.log(r.stdout || r.stderr || 'not installed');
}

function cmdInstall(rest) {
  const flags = parseFlags(rest);
  if (flags.roots.length || flags.interval || flags.cooldown) cmdInit(rest);
  const cfg = lib.loadConfig();
  if (!cfg.roots.length) {
    console.error('No roots configured yet. Run: git-sync install --root <dir> [--root <dir> ...]');
    process.exit(1);
  }
  const node = process.execPath;
  const plat = process.platform;
  if (plat === 'darwin') installMac(node);
  else if (plat === 'linux') installLinux(node);
  else if (plat === 'win32') installWindows(node);
  else {
    console.error('Unsupported platform:', plat);
    process.exit(1);
  }
}

function cmdUninstall() {
  const plat = process.platform;
  if (plat === 'darwin') uninstallMac();
  else if (plat === 'linux') uninstallLinux();
  else if (plat === 'win32') uninstallWindows();
  else {
    console.error('Unsupported platform:', plat);
    process.exit(1);
  }
}

function cmdStatus() {
  const plat = process.platform;
  if (plat === 'darwin') statusMac();
  else if (plat === 'linux') statusLinux();
  else if (plat === 'win32') statusWindows();
  else {
    console.error('Unsupported platform:', plat);
    process.exit(1);
  }
}

function help() {
  console.log(`git-sync-daemon - auto-commit & push changes in local git repos after a cooldown

Usage:
  git-sync init --root <dir> [--root <dir> ...] [--interval <sec>] [--cooldown <sec>]
      Save which folders to watch. If a root itself is a git repo it is watched
      directly; otherwise each immediate subfolder containing a .git is watched.

  git-sync run [--once]
      Run the watch/sync loop in the foreground (Ctrl+C to stop).
      --once runs a single pass over all repos and exits.

  git-sync once
      Shortcut for: git-sync run --once

  git-sync install [--root <dir> ...] [--interval <sec>] [--cooldown <sec>]
      Install and start as a background service:
        macOS   -> launchd agent (~/Library/LaunchAgents)
        Linux   -> systemd --user service
        Windows -> Task Scheduler task (runs hidden at logon)

  git-sync uninstall
      Stop and remove the background service.

  git-sync status
      Show whether the background service is running.

  git-sync logs
      Show the last log lines (~/.git-sync-daemon/daemon.log).

Defaults: interval 15s, cooldown 60s (1 minute of no new edits before syncing).
Repos with no git remote configured, or any repo where push fails, are skipped
and logged once - the daemon never crashes because of one broken repo.
`);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'init': return cmdInit(rest);
    case 'run': return cmdRun(rest);
    case 'once': return cmdOnce(rest);
    case 'install': return cmdInstall(rest);
    case 'uninstall': return cmdUninstall();
    case 'status': return cmdStatus();
    case 'logs': return cmdLogs();
    default: return help();
  }
}

main();
