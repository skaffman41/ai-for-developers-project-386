import {
  constants,
  accessSync,
  closeSync,
  openSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const applicationId = 0x43414c31;
const version = 1;
const schema = `CREATE TABLE event_types (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 540),
  description TEXT CHECK (description IS NULL OR length(description) BETWEEN 1 AND 2000),
  created_at INTEGER NOT NULL
) STRICT`;

export function databasePath(value = process.env.DATABASE_PATH) {
  if (!value || !isAbsolute(value)) {
    throw new Error(
      "DATABASE_PATH must be an absolute path to a persistent local SQLite file",
    );
  }
  return value;
}

function pragma(database: DatabaseSync, name: string) {
  return Object.values(database.prepare(`PRAGMA ${name}`).get() ?? {})[0];
}

function configure(database: DatabaseSync) {
  database.exec(
    "PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=EXTRA; PRAGMA foreign_keys=ON",
  );
  if (process.platform === "darwin") database.exec("PRAGMA fullfsync=ON");
  const expected = {
    journal_mode: "delete",
    synchronous: 3,
    foreign_keys: 1,
    busy_timeout: 5000,
    ...(process.platform === "darwin" ? { fullfsync: 1 } : {}),
  };
  for (const [name, value] of Object.entries(expected)) {
    if (pragma(database, name) !== value)
      throw new Error(`Unsupported SQLite setting: ${name}`);
  }
}

export function prepareDatabase(path: string) {
  // Exclusive creation prevents replacement of any existing database, including an empty file.
  closeSync(openSync(path, "wx", 0o600));
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(path);
    configure(database);
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(schema);
      database.exec(
        `PRAGMA application_id=${applicationId}; PRAGMA user_version=${version}`,
      );
      database.exec("COMMIT");
    } catch (error) {
      if (database.isTransaction) database.exec("ROLLBACK");
      throw error;
    }
  } catch (error) {
    database?.close();
    database = undefined;
    unlinkSync(path);
    throw error;
  } finally {
    database?.close();
  }
}

export function openDatabase(path: string) {
  // SQLite's default open creates missing files; verify access first and disallow that behavior.
  if (!statSync(path).isFile())
    throw new Error("DATABASE_PATH must identify a regular SQLite file");
  accessSync(path, constants.R_OK | constants.W_OK);
  accessSync(dirname(path), constants.R_OK | constants.W_OK | constants.X_OK);
  const uri = pathToFileURL(path);
  uri.searchParams.set("mode", "rw");
  const database = new DatabaseSync(uri.href, { open: false });
  try {
    database.open();
    if (
      pragma(database, "application_id") !== applicationId ||
      pragma(database, "user_version") !== version
    ) {
      throw new Error(
        "Foreign or unsupported database schema; run explicit preparation for a new database",
      );
    }
    const tables = database
      .prepare(
        "SELECT name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND name != 'sqlite_sequence' ORDER BY name",
      )
      .all();
    if (
      tables.length !== 1 ||
      tables[0].name !== "event_types" ||
      tables[0].sql !== schema
    ) {
      throw new Error("Foreign or unsupported database schema structure");
    }
    if (pragma(database, "quick_check") !== "ok")
      throw new Error("Corrupted SQLite database");
    configure(database);
    return database;
  } catch (error) {
    if (database.isOpen) database.close();
    throw error;
  }
}
