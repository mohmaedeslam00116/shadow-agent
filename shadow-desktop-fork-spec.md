# Spec: Shadow Clone, Deep Inspection & Desktop Rearchitecture

| | |
|---|---|
| **Status** | Draft — ready for execution planning |
| **Date** | 2026-09-16 |
| **Author** | mohmaedeslam00116 (with Buffy/Freebuff) |
| **Upstream** | https://github.com/ishaan1013/shadow |
| **Target repo** | https://github.com/mohmaedeslam00116/shadow-agent (to be recreated) |
| **Local working dir** | `D:/ai/shadow` |
| **Short name** | shadow-desktop-fork |

---

## 1. Executive Summary

Clone the open-source **Shadow** background coding agent (ishaan1013/shadow, MIT) into a new
public repo on the user's account, perform a **deep static inspection** of the entire codebase
recorded in a dedicated multi-file documentation package, then — in later phases — reshape it
into a **distributable Windows desktop application wrapped in Electron** while making deep
**agent-behavior changes** (prompts/planning, providers/models incl. local models, tools,
autonomy/lifecycle).

The immediate deliverable of this spec is: **the clone + the inspection package + the spec-driven
foundation for the desktop rearchitecture.** No production code changes happen in this phase.

---

## 2. Upstream Facts (verified 2026-09-16)

- **Repo**: `ishaan1013/shadow` — "Background coding agent and real-time web interface"
- **License**: MIT, © 2025 Shadowrealm.ai — fork is permitted with notice preserved
- **Last commit**: 2025-12-08 (snapshot target: commit `96e7b18`, "Merge pull request #138 … casestudy")
- **Stack**: TypeScript monorepo, Turborepo + npm workspaces, Node ≥ 22 (README)/18 (engines)
- **Structure**:
  - `apps/frontend/` — Next.js 15.3.5, React 19, Tailwind, Radix UI, Socket.IO client, `ai@^4.3.19`, `better-auth`
  - `apps/server/` — Node orchestrator (~20,800 LOC), Socket.IO server, AI SDK v4 (`@ai-sdk/anthropic`, `@ai-sdk/openai`), Prisma client
  - `apps/sidecar/` — Express 5 service (~4,600 LOC) for file ops/command exec inside isolated containers
  - `packages/db/` — Prisma schema + PostgreSQL client
  - `packages/types/` — shared TS types (~2,500 LOC), incl. tool schemas
  - `packages/command-security/` — command validation/sanitization (~280 LOC)
  - `packages/eslint-config/`, `packages/typescript-config/`
- **Execution modes**: `local` (direct filesystem) and `remote` (Kata QEMU microVMs on AWS EKS; ECS backend deploy scripts). Selected via `NODE_ENV` / `AGENT_MODE`.
- **Agent system**: multi-provider LLM (Anthropic/OpenAI/OpenRouter) via Vercel AI SDK, streaming chat over Socket.IO with structured message parts (Text/Reasoning/ToolCall/ToolResult/Error), tool system (file ops, grep/file/semantic search, terminal, todo, memory), repository memory, "Shadow Wiki" codebase documentation, Pinecone semantic indexing, MCP integration, tree-sitter code graph.
- **Auth**: BetterAuth sessions; GitHub App/OAuth in production; PAT quick-start path for local dev (`GITHUB_PERSONAL_ACCESS_TOKEN` + `NEXT_PUBLIC_VERCEL_ENV != production`).
- **DB**: PostgreSQL via Prisma; core models include User, Task, ChatMessage, Memory, CodebaseUnderstanding, Todo.
- **Noted drift**: README's repo-structure list includes `apps/website/` — not present in the tree.
- **Dev environment assumptions**: bash scripts (`setup-script.sh`, `scripts/db-*.sh`), Postgres required, Node 22. User is on **Windows** (`D:/ai/shadow`, bash shell available via Git Bash).

---

## 3. Goals

1. **Clone** upstream Shadow into `mohmaedeslam00116/shadow-agent` (public, full git history kept, one-time snapshot, no upstream sync remote).
2. **Deep-inspect** the codebase and record results in a dedicated multi-file documentation package inside the repo (`docs/inspection/`).
3. Produce a **change-impact guide** anchored to the two change tracks: agent behavior + desktop rearchitecture.
4. Leave the repo in a state where a future AI agent can plan and execute the big changes using the inspection docs without re-reading the whole codebase.

### Non-goals (this phase)
- No production code changes, no rebranding work, no Electron scaffolding, no DB migration.
- No running/building of the stack (static analysis only — see §8 decision log).
- No upstream PRs, no issue tracker integration for this effort.

---

## 4. Requirements — Clone

