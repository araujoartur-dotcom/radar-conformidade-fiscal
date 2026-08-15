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

import { DATABASE } from '../config';

let db: any = null;

export function getDatabase(): any {
  if (!db) {
    try {
      // Tenta carregar better-sqlite3 (só funciona localmente)
      const Database = require('better-sqlite3');
      const path = require('path');
      const fs = require('fs');

      const dir = path.dirname(DATABASE.SQLITE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      db = new Database(DATABASE.SQLITE_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.pragma('busy_timeout = 5000');
      console.log(`✅ Banco SQLite conectado: ${DATABASE.SQLITE_PATH}`);
    } catch {
      // Serverless: retorna stub seguro — as rotas devem usar Supabase
      db = {
        prepare: () => ({
          get: () => null,
          all: () => [],
          run: () => ({ changes: 0, lastInsertRowid: 0 }),
        }),
        pragma: () => null,
        transaction: (fn: any) => (() => fn()),
        close: () => null,
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
