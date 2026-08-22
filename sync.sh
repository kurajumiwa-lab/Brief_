#!/usr/bin/env bash
# Sync the canonical sources into the two test trees.
#
# /home/user/App.tsx + src/ are canonical. preview/src and tc/src are COPIES
# used by the render suites and the typechecker respectively. Editing the
# canonical file and forgetting to copy produces a stale-copy failure that
# looks exactly like a real regression -- it has cost real debugging time more
# than once. Always run this before a test sweep.
set -e
cd "$(dirname "$0")"

for dest in preview/src tc/src; do
  # Mirror the whole tree rather than named files: a new subdirectory
  # (src/components/circle/) was silently missed by the old per-glob copy,
  # which is exactly how the stale-copy trap reappears.
  rm -rf "$dest/api" "$dest/components" "$dest/nav"
  mkdir -p "$dest"
  cp App.tsx "$dest/App.tsx"
  cp -R src/api "$dest/api"
  cp -R src/components "$dest/components"
  cp -R src/nav "$dest/nav"
done

echo "synced App.tsx + src/api + src/components + src/nav -> preview/src, tc/src"
