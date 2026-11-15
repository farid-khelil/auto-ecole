import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { CLIENT_SCHEMA } from './schema.js';

let database: Database.Database | undefined;

export function initializeDatabase(userDataPath: string) {
  if (database) return database;

  mkdirSync(userDataPath, { recursive: true });
  database = new Database(path.join(userDataPath, 'auto-ecole.db'));
  database.pragma('journal_mode = WAL');
  database.exec(CLIENT_SCHEMA);

  try {
    const tableInfo = database.prepare("PRAGMA table_info(clients)").all() as { name: string }[];
    const hasRegNumber = tableInfo.some((col) => col.name === 'registration_number');
    if (!hasRegNumber) {
      database.exec('ALTER TABLE clients ADD COLUMN registration_number TEXT;');
    }

    const hasHistory = tableInfo.some((col) => col.name === 'history_json');
    if (!hasHistory) {
      database.exec("ALTER TABLE clients ADD COLUMN history_json TEXT NOT NULL DEFAULT '[]';");
    }

    const hasArchived = tableInfo.some((col) => col.name === 'is_archived');
    if (!hasArchived) {
      database.exec('ALTER TABLE clients ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;');
      database.exec('ALTER TABLE clients ADD COLUMN archive_year INTEGER;');
    }
    database.exec('CREATE INDEX IF NOT EXISTS clients_archive_index ON clients(is_archived, archive_year);');
  } catch (err) {
    console.error('Migration error for clients table:', err);
  }

  return database;
}

export function getDatabase() {
  if (!database) throw new Error('Database has not been initialized.');
  return database;
}
