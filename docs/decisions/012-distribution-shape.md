# Decision 012 — Distribution shape (packaging, updates, signing, data layout)

Ticket: [#12](https://github.com/mohmaedeslam00116/shadow-agent/issues/12) · Feeds: [#13](https://github.com/mohmaedeslam00116/shadow-agent/issues/13) (ADR-006 distribution) · Interacts: [#7](https://github.com/mohmaedeslam00116/shadow-agent/issues/7) (DB location), [#10](https://github.com/mohmaedeslam00116/shadow-agent/issues/10) (credential location), [#11](https://github.com/mohmaedeslam00116/shadow-agent/issues/11) (clone location), [#15](https://github.com/mohmaedeslam00116/shadow-agent/issues/15) (packaged smoke test)
Toolchain context: electron-builder locked in Decision 006. All eight decisions HITL-locked this session; nothing implemented.

## 1. Ship format

**Both, NSIS primary.** electron-builder multi-target (nearly free from one config): NSIS installer (default path, the target auto-update supports) + portable ZIP (no-install option). Both artifacts attached to every GitHub Release. The ZIP's update story is re-download by design (electron-updater's supported target is NSIS).

## 2. Auto-update: wired in v0

**electron-updater → GitHub Releases from day one.** electron-builder (locked in #6) generates the `latest.yml` feed natively; Releases is a first-class feed. Check on launch + every few hours; sha512-verified download (differential via blockmaps where available); application is atomic at clean relaunch. A desktop agent that executes commands on user machines needs prompt security fixes — this machinery is standard and cheap once Releases exist.

## 3. Code-signing posture

**Unsigned in v0.** Users see SmartScreen's "Windows protected your PC" (More info → Run anyway); documented in README/release notes. Rationale: solo project, no organizational history for Azure Trusted Signing; OV cert ~$200–500/yr, EV ~$300–700/yr mainly to skip the reputation ramp — not justified for current distribution scale. **Target state recorded in the ADR:** Azure Trusted Signing when organizational history makes it obtainable (~$10/mo, Microsoft-managed); interim path is an OV cert if distribution widens. electron-updater functions with unsigned NSIS on Windows.

## 4. First-launch behavior

**Minimal guided.** Launch → existing `/auth` flow (BetterAuth, shape per #10) → "pick your first target" prompt (folder picker or GitHub repo picker per Decision 011). Default directories are created lazily on first use — no pre-created clutter. No multi-step wizard (every step is a skip-step in practice); no OS permission prompts needed on Windows for this app's surface.

## 5. Data-directory layout (the on-disk story)

| Path | Contents | Rationale |
|---|---|---|
| `%APPDATA%/<app>/userData` (`app.getPath('userData')`) | `shadow.db` (per #7), rotated logs, updater cache, credentials (mechanism per #10 — this decision constrains them to userData) | App state is per-user, uninstall-survivable, OS-standard |
| `~/Shadow/workspaces/<owner>/<repo>` | GitHub clones (per #11) | Bulky user-facing data, visible, outside app-data backups |
| Local-folder targets | wherever the user picked (per #11) | Never copied or relocated by the app |

**Portable ZIP uses the same per-user layout in v0** — no relocation mode. Deferred with reasons: per-launch path detection adds surface for zero v0 value, and the portable target has no auto-update story anyway (ZIP users update by re-download); revisit only if a real request appears.

## 6. Update-failure recovery

**Rely on NSIS/electron-updater atomicity — no custom machinery in v0.** sha512 verified before install; NSIS applies at clean quit, so a mid-install interruption leaves the old version running; failed/interrupted downloads retry on the next check. Manual recovery path (documented): re-run any Release installer over the top. Rejected: previous-installer caching (duplicates Releases permanence), staged-rollout/health-check machinery (over-engineered for solo distribution).

## 7. Rollback

**Reinstall posture.** No local version retention (the electron-builder/Windows reality). Every installer stays published on GitHub Releases permanently; downgrade = download older release, install over. **Schema migrations are designed forward-only** — old app + new DB is the one unsupported combination, called out in release notes when a version migrates.

## 8. Schema upgrades for shipped databases (repo-recon finding)

Repo recon confirmed: **no Prisma migrations directory exists** — upstream runs schema-first `db push`. Unacceptable for shipped user data. **Locked: adopt Prisma migrations at build phase** — baseline the current schema once on SQLite (free: dev data disposable per #7), switch dev workflow to `prisma migrate`, and the packaged app runs `migrate deploy` at startup before the embedded Next server boots (ordering owned by #8's startup sequence). This is the prerequisite for shipping updates that touch the schema without corrupting `shadow.db`.

## 9. Rejected alternatives (why)

- **NSIS-only / ZIP-only** — loses the escape hatch / loses the supported auto-update target.
- **Version-check-only updates** — users run stale agent builds indefinitely; security posture fails.
- **Cert now (OV/EV)** — cost without a distribution scale that needs it; reputation accrues only with signing, so starting later costs little.
- **Onboarding wizard / bare shell** — wizard is skip-steps all the way down; bare shell is a coldest-possible first impression for a product whose first-run needs auth + a target.
- **All app-state in userData incl. clones** — contradicts #11; hides multi-GB data.
- **Install-dir data** — breaks under Program Files ACLs and multi-user machines.
- **Custom rollback/staged-rollout** — machinery v0 doesn't earn.
- **db push + hand-rolled per-release SQL diffs** — no history, easy to get wrong, exactly what migrations exist to prevent.
- **Wipe-on-upgrade** — destroys user task history; anti-feature.

## 10. Consequences / trade-offs

- Unsigned builds mean a SmartScreen dialog for every new user until signing changes — the accepted cost of v0.
- `migrate deploy` at startup adds a startup step and makes migration discipline mandatory for every schema change from build phase onward.
- Releases-forever permanence is a commitment: old installers never deleted.
- Same layout in portable mode means the ZIP isn't "self-contained on a stick" — documented, deferred.
- updater cache in userData is small (differential blockmaps); logs rotated to bound growth.

## 11. Follow-ups & map changes

- **#15**: packaged smoke test adds two checks — `latest.yml` feed present on a draft release, and `migrate deploy` runs clean in the packaged app before server boot. Comment posted.
- **#10**: credential storage constrained to userData (mechanism — safeStorage vs OS keyring — remains #10's to decide). Comment posted.
- **#8**: startup sequence must place `migrate deploy` before the embedded server boots (already in its scope; noted on the ticket).
- **#13**: raw material for ADR-006; two minor decisions locked inline during synthesis rather than as tickets: crash-reporting posture (telemetry-free), installer UX copy.
