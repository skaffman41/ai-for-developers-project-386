import { test as base, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { prepareDatabase, startBackend, temporaryDatabase } from "./backend.ts";

type SeedType = {
  id: string;
  name: string;
  durationMinutes: number;
  description?: string;
  createdAt?: number;
};
type Fixtures = {
  eventTypes: { values: SeedType[] };
  backend: { url: string };
};

export const test = base.extend<Fixtures>({
  eventTypes: [{ values: [] }, { option: true }],
  backend: [
    async ({ eventTypes }, use) => {
      const database = await temporaryDatabase();
      let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
      try {
        await prepareDatabase(database.path);
        const connection = new DatabaseSync(database.path);
        try {
          const insert = connection.prepare(
            "INSERT INTO event_types (id,name,duration_minutes,description,created_at) VALUES (?,?,?,?,?)",
          );
          for (const type of eventTypes.values)
            insert.run(
              type.id,
              type.name,
              type.durationMinutes,
              type.description ?? null,
              type.createdAt ?? 0,
            );
        } finally {
          connection.close();
        }
        backend = await startBackend(database.path, 3183);
        await use(backend);
      } finally {
        await backend?.stop();
        await database.dispose();
      }
    },
    { auto: true },
  ],
});
export { expect };
