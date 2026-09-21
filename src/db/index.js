const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { seedDatabase } = require('./seed');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'undangan.db');
const db = new DatabaseSync(dbPath);

// Enable Foreign Keys and WAL Mode for performance & data integrity
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Run Schema DDL
const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schemaSql);

// Run Seeder
seedDatabase(db);

console.log('[DATABASE] SQLite database initialized at:', dbPath);

module.exports = db;
