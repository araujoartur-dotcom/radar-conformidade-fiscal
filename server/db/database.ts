/**
 * ============================================================
 * BANCO DE DADOS — SQLite (Local) ou Supabase (Serverless)
 * ============================================================
 * Em serverless (Vercel), better-sqlite3 NÃO funciona.
 * Todas as rotas devem verificar isSupabaseConfigured() primeiro.
 * O mock aqui evita crashes na importação das rotas que ainda
 * referenciam getDatabase().
 * ============================================================
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { DATABASE } from '../config';

let db: any = null;

export function getDatabase(): any {
  if (!db) {
    try {
      const dir = path.dirname(DATABASE.SQLITE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      db = new Database(DATABASE.SQLITE_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.pragma('busy_timeout = 5000');
      console.log(`✅ Banco SQLite conectado: ${DATABASE.SQLITE_PATH}`);
    } catch (err) {
      console.error('Falha ao conectar SQLite:', err);
      db = {
        prepare: () => ({
          get: () => null,
          all: () => [],
          run: () => ({ changes: 0, lastInsertRowid: 0 }),
        }),
        pragma: () => null,
        transaction: (fn: any) => (() => fn()),
        close: () => null,
        exec: () => null,
      };
    }
  }
  return db;
}

export function closeDatabase(): void {
  if (db && db.close) {
    try { db.close(); } catch {}
  }
}

