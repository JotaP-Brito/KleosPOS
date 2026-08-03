const { app, BrowserWindow, utilityProcess } = require("electron");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

let backendProcess;

// ── Kill any process on port 3000 (Windows) ──
function freePort3000() {
  if (process.platform !== "win32") return;
  try {
    const output = execSync("netstat -ano | findstr :3000").toString();
    const lines = output.trim().split(/\r?\n/);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(pid)) {
        try { execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" }); } catch (_) {}
      }
    }
    return new Promise(resolve => setTimeout(resolve, 500));
  } catch (_) {}
  return Promise.resolve();
}

// ── Make sure node_modules are present ──
function ensureNodeModules(backendDir) {
  const modulesDir = path.join(backendDir, "node_modules");
  if (!fs.existsSync(modulesDir) || fs.readdirSync(modulesDir).length === 0) {
    try {
      execSync("npm install --production", { cwd: backendDir, stdio: "ignore" });
    } catch (err) {
      require("electron").dialog.showErrorBox(
        "Erro",
        "Não foi possível instalar as dependências do backend. Verifique se o Node.js está instalado."
      );
      app.quit();
    }
  }
}

// ── Start the Express backend ──
async function startBackend() {
  const isDev = !app.isPackaged;
  const backendDir = isDev
    ? path.join(__dirname, "..", "pos-backend")
    : path.join(process.resourcesPath, "pos-backend");

  const frontendDistPath = isDev
    ? path.join(__dirname, "..", "pos-frontend", "dist")
    : path.join(process.resourcesPath, "pos-frontend", "dist");

  await freePort3000();
  ensureNodeModules(backendDir);

  const modulePath = path.join(backendDir, "app.js");
  const logPath = path.join(app.getPath("userData"), "backend.log");
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  logStream.write(`\n=== Backend started at ${new Date().toISOString()} ===\n`);

  backendProcess = utilityProcess.fork(modulePath, [], {
    cwd: backendDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "production",
      STATIC_FRONTEND_PATH: frontendDistPath
    }
  });

  if (backendProcess.stdout) {
    backendProcess.stdout.on("data", (data) => logStream.write(data));
  }
  if (backendProcess.stderr) {
    backendProcess.stderr.on("data", (data) => logStream.write(data));
  }

  backendProcess.on("exit", (code) => {
    logStream.write(`Backend exited with code ${code}\n`);
    logStream.end();
  });
}

// ── Auto‑login via injected script ──
function injectAutoLogin(win) {
  win.webContents.executeJavaScript(`
    (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/user/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: "123@gmail.com", password: "t2b4cjoao" })
        });
        if (res.ok) {
          // The cookie is now set – reload to let the app see it
          location.reload();
        }
      } catch (err) {
        console.error("Auto‑login failed:", err);
      }
    })();
  `).catch(err => console.error("Injection error:", err));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Hamburgueria Cantinho Do Sabor",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // After the first page load, inject the auto‑login script
  let firstLoad = true;
  win.webContents.on("did-finish-load", () => {
    if (firstLoad) {
      firstLoad = false;
      injectAutoLogin(win);
    }
  });

  win.loadURL("http://localhost:3000");

  win.on("closed", () => {
    if (backendProcess) backendProcess.kill();
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== "darwin") app.quit();
});