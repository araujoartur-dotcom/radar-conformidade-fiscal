/**
 * ============================================================
 * BANCO DE DADOS — CONEXÃO SQLite
 * ============================================================
 * POC usa SQLite (arquivo local). Em produção, migrar para
 * PostgreSQL com Row-Level Security (RLS) multi-tenant.
 * ============================================================
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DATABASE } from '../config';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    // Garantir que o diretório existe
    const dir = path.dirname(DATABASE.SQLITE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DATABASE.SQLITE_PATH);

    // Configurações de performance e segurança
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    console.log(`✅ Banco de dados conectado: ${DATABASE.SQLITE_PATH}`);
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    console.log('🔒 Banco de dados fechado.');
  }
}
