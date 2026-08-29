const path = require("path");
const { app, BrowserWindow, dialog, Menu, shell } = require("electron");

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) app.quit();

const isDev = !app.isPackaged;
const backendPath = isDev
  ? path.join(__dirname, "..", "pos-backend")
  : path.join(process.resourcesPath, "pos-backend");
const packagedFrontendPath = path.join(process.resourcesPath, "pos-frontend", "dist");

let mainWindow = null;
let backend = null;

function createWindow(port) {
  const fs = require("fs");
  const iconPath = path.join(__dirname, "icon.ico");
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    show: false,
    backgroundColor: "#1f1f1f",
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#1f1f1f", symbolColor: "#ffffff", height: 36 },
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadURL(`http://localhost:${port}`);
  mainWindow.once("ready-to-show", () => { mainWindow.maximize(); mainWindow.show(); });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === "about:blank") return { action: "allow" };
    if (/^(https?:|mailto:|tel:)/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

async function startBackend() {
  if (!isDev) process.env.STATIC_FRONTEND_PATH = packagedFrontendPath;
  delete require.cache[require.resolve(path.join(backendPath, "app.js"))];
  const backendModule = require(path.join(backendPath, "app.js"));
  return backendModule.startServer();
}

async function bootWithRetry() {
  try {
    backend = await startBackend();
    createWindow(backend.port);
  } catch (error) {
    const isDatabaseError = /ECONNREFUSED|MongoNetworkError|MongooseServerSelectionError/i.test(error.message || "");
    const detail = isDatabaseError
      ? `Não foi possível conectar ao MongoDB local. Confirme que o serviço MongoDB está instalado e em execução, depois tente novamente.\n\nDetalhe técnico: ${error.message}`
      : `Detalhe técnico: ${error.message}`;
    const choice = await dialog.showMessageBox({
      type: "error",
      title: "Hamburgueria POS - Erro ao iniciar",
      message: "O POS não pôde iniciar.",
      detail,
      buttons: ["Tentar novamente", "Sair"],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice.response === 0) return bootWithRetry();
    app.quit();
  }
}

app.whenReady().then(() => {
  bootWithRetry();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && backend) createWindow(backend.port);
  });
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => {
  try { require(path.join(backendPath, "app.js")).stopServer(); } catch (_) { /* ignore shutdown errors */ }
});
