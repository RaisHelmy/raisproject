#!/bin/bash
# Works for both macOS (launchd) and Linux (systemd --user).
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
node "$DIR/bin/git-sync.js" uninstall
