import { extractOperations, resolveRefs } from '../../scripts/generate-operations';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

function loadRealSpec(): Record<string, unknown> {
  const specPath = join(__dirname, '..', '..', '..', '..', 'docs', 'api', 'openapi.yaml');
  return yaml.load(readFileSync(specPath, 'utf8')) as Record<string, unknown>;
}

describe('extractOperations against the real openapi.yaml', () => {
  const spec = loadRealSpec();
  const operations = extractOperations(spec);
  const byId = Object.fromEntries(operations.map((op) => [op.operationId, op]));

  it('finds exactly 96 operations', () => {
    expect(operations).toHaveLength(96);
  });

  it('has no duplicate operationIds', () => {
    const ids = operations.map((op) => op.operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('extracts a path parameter for getTransaction', () => {
    expect(byId.getTransaction).toMatchObject({
      method: 'get',
      path: '/transactions/{transactionId}',
      pathParams: [{ name: 'transactionId', required: true, schema: { type: 'string' } }],
      queryParams: [],
      requestBodySchema: null,
    });
  });

  it('resolves a $ref request body for createTransaction', () => {
    expect(byId.createTransaction.method).toBe('post');
    expect(byId.createTransaction.requestBodySchema).toMatchObject({
      type: 'object',
      required: ['account', 'amountMinor', 'date', 'time', 'category', 'comment'],
    });
    expect(byId.createTransaction.requestBodySchema?.properties).not.toHaveProperty('$ref');
  });

  it('resolves nested $refs inside an array items schema (batchTransactions)', () => {
    const schema = byId.batchTransactions.requestBodySchema as {
      properties: {
        operations: { items: { type: string; properties: { op: { enum: string[] } } } };
      };
    };
    const itemsSchema = schema.properties.operations.items;
    expect(itemsSchema.type).toBe('object');
    expect(itemsSchema.properties.op.enum).toEqual(['create', 'update', 'delete']);
    expect(JSON.stringify(schema)).not.toContain('$ref');
  });

  it('extracts query parameters for listTransactions', () => {
    const queryNames = byId.listTransactions.queryParams.map((p) => p.name);
    expect(queryNames.length).toBeGreaterThan(0);
    expect(byId.listTransactions.pathParams).toEqual([]);
  });

  it('marks the ndjson export/import operations distinctly from JSON operations', () => {
    expect(byId.exportTransactions).toMatchObject({
      requestBodyFormat: 'none',
      responseFormat: 'ndjson',
      requiresIdempotencyKey: false,
    });
    expect(byId.importTransactions).toMatchObject({
      requestBodySchema: null,
      requestBodyFormat: 'ndjson',
      responseFormat: 'json',
      requiresIdempotencyKey: true,
    });
    expect(byId.exportSubscriptions.responseFormat).toBe('ndjson');
    expect(byId.importSubscriptions.requestBodyFormat).toBe('ndjson');
    expect(byId.createTransaction).toMatchObject({
      requestBodyFormat: 'json',
      responseFormat: 'json',
    });
  });

  it('flags Idempotency-Key requirements on batch/import operations only', () => {
    expect(byId.batchTransactions.requiresIdempotencyKey).toBe(true);
    expect(byId.importData.requiresIdempotencyKey).toBe(true);
    expect(byId.createTransaction.requiresIdempotencyKey).toBe(false);
    expect(byId.listTransactions.requiresIdempotencyKey).toBe(false);
  });
});

describe('extractOperations — request body composition guard', () => {
  it('throws a clear error for a JSON request body using allOf/oneOf/anyOf composition', () => {
    const specWithComposedBody = {
      paths: {
        '/widgets': {
          post: {
            operationId: 'createWidget',
            requestBody: {
              content: {
                'application/json': {
                  schema: { allOf: [{ type: 'object', properties: { name: { type: 'string' } } }] },
                },
              },
            },
            responses: {
              '200': { content: { 'application/json': { schema: { type: 'object' } } } },
            },
          },
        },
      },
    };
    expect(() => extractOperations(specWithComposedBody)).toThrow(/allOf\/oneOf\/anyOf/);
  });

  it('does not throw for a plain object schema (sanity check against a false positive)', () => {
    const specWithPlainBody = {
      paths: {
        '/widgets': {
          post: {
            operationId: 'createWidget',
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { name: { type: 'string' } } },
                },
              },
            },
            responses: {
              '200': { content: { 'application/json': { schema: { type: 'object' } } } },
            },
          },
        },
      },
    };
    expect(() => extractOperations(specWithPlainBody)).not.toThrow();
  });
});

describe('resolveRefs', () => {
  it('throws on a circular $ref rather than infinite-looping', () => {
    const root = { a: { $ref: '#/b' }, b: { $ref: '#/a' } };
    expect(() => resolveRefs(root.a, root, new Set())).toThrow(/Circular \$ref/);
  });

  it('throws on a non-local $ref pointer', () => {
    expect(() => resolveRefs({ $ref: 'https://example.com/schema.json' }, {}, new Set())).toThrow(
      /local \$ref/,
    );
  });
});
