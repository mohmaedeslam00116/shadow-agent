#!/usr/bin/env node
/**
 * Patch B mechanism — nft junction-EPERM shim (next.js#96823 sibling failure)
 *
 * Next's bundled @vercel/nft output-file-tracing glob-walks from the user's
 * home directory (a traced dep resolves cross-volume) and dies with EPERM on
 * the legacy "C:\Users\<user>\Application Data" junction. Neither
 * outputFileTracingRoot (top-level or experimental) nor
 * outputFileTracingExcludes stops the walk (proven in Memo 007).
 *
 * Mechanism: spawn the Next CLI under Node directly with
 * `--require scripts/nft-eperm-shim.js`. No npx/.cmd chain, no NODE_OPTIONS
 * indirection — the shim is guaranteed loaded in the actual build process.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const shimPath = path.join(__dirname, "nft-eperm-shim.js");
const frontendDir = path.join(root, "apps", "frontend");
const nextBin = require.resolve("next/dist/bin/next", { paths: [frontendDir] });

const result = spawnSync(
  process.execPath,
  ["--require", shimPath, nextBin, "build", ...process.argv.slice(2)],
  {
    cwd: frontendDir,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
      SHIM_PROJECT_ROOT: root,
      // The production webpack build of this app (Monaco + heavy UI) exceeds
      // Node's default 4 GB heap — raise it explicitly.
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=12288"]
        .filter(Boolean)
        .join(" "),
    },
    stdio: "inherit",
  }
);

process.exit(result.status ?? 1);
