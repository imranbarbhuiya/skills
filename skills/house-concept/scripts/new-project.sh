#!/usr/bin/env bash
# Copy the house-concept starter into a new project folder and install its dependencies from the lockfile.
# Usage: new-project.sh <target-dir>
set -euo pipefail

target="${1:?usage: new-project.sh <target-dir>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
starter="$here/../assets/starter"

if [ -e "$target" ] && [ -n "$(ls -A "$target" 2>/dev/null)" ]; then
  echo "error: $target exists and is not empty" >&2
  exit 1
fi
mkdir -p "$target"
# copy everything except installed and built files
(cd "$starter" && tar --exclude=node_modules --exclude=dist -cf - .) | (cd "$target" && tar -xf -)
printf 'node_modules/\ndist/\n' > "$target/.gitignore"

cd "$target"
if command -v bun >/dev/null 2>&1; then
  bun install --frozen-lockfile
else
  echo "bun not found: install it (https://bun.sh) or run 'npm install' (no lockfile for npm)" >&2
fi
echo
echo "Starter copied to $target"
echo "  edit   src/design/house.ts   (the working plan) and src/design/options.ts"
echo "  run    bun run dev           (Vite dev server)"
echo "  build  bun run build         (type-checks, then writes dist/index.html, one self-contained file)"
