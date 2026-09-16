# Memo 004 — IPC migration inventory: Socket.IO contract + process/port/env assumptions

Ticket: [#4](https://github.com/mohmaedeslam00116/shadow-agent/issues/4) · Feeds: [#8](https://github.com/mohmaedeslam00116/shadow-agent/issues/8), [#9](https://github.com/mohmaedeslam00116/shadow-agent/issues/9)

## The typed contract lives in one place

`packages/types/src/ui/events.ts` — fully typed, reusable as an IPC contract as-is:

- **`ServerToClientEvents` (19)**: `connection-info`, `chat-history`, `chat-history-error`, `stream-state`, `stream-chunk`, `stream-complete`, `stream-error`, `stream-update`, `message-error`, `history-complete`, `history-error`, `terminal-history`, `terminal-history-error`, `terminal-output`, `terminal-cleared`, `terminal-error`, `task-status-updated`, `auto-pr-status`, `queued-action-processing`.
- **`ClientToServerEvents` (12)**: `join-task`, `leave-task`, `user-message`, `edit-user-message`, `get-chat-history`, `stop-stream`, `request-history`, `clear-queued-action`, `create-stacked-pr`, `get-terminal-history`, `clear-terminal`, `heartbeat`.

Payloads already carry `taskId` in nearly every event, so the Socket.IO **room** (`task-<taskId>`) maps trivially to per-task IPC channels (`webContents.send` for S2C, `ipcRenderer.invoke` for C2S request/response).

## Server-side machinery to preserve (`apps/server/src/socket.ts`, ~800 lines)

- `taskStreamStates` Map: chunk buffer per task → powers **replay** via `stream-state` on `join-task`/`request-history` (the reconnect story). Under IPC, renderer-reload takes the place of reconnect; the same replay path serves it.
- `connectionStates` Map with 5-min GC + `heartbeat` — largely obsolete in-process (no sockets to expire), kept only if multi-window support is wanted.
- **API keys ride cookies**: `parseApiKeysFromCookies(socket.request.headers.cookie)` per connection, then `modelContextService.createContext(taskId, cookie, model)`. Under IPC, keys move to a main-process store (feeds auth decision #10 / safeStorage).
- `emitToTask(taskId, event, data)` is the single broadcast helper used across the server — one choke point to convert.
- Terminal: remote mode polls sidecar every 1 s → `terminal-output`; **local-mode terminal history is an unimplemented TODO returning `[]`** (build-phase gap, also noted in Memo 002).

## Sidecar (dormant with remote mode, but its inventory informs #8)

- REST surface ~35 endpoints under `/api` registered as router factories: `execute.ts` (7 — command exec, terminal history/clear), `files.ts` (7 write ops), `filesystem-watcher.ts` (3), `git.ts` (14 — status/diff/commit/branch/push), `search.ts`, `health.ts`. Pattern: `router.post(...)` per factory (`apps/sidecar/src/api/*`).
- Storage is **pure filesystem** (`fs.writeFile` in `file-service.ts`), no DB; terminal buffer is in-memory; a `socket.io-client` phones home to the server in remote mode only.
- Sidecar socket namespace types (`packages/types/src/socket.ts`): `SidecarToServerEvents` (`join-task`, `fs-change`, `heartbeat`), `ServerToSidecarEvents` (`task-joined`, `config-update`); the `FileSystemEvent` type is reusable for a future local watcher.

## Ports, CORS, env bindings

- Server: `API_URL` default `http://localhost:4000`, `CORS_ORIGINS` default `http://localhost:3000` (`apps/server/src/config/{shared,dev}.ts`, zod).
- Frontend: dev on port 3000 (`next dev --turbopack --port 3000`); sidecar: 8080 (Docker).
- **Trap**: `NODE_ENV=production` selects `ProdConfig` which hardwires **remote mode** (`apps/server/src/config/index.ts` loading `./prod` vs `./dev`). A packaged desktop app runs with `NODE_ENV=production` — the config loader must decouple `NODE_ENV` from `AGENT_MODE` (feeds #8).
- Socket.IO cookie `io` (`sameSite: lax` dev / `none` prod) — dies with the socket layer.

## Mapping recommendation (for #8/#9 to lock)

`ClientToServerEvents` → `ipcRenderer.invoke` request/response handlers; `ServerToClientEvents` → `webContents.send` on per-task channels via a converted `emitToTask`; replay semantics preserved via `stream-state` on subscription; validation reuses the existing zod/discriminated unions in `packages/types`.
