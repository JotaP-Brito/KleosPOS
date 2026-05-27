const { app, BrowserWindow, utilityProcess } = require("electron");
const path = require("path");
const fs = require("fs");

let backendProcess;

function startBackend() {
  const isDev = !app.isPackaged;
  const backendDir = isDev
    ? path.join(__dirname, "..", "pos-backend")
    : path.join(process.resourcesPath, "pos-backend");

  const modulePath = path.join(backendDir, "app.js");
  const logPath = path.join(app.getPath("userData"), "backend.log");
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  logStream.write(`\n=== Backend started at ${new Date().toISOString()} ===\n`);

  // Usa utilityProcess: não precisa do Node.js do sistema, não abre janela
  backendProcess = utilityProcess.fork(modulePath, [], {
    cwd: backendDir,
    stdio: ["ignore", "pipe", "pipe"],   // capturamos stdout e stderr
    env: { ...process.env, NODE_ENV: "production" }
  });

  // Redireciona stdout e stderr para o ficheiro de log
  if (backendProcess.stdout) {
    backendProcess.stdout.on("data", (data) => {
      logStream.write(data);
    });
  }
  if (backendProcess.stderr) {
    backendProcess.stderr.on("data", (data) => {
      logStream.write(data);
    });
  }

  backendProcess.on("exit", (code) => {
    logStream.write(`Backend exited with code ${code}\n`);
    logStream.end();
  });
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

  // Tenta carregar a cada segundo até o backend responder
  const tryLoad = () => {
    win.loadURL("http://localhost:3000").catch(() => {
      setTimeout(tryLoad, 1000);
    });
  };
  setTimeout(tryLoad, 2000);

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