import { contextBridge, ipcRenderer } from 'electron';
import type { CreateClientInput } from './services/client.service.js';

contextBridge.exposeInMainWorld('autoEcole', {
  clients: {
    create: (input: CreateClientInput) => ipcRenderer.invoke('clients:create', input),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),
    onStatus: (callback: (data: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('updater:status', listener);
      return () => {
        ipcRenderer.removeListener('updater:status', listener);
      };
    },
  },
});
