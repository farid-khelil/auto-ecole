import { ipcMain, app, BrowserWindow } from 'electron';
import updater from 'electron-updater';

const { autoUpdater } = updater;

// Configure the updater per user instructions
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

export function registerUpdaterIpc(getMainWindow?: () => BrowserWindow | undefined) {
  // Forward updater events to renderer
  const sendToWindow = (channel: string, payload: unknown) => {
    try {
      const win = getMainWindow?.() || BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    } catch (e) {
      console.error('[Updater] Failed to send event to window:', e);
    }
  };

  autoUpdater.on('checking-for-update', () => {
    sendToWindow('updater:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendToWindow('updater:status', {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendToWindow('updater:status', {
      status: 'not-available',
      version: info?.version || app.getVersion(),
    });
  });

  autoUpdater.on('error', (err) => {
    sendToWindow('updater:status', {
      status: 'error',
      message: err?.message || String(err),
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendToWindow('updater:status', {
      status: 'downloading',
      percent: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendToWindow('updater:status', {
      status: 'downloaded',
      version: info.version,
    });
  });

  // 1. Check for updates IPC handler
  ipcMain.handle('updater:check', async () => {
    try {
      if (!app.isPackaged) {
        return {
          success: true,
          status: 'dev-mode',
          currentVersion: app.getVersion(),
          message: 'التطبيق قيد التشغيل في وضع التطوير (Development Mode)',
        };
      }
      const result = await autoUpdater.checkForUpdates();
      return {
        success: true,
        updateInfo: result?.updateInfo,
        currentVersion: app.getVersion(),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        currentVersion: app.getVersion(),
      };
    }
  });

  // 2. Download an available update IPC handler
  ipcMain.handle('updater:download', async () => {
    try {
      if (!app.isPackaged) {
        return {
          success: false,
          error: 'لا يمكن تحميل التحديثات في وضع التطوير',
        };
      }
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // 3. Install the downloaded update IPC handler
  ipcMain.handle('updater:install', () => {
    try {
      autoUpdater.quitAndInstall();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // Extra helper: Get current version
  ipcMain.handle('updater:getVersion', () => {
    return app.getVersion();
  });
}
