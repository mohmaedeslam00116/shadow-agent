# Decision 011 — Target model (local folders + GitHub repos)

Ticket: [#11](https://github.com/mohmaedeslam00116/shadow-agent/issues/11) · Feeds: [#13](https://github.com/mohmaedeslam00116/shadow-agent/issues/13) (ADR-004 target model, ADR-005 workspace security) · Consumers: [#14](https://github.com/mohmaedeslam00116/shadow-agent/issues/14), [#8](https://github.com/mohmaedeslam00116/shadow-agent/issues/8), [#9](https://github.com/mohmaedeslam00116/shadow-agent/issues/9)
Grounding: Memo 004 (IPC inventory), Decision 006 (renderer/toolchain), Decision 007 (data layer), repo recon of `local-tool-executor.ts`, `command-security`, `socket.ts` task rooms, `githubService`, Prisma schema.

All eight decisions HITL-locked in this session. Nothing here is implemented yet.

## 1. Final Target model

**One unified `Target` entity** — a discriminated union `kind: 'local' | 'github'` in `packages/types`, one `Target` table, Tasks reference it by `targetId` FK (currently: free-text `repoFullName`/`repoUrl`/`branch` on Task → migrate to Target).

SQLite columns (on top of upstream's id/title/createdAt/updatedAt pattern):

| Column | Local | GitHub |
|---|---|---|
| `kind` | `'local'` | `'github'` |
| `displayName` | folder name | `owner/repo` |
| `canonicalPath` | realpath of picked folder | realpath of clone dir (`~/Shadow/workspaces/<owner>/<repo>`) |
| `repoFullName` | — | `owner/repo` (identity key for already-cloned detection) |
| `repoUrl` | — | clone URL |
| `defaultBranch` | — | captured at clone |
| `status` | `active \| quarantined` | same + `cloning` |

Not stored: branch-per-task (stays on Task), credentials (never — see #10), file listings.

**Sharing: N tasks : 1 Target; one agent run at a time per Target** (extra runs queue — matches the existing chatService queue). Concurrent runs via worktrees: deferred (out of scope for v0).

## 2. Local-folder lifecycle

`native folder picker → realpath canonicalization → containment sanity (exists, is dir, readable) → register Target (active) → workspace root → tasks execute`

- **Single workspace root per Target.** No multi-root in v0.
- **Moved/deleted folder → quarantine**: Target flagged `quarantined`, tasks against it blocked with a clear state. User actions: **Re-link** (re-pick folder; rebind if plausible match) or **Remove** (deletes the DB record only — never touches the disk folder). Restart always tolerates missing dirs.
- **Canonical paths**: every stored path is `fs.realpath`-resolved at registration and re-verified per session. Windows drive-letter casing normalized (uppercase drive), backslashes normalized internally.
- **Duplicate detection**: same realpath → re-open existing Target, not a duplicate row.

## 3. Workspace security boundary (ADR-level)

**Policy: inside-workspace = allowed automatically; anything resolving outside = explicit user approval per operation.** Not deny (breaks npm/git/legit flows), not a static allowlist (brittle, evadable). The approval flow rides the existing `CommandApprovalRequest` channel in `packages/command-security`.

Definition of "outside", applied to every path the agent touches (file ops, command cwd, and path-like arguments the agent passes to commands):

- Resolve via `fs.realpath` (follows symlinks/junctions). Realpath lands outside the workspace root → outside. This single sound test catches `..`, absolute paths, symlink/junction traversal, and created-during-session escapes; lexical checks are unsound and rejected as the enforcement mechanism.
- Drive changes and UNC/network paths (`\\server\share`, mapped drives) are inherently outside.
- Commands whose *text* references outside paths (e.g. `npm install`, `git push`) are evaluated by the same module before spawn: cwd containment is mandatory; referenced outside paths trigger the per-op approval.

## 4. Ownership — Target layer ↔ #14 execution layer

**One shared module, two consumers**: `packages/workspace-security` (extends the `packages/command-security` pattern). API: `canonicalize(p) → WorkspacePath`, `containmentCheck(workspaceRoot, path) → { inside } | { outside, reason }`, `evaluateCommand(workspaceRoot, command, args) → approval-requiring set`. 

- Target layer calls it for file-op paths (its file tools currently `path.resolve()` with **no** containment check — recon-verified — so this is new enforcement, not a port).
- #14's spawn wrapper calls it for cwd + command evaluation before spawn; shell quoting is #14's problem *after* validation (the module evaluates post-tokenization input; #14 owns tokenization and the `.cmd`/`shell:true` semantics from the probe).
- Symlink/junction resolution: realpath inside the module — the only implementation, so no drift.
- #14 receives: canonical workspace root (realpath'd), evaluated command plan, approval verdicts. It does not re-implement policy.

## 5. GitHub target flow (v0)

`pick repo (existing GitHub UI) → clone into ~/Shadow/workspaces/<owner>/<repo> (skipped if realpath already there) → register Target → tasks on per-task branches → PR via existing githubService`

- **Clone home: `~/Shadow/workspaces/<owner>/<repo>`** (HITL-locked over userData — clones are bulky user-facing data, not app state; userData stays DB/credentials per Decision 007). Configurable in settings later.
- **Identity**: `owner/repo` is the identity key; stored clone URL is informational. Upstream-origin assumptions only (no fork/upstream pairs in v0 — upstream's model already assumes this).
- **Auth**: consumed from the existing BetterAuth GitHub token at git-spawn time (exact transport — env vs credential helper — is #10's credential-lifecycle call; Target layer depends on that interface, doesn't own it).
- **Already exists locally**: realpath match under the workspaces home → reuse (fast re-open), not re-clone. A non-empty mismatched dir → quarantine-style prompt.
- **In-process vs services**: repo listing/PR creation stay in the existing in-process `githubService` (no redesign); clone/branch/commit/push are git-spawn operations through #14's wrapper (so they inherit containment + tree-kill semantics).
- **Failure/recovery**: clone failure → Target not registered, error surfaced; push/PR failure → task-level error state, workspace intact; auth loss → quarantine-equivalent "needs auth" state on GitHub targets (#10 owns re-auth UX).

## 6. Persistence and lifecycle

| Event | Survives? | Behavior |
|---|---|---|
| App restart | Targets, Tasks, quarantines | Roots re-verified lazily; missing → quarantine |
| Target removal | Disk folder | DB record deleted; local folders and clones **never** auto-deleted |
| Missing local folder | Target record | Quarantine → re-link/remove |
| Deleted clone | Target record | Quarantine → offer re-clone |
| GitHub auth loss | Target record | `needs-auth` state (#10 owns recovery) |

Targets are **user-managed entities** (a management surface in the UI), not task-scoped records.

## 7. SQLite schema implications (feeds #15 build + ADR-004)

- New `Target` table; `Task.targetId` FK; drop repo fields from Task (data is disposable per Decision 007 — no migration script).
- `kind` is a Prisma enum (SQLite enums supported on 6.13 — Memo 003).
- Paths stored as TEXT, always canonical form.
- Provider swap / userData placement per Decision 007 unchanged.

## 8. Rejected alternatives (why)

- **Two separate entities** — duplicates task wiring, exec plumbing, UI for two kinds identical at execution time.
- **Task-scoped workspace strings (status quo)** — no reuse, no management, re-picking folders constantly; upstream's local mode has no containment at all.
- **Hard deny / static allowlist boundary** — breaks dependency install & git network ops / brittle whack-a-mole.
- **Lexical or hybrid path checks** — evadable via symlinks/junctions; unsound.
- **userData for clones** — hides multi-GB data, bloats app-data backups.
- **Clone-per-task / 1:1** — multi-GB duplication, no shared context.
- **Worktrees in v0** — real value, but a lifecycle surface v0 doesn't need; revisit post-v0.

## 9. Consequences / trade-offs

- Per-op approval prompts are the price of sovereignty; volume is bounded because inside-workspace ops never prompt.
- Realpath on every op adds I/O on Windows; acceptable at agent interaction rates, and `canonicalize` results can be cached per session with invalidation on quarantine.
- Unified Target slightly complicates the schema vs status quo, but the union is exactly two arms and the execution path is shared.
- `~/Shadow/workspaces` is outside the app's uninstall footprint — deliberate (user data), documented in #12's data-layout map.

## 10. Follow-ups & map changes

- **#14 gains a consumer contract**: spawn wrapper must accept (canonical root, evaluated command plan, approval verdict) — comment posted on #14.
- **#10 gains one dependency note**: git auth transport interface consumed by Target layer.
- **#13**: this memo is the raw material for ADR-004 (target model) + ADR-005 (workspace security).
- No new tickets needed; the enforcement work lands inside #14 (module) + the build phase (Target table/UI).
