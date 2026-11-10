import { readFileSync } from "node:fs";
import { buildApp } from "../../backend/src/app.ts";

const app = buildApp({
  now: () =>
    new Date(readFileSync(process.env.TEST_CLOCK_PATH!, "utf8").trim()),
});
process.once("SIGTERM", () => {
  void app.close();
});
await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT ?? 0) });
