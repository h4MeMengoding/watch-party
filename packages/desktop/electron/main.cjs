// Electron main process — CommonJS
const { app, BrowserWindow, desktopCapturer, ipcMain, session, shell } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = 'http://localhost:5173';

// ── Source selection bridge ──────────────────────────────────
// Flow: renderer shows picker → user clicks source
//       → renderer calls getDisplayMedia() [triggers handler below]
//       → after 80ms renderer sends 'screen-source-selected' IPC
//       → handler resolves with that source id
let pendingSourceResolve = null;

ipcMain.on('screen-source-selected', (_evt, sourceId) => {
  if (pendingSourceResolve) { pendingSourceResolve(sourceId); pendingSourceResolve = null; }
});
ipcMain.on('screen-source-cancelled', () => {
  if (pendingSourceResolve) { pendingSourceResolve(null); pendingSourceResolve = null; }
});

// IPC: get list of capturable sources for our custom picker UI
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
    }));
  } catch (err) {
    console.error('[main] getSources failed:', err);
    return [];
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#000000',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Custom picker: renderer sends selected source id, we pass it to Chromium
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      pendingSourceResolve = (sourceId) => {
        if (!sourceId) { callback({}); return; }
        callback({ video: { id: sourceId, name: sourceId }, audio: 'loopback' });
      };
      setTimeout(() => {
        if (pendingSourceResolve) { pendingSourceResolve = null; callback({}); }
      }, 30_000);
    },
    { useSystemPicker: false },
  );

  if (isDev) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
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
