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
for (const [id, operation] of Object.entries(operations)) {
  requests.set(id as OperationId, compile(operation.query));
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
