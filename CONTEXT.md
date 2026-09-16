# CONTEXT

Glossary for this fork of Shadow. Terms only — no implementation details.

## Terms

- **Shadow** — the product: a background coding agent with a real-time interface. Name is kept in the desktop fork.
- **Shadow Realm** — the agent's execution environment (a workspace where the agent runs tools).
- **Local mode** — execution directly on the host machine's filesystem. The only mode the desktop fork runs.
- **Remote mode** — execution in Kata QEMU microVMs (EKS/ECS). **Dormant** in the desktop fork: code kept, never run, map-level documentation only.
- **Dormant** — code that is kept in the tree but is unreachable in the desktop product; not deleted, not maintained.
- **Sidecar** — the Express file-operations/command-execution service. Its fate (absorbed into the desktop main process vs spawned) is an open decision.
- **Target** — what the agent is asked to work on. A persisted, first-class entity (`Target` table) with two kinds: a **local folder** (opened from disk) or a **GitHub repo** (cloned to `~/Shadow/workspaces/<owner>/<repo>`, PR-based). Many Tasks may share one Target; one agent run runs at a time per Target. Tasks reference their Target by id.
- **Workspace root** — the canonical (`fs.realpath`-resolved) directory a Target points at. All file access and command execution is contained inside it unless the user explicitly approves an outside-workspace operation.
- **Workspace quarantine** — the state of a Target whose folder is missing or moved at app start or use: registered but blocked; the user may re-link the folder or remove the record (never deleting the disk folder).
- **userData layout** — where the desktop app keeps its state: `userData` holds app state (shadow.db, logs, updater cache, credentials); `~/Shadow/workspaces` holds GitHub clones; local-folder targets stay wherever the user picked them.
- **Reinstall posture** — the update/rollback model: auto-update forward via electron-updater; going back a version means installing an older Release over the top; no local version retention; schema migrations are forward-only.
- **Renderer strategy** — how the existing Next.js UI runs inside Electron (static export, embedded local server, or SPA rewrite). To be decided by evidence, not preference.
- **Plan of record** — the destination artifact of the desktop wayfinding map: the sequenced, decision-complete plan plus its ADRs.
