#!/usr/bin/env node
/**
 * Parses the checked-in `docs/api/openapi.yaml` (the spec-first source of
 * truth per docs/adr/0007-documentation-architecture.md) into a flat,
 * fully-dereferenced operations manifest consumed by the MCP tool registry
 * (src/tools/registry.ts) and dispatch layer (src/tools/dispatch.ts).
 *
 * Run via `npm run generate` (wired as a pre-build/pretest hook) — never
 * committed, rebuilt from the spec every time, like packages/domain's dist/.
 *
 * Deliberately does NOT extract required scopes: this spec's `security`
 * blocks are always a bare `- bearerAuth: []` with no scopes array (scopes
 * are enforced server-side via `requireScope(...)` in backend/routes/api.js,
 * not declared in the spec) — scope notes belong in the hand-written tool
 * descriptions in registry.ts, sourced by reading the route file once, not
 * re-derived here on every generate.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as yaml from 'js-yaml';

type JsonSchema = Record<string, unknown>;

export interface OperationParam {
  name: string;
  required: boolean;
  schema: JsonSchema;
}

export type BodyFormat = 'json' | 'ndjson' | 'none';

export interface Operation {
  operationId: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  pathParams: OperationParam[];
  queryParams: OperationParam[];
  requestBodySchema: JsonSchema | null;
  requestBodyRequired: boolean;
  requestBodyFormat: BodyFormat;
  responseFormat: BodyFormat;
  requiresIdempotencyKey: boolean;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const SPEC_PATH = join(__dirname, '..', '..', '..', 'docs', 'api', 'openapi.yaml');
const OUTPUT_PATH = join(__dirname, '..', 'src', 'generated', 'operations.ts');

function resolveRefs(node: unknown, root: Record<string, unknown>, seen: Set<string>): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => resolveRefs(item, root, seen));
  }
  if (node === null || typeof node !== 'object') {
    return node;
  }
  const obj = node as Record<string, unknown>;
  const ref = obj['$ref'];
  if (typeof ref === 'string') {
    if (seen.has(ref)) {
      throw new Error(`Circular $ref while generating MCP operations manifest: ${ref}`);
    }
    const target = lookupRef(ref, root);
    return resolveRefs(target, root, new Set(seen).add(ref));
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = resolveRefs(value, root, seen);
  }
  return result;
}

function lookupRef(ref: string, root: Record<string, unknown>): unknown {
  if (!ref.startsWith('#/')) {
    throw new Error(`Only local $ref pointers are supported, got: ${ref}`);
  }
  const segments = ref.slice(2).split('/');
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      throw new Error(`Could not resolve $ref: ${ref}`);
    }
    current = (current as Record<string, unknown>)[segment];
  }
  if (current === undefined) {
    throw new Error(`Could not resolve $ref: ${ref}`);
  }
  return current;
}

/**
 * The dispatch layer's operationProperties() (apps/mcp/src/tools/dispatch.ts)
 * merges a JSON request body's `properties` directly into a tool's flat
 * inputSchema — it has no support for `allOf`/`oneOf`/`anyOf` top-level
 * composition. Every JSON request body in the current spec is a plain
 * `{type: object, properties: {...}}`; fail loudly here (like the
 * unsupported-content-type checks below) if that ever stops being true,
 * rather than letting the generated manifest silently advertise an empty or
 * incomplete schema for the affected tool.
 */
function assertFlatObjectSchema(schema: JsonSchema, operationId: string): void {
  if (schema.allOf || schema.oneOf || schema.anyOf) {
    throw new Error(
      `Operation "${operationId}"'s JSON request body uses allOf/oneOf/anyOf composition, which ` +
        'the MCP dispatch layer cannot flatten into a tool schema (see operationProperties() in ' +
        'apps/mcp/src/tools/dispatch.ts). Resolve the composition into a single object schema in ' +
        'openapi.yaml, or teach the generator/dispatch layer to handle it explicitly.',
    );
  }
}

function pickBodyContent(
  bodyContent: Record<string, Record<string, unknown>> | undefined,
  operationId: string,
): {
  schema: JsonSchema | null;
  format: BodyFormat;
} {
  if (!bodyContent) return { schema: null, format: 'none' };
  if (bodyContent['application/json']) {
    const schema = (bodyContent['application/json'].schema as JsonSchema) ?? null;
    if (schema) assertFlatObjectSchema(schema, operationId);
    return { schema, format: 'json' };
  }
  if (bodyContent['application/x-ndjson']) {
    // A bare `{type: string}` schema, not an object schema with named
    // properties — the dispatch layer sends this content verbatim as the
    // request body rather than merging its (nonexistent) properties into
    // the tool's flat args object the way a JSON body's properties are.
    return { schema: null, format: 'ndjson' };
  }
  throw new Error(
    `Unsupported request body content type(s): ${Object.keys(bodyContent).join(', ')}`,
  );
}

