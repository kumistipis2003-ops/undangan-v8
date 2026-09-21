const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { seedDatabase } = require('./seed');

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let dbPath;
if (isVercel) {
  const tmpDir = '/tmp';
  const tmpDbPath = path.join(tmpDir, 'undangan.db');
  const sourceDbPath = path.join(__dirname, '..', '..', 'data', 'undangan.db');

  if (!fs.existsSync(tmpDbPath) && fs.existsSync(sourceDbPath)) {
    try {
      fs.copyFileSync(sourceDbPath, tmpDbPath);
    } catch (e) {
      console.warn('[DATABASE] Could not copy initial DB to /tmp:', e.message);
    }
  }
  dbPath = tmpDbPath;
} else {
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  dbPath = path.join(dataDir, 'undangan.db');
}

const db = new DatabaseSync(dbPath);

// Enable Foreign Keys
db.exec('PRAGMA foreign_keys = ON;');

// Only use WAL mode in non-serverless environments
if (!isVercel) {
  db.exec('PRAGMA journal_mode = WAL;');
}

// Run Schema DDL
const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schemaSql);

// Run Seeder
seedDatabase(db);

console.log('[DATABASE] SQLite database initialized at:', dbPath);

module.exports = db;
