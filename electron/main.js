const { app, BrowserWindow, protocol } = require("electron");
const path = require("path");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    // ВАЖЛИВО: розмір задається для контенту (а не для рамки/вікна)
    width: 1920,
    height: 1080,
    useContentSize: true,

    resizable: false,

    // ВАЖЛИВО: frame має бути ТУТ, а не в webPreferences
    frame: false,

    // На Windows це не завжди потрібно, але хай буде
    show: false,
    backgroundColor: "#0b0f14",

    // Ховаємо меню (навіть якщо frame:false)
    autoHideMenuBar: true,
    menuBarVisible: false,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,

      backgroundThrottling: false, // критично для запису відео
      offscreen: false,
      devTools: false,
    },
  });

  // Додатково, на всякий: прибрати меню з боку API
  mainWindow.setMenuBarVisibility(false);

  const startUrl =
    process.env.NODE_ENV === "development"
      ? process.env.ELECTRON_START_URL || "http://localhost:3000"
      : `file://${path.join(app.getAppPath(), "dist", "index.html")}`;

  mainWindow.loadURL(startUrl);

  // Якщо треба девтулзи в dev-режимі
  if (process.env.NODE_ENV === "development") {
    // mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerFileProtocol() {
  protocol.registerFileProtocol("file", (request, callback) => {
    try {
      const urlPath = decodeURIComponent(new URL(request.url).pathname);
      const normalizedPath = urlPath.replace(/\\/g, "/");

      const audioIndex = normalizedPath.indexOf("/audio");
      const imageIndex = normalizedPath.indexOf("/images");
      const assetIndex =
        audioIndex !== -1 ? audioIndex : imageIndex !== -1 ? imageIndex : -1;

      if (assetIndex !== -1) {
        const assetPath = normalizedPath.slice(assetIndex);
        callback({
          path: path.join(app.getAppPath(), "dist", assetPath),
        });
        return;
      }

      let resolvedPath = path.normalize(urlPath);
      if (process.platform === "win32" && resolvedPath.startsWith("\\")) {
        resolvedPath = resolvedPath.slice(1);
      }

      callback({ path: resolvedPath });
    } catch (e) {
      // fallback
      callback({ path: "" });
    }
  });
}

app.whenReady().then(() => {
  registerFileProtocol();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
