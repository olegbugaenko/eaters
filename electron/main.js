const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');

function createWindow() {
  let mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
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

app.whenReady().then(() => {
  protocol.registerFileProtocol('file', (request, callback) => {
    const url = decodeURI(request.url.replace('file://', ''));

    if (url.startsWith('/audio') || url.startsWith('/images')) {
      callback({
        path: path.join(app.getAppPath(), 'dist', url),
      });
      return;
    }

    callback({ path: url });
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
