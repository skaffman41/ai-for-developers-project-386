import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../", import.meta.url));

export async function temporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "call-calendar-test-"));
  return {
    directory,
    path: join(directory, "calendar.sqlite"),
    dispose: () => rm(directory, { recursive: true, force: true }),
  };
}

export async function runNode(args: string[], env: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => (output += chunk));
  }
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return { code, output };
}

export async function prepareDatabase(path: string) {
  const result = await runNode(["backend/src/prepare.ts"], {
    DATABASE_PATH: path,
  });
  if (result.code !== 0) throw new Error(result.output);
}

export async function startBackend(
  path: string,
  port = 0,
  options: { entry?: string; env?: NodeJS.ProcessEnv } = {},
) {
  const child = spawn(
    process.execPath,
    [options.entry ?? "backend/dist/server.js"],
    {
      cwd: root,
      env: {
        ...process.env,
        ...options.env,
        DATABASE_PATH: path,
        HOST: "127.0.0.1",
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  const closed = new Promise<void>((resolve) => child.once("close", resolve));
  const ready = new Promise<string>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      reject(new Error(`backend exited (${code}, ${signal})\n${output}`)),
    );
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk: string) => {
        output = (output + chunk).slice(-16000);
        const address = output.match(
          /Server listening at (http:\/\/127\.0\.0\.1:\d+)/,
        )?.[1];
        if (address) resolve(address);
      });
    }
  });
  async function stop() {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
    try {
      await closed;
    } finally {
      clearTimeout(timer);
    }
  }
  const timeout = setTimeout(() => child.kill("SIGKILL"), 15000);
  try {
    const url = await ready;
    return {
      url,
      stop,
      pid: child.pid!,
      kill: (signal: NodeJS.Signals) => child.kill(signal),
    };
  } catch (error) {
    await stop();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
