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

  it('finds exactly 106 operations', () => {
    expect(operations).toHaveLength(106);
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

  // Regression: /grow/{growId} and its buy/sell/dividend/payback/cashflow/
  // deposit siblings (plus /smile/{projectId}, /fire/{projectId},
  // /balance/{assets,liabilities,investments,shares}/{id},
  // /subscriptions/{subscriptionId}, /budget/{budgetId}, and
  // /reports/grow/{growId}/pnl) declare their id parameter once at the
  // path-item level, shared across every method under that path, instead
  // of repeating it in each operation's own `parameters` — both are valid
  // OpenAPI, but only reading the operation-level list silently dropped
  // the id parameter for every one of these actions except list/create.
  // Confirmed live: the generated MCP tool schema had no growId field at
  // all, so dispatch always sent the literal unsubstituted
  // "/grow/{growId}" path and every update/buy/sell/etc. call 404'd.
  it('inherits a path-item-level parameter shared across every method under that path', () => {
    for (const [operationId, expectedParam] of [
      ['updateGrow', 'growId'],
      ['sellGrow', 'growId'],
      ['buyGrow', 'growId'],
      ['getGrowPnl', 'growId'],
      ['updateSmileProject', 'projectId'],
      ['updateFireProject', 'projectId'],
      ['updateShare', 'shareId'],
      ['updateAsset', 'assetId'],
      ['updateLiability', 'liabilityId'],
      ['updateInvestment', 'investmentId'],
      ['updateSubscription', 'subscriptionId'],
      ['updateBudgetRow', 'budgetId'],
    ] as const) {
      expect(byId[operationId].pathParams).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: expectedParam, required: true })]),
      );
    }
  });

  it('lets an operation-level parameter override a path-item-level one of the same name/location', () => {
    // copyTransaction declares transactionId on the operation itself
    // (POST /transactions/{transactionId}/copy) while GET/PATCH/DELETE
    // /transactions/{transactionId} do not share a path-item-level
    // parameters block at all — this just confirms the merge doesn't
    // duplicate or drop a normally-declared operation-level parameter.
    expect(byId.copyTransaction.pathParams).toEqual([
      { name: 'transactionId', required: true, schema: { type: 'string' } },
    ]);
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

describe('extractOperations — path-item-level parameters', () => {
  it('inherits a parameter declared once at the path-item level for an operation with none of its own', () => {
    const spec = {
      paths: {
        '/widgets/{widgetId}': {
          parameters: [
            { name: 'widgetId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          patch: {
            operationId: 'updateWidget',
            responses: {
              '200': { content: { 'application/json': { schema: { type: 'object' } } } },
            },
          },
        },
      },
    };
    const [operation] = extractOperations(spec);
    expect(operation.pathParams).toEqual([
      { name: 'widgetId', required: true, schema: { type: 'string' } },
    ]);
  });

  it('lets an operation-level parameter override a path-item-level one of the same name and location', () => {
    const spec = {
      paths: {
        '/widgets/{widgetId}': {
          parameters: [
            { name: 'widgetId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          get: {
            operationId: 'getWidget',
            // Overrides the shared param with a narrower schema — the
            // override must win, not the path-level one.
            parameters: [
              {
                name: 'widgetId',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
              },
            ],
            responses: {
              '200': { content: { 'application/json': { schema: { type: 'object' } } } },
            },
          },
        },
      },
    };
    const [operation] = extractOperations(spec);
    expect(operation.pathParams).toEqual([
      { name: 'widgetId', required: true, schema: { type: 'string', format: 'uuid' } },
    ]);
  });

  it('resolves a $ref inside a path-item-level parameters list', () => {
    const spec = {
      components: {
        parameters: {
          WidgetId: { name: 'widgetId', in: 'path', required: true, schema: { type: 'string' } },
        },
      },
      paths: {
        '/widgets/{widgetId}': {
          parameters: [{ $ref: '#/components/parameters/WidgetId' }],
          delete: {
            operationId: 'deleteWidget',
            responses: { '204': {} },
          },
        },
      },
    };
    const [operation] = extractOperations(spec);
    expect(operation.pathParams).toEqual([
      { name: 'widgetId', required: true, schema: { type: 'string' } },
    ]);
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