| # | Requirement |
|---|---|
| C1 | Clone full upstream git history (not shallow) into working dir `D:/ai/shadow`. |
| C2 | Recreate GitHub repo `mohmaedeslam00116/shadow-agent` from scratch (it currently holds only the earlier scaffolding commit `96050bc` — that commit is expendable). |
| C3 | Port the still-useful scaffolding into the new repo: `AGENTS.md` (Agent skills block) and `docs/agents/` (issue-tracker.md, domain.md) — updated to fit the new repo context. |
| C4 | Keep upstream attribution: **LICENSE file untouched**. Strip upstream author credits/marketing links (ishaand.com case study, X handles) from README during rebrand phase — not in this phase. |
| C5 | One-time snapshot: do NOT add an upstream remote; future upstream changes will not be pulled. |
| C6 | Repo stays **public**. |

---

## 5. Requirements — Deep Inspection Package

### 5.1 Format & location

- Multi-file package under **`docs/inspection/`** with an `index.md` entry point and a coverage checklist.
- Mermaid diagrams included (architecture, request-lifecycle sequence, ER diagram, event flows).
- Every claim carries **file:line references**.

### 5.2 Files to produce

| File | Content |
|---|---|
| `docs/inspection/index.md` | TOC, how-to-read guide, coverage checklist, spec-of-record links |
| `docs/inspection/architecture.md` | System overview, process topology, monorepo dependency graph, execution-mode abstraction, env var catalog, Windows caveats. Mermaid architecture diagram |
| `docs/inspection/agent-pipeline.md` | Agent loop end-to-end: orchestration, context assembly, system prompt (**verbatim** for the MAIN agent system prompt), per-tool prompt summaries, tool schemas & implementations, memory system, Shadow Wiki generation, indexing (tree-sitter/graph/Pinecone), MCP integration, provider abstraction (AI SDK) |
| `docs/inspection/realtime-events.md` | Socket.IO event catalog (names, payloads, direction), message-part protocol, streaming flow frontend↔server, terminal I/O streaming, task status lifecycle events. Mermaid sequence + event flow diagrams |
| `docs/inspection/data-model.md` | Every Prisma model with fields/relations/runtime usage, migration state, Postgres-specific features inventory (critical input for SQLite migration) |
| `docs/inspection/ui-inventory.md` | Deep dive of key screens: task workspace (chat, terminal emulator, file explorer), dashboard, auth flows. Component list + key props/state for those screens. Other components listed (name + one-line purpose). Complete branding-touchpoint inventory (names, copy, logos, "Shadow Realm" references, colors/theme tokens) |
| `docs/inspection/critique.md` | Tech debt, dead code, stale docs-vs-code drift (e.g. phantom `apps/website/`), risky hacks, security observations, Windows incompatibilities |
| `docs/inspection/impact-guide.md` | Change-impact analysis for both tracks (§6): exact files/subsystems per planned change, recommended sequencing, risk callouts |

### 5.3 Depth requirements

- **Agent pipeline, realtime events, data model, UI/branding**: deepest coverage (user-selected priorities).
- **Infra/deploy (Kata, EKS, ECS scripts)**: map-level coverage only (kept dormant, see D6).
- **Success bar (both)**: (a) coverage checklist — every file in deep areas mapped with refs; (b) agent-consumable — another AI agent could plan and execute changes using only these docs.

---

## 6. Requirements — Change Tracks (context for the impact guide; execution is a later phase)

### Track A — Agent behavior (all four areas planned)
1. **Prompts & planning** ← *agreed first priority*: system prompt rework, planning loop, memory/Wiki changes.
2. **Providers/models**: keep Anthropic/OpenAI/OpenRouter; ADD local models (Ollama/vLLM/llama.cpp via AI SDK) and additional hosted providers (Gemini, DeepSeek, xAI or via OpenRouter) as first-class.
3. **Agent tools**: add/remove/modify tools; MCP integrations.
4. **Autonomy & lifecycle**: task lifecycle, scheduling, parallel/background agents, checkpointing, PR-generation behavior.

### Track B — Product reshape → Electron Windows desktop app
| Aspect | Decision |
|---|---|
| Name | Keep **"Shadow"** — no rename; visuals, copy, product structure may change |
| UI scope | **Full rethink**: visual overhaul AND information-architecture/feature changes |
| Packaging | Electron, Windows-first, **distributable** (NSIS installer, auto-update consideration, signing later) |
| Architecture | **Merge server logic into the Electron main process**; replace Socket.IO with IPC (deepest rework path — inspection must map all process/port/env assumptions to enable this) |
| Data layer | **Switch Prisma to SQLite**; zero-install DB (inspection must inventory every Postgres-specific schema feature: enums, JSON columns, array types, etc.) |
| Remote mode | **Keep code dormant**: leave all Kata/EKS/ECS/remote-branch code untouched; desktop always runs local mode; map-level docs only |
| Auth | **Keep BetterAuth + GitHub OAuth**, adapted for desktop (localhost loopback redirect); PAT quick-start remains the dev path |
| Vector search | **Keep Pinecone** (semantic search unchanged in direction) |
| Attribution | LICENSE only; upstream credits stripped from README/copy during rebrand |
| Runtime | **Accept Windows**: local mode should run natively on Windows (repo currently assumes Node 22 + Postgres + bash scripts — Windows caveats are part of critique) |

