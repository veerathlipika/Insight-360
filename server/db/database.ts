import initSqlJs, { Database as SqlDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: SqlDatabase | null = null;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = process.env.CRM_DB_FILE
  ? path.resolve(process.env.CRM_DB_FILE)
  : path.join(DATA_DIR, 'crm.sqlite');
const DB_DIRECTORY = path.dirname(DB_FILE);

export async function getDb(): Promise<SqlDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!fs.existsSync(DB_DIRECTORY)) {
    fs.mkdirSync(DB_DIRECTORY, { recursive: true });
  }

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (e) {
      console.error('Error loading existing db file, creating new database:', e);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');
  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to save database to disk:', err);
  }
}

// Helpers for querying sql.js with standard object results
export interface QueryResultRow {
  [key: string]: any;
}

export function all<T = QueryResultRow>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export function get<T = QueryResultRow>(sql: string, params: any[] = []): T | null {
  const rows = all<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function run(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  if (!dbInstance) throw new Error('Database not initialized');
  
  if (params && params.length > 0) {
    const stmt = dbInstance.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
  } else {
    dbInstance.run(sql);
  }

  const lastIdRes = dbInstance.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = (lastIdRes[0]?.values[0]?.[0] as number) || 0;
  
  // Save changes to disk asynchronously or on tick
  saveDb();

  return {
    lastInsertRowid,
    changes: 1
  };
}

export function exec(sql: string): void {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.exec(sql);
  saveDb();
}
