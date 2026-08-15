import { getDatabase } from './server/db/database';
const db = getDatabase();
const tables = db.prepare("SELECT sql FROM sqlite_master WHERE type='table'").all();
console.log(tables.map((t: any) => t.sql).join('\n'));
