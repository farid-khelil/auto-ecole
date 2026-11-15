export const CLIENT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_number TEXT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    birth_date TEXT,
    email TEXT,
    address TEXT,
    training TEXT NOT NULL,
    registration_date TEXT NOT NULL,
    received_documents_json TEXT NOT NULL DEFAULT '[]',
    documents_json TEXT NOT NULL DEFAULT '[]',
    history_json TEXT NOT NULL DEFAULT '[]',
    is_archived INTEGER NOT NULL DEFAULT 0,
    archive_year INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS clients_phone_index ON clients(phone);
`;
