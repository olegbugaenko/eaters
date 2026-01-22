const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');

function createWindow() {
  let mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    hideMenuBar: true,
    autoHideMenuBar: true,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      backgroundThrottling: false, // ❗ критично для запису відео
      offscreen: false,            // залишаємо GPU
      devTools: false,  
    },
    titleBarStyle: 'default',
  });

  const startUrl =
    process.env.NODE_ENV === 'development'
      ? process.env.ELECTRON_START_URL || 'http://localhost:3000'
      : `file://${path.join(app.getAppPath(), 'dist', 'index.html')}`;

  mainWindow.loadURL(startUrl);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const gpuStatus = app.getGPUFeatureStatus();
  console.log('[electron][gpu] Feature status:', gpuStatus);
  try {
    const gpuInfo = await app.getGPUInfo('basic');
    console.log('[electron][gpu] Basic info:', gpuInfo);
  } catch (error) {
    console.warn('[electron][gpu] Failed to read basic GPU info.', error);
  }

  const gpuStatusValues = Object.values(gpuStatus ?? {});
  const usesSoftwareRendering = gpuStatusValues.some(
    (value) => typeof value === 'string' && value.includes('software')
  );
  if (usesSoftwareRendering) {
    console.warn(
      '[electron][gpu] Software rendering detected. Consider запуск із прапорцями ' +
        'ELECTRON_FORCE_GPU=true або ELECTRON_DISABLE_SW=true.'
    );
  }
  protocol.registerFileProtocol('file', (request, callback) => {
    const urlPath = decodeURIComponent(new URL(request.url).pathname);
    const normalizedPath = urlPath.replace(/\\/g, '/');
    const audioIndex = normalizedPath.indexOf('/audio');
    const imageIndex = normalizedPath.indexOf('/images');
    const assetIndex =
      audioIndex !== -1 ? audioIndex : imageIndex !== -1 ? imageIndex : -1;

    if (assetIndex !== -1) {
      const assetPath = normalizedPath.slice(assetIndex);
      callback({
        path: path.join(app.getAppPath(), 'dist', assetPath),
      });
      return;
    }

    let resolvedPath = path.normalize(urlPath);
    if (process.platform === 'win32' && resolvedPath.startsWith('\\')) {
      resolvedPath = resolvedPath.slice(1);
    }

    callback({ path: resolvedPath });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
