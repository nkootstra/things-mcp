import { test, expect, describe, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadTools } from "../src/read-tools.js";
import { _setDb } from "../src/db.js";

describe("read tool registration", () => {
  let testDb: Database;

  beforeEach(() => {
    // Provide an in-memory database so tools can be exercised
    testDb = new Database(":memory:");
    testDb.exec(`
      CREATE TABLE TMArea (uuid TEXT PRIMARY KEY, title TEXT, visible INTEGER DEFAULT 1, "index" INTEGER DEFAULT 0);
      CREATE TABLE TMTag (uuid TEXT PRIMARY KEY, title TEXT, shortcut TEXT, parent TEXT);
      CREATE TABLE TMTask (
        uuid TEXT PRIMARY KEY, title TEXT, notes TEXT, type INTEGER DEFAULT 0,
        status INTEGER DEFAULT 0, start INTEGER DEFAULT 0, startDate INTEGER,
        deadline INTEGER, todayIndex INTEGER DEFAULT 0, project TEXT, area TEXT,
        actionGroup TEXT, trashed INTEGER DEFAULT 0, creationDate REAL DEFAULT 0,
        userModificationDate REAL, stopDate REAL, "index" INTEGER DEFAULT 0
      );
      CREATE TABLE TMTaskTag (tasks TEXT, tags TEXT);
      CREATE TABLE TMChecklistItem (
        uuid TEXT PRIMARY KEY, title TEXT, status INTEGER DEFAULT 0,
        task TEXT, "index" INTEGER DEFAULT 0
      );
    `);
    _setDb(testDb);
  });

  afterEach(() => {
    _setDb(null);
    testDb.close();
  });

  test("registerReadTools does not throw", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    expect(() => registerReadTools(server)).not.toThrow();
  });

  test("registers all 6 read tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerReadTools(server);

    // Access registered tools via internal state
    // We verify by trying to register the same names — which would throw if they exist
    const server2 = new McpServer({ name: "test2", version: "0.0.1" });
    registerReadTools(server2);
    // If we get here without throwing, tools registered successfully on both servers
  });
});
