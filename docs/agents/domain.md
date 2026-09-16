# Domain docs

This repo uses the **single-context** layout: one `CONTEXT.md` at the repo root
plus ADRs under `docs/adr/`.

## Layout

- `CONTEXT.md` — domain glossary and core concepts for the whole repo
- `docs/adr/` — architecture decision records, numbered `NNNN-title.md`

## Consumer rules

When a task touches domain concepts, business rules, or naming:

1. Read `CONTEXT.md` before making changes that involve domain terminology.
2. If a term is missing or ambiguous, add or refine its entry in `CONTEXT.md`
   as part of the change.
3. Record significant architectural decisions as a new ADR in `docs/adr/`,
   following the numbering scheme of existing entries.
4. Never contradict an existing ADR without superseding it: either update the
   ADR in place (if it is still a draft) or write a new ADR that explicitly
   supersedes the old one.

There are no per-package contexts: this is a single-context repo. Do not create
`CONTEXT-MAP.md` or per-directory `CONTEXT.md` files unless the repo grows into
a genuine multi-package monorepo.
