import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { AnySchema, ValidateFunction } from "ajv";
import { components, operations } from "./generated/operations.gen.js";

export type OperationId = keyof typeof operations;
const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
});
addFormats.default(ajv);

// Hey API preserves local OpenAPI references; Ajv evaluates them in a schema document.
function schemaReferences(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(schemaReferences);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key === "$ref" && typeof item === "string"
          ? item.replace("#/components/schemas/", "#/$defs/")
          : schemaReferences(item),
      ]),
    );
  }
  return value;
}

function compile(schema: unknown) {
  return ajv.compile({
    $defs: schemaReferences(components),
    ...(schemaReferences(schema) as object),
  } as AnySchema);
}

const requests = new Map<OperationId, ValidateFunction>();
const responses = new Map<string, ValidateFunction>();
const headers = new Map<OperationId, ValidateFunction>();
const bodies = new Map<OperationId, ValidateFunction>();
const schemas = new Map(
  Object.entries(components).map(([name, schema]) => [name, compile(schema)]),
);
for (const [id, operation] of Object.entries(operations)) {
  requests.set(id as OperationId, compile(operation.query));
  headers.set(id as OperationId, compile(operation.headers));
  if (operation.body) bodies.set(id as OperationId, compile(operation.body));
  for (const [status, response] of Object.entries(operation.responses)) {
    responses.set(`${id}:${status}`, compile(response.schema));
  }
}

export function validReadRequest(
  operation: OperationId,
  query: unknown,
  body: unknown,
) {
  return body === undefined && requests.get(operation)!(query);
}

export function assertResponse(
  operation: OperationId,
  status: number,
  mediaType: string | null,
  data: unknown,
): void {
  const validate = responses.get(`${operation}:${status}`);
  if (
    !validate ||
    mediaType?.split(";", 1)[0].trim().toLowerCase() !== "application/json" ||
    !validate(data)
  ) {
    throw new Error(`Invalid ${operation} response (${status})`);
  }
}

// Select only contracted headers: ordinary HTTP transport headers are allowed.
export function validRequestEnvelope(
  operation: OperationId,
  query: unknown,
  values: Record<string, unknown>,
) {
  if (
    operations[operation].body &&
    (typeof values["content-type"] !== "string" ||
      values["content-type"].split(";", 1)[0].trim().toLowerCase() !==
        operations[operation].requestMediaType)
  )
    return false;
  const selected = Object.fromEntries(
    Object.keys(operations[operation].headers.properties)
      .filter((name) => values[name] !== undefined)
      .map((name) => [name, values[name]]),
  );
  return Boolean(
    requests.get(operation)!(query) && headers.get(operation)!(selected),
  );
}
export function validRequestBody(operation: OperationId, body: unknown) {
  return bodies.get(operation)?.(body) ?? body === undefined;
}
export function schemaErrors(
  name: keyof typeof components,
  value: unknown,
): Record<string, string> {
  const validate = schemas.get(name)!;
  if (validate(value)) return {};
  return Object.fromEntries(
    (validate.errors ?? []).map((error) => [
      String(
        error.params.missingProperty ??
          error.instancePath.split("/")[1] ??
          "form",
      ),
      "Проверьте значение поля",
    ]),
  );
}

// JSON parsing can produce Infinity for a numeric literal such as 1e400.
// It has no representable JSON value on this runtime: never stringify it to
// null and register that lossy identity as a saved attempt.
export function interpretableJson(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(interpretableJson);
  if (value !== null && typeof value === "object")
    return Object.values(value).every(interpretableJson);
  return (
    value === null || typeof value === "string" || typeof value === "boolean"
  );
}
