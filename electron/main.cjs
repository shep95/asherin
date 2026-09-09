const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Asherin IDE',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      allowRunningInsecureContent: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:8080');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();
    const parsed = new URL(url);
    const currentParsed = new URL(current);

    const isTopLevelFileNav =
      parsed.protocol === 'file:' && parsed.pathname !== currentParsed.pathname;

    if (isTopLevelFileNav) {
      const staticHtml = path.join(parsed.pathname);
      if (staticHtml.endsWith('.html')) {
        event.preventDefault();
        win.loadFile(staticHtml);
        return;
      }
    }

    if (parsed.protocol !== 'file:' && parsed.origin !== currentParsed.origin) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -6 || errorCode === -300) {
      return;
    }
    console.error('failed to load', validatedURL, errorCode, errorDescription);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
