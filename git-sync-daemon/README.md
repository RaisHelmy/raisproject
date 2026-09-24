# git-sync-daemon

A tiny, dependency-free service that watches one or more folders full of git
repos and auto-commits + pushes any changes after **1 minute of no further
edits**. Repos with no git remote configured, or where push fails for any
reason, are skipped and logged once — the daemon never crashes because of a
broken repo.

Requires only Node.js (>=16) and `git` on PATH. No npm install needed.

## How it works

Every 15 seconds it re-scans the configured root folder(s):

- If a root itself is a git repo, it's watched directly.
- Otherwise every immediate subfolder containing a `.git` is watched
  (this matches a workspace like `raisproject/` where each project folder is
  its own repo).

For each repo it runs `git status --porcelain`. If the output changes, the
1-minute cooldown timer resets. Once 60 seconds pass with no new changes
*and* the repo is still dirty, it runs `git add -A`, commits, and pushes
(falling back to `git push -u origin <branch>` if there's no upstream yet).

## CLI

```
git-sync init --root <dir> [--root <dir> ...] [--interval <sec>] [--cooldown <sec>]
git-sync run [--once]
git-sync once
git-sync install [--root <dir> ...] [--interval <sec>] [--cooldown <sec>]
git-sync uninstall
git-sync status
git-sync logs
```

Config lives at `~/.git-sync-daemon/config.json`, logs at
`~/.git-sync-daemon/daemon.log`. You can edit the config file directly to
add/remove roots later without reinstalling the service.

Run `node bin/git-sync.js` (no args) for full help text.

## Try it without installing a service

```sh
node bin/git-sync.js once --root "/Users/you/Downloads/raisproject"
```

This runs a single sync pass over every repo under that root and exits —
good for checking it behaves before installing it as a background service.

## Install as a background service

### macOS (launchd)

```sh
./install/install-macos.sh "/Users/you/Downloads/raisproject"
```

Installs `~/Library/LaunchAgents/com.gitsyncdaemon.agent.plist`, starts it
immediately, and re-starts it at every login (and on crash).

### Linux (systemd --user)

```sh
./install/install-linux.sh "/home/you/projects"
```

Installs `~/.config/systemd/user/git-sync-daemon.service` and enables +
starts it. Optionally run `loginctl enable-linger $USER` so it keeps
running even when you're not logged in.

### Windows (Task Scheduler)

```powershell
.\install\install-windows.ps1 -Root "C:\Users\you\projects"
```

Creates a scheduled task named `GitSyncDaemon` that runs hidden (via a small
`.vbs` wrapper) at logon, and starts it immediately.

## Uninstall

- macOS / Linux: `./install/uninstall.sh`
- Windows: `.\install\uninstall-windows.ps1`

Or directly: `node bin/git-sync.js uninstall`

## Notes / limitations

- Polling-based (checks git status every 15s), not filesystem-event based —
  simple and reliable across all three OSes without extra dependencies.
- Only the top level of each root is scanned for repos (one level deep).
  Nested/multi-root setups: pass multiple `--root` flags.
- Commit message is `chore: auto-sync <ISO timestamp>`.
- Detached HEAD, and repos mid-rebase/merge/cherry-pick, are skipped.
