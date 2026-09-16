#!/usr/bin/env bash
# Patch A — flight-client-entry-plugin.js (next.js#96823 Windows crash)
#
# Captures the working, hand-patched plugin from node_modules into patches/
# as a pristine drop-in file. The hand-patch (applied during ticket #6) ports
# the guard set from vercel/next.js PR #96830 to Next 15.3.5:
#   - chunkGroup.name normalized (backslashes) before use as mapping key
#   - guarded worker loops (skip missing mapping entries instead of crashing)
# scripts/apply-desktop-patches.js copies this file back over node_modules.
#
# Strategy: the unpatched plugin differs from the patched one only in a
# middle byte range, so we splice head+tail from the ORIGINAL upstream file
# (git-restored) with the patched middle segment. Run once; commit the result.
set -euo pipefail
cd "$(dirname "$0")/.."

F=node_modules/next/dist/build/webpack/plugins/flight-client-entry-plugin.js
OUT=patches/flight-client-entry-plugin.js
mkdir -p patches

if ! grep -q "__normalizePathSep" "$F"; then
  echo "ERROR: $F does not carry the hand-patch — nothing to capture." >&2
  exit 1
fi

# Locate the patch boundaries in the PATCHED file (first/last changed lines).
FIRST=$(grep -n "__normalizePathSep = " "$F" | head -1 | cut -d: -f1)
LAST=$(grep -n "if (modId) {" "$F" | tail -1 | cut -d: -f1)
END=$((LAST + 2))   # closing brace of the guarded block

# Extract the patched middle segment.
sed -n "${FIRST},${END}p" "$F" > /tmp/patched-middle.js

# Rebuild the original (upstream) file: same file with the patch reverted via
# git is not possible (node_modules is not tracked), so we splice: everything
# before FIRST and after END comes from the patched file unchanged; the
# middle is replaced by reconstructing the original from the PR diff.
# Simpler and lossless: keep head/tail from patched file and the patched
# middle — i.e. the whole patched file IS the drop-in.
cp "$F" "$OUT"

echo "Captured $(wc -l < "$OUT") lines to $OUT"
echo "Verifying syntax..."
node --check "$OUT"
echo "OK: patches/flight-client-entry-plugin.js is a valid drop-in."
