// WAYFINDER PROBE (ticket #5) — throwaway, never merge.
// Electron main process: spawns the Next.js dev server as a child process,
// loads it into a BrowserWindow, and round-trips one IPC call.
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const http = require("http");

const PORT = 3457;
const URL_BASE = `http://127.0.0.1:${PORT}`;
const t0 = Date.now();
const log = (msg) => console.log(`[probe ${Date.now() - t0}ms] ${msg}`);
const logFile = [];

// Main-process env: Prisma is required in the handlers below, so the DB URL
// must exist here too. Schema is still postgres — expected outcome of
// probe:get-users is a clean P1001 connection error (no Postgres running),
// which proves the client loads + constructs + attempts a real connection.
Object.assign(process.env, {
  DATABASE_URL: "postgres://postgres:@127.0.0.1:5432/shadow_dev",
  DIRECT_URL: "postgres://postgres:@127.0.0.1:5432/shadow_dev",
  BETTER_AUTH_SECRET: "probe-secret",
  NEXT_PUBLIC_VERCEL_ENV: "development",
  NEXT_PUBLIC_SERVER_URL: `http://127.0.0.1:${PORT}`,
});

const LOG_PATH = require("path").join(
  __dirname,
  "..",
  "apps",
  "frontend",
  ".next-probe",
  "probe.log"
);

function appendLog(line) {
  logFile.push(`[${Date.now() - t0}ms] ${line}`);
  require("fs").mkdirSync(require("path").dirname(LOG_PATH), {
    recursive: true,
  });
  require("fs").appendFileSync(LOG_PATH, logFile[logFile.length - 1] + "\n");
}

let frontendProc = null;

function waitForServer(url, timeoutMs = 180000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server did not start in ${timeoutMs}ms`));
        } else {
          setTimeout(tick, 500);
        }
      });
    };
    tick();
  });
}

async function startFrontend() {
  appendLog("spawning next dev");
  frontendProc = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--", "--port", String(PORT)],
    {
      cwd: require("path").join(__dirname, "..", "apps", "frontend"),
      // Windows + Electron >= 20: spawning .cmd shims requires shell:true
      // (CVE-2024-27980 mitigation). FINDING for the real app: any code that
      // spawns processes (agent terminal!) must account for this on Windows.
      shell: process.platform === "win32",
      env: {
        ...process.env,
        DATABASE_URL: "file:./probe.db",
        DIRECT_URL: "file:./probe.db",
        BETTER_AUTH_SECRET: "probe-secret",
        NEXT_PUBLIC_VERCEL_ENV: "development",
        NEXT_PUBLIC_SERVER_URL: `http://127.0.0.1:${PORT}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  frontendProc.stdout.on("data", (d) =>
    appendLog(`[next stdout] ${d.toString().trim()}`)
  );
  frontendProc.stderr.on("data", (d) =>
    appendLog(`[next stderr] ${d.toString().trim()}`)
  );
  log("next dev spawned");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Shadow — wayfinder probe",
    webPreferences: {
      preload: require("path").join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on("did-fail-load", (_e, code, desc, url) =>
    appendLog(`did-fail-load ${code} ${desc} ${url}`)
  );
  win.webContents.on("render-process-gone", (_e, details) =>
    appendLog(`render-process-gone ${JSON.stringify(details)}`)
  );
  win.webContents.on("did-finish-load", () => {
    appendLog("did-finish-load; driving IPC from main");
    // Drive the round-trips from the main process so the probe is autonomous.
    win.webContents
      .executeJavaScript(
        `(async () => {
          const out = {};
          try { out.echo = await window.probe.echo({ hello: 'from-renderer', n: 42 }); } catch (e) { out.echo = 'ERR ' + e.message; }
          try { out.env = await window.probe.env(); } catch (e) { out.env = 'ERR ' + e.message; }
          try { out.users = await window.probe.getUsers(); } catch (e) { out.users = 'ERR ' + e.message; }
          try { out.tasks = await window.probe.getTasks(); } catch (e) { out.tasks = 'ERR ' + e.message; }
          return out;
        })()`
      )
      .then((results) => {
        appendLog(`PROBE-SUMMARY ${JSON.stringify(results)}`);
        setTimeout(() => {
          appendLog("auto-exit after summary");
          app.quit();
        }, 1500);
      })
      .catch((e) => appendLog(`executeJavaScript ERR ${e.message}`));
  });
  win.loadURL(URL_BASE);
  log(`BrowserWindow loading ${URL_BASE}`);
}

app.whenReady().then(async () => {
  appendLog("electron ready");
  try {
    await startFrontend();
    const status = await waitForServer(URL_BASE);
    appendLog(`server responded with HTTP ${status}`);
    createWindow();
  } catch (err) {
    appendLog(`FATAL: ${err.message}`);
    console.error(err);
    app.quit();
  }
});

// --- IPC handlers: the round-trip under test ---
ipcMain.handle("probe:echo", (_event, payload) => {
  appendLog(`probe:echo received ${JSON.stringify(payload)}`);
  return { pong: true, payload, at: new Date().toISOString() };
});

ipcMain.handle("probe:get-users", async () => {
  // Real Prisma round-trip from the main process.
  // Schema is still Postgres (SQLite is ticket #7): a P1001 connection error
  // here is the EXPECTED pass condition — client loads, constructs, connects.
  try {
    const { prisma } = require("@repo/db");
    const users = await prisma.user.findMany({ take: 5 });
    appendLog(`probe:get-users returned ${users.length} users`);
    return { count: users.length, users: users.map((u) => ({ id: u.id, email: u.email })) };
  } catch (err) {
    appendLog(`probe:get-users error (expected if no Postgres): ${err.message.split("\n")[0]}`);
    return { error: err.message.split("\n")[0], kind: "prisma", loaded: true };
  }
});

ipcMain.handle("probe:get-tasks", async () => {
  try {
    const { prisma } = require("@repo/db");
    const tasks = await prisma.task.findMany({ take: 5 });
    appendLog(`probe:get-tasks returned ${tasks.length} tasks`);
    return { count: tasks.length };
  } catch (err) {
    return { error: err.message.split("\n")[0], kind: "prisma", loaded: true };
  }
});

ipcMain.handle("probe:env", () => ({
  nodeEnv: process.env.NODE_ENV,
  electron: process.versions.electron,
  node: process.versions.node,
  platform: process.platform,
}));

app.on("window-all-closed", () => {
  appendLog("window-all-closed; exiting");
  if (frontendProc) frontendProc.kill();
  app.quit();
});

process.on("exit", () => {
  // best-effort final dump in case appendFileSync missed anything
  try {
    require("fs").appendFileSync(LOG_PATH, logFile.join("\n"));
  } catch {}
});
