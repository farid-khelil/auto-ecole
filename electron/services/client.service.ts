import { getDatabase } from '../database/sqlite.js';

export type ClientDocument = { id: string; title: string };

export type CreateClientInput = {
  registrationNumber?: string;
  name?: string;
  phone?: string;
  birthDate?: string;
  email?: string;
  address?: string;
  training?: string;
  registrationDate?: string;
  receivedDocuments?: string[];
  documents?: ClientDocument[];
  history?: unknown[];
};

type CreateClientResult = { id: number };

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function documentList(value: unknown): ClientDocument[] {
  if (!Array.isArray(value)) return [];
  return value.filter((document): document is ClientDocument => Boolean(
    document && typeof document === 'object' && typeof document.id === 'string' && typeof document.title === 'string',
  ));
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function historyList(value: unknown) {
  return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object') : [];
}

export function createClient(input: unknown): CreateClientResult {
  if (!input || typeof input !== 'object') throw new Error('Invalid client information.');

  const data = input as Partial<CreateClientInput>;
  const client = {
    registrationNumber: optionalText(data.registrationNumber),
    name: cleanText(data.name) || 'بدون اسم',
    phone: cleanText(data.phone),
    birthDate: optionalText(data.birthDate),
    email: optionalText(data.email),
    address: optionalText(data.address),
    training: cleanText(data.training) || 'B',
    registrationDate: cleanText(data.registrationDate) || new Date().toISOString().slice(0, 10),
    receivedDocuments: stringList(data.receivedDocuments),
    documents: documentList(data.documents),
    history: historyList(data.history),
  };

  const result = getDatabase().prepare(`
    INSERT INTO clients (
      registration_number, full_name, phone, birth_date, email, address, training, registration_date,
      received_documents_json, documents_json, history_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    client.registrationNumber,
    client.name,
    client.phone,
    client.birthDate,
    client.email,
    client.address,
    client.training,
    client.registrationDate,
    JSON.stringify(client.receivedDocuments),
    JSON.stringify(client.documents),
    JSON.stringify(client.history),
  );

  return { id: Number(result.lastInsertRowid) };
}
