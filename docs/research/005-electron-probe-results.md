# Memo 005 — Electron walking-skeleton probe results

Ticket: [#5](https://github.com/mohmaedeslam00116/shadow-agent/issues/5) · Feeds: [#6](https://github.com/mohmaedeslam00116/shadow-agent/issues/6), [#8](https://github.com/mohmaedeslam00116/shadow-agent/issues/8) · Branch: `research/electron-probe` (throwaway, never merge)

## Verdict

**PASS.** Electron 33 + Next 15.3.5 (dev server as child process) boots on Windows and the full checklist works: middleware auth redirect fires, `/auth` renders through BetterAuth, same-origin page load, and renderer→main→renderer IPC round-trips. The embedded-Next-server renderer strategy is **validated for the dev-server shape**; remaining risk concentrates in production builds (below).

## Checklist results (probe run, 2026-09-16, Windows 10, Electron 33.4.11 / embedded Node 20.18.3)

| Check | Result | Timing |
|---|---|---|
| Electron ready | ✅ | 44 ms |
| `next dev` child spawn → "Ready" | ✅ | 10.4 s total (boot 4.9 s after npm startup) |
| Middleware `/auth` redirect (no session cookie) | ✅ HTTP 307 | 10.5 s |
| `/auth` page compile + render through BetterAuth handler | ✅ 200 | 17.4 s first compile (dev), then fast |
| Renderer loads in BrowserWindow | ✅ `did-finish-load` | 28.5 s |
| IPC echo renderer→main→renderer (`contextIsolation` + preload) | ✅ payload intact | ~20 ms after load |
| `window.probe.env()` | ✅ electron 33.4.11, node 20.18.3, win32 | — |
| Prisma client `require("@repo/db")` in main process | ✅ loads + constructs | — |
| Prisma query attempt (no Postgres running) | ✅ handled error (expected; SQLite is #7) | — |

## Findings (each one is a desktop-plan input)

1. **Windows process-spawn rule (security)**: Electron ≥ 20 refuses `spawn("npm.cmd", …)` without `shell: true` (CVE-2024-27980 mitigation) — `spawn EINVAL`. **Feeds #8/#9**: the agent's `run_terminal_cmd` tool and any child-process spawning must account for this on Windows (shell:true changes quoting/args semantics; command-security validation must treat shell semantics accordingly).
2. **Process-tree cleanup is NOT solved by `child.kill()`**: with `shell: true`, killing the shell leaves the whole npm→node tree alive holding stdio pipes (probe: 10+ orphaned processes; the harness had to force-kill). **Feeds #8**: the real app needs `taskkill /T` on Windows / detached process-group management, and it is the same machinery the agent's terminal tool will need.
3. **`NODE_ENV=production` ⇒ remote-mode config**: confirmed in source (`apps/server/src/config/index.ts`). A packaged app runs with `NODE_ENV=production`, so the config loader must decouple the two (already queued for #8 from Memo 004).
4. **Production build of the frontend is blocked on Windows by two known Next issues** — this is the main open risk for the *packaged* app:
   - webpack build: **vercel/next.js#96823** (open): `FlightClientEntryPlugin.createActionAssets` crashes (`serverActionModules` empty while Server Actions exist on Windows).
   - Turbopack prod build (experimental): compiles fine (23 s) but **fails page-data collection on the Prisma engine loader** — the bundled runtime passes a numeric module id to `path.join` (`ERR_INVALID_ARG_TYPE`); `serverExternalPackages` does not externalize the workspace-aliased `@repo/db` in 15.3.5.
   - Workarounds to evaluate in #6: upgrade Next (a fix PR exists upstream for #96823), restructure `@repo/db` exports so the engine loader isn't bundled, or run the packaged frontend in a lightweight non-prod server mode. **Dev-mode runs perfectly**, so the renderer decision (embedded local server) stands.
5. **Windows native deps for Tailwind v4**: `lightningcss-win32-x64-msvc` and `@tailwindcss/oxide-win32-x64-msvc` are not in the lockfile's optional set (upstream pins only Linux optionals); npm's `--no-save` install + a copy of the `.node` binary inside `node_modules/lightningcss/` was needed. **Feeds #6**: the desktop toolchain ticket must add Windows optional deps + postinstall strategy to the plan.
6. **PrismaPlugin (`@prisma/nextjs-monorepo-workaround-plugin`) throws with Next 15 webpack on Windows** (disabled on the probe branch): fold into the same Next/toolchain decision as (4).
7. **Dev-server cross-origin warning**: loading via `127.0.0.1` while the app advertises `localhost` triggers Next's `allowedDevOrigins` notice — pin one canonical origin in the real shell (cosmetic, noted for #6).
8. **npm allow-scripts policy on this machine** defers native builds (`tree-sitter-*`, electron postinstall already approved interactively): the real app's build scripts must run with an explicit allow-list. **Feeds #6/#13.**

## Probe artifacts

- `probe/main.js` (shell + autonomous IPC driver + Prisma handler), `probe/preload.js` (contextBridge), `probe/package.json` (Electron 33 pinned)
- `apps/frontend/next.config.ts` probe deltas: PrismaPlugin disabled, `serverExternalPackages` added (both to be revisited by #6, never merged as-is)
- Raw run log excerpt preserved in this memo's checklist table

## Recommendation to #6

Validate the renderer as **embedded local Next server**; make "Next version upgrade + Windows prod-build path" the explicit first spike of the plan's build phase, since dev-mode is proven and only the packaged-build path carries the known Next-on-Windows bugs.
