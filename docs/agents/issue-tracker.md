# Issue tracker

Issues for this repo live in **GitHub Issues**, managed with the `gh` CLI.

- **Repository**: `mohmaedeslam00116/shadow-agent` (https://github.com/mohmaedeslam00116/shadow-agent)
- **Create an issue**: `gh issue create --title "..." --body "..."`
- **List issues**: `gh issue list`
- **View an issue**: `gh issue view <number>`
- **Close an issue**: `gh issue close <number>`

## Wayfinding operations

Wayfinder maps and tickets are GitHub Issues:

- **Map**: a single issue labelled `wayfinder:map`. Its body is the low-res index (Destination, Notes, Decisions so far, Not yet specified, Out of scope).
- **Tickets**: child issues of the map, labelled `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`, each with `Map: #N` in the body.
- **Blocking**: GitHub has no native blocking, so tickets use a body convention — a `Blocked by: #a, #b` line. A ticket is unblocked when every issue in its Blocked-by line is closed.
- **Claim**: assign the issue to yourself (`gh issue edit <n> --add-assignee @me`) before working it. An open, unassigned ticket is unclaimed.
- **Frontier query** (open, unblocked, unclaimed — filter the labels you want):
  `gh issue list --label wayfinder:research --state open --json number,title,assignees`
- **Resolve**: post the answer as a comment, close the issue, append a one-line gist + link to the map's Decisions-so-far.

## PRs as a request surface

- **Enabled**: no

External pull requests are **not** included in the triage queue. Only GitHub
Issues are treated as work items. A user who wants external PRs in the triage
queue can flip this flag to `yes`.
