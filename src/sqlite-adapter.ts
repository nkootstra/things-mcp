import initSqlJs, { type BindParams, type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";

export interface SqliteAdapter {
  all<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown> | unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown> | unknown[]): T | null;
  exec(sql: string): void;
  close(): void;
}

let SQL: SqlJsStatic;

/** One-time WASM initialization — call before any database operations */
export async function initSql(): Promise<void> {
  SQL = await initSqlJs();
}

/** Create an adapter wrapping a sql.js database. Pass a buffer for file-based DBs, omit for in-memory. */
export function createAdapter(data?: Buffer | Uint8Array): SqliteAdapter {
  const db: SqlJsDatabase = data ? new SQL.Database(new Uint8Array(data)) : new SQL.Database();

  return {
    all<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown> | unknown[]): T[] {
      const stmt = db.prepare(sql);
      if (params) {
        stmt.bind(normalizeParams(params));
      }
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return results;
    },

    get<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown> | unknown[]): T | null {
      const stmt = db.prepare(sql);
      if (params) {
        stmt.bind(normalizeParams(params));
      }
      const result = stmt.step() ? (stmt.getAsObject() as T) : null;
      stmt.free();
      return result;
    },

    exec(sql: string): void {
      db.exec(sql);
    },

    close(): void {
      db.close();
    },
  };
}

/** Normalize params: prefix object keys with $ for sql.js named bindings, pass arrays through */
function normalizeParams(params: Record<string, unknown> | unknown[]): BindParams {
  if (Array.isArray(params)) return params as BindParams;

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    normalized[key.startsWith("$") ? key : `$${key}`] = value;
  }
  return normalized as BindParams;
}
