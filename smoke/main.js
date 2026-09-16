// SMOKE SHELL (ticket #15) — the desktop architecture in miniature.
// Shims fs (nft/EPERM) → migrate deploy into a temp userData/shadow.db →
// starts the embedded Next production server IN-PROCESS (decision #6) →
// loads it in a BrowserWindow with a preload IPC bridge → drives the
// renderer → auth-redirect assertion → SQLite Prisma round-trip → prints a
// SMOKE SUMMARY and auto-exits. Throwaway probe infra; never shipped.
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

// Patch B mechanism at app runtime: same shim the build used.
require(path.join(__dirname, "..", "scripts", "nft-eperm-shim.js"));

const PORT = 3457;
const BASE = `http://127.0.0.1:${PORT}`;
// Dev run: repo root is one level up. Packaged run (asar:false, decision
// deferred to #8): the monorepo snapshot rides in resources/app-root.
const ROOT = app.isPackaged
  ? path.join(process.resourcesPath, "app-root")
  : path.join(__dirname, "..");
const t0 = Date.now();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
};

function get(url, maxRedirects = 0) {
  return new Promise((resolve) => {
    http
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects < 3) {
          res.resume();
          return resolve(get(new URL(res.headers.location, url).href, maxRedirects + 1));
        }
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      })
      .on("error", (e) => resolve({ status: 0, body: String(e) }));
  });
}

function waitForServer(url, timeoutMs = 60000) {
  const t0w = Date.now();
  return new Promise((resolve, reject) => {
    const ping = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve(res.statusCode);
        })
        .on("error", () => {
          if (Date.now() - t0w > timeoutMs) return reject(new Error("frontend server never came up"));
          setTimeout(ping, 300);
        });
    };
    ping();
  });
}

async function migrateDeploy() {
  // Decision #12: prisma migrate deploy before the server boots, against
  // a fresh userData/shadow.db (temp profile → disposable).
  const dbDir = app.getPath("userData");
  const dbPath = path.join(dbDir, "shadow.db");
  check("userData dir", fs.existsSync(dbDir), dbDir);
  const dbPkg = path.join(ROOT, "packages", "db");
  const env = {
    ...process.env,
    DATABASE_URL: `file:${dbPath}`,
  };
  const prismaBin = require.resolve("prisma/build/index.js", { paths: [dbPkg] });
  const res = await new Promise((resolve) => {
    const p = spawn(process.execPath, [prismaBin, "migrate", "deploy", "--schema", path.join(dbPkg, "prisma", "schema.prisma")], {
      cwd: dbPkg,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
    p.on("error", (e) => resolve({ code: -1, out: String(e) }));
  });
  check("migrate deploy (userData/shadow.db)", res.code === 0, res.code === 0 ? dbPath : res.out.slice(-400));
  return dbPath;
}

async function startEmbeddedNext() {
  // Decision #6: in-process embedded local Next server (next({ dev:false })),
  // NOT a spawned child — the packaged app's process model in miniature.
  const frontendDir = path.join(ROOT, "apps", "frontend");
  const nextDistDir = path.join(frontendDir, ".next");
  if (!fs.existsSync(path.join(nextDistDir, "BUILD_ID"))) {
    check("production build present", false, nextDistDir);
    return null;
  }
  process.chdir(frontendDir);
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = `file:${app.getPath("userData")}/shadow.db`;
  const nextFactory = require(require.resolve("next", { paths: [frontendDir] }));
  const app2 = nextFactory({ dev: false, dir: frontendDir });
  await app2.prepare();
  const handler = app2.getRequestHandler();
  await new Promise((resolve) => {
    app2.httpServer = http.createServer(handler).listen(PORT, "127.0.0.1", resolve);
  });
  check("embedded next server listening", true, BASE);
  return app2;
}

async function run() {
  console.log(`[smoke ${Date.now() - t0}ms] starting`);
  const dbPath = await migrateDeploy();

  const server = await startEmbeddedNext();
  if (!server) return finish(1);

  const status = await waitForServer(`${BASE}/api/models`, 60000);
  check("HTTP reachability (api/models)", status > 0 && status < 500, `status ${status}`);

  // Auth middleware: unauthenticated / redirects (307) to /auth (decision: keep OAuth flow).
  const root = await get(`${BASE}/`);
  check("auth redirect on /", root.status === 200 && /auth/i.test(root.body.slice(0, 4000)), `final ${root.status}`);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadURL(`${BASE}/`);
  const title = await win.webContents.executeJavaScript("document.title");
  check("renderer loaded (title)", typeof title === "string", title);

  // IPC round-trip through the preload bridge.
  const echo = await win.webContents.executeJavaScript("window.smoke.echo('ping')");
  check("IPC echo round-trip", echo === "pong:ping", JSON.stringify(echo));
  const env2 = await win.webContents.executeJavaScript("window.smoke.env()");
  check("renderer runtime versions", env2 && env2.electron, `electron ${env2 && env2.electron}`);

  // SQLite round-trip through the embedded server's Prisma client (main side).
  const { PrismaClient } = require(path.join(ROOT, "packages", "db", "generated", "client"));
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  });
  const users = await prisma.user.count();
  check("SQLite Prisma round-trip", typeof users === "number", `user count ${users}`);
  const settings = await prisma.userSettings.create({
    data: { userId: "smoke-user", selectedModels: JSON.stringify(["gpt-4o"]) },
  });
  check("selectedModels JSON boundary", JSON.parse(settings.selectedModels).length === 1, settings.selectedModels);
  await prisma.$disconnect();

  await win.close();
  return finish(results.every((r) => r.ok) ? 0 : 1);
}

function finish(code) {
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== SMOKE SUMMARY: ${pass}/${results.length} checks passed ===`);
  for (const r of results) console.log(`  [${r.ok ? "PASS" : "FAIL"}] ${r.name}`);
  console.log(`[smoke] total ${Date.now() - t0}ms, exit ${code}`);
  try { app.exit(code); } catch { process.exit(code); }
}

app.whenReady().then(run).catch((e) => {
  console.error("[smoke] fatal:", e);
  finish(1);
});
