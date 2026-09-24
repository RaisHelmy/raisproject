#!/bin/bash
# Convenience wrapper: installs the launchd agent for git-sync-daemon.
# Usage: ./install-macos.sh <root-dir> [more-root-dirs...]
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <root-dir> [more-root-dirs...]"
  echo "Example: $0 \"$HOME/Downloads/raisproject\""
  exit 1
fi

args=(install)
for root in "$@"; do
  args+=(--root "$root")
done

node "$DIR/bin/git-sync.js" "${args[@]}"