function pickResponseFormat(responses: Record<string, unknown> | undefined): BodyFormat {
  if (!responses) return 'none';
  for (const [status, response] of Object.entries(responses)) {
    if (!status.startsWith('2')) continue;
    const content = (response as Record<string, unknown> | undefined)?.content as
      Record<string, unknown> | undefined;
    if (!content) return 'none';
    if (content['application/json']) return 'json';
    if (content['application/x-ndjson']) return 'ndjson';
    throw new Error(
      `Unsupported response content type(s) for status ${status}: ${Object.keys(content).join(', ')}`,
    );
  }
  return 'none';
}

function extractOperations(spec: Record<string, unknown>): Operation[] {
  const paths = spec.paths as Record<string, Record<string, unknown>>;
  const operations: Operation[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const rawOperation = pathItem[method] as Record<string, unknown> | undefined;
      if (!rawOperation) continue;

      const operationId = rawOperation.operationId as string | undefined;
      if (!operationId) {
        throw new Error(`Operation ${method.toUpperCase()} ${path} is missing an operationId`);
      }

      const resolvedOperation = resolveRefs(rawOperation, spec, new Set()) as Record<
        string,
        unknown
      >;
      const parameters =
        (resolvedOperation.parameters as Record<string, unknown>[] | undefined) ?? [];

      const pathParams: OperationParam[] = [];
      const queryParams: OperationParam[] = [];
      let requiresIdempotencyKey = false;
      for (const param of parameters) {
        const entry: OperationParam = {
          name: param.name as string,
          required: Boolean(param.required),
          schema: (param.schema as JsonSchema) ?? {},
        };
        if (param.in === 'path') pathParams.push(entry);
        else if (param.in === 'query') queryParams.push(entry);
        else if (param.in === 'header' && entry.name === 'Idempotency-Key') {
          requiresIdempotencyKey = true;
        }
      }

      const requestBody = resolvedOperation.requestBody as Record<string, unknown> | undefined;
      const bodyContent = requestBody?.content as
        Record<string, Record<string, unknown>> | undefined;
      const { schema: requestBodySchema, format: requestBodyFormat } = pickBodyContent(
        bodyContent,
        operationId,
      );

      const responses = resolvedOperation.responses as Record<string, unknown> | undefined;
      const responseFormat = pickResponseFormat(responses);

      operations.push({
        operationId,
        method,
        path,
        pathParams,
        queryParams,
        requestBodySchema,
        requestBodyRequired: Boolean(requestBody?.required),
        requestBodyFormat,
        responseFormat,
        requiresIdempotencyKey,
      });
    }
  }

  return operations;
}

function render(operations: Operation[]): string {
  const byOperationId: Record<string, Operation> = {};
  for (const operation of operations) {
    if (byOperationId[operation.operationId]) {
      throw new Error(`Duplicate operationId in openapi.yaml: ${operation.operationId}`);
    }
    byOperationId[operation.operationId] = operation;
  }

  return `// GENERATED FILE — do not edit by hand.
// Produced by scripts/generate-operations.ts from docs/api/openapi.yaml.
// Run \`npm run generate\` to rebuild.

export interface OperationParam {
  name: string;
  required: boolean;
  schema: Record<string, unknown>;
}

export type BodyFormat = 'json' | 'ndjson' | 'none';

export interface Operation {
  operationId: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  pathParams: OperationParam[];
  queryParams: OperationParam[];
  requestBodySchema: Record<string, unknown> | null;
  requestBodyRequired: boolean;
  requestBodyFormat: BodyFormat;
  responseFormat: BodyFormat;
  requiresIdempotencyKey: boolean;
}

export const OPERATIONS: Record<string, Operation> = ${JSON.stringify(byOperationId, null, 2)};
`;
}

function main(): void {
  const raw = readFileSync(SPEC_PATH, 'utf8');
  const spec = yaml.load(raw) as Record<string, unknown>;
  const operations = extractOperations(spec);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, render(operations), 'utf8');
  console.error(`Generated ${operations.length} operations -> ${OUTPUT_PATH}`);
}

if (require.main === module) {
  main();
}

export { extractOperations, resolveRefs };
