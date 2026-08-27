import { getDatabase } from './server/db/database';
import { initializeSchema } from './server/db/schema';

initializeSchema();
const db = getDatabase();
const cols = db.prepare("PRAGMA table_info(dfe_documentos)").all();
console.log('Colunas de dfe_documentos:', cols.map((c: any) => c.name).join(', '));

const eventCols = db.prepare("PRAGMA table_info(eventos_transmitidos)").all();
console.log('Colunas de eventos_transmitidos:', eventCols.map((c: any) => c.name).join(', '));
