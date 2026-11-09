import { createClient } from "@hey-api/openapi-ts";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { format } from "prettier";

const root = fileURLToPath(new URL("../", import.meta.url));
/** @typedef {import("ajv").AnySchemaObject} Schema */
/** @typedef {{ operationId: string, summary: string, description?: string, parameters?: { in: string, name: string, required?: boolean, schema: Schema }[], responses: Record<string, { content: Record<string, { schema: Schema }> }> }} Operation */
/** @typedef {{ info: { title: string }, paths: Record<string, Record<string, Operation>>, components: { schemas: Record<string, Schema> } }} OpenApi */
const document = JSON.parse(
  await readFile(join(root, "contract/openapi.json"), "utf8"),
);
const meta = JSON.parse(
  await readFile(join(root, "contract/vendor/openapi-3.1-schema.json"), "utf8"),
);
// This standalone structural schema has no dynamic-scope override. Resolve its meta
// anchor explicitly: Ajv otherwise recurses into the OpenAPI document at #meta.
const structural = JSON.parse(
  JSON.stringify(meta).replaceAll(
    '"$dynamicRef":"#meta"',
    '"$ref":"#/$defs/schema"',
  ),
);
const validate = new Ajv2020({ strict: false, validateFormats: false }).compile(
  structural,
);
if (!validate(document))
  throw new Error(`Invalid OpenAPI: ${JSON.stringify(validate.errors)}`);
const source = /** @type {OpenApi} */ (document);
const schemaCompiler = addFormats.default(new Ajv2020({ strict: true }));
const schemaDocument = JSON.parse(
  JSON.stringify({ $defs: source.components.schemas }).replaceAll(
    "#/components/schemas/",
    "#/$defs/",
  ),
);
for (const name of Object.keys(source.components.schemas))
  schemaCompiler.compile({ ...schemaDocument, $ref: `#/$defs/${name}` });

const temporary = await mkdtemp(join(tmpdir(), "call-calendar-contract-"));
try {
  const generated = join(temporary, "generated");
  await createClient({
    input: join(root, "contract/openapi.json"),
    output: { path: generated, importFileExtension: ".js" },
    plugins: [
      "@hey-api/typescript",
      "@hey-api/client-fetch",
      "@hey-api/sdk",
      "@hey-api/schemas",
      "fastify",
    ],
  });
  /** @type {Record<string, unknown>} */
  const operations = {};
  let documentation = `# ${source.info.title}\n\nGenerated from [openapi.json](openapi.json). Do not edit by hand.\n`;
  for (const [path, item] of Object.entries(source.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      /** @type {{type: string, additionalProperties: boolean, properties: Record<string, Schema>, required: string[]}} */
      const query = {
        type: "object",
        additionalProperties: false,
        properties: {},
        required: [],
      };
      for (const parameter of operation.parameters ?? []) {
        if (parameter.in !== "query")
          throw new Error(
            "Add contract generation support before using another parameter location",
          );
        query.properties[parameter.name] = parameter.schema;
        if (parameter.required) query.required.push(parameter.name);
      }
      const responses = Object.fromEntries(
        Object.entries(operation.responses).map(([status, response]) => {
          const content = Object.entries(response.content ?? {});
          if (content.length !== 1 || content[0][0] !== "application/json")
            throw new Error(
              "Only explicit JSON responses are currently supported",
            );
          return [
            status,
            { mediaType: content[0][0], schema: content[0][1].schema },
          ];
        }),
      );
      operations[operation.operationId] = {
        method: method.toUpperCase(),
        path,
        query,
        responses,
      };
      documentation += `\n## ${method.toUpperCase()} ${path}\n\n${operation.summary}\n\n${operation.description ?? ""}\n\nResponses: ${Object.keys(responses).join(", ")}.\n`;
    }
  }
  const components = Object.keys(source.components.schemas)
    .map((name) => `${JSON.stringify(name)}: schemas.${name}Schema`)
    .join(",\n");
  await writeFile(
    join(generated, "operations.gen.ts"),
    `// Generated from openapi.json by scripts/api.mjs. Do not edit.\nimport * as schemas from "./schemas.gen.js";\nexport const components = { ${components} } as const;\nexport const operations = ${JSON.stringify(operations)} as const;\n`,
  );
  documentation += `\n## Schemas\n\n\`\`\`json\n${JSON.stringify(source.components.schemas, null, 2)}\n\`\`\`\n`;
  /** @type {Map<string, string>} */
  const files = new Map();
  /** @param {string} directory */
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      else
        files.set(
          join("contract/src/generated", relative(generated, path)),
          await format(
            // Hey API 0.99 unescapes Unicode even after an escaped backslash.
            // Restore these regex escapes before JS can consume them as line
            // continuations. Keep this repair in generation, never derivatives.
            (await readFile(path, "utf8")).replaceAll(
              /\\[\u2028\u2029]/gu,
              (escaped) => `\\\\u${escaped.charCodeAt(1).toString(16)}`,
            ),
            {
              parser: "typescript",
              filepath: path,
            },
          ),
        );
    }
  }
  await collect(generated);
  // Reproducible bytes can still contain a reproducible semantic defect. Check
  // the actual emitted schema values against the canonical components as well.
  const schemaPath = join(generated, "schemas.gen.ts");
  const schemaContents = files.get("contract/src/generated/schemas.gen.ts");
  if (!schemaContents) throw new Error("Generated schema module is missing");
  await writeFile(schemaPath, schemaContents);
  const generatedSchemas = await import(pathToFileURL(schemaPath).href);
  for (const [name, schema] of Object.entries(source.components.schemas)) {
    if (!isDeepStrictEqual(generatedSchemas[`${name}Schema`], schema)) {
      throw new Error(`Generated schema ${name} differs from OpenAPI values`);
    }
  }
  files.set(
    "contract/API.generated.md",
    await format(documentation, { parser: "markdown" }),
  );
  if (process.argv.includes("--check")) {
    /** @type {string[]} */
    const actual = [];
    /** @param {string} directory */
    async function list(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await list(path);
        else actual.push(relative(root, path));
      }
    }
    await list(join(root, "contract/src/generated"));
    const differences = actual.filter((path) => !files.has(path));
    for (const [path, contents] of files) {
      if (
        (await readFile(join(root, path), "utf8").catch(() => undefined)) !==
        contents
      )
        differences.push(path);
    }
    if (differences.length)
      throw new Error(
        `Generated API differs: ${differences.join(", ")}. Run npm run api:generate.`,
      );
    console.log("OpenAPI valid; all generated API artifacts match.");
  } else {
    // Hey API owns this directory. Remove stale derivatives when operations disappear.
    await rm(join(root, "contract/src/generated"), {
      recursive: true,
      force: true,
    });
    const { mkdir } = await import("node:fs/promises");
    for (const [path, contents] of files) {
      await mkdir(join(root, path, ".."), { recursive: true });
      await writeFile(join(root, path), contents);
    }
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
