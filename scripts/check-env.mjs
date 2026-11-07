import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const expectedMise = "2026.11.3";
const versions = [
  [
    "mise",
    execFileSync("mise", ["--version"], { encoding: "utf8" }).split(" ")[0],
    expectedMise,
  ],
  ["Node", process.versions.node, manifest.engines.node],
  [
    "npm",
    execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(),
    manifest.engines.npm,
  ],
];

for (const [tool, actual, expected] of versions) {
  if (actual !== expected) {
    console.error(`${tool}: expected ${expected}, got ${actual}`);
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log(
    `Environment OK: mise ${expectedMise}, Node ${manifest.engines.node}, npm ${manifest.engines.npm}`,
  );
}
