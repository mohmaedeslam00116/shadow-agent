# Memo 003 — Postgres-only feature audit of the Prisma schema

Ticket: [#3](https://github.com/mohmaedeslam00116/shadow-agent/issues/3) · Feeds: [#7](https://github.com/mohmaedeslam00116/shadow-agent/issues/7)

## Verdict

**Portability: VERY HIGH.** The schema (`packages/db/prisma/schema.prisma`) avoids nearly everything that makes Postgres→SQLite painful. **Zero raw SQL** (`$queryRaw`/`$executeRaw`) anywhere in `apps/server` or `apps/frontend` (grep-verified). **Prisma 6.2.0 (Jan 2025) added native `Json` AND `enum` support on SQLite** (release notes; this repo runs Prisma 6.13 via `@prisma/nextjs-monorepo-workaround-plugin@6.13.0`), which removes what used to be the two biggest conversion items. The only real schema change left is one scalar-list column.

## Findings

| Feature | Where | SQLite impact |
|---|---|---|
| 6 enums (`TaskStatus`, `PullRequestStatus`, `MessageRole`, `TodoStatus`, `InitStatus`, `MemoryCategory`) | schema; `InitStatus` imported from `@repo/db` in server code | **Supported on SQLite since Prisma 6.2** — keep as-is; imports (`InitStatus` etc.) untouched. Verify at execution that `db push` emits correct constraints |
| `Json?` / `Json` columns (`ChatMessage.metadata`, `CodebaseUnderstanding.content`) | 2 columns | **Supported on SQLite since Prisma 6.2** — keep as-is; verify round-trip at execution |
| Scalar list `String[] @default([])` (`UserSettings.selectedModels`) | 1 column | **Still unsupported on SQLite** — the one real change: convert to `String` (JSON-serialized) or a join table; few access sites, mechanical |
| Composite PK `@@id([taskId, id])` (Todo) | 1 model | Supported on SQLite — no change |
| `@default(nanoid()/cuid()/now())`, `@updatedAt` | throughout | Prisma-level defaults — DB-agnostic, no change |
| `onDelete: Cascade / SetNull` | throughout | Prisma-enforced referential actions — verify generated migration once |
| `binaryTargets: ["native", "rhel-openssl-3.0.x", "linux-musl-openssl-3.0.x"]` | generator | Replace with `native` for the desktop; note query-engine size affects installer footprint |
| `directUrl = env("DIRECT_URL")` | datasource | Remove (a pooling concept); `DATABASE_URL` becomes a `file:` URL |

## Viable paths (to be decided in #7)

1. **Provider swap** — `provider = "sqlite"` in the same schema. Simplest; enums and Json carry over natively (6.2+).
2. **Driver adapter** (`@prisma/adapter-better-sqlite3`) — no separate query-engine binary (smaller, packaging-friendlier for Electron), GA in Prisma 6.x. Costs a client-construction change where `PrismaClient` is instantiated.

Either path: dev DB is disposable — **no data migration needed** (nothing of value exists yet). The bash `scripts/db-*.sh` workflow collapses to plain `prisma db push` / `migrate` — Windows script cleanup lands in the build phase.
