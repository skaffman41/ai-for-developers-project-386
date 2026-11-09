import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Ajv } from "ajv";

const require = createRequire(import.meta.url);
const { default: addFormats } = require("ajv-formats");
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const tool = require("release-please/package.json");

for (const [path, schemaPath] of [
  ["release-please-config.json", "release-please/schemas/config.json"],
  [".release-please-manifest.json", "release-please/schemas/manifest.json"],
]) {
  const value = JSON.parse(await readFile(path, "utf8"));
  const validate = ajv.compile(require(schemaPath));
  assert.ok(validate(value), `${path}: ${ajv.errorsText(validate.errors)}`);
}

const versions = JSON.parse(
  await readFile(".release-please-manifest.json", "utf8"),
);
const version = (await readFile("version.txt", "utf8")).trim();
assert.equal(
  version,
  versions["."],
  "Application version and release manifest must agree",
);

console.log(
  `Release configuration valid against release-please ${tool.version} schemas`,
);
