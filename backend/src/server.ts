import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.ts";

const app = buildApp();
app.register(fastifyStatic, {
  root: fileURLToPath(new URL("../../frontend/dist/", import.meta.url)),
  wildcard: false,
  dotfiles: "deny",
});
for (const path of ["/booking", "/owner"]) {
  app.get(path, async (_request, reply) => reply.sendFile("index.html"));
}

async function shutdown() {
  try {
    await app.close();
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

try {
  const port = Number(process.env.PORT ?? 3000);
  if (
    !Number.isInteger(port) ||
    port < 0 ||
    port > 65535 ||
    process.env.PORT === ""
  ) {
    throw new Error("PORT must be an integer between 0 and 65535");
  }
  await app.listen({ host: process.env.HOST ?? "127.0.0.1", port });
} catch (error) {
  app.log.error(error);
  await shutdown();
  process.exitCode = 1;
}
