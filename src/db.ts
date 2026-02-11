import { createAdapter, type SqliteAdapter } from "./sqlite-adapter.js";
import { readFileSync, readdirSync, mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";

// --- Types ---

export interface Todo {
  uuid: string;
  title: string;
  notes: string;
  status: "open" | "completed" | "canceled";
  start: "inbox" | "anytime" | "someday" | null;
  startDate: string | null;
  deadline: string | null;
  todayIndex: number;
  projectId: string | null;
  projectTitle: string | null;
  areaId: string | null;
  areaTitle: string | null;
  headingId: string | null;
  headingTitle: string | null;
  creationDate: string;
  modificationDate: string | null;
  completionDate: string | null;
  tags: string[];
  checklistItems: ChecklistItem[];
}

export interface ChecklistItem {
  uuid: string;
  title: string;
  completed: boolean;
}

export interface Project {
  uuid: string;
  title: string;
  notes: string;
  status: "open" | "completed" | "canceled";
  start: "inbox" | "anytime" | "someday" | null;
  startDate: string | null;
  deadline: string | null;
  areaId: string | null;
  areaTitle: string | null;
  creationDate: string;
  modificationDate: string | null;
  completionDate: string | null;
  tags: string[];
  openTodoCount: number;
  totalTodoCount: number;
}

export interface ProjectDetail extends Omit<Project, "openTodoCount" | "totalTodoCount"> {
  headings: { uuid: string; title: string }[];
  todos: (Todo & { headingId: string | null })[];
}

export interface Area {
  uuid: string;
  title: string;
  visible: boolean;
}

export interface Tag {
  uuid: string;
  title: string;
  shortcut: string | null;
  parentTag: string | null;
}

export type TodoList = "inbox" | "today" | "anytime" | "someday" | "upcoming" | "logbook" | "trash";

export interface TodoFilters {
  list?: TodoList;
  projectId?: string;
  areaId?: string;
  tag?: string;
  search?: string;
  status?: "open" | "completed" | "canceled";
  limit?: number;
}

export interface ProjectFilters {
  status?: "open" | "completed" | "canceled";
  areaId?: string;
  search?: string;
  limit?: number;
}

// --- Date Utilities ---

/** Core Data reference: 2001-01-01T00:00:00Z in Unix epoch seconds */
const CORE_DATA_EPOCH = 978307200;

/** Convert Core Data timestamp (seconds since 2001-01-01) to ISO string */
export function coreDataTimestampToISO(timestamp: number): string {
  return new Date((timestamp + CORE_DATA_EPOCH) * 1000).toISOString();
}

/** Convert Things day integer (days since 2001-01-01) to YYYY-MM-DD */
export function dayIntegerToDate(dayInt: number): string {
  const ms = (dayInt * 86400 + CORE_DATA_EPOCH) * 1000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Get today as days since 2001-01-01 */
export function todayAsDayInteger(): number {
  const now = Date.now() / 1000;
  return Math.floor((now - CORE_DATA_EPOCH) / 86400);
}

// --- Database Connection ---

let db: SqliteAdapter | null = null;

/** Exported for testing: inject a database instance */
export function _setDb(database: SqliteAdapter | null): void {
  db = database;
}

/** Detect the Things SQLite database path */
export function detectDbPath(): string {
  const envPath = process.env.THINGS_DB_PATH;
  if (envPath) return envPath;

  const groupContainers = join(homedir(), "Library", "Group Containers", "JLMPQHK86H.com.culturedcode.ThingsMac");
  let entries: string[];
  try {
    entries = readdirSync(groupContainers);
  } catch {
    throw new Error(
      "Things 3 database not found. Is Things 3 installed? " +
        "You can set THINGS_DB_PATH to the database path manually.",
    );
  }

  const thingsData = entries.find((e) => e.startsWith("ThingsData-"));
  if (!thingsData) {
    throw new Error(
      "Things 3 data directory not found in Group Containers. " +
        "You can set THINGS_DB_PATH to the database path manually.",
    );
  }

  return join(groupContainers, thingsData, "Things Database.thingsdatabase", "main.sqlite");
}

/**
 * Read a SQLite database file with WAL support.
 * Uses `sqlite3 .backup` to produce a clean snapshot that includes
 * any changes still in the WAL journal. Falls back to a raw file
 * read if the sqlite3 CLI is unavailable.
 */
function readSqliteFile(dbPath: string): Buffer {
  const tmp = mkdtempSync(join(tmpdir(), "things-mcp-"));
  const tmpFile = join(tmp, "backup.sqlite");
  try {
    execSync(`sqlite3 "${dbPath}" ".backup '${tmpFile}'"`, { stdio: "pipe" });
    return readFileSync(tmpFile);
  } catch {
    // sqlite3 CLI unavailable — fall back to raw read
    return readFileSync(dbPath);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
    try { rmdirSync(tmp); } catch {}
  }
}

/** Get or create the database connection (lazy singleton, read-only) */
export function getDb(): SqliteAdapter {
  if (db) return db;
  const path = detectDbPath();
  const data = readSqliteFile(path);
  db = createAdapter(data);
  return db;
}

// --- Status/Start Helpers ---

function mapStatus(status: number): "open" | "completed" | "canceled" {
  if (status === 3) return "completed";
  if (status === 2) return "canceled";
  return "open";
}

function mapStart(start: number | null): "inbox" | "anytime" | "someday" | null {
  if (start === 0) return "inbox";
  if (start === 1) return "anytime";
  if (start === 2) return "someday";
  return null;
}

// --- Query Functions ---

export function queryTodos(filters: TodoFilters = {}): Todo[] {
  const database = getDb();
  const conditions: string[] = ["t.type = 0"];
  const params: Record<string, string | number> = {};
  const limit = filters.limit ?? 50;

  if (filters.list !== "trash") {
    conditions.push("t.trashed = 0");
  }

  if (filters.list) {
    const todayDays = todayAsDayInteger();
    switch (filters.list) {
      case "inbox":
        conditions.push("t.status = 0", "t.start = 0", "t.project IS NULL");
        break;
      case "today":
        params.todayDays = todayDays;
        conditions.push(
          "t.status = 0",
          "(t.todayIndex > 0 OR (t.startDate IS NOT NULL AND t.startDate <= $todayDays))",
        );
        break;
      case "anytime":
        params.todayDays = todayDays;
        conditions.push(
          "t.status = 0",
          "t.start = 1",
          "(t.startDate IS NULL OR t.startDate <= $todayDays)",
        );
        break;
      case "someday":
        conditions.push("t.status = 0", "t.start = 2");
        break;
      case "upcoming":
        params.todayDays = todayDays;
        conditions.push(
          "t.status = 0",
          "t.start = 1",
          "t.startDate IS NOT NULL",
          "t.startDate > $todayDays",
        );
        break;
      case "logbook":
        conditions.push("t.status = 3");
        break;
      case "trash":
        conditions.push("t.trashed = 1");
        break;
    }
  }

  if (filters.status) {
    const statusMap = { open: 0, completed: 3, canceled: 2 };
    params.status = statusMap[filters.status];
    conditions.push("t.status = $status");
  }

  if (filters.projectId) {
    params.projectId = filters.projectId;
    conditions.push("t.project = $projectId");
  }

  if (filters.areaId) {
    params.areaId = filters.areaId;
    conditions.push("(t.area = $areaId OR p.area = $areaId)");
  }

  if (filters.search) {
    params.search = `%${filters.search}%`;
    conditions.push("(t.title LIKE $search OR t.notes LIKE $search)");
  }

  let orderBy = "t.todayIndex ASC, t.creationDate DESC";
  if (filters.list === "logbook") {
    orderBy = "t.stopDate DESC";
  }

  const sql = `
    SELECT
      t.uuid, t.title, t.notes, t.status, t.start,
      t.startDate, t.deadline, t.todayIndex,
      t.project AS projectId, p.title AS projectTitle,
      t.area AS areaId, a.title AS areaTitle,
      t.heading AS headingId, h.title AS headingTitle,
      t.creationDate, t.userModificationDate AS modificationDate,
      t.stopDate AS completionDate
    FROM TMTask t
    LEFT JOIN TMTask p ON t.project = p.uuid
    LEFT JOIN TMArea a ON COALESCE(t.area, p.area) = a.uuid
    LEFT JOIN TMTask h ON t.heading = h.uuid AND h.type = 2
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT $limit
  `;
  params.limit = limit;

  const rows = database.all<RawTodoRow>(sql, params);
  const uuids = rows.map((r) => r.uuid);
  if (uuids.length === 0) return [];

  const tagsMap = batchLoadTags(database, uuids);
  const checklistMap = batchLoadChecklists(database, uuids);

  return rows.map((r) => formatTodo(r, tagsMap, checklistMap));
}

export function queryTodoById(uuid: string): Todo | null {
  const database = getDb();
  const sql = `
    SELECT
      t.uuid, t.title, t.notes, t.status, t.start,
      t.startDate, t.deadline, t.todayIndex,
      t.project AS projectId, p.title AS projectTitle,
      t.area AS areaId, a.title AS areaTitle,
      t.heading AS headingId, h.title AS headingTitle,
      t.creationDate, t.userModificationDate AS modificationDate,
      t.stopDate AS completionDate
    FROM TMTask t
    LEFT JOIN TMTask p ON t.project = p.uuid
    LEFT JOIN TMArea a ON COALESCE(t.area, p.area) = a.uuid
    LEFT JOIN TMTask h ON t.heading = h.uuid AND h.type = 2
    WHERE t.uuid = $uuid AND t.type = 0
  `;

  const row = database.get<RawTodoRow>(sql, { uuid });
  if (!row) return null;

  const tagsMap = batchLoadTags(database, [uuid]);
  const checklistMap = batchLoadChecklists(database, [uuid]);

  return formatTodo(row, tagsMap, checklistMap);
}

export function queryProjects(filters: ProjectFilters = {}): Project[] {
  const database = getDb();
  const conditions: string[] = ["t.type = 1", "t.trashed = 0"];
  const params: Record<string, string | number> = {};
  const limit = filters.limit ?? 50;

  if (filters.status) {
    const statusMap = { open: 0, completed: 3, canceled: 2 };
    params.status = statusMap[filters.status];
    conditions.push("t.status = $status");
  }

  if (filters.areaId) {
    params.areaId = filters.areaId;
    conditions.push("t.area = $areaId");
  }

  if (filters.search) {
    params.search = `%${filters.search}%`;
    conditions.push("(t.title LIKE $search OR t.notes LIKE $search)");
  }

  const sql = `
    SELECT
      t.uuid, t.title, t.notes, t.status, t.start,
      t.startDate, t.deadline,
      t.area AS areaId, a.title AS areaTitle,
      t.creationDate, t.userModificationDate AS modificationDate,
      t.stopDate AS completionDate,
      (SELECT COUNT(*) FROM TMTask c WHERE c.project = t.uuid AND c.type = 0 AND c.trashed = 0 AND c.status = 0) AS openTodoCount,
      (SELECT COUNT(*) FROM TMTask c WHERE c.project = t.uuid AND c.type = 0 AND c.trashed = 0) AS totalTodoCount
    FROM TMTask t
    LEFT JOIN TMArea a ON t.area = a.uuid
    WHERE ${conditions.join(" AND ")}
    ORDER BY t.todayIndex ASC, t.creationDate DESC
    LIMIT $limit
  `;
  params.limit = limit;

  const rows = database.all<RawProjectRow>(sql, params);
  const uuids = rows.map((r) => r.uuid);
  if (uuids.length === 0) return [];

  const tagsMap = batchLoadTags(database, uuids);

  return rows.map((r) => formatProject(r, tagsMap));
}

export function queryProjectById(uuid: string): ProjectDetail | null {
  const database = getDb();
  const sql = `
    SELECT
      t.uuid, t.title, t.notes, t.status, t.start,
      t.startDate, t.deadline,
      t.area AS areaId, a.title AS areaTitle,
      t.creationDate, t.userModificationDate AS modificationDate,
      t.stopDate AS completionDate
    FROM TMTask t
    LEFT JOIN TMArea a ON t.area = a.uuid
    WHERE t.uuid = $uuid AND t.type = 1
  `;

  const row = database.get<RawProjectRow>(sql, { uuid });
  if (!row) return null;

  const tagsMap = batchLoadTags(database, [uuid]);

  // Load headings
  const headings = database.all<{ uuid: string; title: string }>(
    `SELECT uuid, title FROM TMTask WHERE project = $uuid AND type = 2 AND trashed = 0 ORDER BY "index" ASC`,
    { uuid },
  );

  // Load todos within this project
  const todoSql = `
    SELECT
      t.uuid, t.title, t.notes, t.status, t.start,
      t.startDate, t.deadline, t.todayIndex,
      t.project AS projectId, $uuid AS projectTitle,
      t.area AS areaId, a2.title AS areaTitle,
      t.heading AS headingId, h.title AS headingTitle,
      t.creationDate, t.userModificationDate AS modificationDate,
      t.stopDate AS completionDate
    FROM TMTask t
    LEFT JOIN TMArea a2 ON t.area = a2.uuid
    LEFT JOIN TMTask h ON t.heading = h.uuid AND h.type = 2
    WHERE t.project = $uuid AND t.type = 0 AND t.trashed = 0
    ORDER BY t."index" ASC
  `;
  const todoRows = database.all<RawTodoRow>(todoSql, { uuid });
  const todoUuids = todoRows.map((r) => r.uuid);

  const todoTagsMap = todoUuids.length > 0 ? batchLoadTags(database, todoUuids) : new Map();
  const checklistMap = todoUuids.length > 0 ? batchLoadChecklists(database, todoUuids) : new Map();

  const todos = todoRows.map((r) => ({
    ...formatTodo(r, todoTagsMap, checklistMap),
    headingId: r.headingId,
  }));

  return {
    uuid: row.uuid,
    title: row.title,
    notes: row.notes ?? "",
    status: mapStatus(row.status),
    start: mapStart(row.start),
    startDate: row.startDate != null ? dayIntegerToDate(row.startDate) : null,
    deadline: row.deadline != null ? dayIntegerToDate(row.deadline) : null,
    areaId: row.areaId,
    areaTitle: row.areaTitle,
    creationDate: coreDataTimestampToISO(row.creationDate),
    modificationDate: row.modificationDate != null ? coreDataTimestampToISO(row.modificationDate) : null,
    completionDate: row.completionDate != null ? coreDataTimestampToISO(row.completionDate) : null,
    tags: tagsMap.get(uuid) ?? [],
    headings,
    todos,
  };
}

export function queryAreas(): Area[] {
  const database = getDb();
  const rows = database.all<{ uuid: string; title: string; visible: number }>(
    `SELECT uuid, title, visible FROM TMArea ORDER BY "index" ASC`,
  );

  return rows.map((r) => ({
    uuid: r.uuid,
    title: r.title,
    visible: r.visible === 1,
  }));
}

export function queryTags(): Tag[] {
  const database = getDb();
  const rows = database.all<{ uuid: string; title: string; shortcut: string | null; parent: string | null }>(
    `SELECT uuid, title, shortcut, parent FROM TMTag ORDER BY title ASC`,
  );

  return rows.map((r) => ({
    uuid: r.uuid,
    title: r.title,
    shortcut: r.shortcut ?? null,
    parentTag: r.parent ?? null,
  }));
}

// --- Internal Helpers ---

interface RawTodoRow {
  uuid: string;
  title: string;
  notes: string | null;
  status: number;
  start: number | null;
  startDate: number | null;
  deadline: number | null;
  todayIndex: number;
  projectId: string | null;
  projectTitle: string | null;
  areaId: string | null;
  areaTitle: string | null;
  headingId: string | null;
  headingTitle: string | null;
  creationDate: number;
  modificationDate: number | null;
  completionDate: number | null;
}

interface RawProjectRow {
  uuid: string;
  title: string;
  notes: string | null;
  status: number;
  start: number | null;
  startDate: number | null;
  deadline: number | null;
  areaId: string | null;
  areaTitle: string | null;
  creationDate: number;
  modificationDate: number | null;
  completionDate: number | null;
  openTodoCount?: number;
  totalTodoCount?: number;
}

function batchLoadTags(database: SqliteAdapter, uuids: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (uuids.length === 0) return map;

  const placeholders = uuids.map(() => "?").join(",");
  const rows = database.all<{ taskUuid: string; title: string }>(
    `SELECT tt.tasks AS taskUuid, t.title
       FROM TMTaskTag tt
       JOIN TMTag t ON tt.tags = t.uuid
       WHERE tt.tasks IN (${placeholders})
       ORDER BY t.title ASC`,
    uuids,
  );

  for (const row of rows) {
    const existing = map.get(row.taskUuid);
    if (existing) {
      existing.push(row.title);
    } else {
      map.set(row.taskUuid, [row.title]);
    }
  }
  return map;
}

function batchLoadChecklists(database: SqliteAdapter, uuids: string[]): Map<string, ChecklistItem[]> {
  const map = new Map<string, ChecklistItem[]>();
  if (uuids.length === 0) return map;

  const placeholders = uuids.map(() => "?").join(",");
  const rows = database.all<{ uuid: string; title: string; status: number; task: string }>(
    `SELECT uuid, title, status, task
       FROM TMChecklistItem
       WHERE task IN (${placeholders})
       ORDER BY "index" ASC`,
    uuids,
  );

  for (const row of rows) {
    const item: ChecklistItem = {
      uuid: row.uuid,
      title: row.title,
      completed: row.status === 3,
    };
    const existing = map.get(row.task);
    if (existing) {
      existing.push(item);
    } else {
      map.set(row.task, [item]);
    }
  }
  return map;
}

function formatTodo(
  r: RawTodoRow,
  tagsMap: Map<string, string[]>,
  checklistMap: Map<string, ChecklistItem[]>,
): Todo {
  return {
    uuid: r.uuid,
    title: r.title,
    notes: r.notes ?? "",
    status: mapStatus(r.status),
    start: mapStart(r.start),
    startDate: r.startDate != null ? dayIntegerToDate(r.startDate) : null,
    deadline: r.deadline != null ? dayIntegerToDate(r.deadline) : null,
    todayIndex: r.todayIndex,
    projectId: r.projectId,
    projectTitle: r.projectTitle,
    areaId: r.areaId,
    areaTitle: r.areaTitle,
    headingId: r.headingId,
    headingTitle: r.headingTitle,
    creationDate: coreDataTimestampToISO(r.creationDate),
    modificationDate: r.modificationDate != null ? coreDataTimestampToISO(r.modificationDate) : null,
    completionDate: r.completionDate != null ? coreDataTimestampToISO(r.completionDate) : null,
    tags: tagsMap.get(r.uuid) ?? [],
    checklistItems: checklistMap.get(r.uuid) ?? [],
  };
}

function formatProject(r: RawProjectRow, tagsMap: Map<string, string[]>): Project {
  return {
    uuid: r.uuid,
    title: r.title,
    notes: r.notes ?? "",
    status: mapStatus(r.status),
    start: mapStart(r.start),
    startDate: r.startDate != null ? dayIntegerToDate(r.startDate) : null,
    deadline: r.deadline != null ? dayIntegerToDate(r.deadline) : null,
    areaId: r.areaId,
    areaTitle: r.areaTitle,
    creationDate: coreDataTimestampToISO(r.creationDate),
    modificationDate: r.modificationDate != null ? coreDataTimestampToISO(r.modificationDate) : null,
    completionDate: r.completionDate != null ? coreDataTimestampToISO(r.completionDate) : null,
    tags: tagsMap.get(r.uuid) ?? [],
    openTodoCount: r.openTodoCount ?? 0,
    totalTodoCount: r.totalTodoCount ?? 0,
  };
}
