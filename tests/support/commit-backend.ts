// Test-owned process entry. Synchronous stage markers keep the production
// transaction synchronous and let the parent kill at a known boundary.
import { readFileSync, writeFileSync } from "node:fs";
import { buildApp } from "../../backend/src/app.ts";
const app = buildApp({
  ...(process.env.TEST_CLOCK_PATH
    ? {
        now: () =>
          new Date(readFileSync(process.env.TEST_CLOCK_PATH!, "utf8").trim()),
      }
    : {}),
  onCommitStage(stage) {
    if (stage === process.env.STOP_STAGE) {
      writeFileSync(process.env.STAGE_MARKER!, stage);
      process.kill(process.pid, "SIGSTOP");
    }
  },
});
process.once("SIGTERM", () => {
  void app.close();
});
await app.listen({ host: "127.0.0.1", port: 0 });
