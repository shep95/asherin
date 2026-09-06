// Asherin Sentinel — desktop companion, main process.
//
// NARRATIVE CHECK, written before the code:
//
// The room in the browser is honest about its ceiling: a tab cannot outlive the
// browser, and no web page records after the process dies or the machine sleeps.
// This companion is the part that legitimately extends that reach, and only as
// far as an operating system actually allows:
//
//   • it runs as its own process, so closing the browser changes nothing.
//   • it starts at login (opt-in, toggled from the tray), so a reboot resumes
//     the watch without anyone opening anything.
//   • it holds the microphone with the window hidden, which a tab cannot.
//   • it keeps a visible tray presence and a recording indicator the OS shows —
//     covert capture is not a feature, it is a crime in most jurisdictions.
//
// What it still does NOT do, and will not claim: record while the machine is
// powered off, suspended, or hibernating. No user-space process on any OS does.
// On sleep it marks the device "sleeping" and resumes on wake, and the gap is
// visible in the timeline rather than papered over.

const { app, BrowserWindow, Tray, Menu, ipcMain, powerMonitor, shell, nativeImage } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fssync = require("node:fs");

const STORE_FILE = () => path.join(app.getPath("userData"), "sentinel.json");
const PENDING_DIR = () => path.join(app.getPath("userData"), "pending");

let win = null;
let tray = null;
let quitting = false;
let lastState = { state: "idle", pending: 0, message: null, label: "" };

async function readStore() {
  try {
    return JSON.parse(await fs.readFile(STORE_FILE(), "utf8"));
  } catch {
    return {};
  }
}

async function writeStore(patch) {
  const next = { ...(await readStore()), ...patch };
  await fs.mkdir(path.dirname(STORE_FILE()), { recursive: true });
  await fs.writeFile(STORE_FILE(), JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

function trayIcon() {
  // A 16x16 monochrome dot, drawn in code so the bundle carries no binary asset
  // that could drift from the product mark.
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - 7.5, dy = y - 7.5;
      const r = Math.sqrt(dx * dx + dy * dy);
      const a = r < 5.2 ? 255 : r < 6.4 ? 120 : 0;
      const i = (y * size + x) * 4;
      buf[i] = buf[i + 1] = buf[i + 2] = 235;
      buf[i + 3] = a;
    }
  }
  const img = nativeImage.createFromBuffer(buf, { width: size, height: size });
  img.setTemplateImage(true);
  return img;
}

function buildTray() {
  tray = new Tray(trayIcon());
  refreshTray();
  tray.on("click", () => showWindow());
}

function refreshTray() {
  if (!tray) return;
  const login = app.getLoginItemSettings().openAtLogin;
  const menu = Menu.buildFromTemplate([
    { label: `asherin.sentinel — ${lastState.state}`, enabled: false },
    { label: lastState.pending ? `${lastState.pending} segment(s) waiting to sync` : "everything synced", enabled: false },
    { type: "separator" },
    { label: "open companion", click: () => showWindow() },
    {
      label: lastState.state === "listening" ? "pause listening" : "start listening",
      click: () => win?.webContents.send("companion:toggle"),
    },
    { type: "separator" },
    {
      label: "start at login",
      type: "checkbox",
      checked: login,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked, openAsHidden: true });
        refreshTray();
      },
    },
    { label: "open the account timeline", click: () => shell.openExternal("https://asherin.com/dashboard/sentinel") },
    { type: "separator" },
    { label: "quit (stops the watch)", click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setToolTip(`asherin.sentinel — ${lastState.state}`);
  tray.setContextMenu(menu);
}

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 640,
    show: false,
    title: "Asherin Sentinel",
    backgroundColor: "#0b0b0c",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.loadFile(path.join(__dirname, "dist", "index.html"));
  win.on("close", (e) => {
    // Closing the window must not stop the watch — that is the entire point of
    // the companion. Quit is explicit, from the tray.
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

// The renderer asks for the microphone; grant it only to our own bundled page.
function wirePermissions() {
  const session = require("electron").session.defaultSession;
  session.setPermissionRequestHandler((wc, permission, callback) => {
    callback(permission === "media" && wc === win?.webContents);
  });
}

app.whenReady().then(async () => {
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  app.on("second-instance", () => showWindow());
  await fs.mkdir(PENDING_DIR(), { recursive: true });
  wirePermissions();
  createWindow();
  buildTray();

  const store = await readStore();
  if (!store.token) showWindow(); // unpaired: the operator must see the code box

  powerMonitor.on("suspend", () => win?.webContents.send("companion:power", "suspend"));
  powerMonitor.on("resume", () => win?.webContents.send("companion:power", "resume"));
});

app.on("window-all-closed", () => { /* tray app: never quit on window close */ });
app.on("before-quit", () => { quitting = true; });

// ── ipc: storage the renderer cannot reach on its own ───────────────────────
ipcMain.handle("store:get", () => readStore());
ipcMain.handle("store:set", (_e, patch) => writeStore(patch || {}));
ipcMain.handle("store:clear-token", () => writeStore({ token: null, deviceKey: null }));

ipcMain.handle("pending:write", async (_e, id, payload) => {
  await fs.mkdir(PENDING_DIR(), { recursive: true });
  await fs.writeFile(path.join(PENDING_DIR(), `${id}.json`), JSON.stringify(payload), { mode: 0o600 });
  return true;
});
ipcMain.handle("pending:list", async (_e, limit) => {
  await fs.mkdir(PENDING_DIR(), { recursive: true });
  const names = (await fs.readdir(PENDING_DIR())).filter((n) => n.endsWith(".json")).sort();
  const out = [];
  for (const n of names.slice(0, Math.max(1, Number(limit) || 3))) {
    try {
      out.push({ id: n.replace(/\.json$/, ""), payload: JSON.parse(await fs.readFile(path.join(PENDING_DIR(), n), "utf8")) });
    } catch {
      await fs.rm(path.join(PENDING_DIR(), n), { force: true }); // unreadable: drop, never invent
    }
  }
  return out;
});
ipcMain.handle("pending:count", async () => {
  try {
    return (await fs.readdir(PENDING_DIR())).filter((n) => n.endsWith(".json")).length;
  } catch {
    return 0;
  }
});
ipcMain.handle("pending:done", async (_e, id) => {
  if (!/^[a-z0-9_-]+$/i.test(String(id))) return false; // path traversal guard
  await fs.rm(path.join(PENDING_DIR(), `${id}.json`), { force: true });
  return true;
});

ipcMain.on("companion:state", (_e, state) => {
  lastState = { ...lastState, ...state };
  refreshTray();
});

if (!fssync.existsSync(path.join(__dirname, "dist", "index.html"))) {
  console.error("renderer bundle missing — run `npm run build:renderer` first.");
}
