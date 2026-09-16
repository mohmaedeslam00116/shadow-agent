# CONTEXT

Glossary for this fork of Shadow. Terms only — no implementation details.

## Terms

- **Shadow** — the product: a background coding agent with a real-time interface. Name is kept in the desktop fork.
- **Shadow Realm** — the agent's execution environment (a workspace where the agent runs tools).
- **Local mode** — execution directly on the host machine's filesystem. The only mode the desktop fork runs.
- **Remote mode** — execution in Kata QEMU microVMs (EKS/ECS). **Dormant** in the desktop fork: code kept, never run, map-level documentation only.
- **Dormant** — code that is kept in the tree but is unreachable in the desktop product; not deleted, not maintained.
- **Sidecar** — the Express file-operations/command-execution service. Its fate (absorbed into the desktop main process vs spawned) is an open decision.
- **Target** — what the agent is asked to work on. Two kinds in the desktop fork: a **local folder** (opened from disk) or a **GitHub repo** (cloned, PR-based). GitHub is optional in v0.
- **Renderer strategy** — how the existing Next.js UI runs inside Electron (static export, embedded local server, or SPA rewrite). To be decided by evidence, not preference.
- **Plan of record** — the destination artifact of the desktop wayfinding map: the sequenced, decision-complete plan plus its ADRs.
