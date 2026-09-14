import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import path from 'node:path';
import fs from 'node:fs';

let dbDriver = null;

export async function initDb() {
  if (env.DATABASE_URL) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: env.DB_POOL_MAX || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    client.release();
    logger.info({ maxPoolSize: env.DB_POOL_MAX || 10 }, 'Connected to PostgreSQL database');

    dbDriver = {
      type: 'pg',
      pool,
      async query(text, params) {
        const res = await pool.query(text, params);
        return res.rows;
      },
    };

    // Create rooms and files tables in PostgreSQL
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY,
        room_code VARCHAR(16) UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        owner_token VARCHAR(128) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);
      CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);
      CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY,
        room_code VARCHAR(16) NOT NULL,
        participant_id VARCHAR(64) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        object_key VARCHAR(255) NOT NULL,
        mime_type VARCHAR(128) NOT NULL,
        size_bytes BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        storage_provider VARCHAR(20) NOT NULL DEFAULT 'local'
      );
      CREATE INDEX IF NOT EXISTS idx_files_room_code ON files(room_code);
      CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);

      CREATE TABLE IF NOT EXISTS snippets (
        id VARCHAR(64) PRIMARY KEY,
        room_code VARCHAR(16) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_snippets_room_code ON snippets(room_code);
    `);
  } else {
    const { default: sqlite3 } = await import('sqlite3');

    const dbDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'dropx.sqlite');

    const db = new sqlite3.Database(dbPath);
    logger.info({ dbPath }, 'Connected to SQLite database (Local Development)');

    dbDriver = {
      type: 'sqlite',
      db,
      query(sql, params = []) {
        return new Promise((resolve, reject) => {
          const sqliteSql = sql.replace(/\$\d+/g, '?');
          if (sql.trim().toUpperCase().startsWith('SELECT')) {
            db.all(sqliteSql, params, (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          } else {
            db.run(sqliteSql, params, function (err) {
              if (err) reject(err);
              else resolve([{ changes: this.changes, lastID: this.lastID }]);
            });
          }
        });
      },
      exec(sql) {
        return new Promise((resolve, reject) => {
          db.exec(sql, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      },
    };

    // Create rooms, files, and snippets tables in SQLite
    await dbDriver.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        room_code TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        owner_token TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);
      CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);
      CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        participant_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        object_key TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        storage_provider TEXT NOT NULL DEFAULT 'local'
      );
      CREATE INDEX IF NOT EXISTS idx_files_room_code ON files(room_code);
      CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);

      CREATE TABLE IF NOT EXISTS snippets (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_snippets_room_code ON snippets(room_code);
    `);
  }
}

export function getDb() {
  if (!dbDriver) {
    throw new Error('Database has not been initialized. Call initDb() first.');
  }
  return dbDriver;
}

export async function closeDb() {
  if (!dbDriver) return;
  if (dbDriver.type === 'pg' && dbDriver.pool) {
    await dbDriver.pool.end();
    logger.info('Closed PostgreSQL pool');
  } else if (dbDriver.type === 'sqlite' && dbDriver.db) {
    await new Promise((resolve) => dbDriver.db.close(resolve));
    logger.info('Closed SQLite database');
  }
  dbDriver = null;
}
