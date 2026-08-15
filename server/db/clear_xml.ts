import { getDatabase, closeDatabase } from './database';

console.log('Limpando dados fictícios...');
const db = getDatabase();

db.prepare('DELETE FROM dfe_itens').run();
db.prepare('DELETE FROM dfe_documentos').run();

console.log('Dados excluídos com sucesso. O sistema está limpo.');
closeDatabase();
