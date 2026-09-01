# Refactor: decompose App.tsx into screens, overlay shell, hooks, and chrome (zero behavior change)

**Base:** `main` @ `47ae1d0` · **Head:** `refactor/modular-shell` · 28 commits, 111 files, −37,549/+48,119 (includes `tc/` and `preview/`, which are build mirrors kept in sync by `sync.sh`)

## What this is

App.tsx was 7,635 lines. It is now **1,925 lines (−75%)** — an orchestrator: shared state, routing core, hook wiring, chrome JSX. Every extraction was made with all gates green and committed individually, so any step can be reviewed or reverted independently.

| Phase | What landed | App.tsx |
|---|---|---|
| 0 | `src/model/core.tsx` split (types + pure fns), monetization components + fees catalog, calendar-flake + mojibake-guard suites | 7,635 → ~6,800 |
| 1 | **Screens:** ArenaScreen, MyLayerScreen, NearbyScreen, WorkflowsScreen → `src/screens/` | → 5,648 |
| 2 | **Colocation:** per-screen filters/memos/handlers moved into each screen (draft gotchas: `renormalizePursuitCounts`, all MyLayer command+answer clusters, Nearby section handlers) | 5,648 → 5,392 |
| 3 | **OverlaysShell** (2,145L: campaign dashboard, editions, create campaign, capture, tea detail, object detail + small overlay mounts) | 5,392 → 3,265 |
| 4 | **13 custom hooks** → `src/shell/hooks/`: useCampaignHub · useCaptureFlow · useArenaData · useIngestionDesk · usePersonalLayer · useWatchAndShare · useDiscoveryFeed · useQuestsAndRewards · useGroupsDesk · useBriefItFlow · useSessionLocation · useSessionBoot · useTuning | 3,265 → 2,064 |
| 5 | **Chrome:** StatusToasts / DesktopRail / DockNav → `src/shell/Chrome.tsx` | 2,064 → 1,925 |

## Invariants (held at every commit)

- **tsc** clean (`npx tsc -p tsconfig.json` in `tc/`) — EXIT 0
- **Client suite:** 1,719 passed / 0 failed (`bash run-suites.sh`)
- **Preview build** ✓ (arena session full build)
- **Zero behavior change:** all JSX and logic moved verbatim; tests are the behavioral spec

## Deliberate shell-retained rules (review focus)

1. **Route-sync setters stay shell:** `goToDestination`, `applyRoute`, popstate effect, `writeUrl`.
2. **Unmount persistence:** active-tab screens unmount when inactive; only derived/handlers colocated, not screen-lifetime state.
3. **`isAnyModalActive`'s ~30 overlay states never colocated** (chrome gating depends on them).

## Incidents worth a look in review

- `16609c3`: a structural nav suite caught a real unmount-reset regression during colocation — states pulled back to shell. (This is why the rule above exists.)
- `b5b4bda` + `230bc74`: trust/pure "daily edge" suites had a pre-existing UTC-midnight flake (reproduces on baseline commit `47ae1d0`); fixed by freezing fixture clocks at local 14:00.
- Five wrong-first-pass extractions rolled back via the per-move commit jazz; machinery (`scripts/make_hook.py`, `colocate.py`, `make_chrome.py`, `make_overlay_shell.py`) is included and enforces the discipline mechanically.

## How to verify

```bash
npm run install:all
cd tc && npx tsc -p tsconfig.json     # EXIT 0
cd .. && bash run-suites.sh           # 1719/0 GREEN
npm run build:client && (cd preview && npm run build)
```

Full narrative: `BRIEF-V2-CHANGE-REPORT.md` (repo root) or `git log --oneline 47ae1d0..refactor/modular-shell`.
