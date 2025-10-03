const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // Створення вікна браузера
  let mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
    icon: path.join(__dirname, 'icon.png'), // іконка додатку
    titleBarStyle: 'default',
  });

  // Завантаження додатку
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Відкриття DevTools в режимі розробки
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Обробка закриття вікна
  mainWindow.on('closed', () => {
    // Dereference the window object for garbage collection
    mainWindow = null;
  });
}

// Цей callback буде викликаний коли Electron завершить ініціалізацію
app.whenReady().then(createWindow);

// Вийти коли всі вікна закриті.
app.on('window-all-closed', () => {
  // На macOS це загальний випадок щоб додатки та їх меню-бар
  // залишаються активними поки користувач не вийде зовсім через Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // На macOS це загальний випадок щоб пересоздавати вікно додатку коли
  // клікають на іконку в докері та немає інших відкритих вікон
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// В цьому файлі можна додати інші специфічні частини вашого main процесу
