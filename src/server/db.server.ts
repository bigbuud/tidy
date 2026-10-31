import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env["DATA_DIR"] || path.resolve("data");
export const FILES_DIR = path.join(DATA_DIR, "files");

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(FILES_DIR, { recursive: true });
  db = new DatabaseSync(path.join(DATA_DIR, "logboek.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      totp_secret TEXT NOT NULL,
      last_totp_step INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      cost REAL,
      mileage INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      log_id INTEGER REFERENCES logs(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_logs_asset ON logs(asset_id, date);
    CREATE INDEX IF NOT EXISTS idx_documents_asset ON documents(asset_id);
    CREATE INDEX IF NOT EXISTS idx_documents_log ON documents(log_id);
  `);
  // Migratie: foto per item (bestaande databases krijgen de kolommen er bij).
  const cols = db.prepare("PRAGMA table_info(assets)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "photo_file")) {
    db.exec(
      "ALTER TABLE assets ADD COLUMN photo_file TEXT; ALTER TABLE assets ADD COLUMN photo_v INTEGER;",
    );
  }
  // Escape hatch: start the container once with LOGBOEK_RESET_AUTH=true to
  // remove the account (data stays) and run the setup again.
  if (process.env["LOGBOEK_RESET_AUTH"] === "true") {
    db.exec("DELETE FROM sessions; DELETE FROM users;");
    console.warn(
      "[logboek] Account verwijderd via LOGBOEK_RESET_AUTH. Verwijder deze variabele na de nieuwe setup.",
    );
  }
  return db;
}

export function removeStoredFile(storedName: string) {
  const p = path.join(FILES_DIR, path.basename(storedName));
  fs.rmSync(p, { force: true });
}
