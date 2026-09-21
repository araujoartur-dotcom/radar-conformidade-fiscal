import fs from 'fs';
import path from 'path';

const testDbPath = path.resolve(process.cwd(), 'data', 'test_clean_radar.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

process.env.DATABASE_PATH = testDbPath;

const { initializeSchema } = await import('../server/db/schema');
const { seedDatabase } = await import('../server/db/seed');

console.log('--- 1. Testing initializeSchema on fresh DB ---');
initializeSchema();
console.log('✅ Schema initialized successfully!');

console.log('--- 2. Testing seedDatabase on fresh DB ---');
seedDatabase();
console.log('✅ Seed executed successfully!');

const { closeDatabase } = await import('../server/db/database');
closeDatabase();

// Clean up
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