### Known tensions to resolve during execution (recorded, not blockers)
- Electron + no-Docker vs. Prisma+Postgres → resolved by SQLite decision; `data-model.md` must audit schema portability.
- Merging server into main process vs. "maintain WebSocket event compatibility" upstream guidance → the realtime-events doc must make the Socket.IO contract fully explicit so IPC replacement is mechanical.
- "Keep both modes" (earlier answer) was superseded by "keep code dormant" — dormant is authoritative.

---

## 7. Post-inspection verification bar (for later phases, not this one)

- `npm run check-types` and `npm run lint` pass on the untouched snapshot (baseline).
- After desktop migration: app installs and runs on Windows without Docker; agent completes a task against a local repo; DB is SQLite single-file; no Socket.IO dependency in renderer↔main path.

---

## 8. Decision Log (interview rounds 1–6)

| # | Question | Decision |
|---|---|---|
| D1 | Kind of big changes | Agent behavior + rebrand/reshape product |
| D2 | Repo strategy | New repo on user's account (not a GitHub fork) |
| D3 | Upstream relationship | One-time snapshot, no sync |
| D4 | Working directory | This repo (`D:/ai/shadow`) |
| D5 | Doc format | Multi-file package under `docs/inspection/` |
| D6 | Deep-coverage areas | Agent pipeline, realtime events, data model, UI & branding (all four) |
| D7 | Doc layers | Factual map + critique + change-impact guide |
| D8 | Diagrams | Yes, Mermaid |
| D9 | Repo name | Reuse `shadow-agent` — recreate repo from scratch, port scaffolding |
| D10 | Git history | Keep full upstream history |
| D11 | Analysis mode | Static analysis only (no build/run in this phase) |
| D12 | Prompt documentation | Main system prompt verbatim; other prompts summarized |
| D13 | Brand name | Keep "Shadow" |
| D14 | Auth | Keep BetterAuth + GitHub OAuth as-is (later: desktop loopback) |
| D15 | Vector search | Keep Pinecone |
| D16 | Remote mode (initial) | Keep both modes — **superseded by D21** |
| D17 | Attribution | LICENSE only; strip upstream credits/marketing later |
| D18 | Reshape scope | Full rethink (visual + IA/features) |
| D19 | First agent track | Prompts & planning |
| D20 | Machine tooling | **Custom answer: Windows desktop app, no Docker, wrapped in Electron** ← pivotal |
| D21 | Remote mode (final) | Keep code dormant; desktop runs local mode only |
| D22 | Data layer | Switch to SQLite |
| D23 | Electron architecture | Merge server into main process; IPC replaces Socket.IO |
| D24 | Desktop auth | Keep OAuth flow (loopback redirect) |
| D25 | Distribution | Distributable (NSIS, auto-update consideration) |
| D26 | UI depth | Key screens deep + exhaustive branding grep; other components listed |
| D27 | Success bar | Coverage checklist + agent-consumable |

---

## 9. Execution Plan (when this spec is green-lit)

1. **Clone**: fresh full clone of `ishaan1013/shadow` → `D:/ai/shadow`; recreate `mohmaedeslam00116/shadow-agent`; push with history.
2. **Port scaffolding**: AGENTS.md + docs/agents into the new tree (update references).
3. **Inspection sweep** (in order): architecture → data-model → agent-pipeline → realtime-events → ui-inventory → critique → impact-guide → index + coverage checklist. Commit docs incrementally.
4. **Baseline verification**: run typecheck/lint where possible without full env setup; record results in critique.md.
5. **Hand off**: impact-guide.md becomes the entry point for Track B phase 1 (Electron shell + SQLite) and Track A phase 1 (prompts & planning).

---

## 10. Open Questions (carried forward)

1. Exact Electron bundler (electron-vite vs. forge vs. builder) — decide at Track B kickoff, informed by `architecture.md`.
2. SQLite migration mechanism (Prisma `sqlite` provider vs. Prisma driver adapters / `@prisma/adapter-better-sqlite3`) — decide after `data-model.md` portability audit.
3. IPC schema design: whether to reuse `packages/types` message-part discriminated unions as the IPC contract (recommended starting point).
4. Auto-update channel/signing certificates — deferred until distribution phase.
5. Whether sidecar's REST API survives as an in-process module or is absorbed into the merged main process — impact guide to recommend.
