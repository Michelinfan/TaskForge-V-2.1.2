const { app, BrowserWindow, Notification, ipcMain, Tray, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let win;
let tray;
let isQuitting = false;
const timers = new Map();
const dataFile = path.join(app.getPath("userData"), "tasks.json");

function loadTasks() {
  try {
    if (fs.existsSync(dataFile)) return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch (e) {
    console.error("No se pudieron cargar las tareas:", e);
  }
  return [];
}

function saveTasks(tasks) {
  try {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(tasks || []), "utf8");
  } catch (e) {
    console.error("No se pudieron guardar las tareas:", e);
  }
}

let tasks = loadTasks();

function getNotificationSoundPath(task) {
  const file =
    task?.priority === "p1" ? "notification-priority1.wav" :
    task?.priority === "p2" ? "notification-priority2.wav" :
    task?.priority === "p3" ? "notification-priority3.wav" :
    "notification-none.wav";

  const candidates = [
    path.join(process.resourcesPath, "app.asar.unpacked", file),
    path.join(__dirname, file)
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function playNotificationSound(task) {
  if (process.platform !== "win32") return;
  const soundPath = getNotificationSoundPath(task);
  if (!soundPath) {
    console.error("No se encontró el sonido para la prioridad:", task?.priority);
    return;
  }

  const escaped = soundPath.replace(/'/g, "''");
  const script = [
    "Add-Type -AssemblyName System.Media",
    `$player = New-Object System.Media.SoundPlayer '${escaped}'`,
    "$player.Load()",
    "$player.PlaySync()",
    "$player.Dispose()"
  ].join("; ");

  try {
    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script
    ], {
      windowsHide: true,
      stdio: "ignore"
    });
    child.on("error", err => console.error("No se pudo iniciar el sonido:", err));
    child.on("exit", code => {
      if (code !== 0) console.error("PowerShell terminó el sonido con código", code);
    });
  } catch (e) {
    console.error("No se pudo reproducir el sonido:", e);
  }
}

function showTaskNotification(task) {
  if (!Notification.isSupported()) return;
  playNotificationSound(task);
  const notification = new Notification({
    title: "TaskForge",
    body: `⏰ ${task.title}`,
    silent: true
  });
  notification.show();
}

function clearTaskTimers() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}

function scheduleTaskNotifications() {
  clearTaskTimers();
  const now = Date.now();

  for (const task of tasks) {
    if (!task || task.completed || task.deleted || !task.date || !task.time) continue;
    const when = new Date(`${task.date}T${task.time}:00`).getTime();
    if (!Number.isFinite(when) || when <= now) continue;

    const delay = when - now;
    // setTimeout has a ~24.8 day maximum. Re-schedule long waits in chunks.
    const timer = setTimeout(() => {
      const current = tasks.find(t => t.id === task.id);
      if (current && !current.completed && !current.deleted) {
        const target = new Date(`${current.date}T${current.time}:00`).getTime();
        if (Number.isFinite(target) && target <= Date.now()) {
          showTaskNotification(current);
          timers.delete(current.id);
          return;
        }
      }
      scheduleTaskNotifications();
    }, Math.min(delay, 2147483647));
    timers.set(task.id, timer);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile("index.html");

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, "icon.ico"));
  const menu = Menu.buildFromTemplate([
    { label: "Abrir TaskForge", click: () => { win.show(); win.focus(); } },
    { type: "separator" },
    { label: "Salir de TaskForge", click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip("TaskForge — notificaciones activas");
  tray.setContextMenu(menu);
  tray.on("double-click", () => { win.show(); win.focus(); });
}

ipcMain.handle("get-stored-tasks", () => tasks);
ipcMain.on("sync-tasks", (_event, incoming) => {
  if (Array.isArray(incoming)) {
    tasks = incoming;
    saveTasks(tasks);
    scheduleTaskNotifications();
  }
});
ipcMain.on("show-notification", (_event, payload) => {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: payload?.title || "TaskForge",
    body: payload?.body || "Tienes una tarea pendiente.",
    silent: true
  });
  notification.show();
});

app.whenReady().then(() => {
  // TaskForge stays available in the background so reminders can fire with the window closed.
  app.setLoginItemSettings({
    openAtLogin: true,
    args: ["--hidden"]
  });

  createWindow();
  createTray();
  scheduleTaskNotifications();

  if (process.argv.includes("--hidden")) win.hide();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else { win.show(); win.focus(); }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  clearTaskTimers();
});

app.on("window-all-closed", () => {
  // Intentionally keep the app alive in the tray on Windows/macOS.
  if (process.platform === "darwin") app.quit();
});
