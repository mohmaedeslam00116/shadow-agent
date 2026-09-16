#!/usr/bin/env node
/**
 * Applies the desktop-fork build patches to node_modules. Idempotent.
 *
 * Patch A — flight-client-entry-plugin.js (next.js#96823 Windows crash):
 *   Copies the captured, guarded plugin over Next's compiled output.
 *   Source of truth: patches/flight-client-entry-plugin.js
 *   (captured by scripts/capture-flight-plugin-patch.sh during ticket #6;
 *   ports vercel/next.js PR #96830's guard set to Next 15.3.5).
 *
 * Patch B — nft junction-EPERM:
 *   No file surgery needed. scripts/build-frontend.js injects
 *   scripts/nft-eperm-shim.js via NODE_OPTIONS for the build; the packaged
 *   app's main process requires the same shim before booting the embedded
 *   Next server. Nothing to do here — listed for discoverability.
 *
 * Wired as apps/frontend "prebuild", so `next build` (and any turbo-ordered
 * build) always runs against a patched tree. Safe to run repeatedly.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "patches", "flight-client-entry-plugin.js");
const dst = path.join(
  root,
  "node_modules",
  "next",
  "dist",
  "build",
  "webpack",
  "plugins",
  "flight-client-entry-plugin.js"
);

if (!fs.existsSync(src)) {
  console.error("[desktop-patches] missing " + src + " — run the capture script first");
  process.exit(1);
}
if (!fs.existsSync(dst)) {
  console.error("[desktop-patches] missing " + dst + " — run npm install first");
  process.exit(1);
}

const patched = fs.readFileSync(src, "utf8");
const current = fs.readFileSync(dst, "utf8");

if (current === patched) {
  console.log("[desktop-patches] Patch A already applied (flight-client-entry-plugin)");
  process.exit(0);
}
if (!patched.includes("__normalizePathSep")) {
  console.error("[desktop-patches] captured patch file looks unpatched — refusing to apply");
  process.exit(1);
}

fs.writeFileSync(dst, patched);
console.log("[desktop-patches] Patch A applied: flight-client-entry-plugin.js (next.js#96823 guard set)");
