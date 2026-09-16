/**
 * Patch B mechanism — fs shim for the @vercel/nft junction EPERM.
 * Loaded via --require (build wrapper / packaged desktop main process).
 *
 * The bundled nft inside Next walks from the user home dir and dies with
 * EPERM on Windows legacy profile junctions ("Application Data",
 * "My Documents", "Local Settings", ...). Neither outputFileTracingRoot
 * nor outputFileTracingExcludes stops the walk (Memo 007).
 *
 * Mechanism: readdir/readdirSync/promises.readdir catch EPERM/EACCES —
 * the "structurally unreadable" errnos (legacy profile junctions, the
 * WindowsApps execution-alias files) — and return [] so the walk treats
 * those entries as empty. Name-matching was tried first and abandoned:
 * the failure family is open-ended (Application Data → My Documents →
 * WindowsApps aliases...).
 *
 * Scope guard: when SHIM_PROJECT_ROOT is set (build wrapper sets it),
 * errors for paths INSIDE that root are rethrown — genuine permission
 * problems in the project tree must stay loud. Outside, the walk's
 * readdir failures are advisory (output-file-tracing), so [] is safe.
 */
(function () {
  const fs = require("fs");
  const path = require("path");

  if (fs.__nftShimApplied) return;
  fs.__nftShimApplied = true;

  const projectRoot = process.env.SHIM_PROJECT_ROOT
    ? path.resolve(process.env.SHIM_PROJECT_ROOT).toLowerCase().replace(/\\/g, "/")
    : null;

  function isInsideProject(p) {
    if (!projectRoot || typeof p !== "string") return false;
    const norm = path.resolve(String(p)).toLowerCase().replace(/\\/g, "/");
    return norm === projectRoot || norm.startsWith(projectRoot + "/");
  }

  function isFatal(err, p) {
    if (!err) return false;
    if (err.code !== "EPERM" && err.code !== "EACCES") return false;
    return !isInsideProject(p);
  }

  const origReaddirSync = fs.readdirSync;
  fs.readdirSync = function (p, ...rest) {
    try {
      return origReaddirSync.call(this, p, ...rest);
    } catch (err) {
      if (isFatal(err, p)) return [];
      throw err;
    }
  };

  const origReaddir = fs.readdir;
  fs.readdir = function (p, ...rest) {
    const cb = rest[rest.length - 1];
    const args = rest.slice(0, -1);
    if (typeof cb !== "function") {
      // No callback: delegate; a throw of EPERM/EACCES becomes an empty array.
      try {
        return origReaddir.call(this, p, ...rest);
      } catch (err) {
        if (isFatal(err, p)) return [];
        throw err;
      }
    }
    try {
      return origReaddir.call(this, p, ...args, function (err, files) {
        if (err && isFatal(err, p)) return cb(null, []);
        cb(err, files);
      });
    } catch (err) {
      if (isFatal(err, p)) return process.nextTick(() => cb(null, []));
      throw err;
    }
  };

  const origPromisesReaddir = fs.promises.readdir;
  fs.promises.readdir = async function (p, ...rest) {
    try {
      return await origPromisesReaddir.call(this, p, ...rest);
    } catch (err) {
      if (isFatal(err, p)) return [];
      throw err;
    }
  };
})();
