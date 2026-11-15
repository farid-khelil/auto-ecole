import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase } from './database/sqlite.js';
import { registerClientIpc } from './ipc/client.ipc.js';
import { registerUpdaterIpc, checkForUpdatesSilently } from './ipc/updater.ipc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | undefined;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[MainWindow] Failed to load:', errorCode, errorDescription, validatedURL);
  });

  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    void mainWindow.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  initializeDatabase(app.getPath('userData'));
  registerClientIpc();
  registerUpdaterIpc(() => mainWindow);
  createWindow();

  if (app.isPackaged) {
    setTimeout(() => {
      checkForUpdatesSilently();
    }, 3000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
