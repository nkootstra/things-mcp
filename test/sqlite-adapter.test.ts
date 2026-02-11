import { test, expect, describe, beforeAll } from "vitest";
import { initSql, createAdapter } from "../src/sqlite-adapter.js";

beforeAll(async () => {
  await initSql();
});

describe("createAdapter", () => {
  test("exec runs DDL and DML", () => {
    const db = createAdapter();
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");
    db.exec("INSERT INTO t (id, name) VALUES (1, 'alice')");
    const rows = db.all<{ id: number; name: string }>("SELECT * FROM t");
    expect(rows).toEqual([{ id: 1, name: "alice" }]);
    db.close();
  });

  test("all returns multiple rows", () => {
    const db = createAdapter();
    db.exec("CREATE TABLE t (id INTEGER, val TEXT)");
    db.exec("INSERT INTO t VALUES (1, 'a'), (2, 'b'), (3, 'c')");
    const rows = db.all<{ id: number; val: string }>("SELECT * FROM t ORDER BY id");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ id: 1, val: "a" });
    expect(rows[2]).toEqual({ id: 3, val: "c" });
    db.close();
  });

  test("all with named params auto-prefixes $ on keys", () => {
    const db = createAdapter();
    db.exec("CREATE TABLE t (id INTEGER, name TEXT)");
    db.exec("INSERT INTO t VALUES (1, 'alice'), (2, 'bob')");
    const rows = db.all<{ id: number; name: string }>("SELECT * FROM t WHERE name = $name", {
      name: "bob",
    });
    expect(rows).toEqual([{ id: 2, name: "bob" }]);
    db.close();
  });

  test("all with already-prefixed $ keys works", () => {
    const db = createAdapter();
    db.exec("CREATE TABLE t (id INTEGER, name TEXT)");
    db.exec("INSERT INTO t VALUES (1, 'alice')");
    const rows = db.all<{ id: number; name: string }>("SELECT * FROM t WHERE name = $name", {
      $name: "alice",
    });
    expect(rows).toEqual([{ id: 1, name: "alice" }]);
    db.close();
  });

  test("all with positional params (array)", () => {
    const db = createAdapter();
    db.exec("CREATE TABLE t (id INTEGER, name TEXT)");
    db.exec("INSERT INTO t VALUES (1, 'alice'), (2, 'bob'), (3, 'carol')");
    const rows = db.all<{ id: number; name: string }>(
      "SELECT * FROM t WHERE name IN (?, ?) ORDER BY id",
      ["alice", "carol"],
    );
    expect(rows).toEqual([
      { id: 1, name: "alice" },
      { id: 3, name: "carol" },
    ]);
    db.close();
  });

  test("all with no params", () => {
    const db = createAdapter();
    db.exec("CREATE TABLE t (val TEXT)");
    db.exec("INSERT INTO t VALUES ('x')");
    const rows = db.all<{ val: string }>("SELECT * FROM t");
    expect(rows).toEqual([{ val: "x" }]);
    db.close();
  });

  test("get returns first row", () => {
    const db = createAdapter();
    db.exec("CREATE TABLE t (id INTEGER, name TEXT)");
    db.exec("INSERT INTO t VALUES (1, 'alice'), (2, 'bob')");
    const row = db.get<{ id: number; name: string }>("SELECT * FROM t WHERE id = $id", { id: 1 });
    expect(row).toEqual({ id: 1, name: "alice" });
    db.close();
  });

  test("get returns null when no match", () => {
    const db = createAdapter();
    db.exec("CREATE TABLE t (id INTEGER)");
    const row = db.get("SELECT * FROM t WHERE id = $id", { id: 999 });
    expect(row).toBeNull();
    db.close();
  });

  test("close prevents further operations", () => {
    const db = createAdapter();
    db.exec("CREATE TABLE t (id INTEGER)");
    db.close();
    expect(() => db.all("SELECT * FROM t")).toThrow();
  });
});
