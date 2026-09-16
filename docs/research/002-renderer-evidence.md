# Memo 002 — Renderer evidence: can the Next.js app run inside Electron?

Ticket: [#2](https://github.com/mohmaedeslam00116/shadow-agent/issues/2) · Feeds: [#6](https://github.com/mohmaedeslam00116/shadow-agent/issues/6), probe [#5](https://github.com/mohmaedeslam00116/shadow-agent/issues/5)

## Verdict

**Static export: not viable. Embedded local Next server: viable, least-risk path. Vite SPA rewrite: viable but the most expensive.**

## Blockers against static export (decisive, in order)

1. **21 API route handlers** under `apps/frontend/app/api/**`: `auth/[...auth]` (the BetterAuth handler), `github/{branches,install,issues,repositories,status}`, `tasks/[taskId]/{archive,diff-stats,files/content,files/tree,messages,pull-request,route.ts,stacked-pr-info,status,title}`, `models`, `codebases/[codebaseId]`, `indexing-status/[repoFullName]`, `user-settings`, `validate-keys`. All dead under `file://`.
2. **Server Actions**: `apps/frontend/lib/actions/{api-keys,create-task,edit-message,git-selector-cookie,model-selector-cookie}.ts` plus `next/headers` usage in `app/api/tasks/[taskId]/pull-request/route.ts` and `app/layout.tsx`. Require a server runtime.
3. **`apps/frontend/middleware.ts`**: session gate — redirects to `/auth` when `better-auth.session_token` cookie is absent. Middleware runs server-side.
4. **`@repo/db` (Prisma) imported in 15 frontend files**, including client-side components (`components/sidebar/*`, `hooks/tasks/*`, `components/chat/messages/pr-card.tsx`) — a bundling/pattern refactor regardless of option chosen.

Supporting facts: `next.config.ts` is otherwise tame (no custom server, no rewrites; SVG via `@svgr`, images from `avatars.githubusercontent.com`, `PrismaPlugin` for production server builds, Turbopack in dev). 22 `fetch("/api/...")` call sites work same-origin only. Env switches: `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_VERCEL_ENV` (any value ≠ "production" enables local behavior), `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`, `NEXT_PUBLIC_FORCE_GITHUB_APP`. xterm is used in exactly one component: `components/agent-environment/terminal.tsx`; local-mode terminal history is currently a `TODO` returning `[]` in `apps/server/src/socket.ts` (`getTerminalHistory`) — the desktop local terminal buffer must be built during implementation (build-phase task, not a planning blocker).

## Options

| Option | Consequence |
|---|---|
| **A. Embedded local Next server** (main process runs `next start`-style server, window loads `http://127.0.0.1:<port>`) | Keeps all 21 routes, Server Actions, middleware, BetterAuth handler working **unchanged**; same-origin kills CORS; auth loopback natural. Costs: Node server inside main process, port management, cold-start time, CSP care over http. **Least risk.** |
| **B. Static export** | Must re-home 21 routes + 7 actions + middleware as IPC handlers in the main process, strip Prisma from client bundles, rebuild auth. Most invasive; loses BetterAuth as-is. **Not recommended.** |
| **C. Vite SPA rewrite** | Cleanest end state (true file://, no server), but rewrites navigation, data-fetch, and auth plumbing. Only if the probe proves A painful. |

## Probe checklist for #5 (Windows)

Boot Next server inside Electron main; load it in a BrowserWindow; verify middleware `/auth` redirect; one same-origin API route fetch; one Server Action; socket connection with cookie; cold-start timing; monorepo `PrismaPlugin` behavior in a packaged-like build.
