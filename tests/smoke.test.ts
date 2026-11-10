import { spawn } from "node:child_process";
import { get } from "node:http";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { temporaryDatabase, prepareDatabase } from "./support/backend.ts";

const root = fileURLToPath(new URL("../", import.meta.url));

async function freePort() {
  const server = createServer();
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected a loopback TCP port");
    }
    return address.port;
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }
}

function startServer(
  name: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  failure: AbortController,
) {
  // Run Node directly so the owned child is the listener, without an npm shell.
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      output = (output + chunk).slice(-16_000);
    });
  }
  const closed = new Promise<void>((resolve) => child.once("close", resolve));
  child.once("error", (error) => failure.abort(error));
  child.once("exit", (code, signal) => {
    failure.abort(new Error(`${name} exited (code ${code}, signal ${signal})`));
  });

  return {
    diagnostics: () => `${name} (pid ${child.pid ?? "not started"})\n${output}`,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
      }
      const timer = setTimeout(() => child.kill("SIGKILL"), 3_000);
      try {
        await closed;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function request(url: string, failure: AbortSignal, timeout = 5_000) {
  return new Promise<{
    status: number | undefined;
    type: string;
    body: string;
  }>((resolve, reject) => {
    const req = get(
      url,
      {
        agent: false,
        signal: AbortSignal.any([failure, AbortSignal.timeout(timeout)]),
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => (body += chunk));
        response.once("error", reject);
        response.once("end", () => {
          resolve({
            status: response.statusCode,
            type: response.headers["content-type"] ?? "",
            body,
          });
        });
      },
    );
    req.once("error", reject);
  });
}

async function waitForHttp(
  url: string,
  failure: AbortSignal,
  deadline: number,
) {
  let lastError: unknown;
  while (Date.now() < deadline) {
    failure.throwIfAborted();
    try {
      return await request(
        url,
        failure,
        Math.max(1, Math.min(5_000, deadline - Date.now())),
      );
    } catch (error) {
      failure.throwIfAborted();
      lastError = error;
    }
    await delay(Math.min(100, Math.max(0, deadline - Date.now())), undefined, {
      signal: failure,
    });
  }
  throw new Error(`HTTP readiness timed out: ${url}`, { cause: lastError });
}

test("built backend and frontend serve their public HTTP contracts", async () => {
  const backendPort = await freePort();
  let frontendPort = await freePort();
  while (frontendPort === backendPort) frontendPort = await freePort();
  const backendUrl = `http://127.0.0.1:${backendPort}/health`;
  const frontendUrl = `http://127.0.0.1:${frontendPort}/`;
  const database = await temporaryDatabase();
  const failure = new AbortController();
  const servers: ReturnType<typeof startServer>[] = [];
  let address = `${backendUrl}, ${frontendUrl}`;
  try {
    await prepareDatabase(database.path);
    const deadline = Date.now() + 30_000;
    servers.push(
      startServer(
        "backend",
        ["backend/dist/server.js"],
        {
          HOST: "127.0.0.1",
          PORT: String(backendPort),
          DATABASE_PATH: database.path,
        },
        failure,
      ),
    );
    servers.push(
      startServer(
        "frontend preview",
        [
          "node_modules/vite/bin/vite.js",
          "preview",
          "frontend",
          "--host",
          "127.0.0.1",
          "--port",
          String(frontendPort),
          "--strictPort",
        ],
        {},
        failure,
      ),
    );

    address = backendUrl;
    const health = await waitForHttp(backendUrl, failure.signal, deadline);
    expect(health.status).toBe(200);
    expect(health.type).toMatch(/^application\/json(?:\s*;|$)/i);
    expect(JSON.parse(health.body)).toEqual({ status: "ok" });

    address = frontendUrl;
    const page = await waitForHttp(frontendUrl, failure.signal, deadline);
    expect(page.status).toBe(200);
    expect(page.type).toMatch(/^text\/html(?:\s*;|$)/i);
    expect(page.body).toMatch(/<div\b[^>]*\sid\s*=\s*["']root["'][^>]*>/i);
    const entry = page.body.match(
      /<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/i,
    )?.[1];
    if (!entry) throw new Error("HTML must reference a JavaScript entry point");
    const scriptUrl = new URL(entry, frontendUrl);
    expect(scriptUrl.origin).toBe(new URL(frontendUrl).origin);

    address = scriptUrl.href;
    const asset = await request(address, failure.signal);
    expect(asset.status).toBe(200);
    expect(asset.type).toMatch(/^(?:text|application)\/javascript(?:\s*;|$)/i);
    expect(asset.body.trim().length).toBeGreaterThan(0);
    failure.signal.throwIfAborted();
  } catch (error) {
    throw new Error(
      `HTTP smoke failed at ${address}\n${servers.map((server) => server.diagnostics()).join("\n")}`,
      { cause: error },
    );
  } finally {
    try {
      await Promise.all(servers.map((server) => server.stop()));
    } finally {
      await database.dispose();
    }
  }
});
