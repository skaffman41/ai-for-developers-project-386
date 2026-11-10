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
const version = 3;
const schema = `CREATE TABLE event_types (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 540),
  description TEXT CHECK (description IS NULL OR length(description) BETWEEN 1 AND 2000),
  created_at INTEGER NOT NULL
) STRICT`;

const resultsSchema = `CREATE TABLE operation_results (
  operation TEXT NOT NULL,
  attempt_key TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  status INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (operation, attempt_key)
) STRICT`;

const bookingsSchema = `CREATE TABLE bookings (
  id TEXT PRIMARY KEY NOT NULL,
  event_type_id TEXT NOT NULL REFERENCES event_types(id),
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL CHECK (ends_at > starts_at),
  guest_name TEXT NOT NULL CHECK (length(guest_name) BETWEEN 1 AND 100),
  guest_email TEXT NOT NULL CHECK (length(guest_email) BETWEEN 1 AND 254)
) STRICT`;
const occupancyIndex =
  "CREATE INDEX bookings_interval ON bookings (starts_at, ends_at)";

function checkSchema(database: DatabaseSync, expectedVersion: number) {
  const expected =
    expectedVersion === 1
      ? [schema]
      : expectedVersion === 2
        ? [schema, resultsSchema]
        : [bookingsSchema, occupancyIndex, schema, resultsSchema];
  const tables = database
    .prepare(
      "SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name != 'sqlite_sequence' ORDER BY name",
    )
    .all();
  if (
    tables.length !== expected.length ||
    tables.some((table, index) => table.sql !== expected[index])
  )
    throw new Error("Foreign or unsupported database schema structure");
}

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
      database.exec(resultsSchema);
      database.exec(bookingsSchema);
      database.exec(occupancyIndex);
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

export function openDatabase(
  path: string,
  options: { beforeMigrationCommit?: () => void } = {},
) {
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
      ![1, 2, version].includes(Number(pragma(database, "user_version")))
    ) {
      throw new Error(
        "Foreign or unsupported database schema; run explicit preparation for a new database",
      );
    }
    const currentVersion = Number(pragma(database, "user_version"));
    checkSchema(database, currentVersion);
    if (pragma(database, "quick_check") !== "ok")
      throw new Error("Corrupted SQLite database");
    configure(database);
    if (currentVersion < version) {
      database.exec("BEGIN IMMEDIATE");
      try {
        if (currentVersion === 1) {
          database.exec(resultsSchema);
          database.exec("PRAGMA user_version=2");
          checkSchema(database, 2);
        }
        database.exec(bookingsSchema);
        database.exec(occupancyIndex);
        database.exec(`PRAGMA user_version=${version}`);
        checkSchema(database, version);
        options.beforeMigrationCommit?.();
        database.exec("COMMIT");
      } catch (error) {
        if (database.isTransaction) database.exec("ROLLBACK");
        throw error;
      }
    }
    return database;
  } catch (error) {
    if (database.isOpen) database.close();
    throw error;
  }
}
