import { ipcMain } from 'electron';
import { createClient } from '../services/client.service.js';

export function registerClientIpc() {
  ipcMain.handle('clients:create', (_event, input: unknown) => createClient(input));
}
