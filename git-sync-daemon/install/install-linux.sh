#!/bin/bash
# Convenience wrapper: installs the systemd --user service for git-sync-daemon.
# Usage: ./install-linux.sh <root-dir> [more-root-dirs...]
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <root-dir> [more-root-dirs...]"
  echo "Example: $0 \"$HOME/projects\""
  exit 1
fi

args=(install)
for root in "$@"; do
  args+=(--root "$root")
done

node "$DIR/bin/git-sync.js" "${args[@]}"
