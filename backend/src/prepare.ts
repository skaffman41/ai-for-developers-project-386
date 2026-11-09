import { databasePath, prepareDatabase } from "./storage.ts";

try {
  const path = databasePath();
  prepareDatabase(path);
  console.log(`Prepared empty database: ${path}`);
} catch (error) {
  console.error("Database preparation failed:", error);
  process.exitCode = 1;
}
