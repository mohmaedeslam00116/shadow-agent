# Memo 007 — Production-build experiments (ticket #6)

Ticket: [#6](https://github.com/mohmaedeslam00116/shadow-agent/issues/6) · Feeds: the unblock-production-build task (#15 at locking time) · Branch: `research/electron-probe` · Environment: Windows 10, Node 24.18 (repo engines: ≥18), Next 15.3.5

## Experiment log

| # | Experiment | Result |
|---|---|---|
| 1 | Webpack prod build, stock 15.3.5 (`main` state) | ❌ crash in `FlightClientEntryPlugin.createActionAssets` — vercel/next.js#96823 (open; maintainer triage confirms 3 Windows bugs: `path.posix.relative` with `\\` separators, un-normalized chunk-group keys, unguarded `serverActionModules[name]` access) |
| 2 | Hand-applied vercel/next.js#96830 guard set to installed `node_modules/next/dist/build/webpack/plugins/flight-client-entry-plugin.js` (normalized keys + guarded worker loops; the `posix.relative` sites don't exist in 15.3.5's compiled bundle) | ✅ **#96823 crash eliminated** — build proceeded past the previous fatal point |
| 3 | Same build, config-override fully neutralized (rule out repo config) | ❌ still fails on **EPERM** — proves PrismaPlugin/SVG block were never the EPERM cause |
| 4 | fs-level trace of the EPERM | **Root cause: `@vercel/nft`** (output-file-tracing, `next/dist/compiled/@vercel/nft`). Its glob walk reaches `C:/Users/Dell` — a traced dependency resolves under the user home on a different volume — and dies on the legacy `C:\Users\Dell\Application Data` junction (EPERM -4048). The fatal is escalated to "Failed to compile" |
| 5 | `outputFileTracingRoot` pinned to monorepo root (top-level AND `experimental.*`) | ❌ does not stop the walk (cross-volume dep resolution bypasses the project-root pin) |
| 6 | `outputFileTracingExcludes: { "*": ["**"] }` | ❌ does not stop the walk |
| 7 | Turbopack prod build (earlier, Memo 005) | ❌ bundled Prisma engine loader (`ERR_INVALID_ARG_TYPE`); deferred until any Next upgrade |

## Portable fix recipe for the desktop build (Patch A + Patch B)

**Patch A — validated**: patch-package `next` with the #96830 guard set. Minimal safe patch for 15.3.5's `flight-client-entry-plugin.js`:
1. Inject helper: `const __normalizePathSep = (p) => (typeof p === "string" ? p.split(String.fromCharCode(92)).join("/") : p);` (backslash-free construction survives JS string escaping)
2. Normalize chunk-group keys: `const entryName = __normalizePathSep(chunkGroup.name);` and use `mapping[entryName]`
3. Guard both worker loops: `const modId = pluginState.serverActionModules[name] && pluginState.serverActionModules[name][targetLayer]; if (modId) { action.workers[name] = modId; }`

**Patch B — required, not yet written**: make `@vercel/nft`'s glob tolerant of EPERM on unreadable directories (skip subtree instead of throwing), applied via patch-package to `next/dist/compiled/@vercel/nft/index.js`. Alternative (machine-local, NOT plan-reliable): one-time removal of the legacy junction (`rmdir "C:\Users\Dell\Application Data"` — a compatibility stub, safe to delete) — the plan must not depend on individual machines' junction state.

**PrismaPlugin**: unproven, probably innocent (its earlier throw was a secondary symptom of the aborted compilation). Locked direction drops it for desktop anyway (node_modules ship via electron-builder; no standalone tracing needed) — retest on first green build to confirm.

**Windows native deps (proven earlier)**: `lightningcss-win32-x64-msvc` + `@tailwindcss/oxide-win32-x64-msvc` as optionalDependencies in the frontend workspace (+ postinstall allow-list); the lightningcss fallback loader also accepts the `.node` binary copied beside `lightningcss/node/index.js`.

## Decision consequences (locked in #6)

- Next **stays on 15.3.x** for the desktop migration; Next 16 upgrade becomes a separate modernization ticket after desktop v0.
- The production chain `source → prod build → package → launch .exe → renderer` is blocked ONLY on Patch A + Patch B + packaging config; everything downstream (BetterAuth / IPC / Prisma inside the packaged exe) is validated by the follow-up task's smoke test.
