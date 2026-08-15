/**
 * ============================================================
 * BANCO DE DADOS — CONEXÃO SQLite COM FALLBACK SEGURO
 * ============================================================
 * Carrega better-sqlite3 localmente. No ambiente serverless (Vercel),
 * o Supabase (PostgreSQL) assume o banco de dados principal.
 * ============================================================
 */

import path from 'path';
import fs from 'fs';
import { DATABASE } from '../config';

let db: any = null;

export function getDatabase(): any {
  if (!db) {
    try {
      // Dynamic import/require para evitar crash em ambiente serverless
      const DatabaseConstructor = require('better-sqlite3');
      
      const dir = path.dirname(DATABASE.SQLITE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      db = new DatabaseConstructor(DATABASE.SQLITE_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.pragma('busy_timeout = 5000');

      console.log(`✅ Banco SQLite conectado: ${DATABASE.SQLITE_PATH}`);
    } catch (err: any) {
      console.warn('⚠️ SQLite nativo não disponível neste ambiente. Usando fallback:', err.message);
      // Retorna mock seguro para evitar quebras em serverless
      db = {
        prepare: () => ({
          get: () => null,
          all: () => [],
          run: () => ({ changes: 0, lastInsertRowid: 0 }),
        }),
        pragma: () => null,
        transaction: (fn: any) => fn,
        close: () => null,
      };
    }
  }
  return db;
}

export function closeDatabase(): void {
  if (db && typeof db.close === 'function') {
    try {
      db.close();
      console.log('🔒 Banco de dados fechado.');
    } catch {}
  }
}
