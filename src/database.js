import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'guandan.db');

let db;

export async function initDb() {
  const SQL = await initSqlJs();
  
  let data;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  }
  
  db = new SQL.Database(data);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS score_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      month TEXT NOT NULL,
      round INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      daily_settlement_id TEXT,
      monthly_settlement_id TEXT
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_settlement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      month TEXT NOT NULL,
      data TEXT NOT NULL,
      settled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      settlement_key TEXT UNIQUE
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS monthly_settlement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      data TEXT NOT NULL,
      settled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      settlement_key TEXT UNIQUE
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS current_game (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      round INTEGER NOT NULL,
      selected_players TEXT,
      scores TEXT,
      submitted INTEGER DEFAULT 0,
      submitted_at DATETIME
    )
  `);
  
  saveDb();
  
  return db;
}

export function getDb() {
  return db;
}

export function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
  }
}

export default { initDb, getDb, saveDb, closeDb };
