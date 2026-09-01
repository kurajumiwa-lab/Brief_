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
  rm -rf "$dest/api" "$dest/shell" "$dest/model" "$dest/screens" "$dest/components" "$dest/nav" "$dest/ui" "$dest/assets" "$dest/engine"
  mkdir -p "$dest"
  cp App.tsx "$dest/App.tsx"
  cp -R src/api "$dest/api"
  cp -R src/shell "$dest/shell"
  cp -R src/components "$dest/components"
  cp -R src/nav "$dest/nav"
  cp -R src/ui "$dest/ui"
  # Static assets imported by components (e.g. arena key-art). tc needs the
  # images.d.ts shim to type-check the imports; preview needs the bytes to build.
  cp -R src/assets "$dest/assets"
  # The engine sync machine (src/engine) is imported by components.
  cp -R src/engine "$dest/engine"
  cp -R src/model "$dest/model"
  cp -R src/screens "$dest/screens"
done

echo "synced App.tsx + src/model + src/api + src/components + src/nav + src/ui + src/assets + src/engine -> preview/src, tc/src"
