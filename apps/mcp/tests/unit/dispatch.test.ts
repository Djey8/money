import { ApiClient } from '../../src/client';
import { buildToolList, dispatchToolCall } from '../../src/tools/dispatch';
import { TOOLS } from '../../src/tools/registry';
import { OPERATIONS } from '../../src/generated/operations';
import type { FetchLike } from '../../src/client';

function fakeClient(fetchImpl: FetchLike): ApiClient {
  return new ApiClient('http://localhost:3000/api/v1', 'mmpat_test', fetchImpl);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('registry vs. generated manifest (drift check)', () => {
  it('references only operationIds that exist in the generated OpenAPI manifest', () => {
    for (const tool of TOOLS) {
      const actions =
        tool.kind === 'simple'
          ? Object.values(tool.actions)
          : Object.values(tool.entities).flatMap((entityActions) => Object.values(entityActions));
      for (const action of actions) {
        expect(OPERATIONS[action.operationId]).toBeDefined();
      }
    }
  });
});

describe('buildToolList', () => {
  it('produces one MCP tool per registry entry, each with an object inputSchema', () => {
    const tools = buildToolList(TOOLS);
    expect(tools).toHaveLength(TOOLS.length);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('marks entityType required for manage_balance_sheet', () => {
    const tools = buildToolList(TOOLS);
    const balanceSheet = tools.find((t) => t.name === 'manage_balance_sheet')!;
    expect(balanceSheet.inputSchema.required).toContain('entityType');
  });

  it('accepts either shape when two actions give the same argument different schemas, instead of the last action winning', () => {
    const tools = buildToolList(TOOLS);
    const grow = tools.find((t) => t.name === 'manage_grow')!;
    const properties = grow.inputSchema.properties as Record<string, { anyOf?: unknown[] }>;
    const liabilitieVariants = JSON.stringify(properties.liabilitie.anyOf);
    expect(liabilitieVariants).toContain('loanMinor');
    expect(liabilitieVariants).toContain('amountMinor');
    expect(JSON.stringify(properties.share)).toContain('priceMinor');
  });

  it('does not require "action" for a single-action tool', () => {
    const tools = buildToolList(TOOLS);
    const identity = tools.find((t) => t.name === 'get_identity')!;
    expect(identity.inputSchema.required ?? []).not.toContain('action');
  });
});

describe('dispatchToolCall — confirm gate', () => {
  it('blocks a delete action without confirm: true, never calling fetch', async () => {
    const fetchImpl = jest.fn();
    const client = fakeClient(fetchImpl);
    const result = await dispatchToolCall(TOOLS, client, 'manage_transactions', {
      action: 'delete',
      transactionId: 'tx_1',
    });
    expect(result.isError).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('allows a delete action once confirm: true is passed', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { id: 'tx_1' }));
    const client = fakeClient(fetchImpl);
    const result = await dispatchToolCall(TOOLS, client, 'manage_transactions', {
      action: 'delete',
      transactionId: 'tx_1',
      confirm: true,
    });
    expect(result.isError).toBeFalsy();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/transactions/tx_1');
    expect(init.method).toBe('DELETE');
  });

  it('blocks every manage_data action without confirm: true (export, import, recalculate)', async () => {
    const fetchImpl = jest.fn();
    const client = fakeClient(fetchImpl);
    for (const action of ['export', 'import', 'recalculate']) {
      const result = await dispatchToolCall(TOOLS, client, 'manage_data', { action });
      expect(result.isError).toBe(true);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('dispatchToolCall — arg splitting', () => {
  it('substitutes path params and forwards remaining fields as the JSON body', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { id: 'tx_1', amountMinor: -1500 }));
    const client = fakeClient(fetchImpl);
    const result = await dispatchToolCall(TOOLS, client, 'manage_transactions', {
      action: 'update',
      transactionId: 'tx_1',
      amountMinor: -1500,
    });
    expect(result.isError).toBeFalsy();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/transactions/tx_1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ amountMinor: -1500 });
  });

  it('forwards query params for list actions', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { transactions: [] }));
    const client = fakeClient(fetchImpl);
    await dispatchToolCall(TOOLS, client, 'manage_transactions', { action: 'list', limit: 5 });
    const [url] = fetchImpl.mock.calls[0];
    expect(new URL(url).searchParams.get('limit')).toBe('5');
  });

  it('resolves entity tools via entityType + action', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { assets: [] }));
    const client = fakeClient(fetchImpl);
    await dispatchToolCall(TOOLS, client, 'manage_balance_sheet', {
      entityType: 'asset',
      action: 'list',
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/balance/assets');
    expect(init.method).toBe('GET');
  });

  it('defaults to the sole action for a single-action entity value (list_income_sources)', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { revenues: [] }));
    const client = fakeClient(fetchImpl);
    const result = await dispatchToolCall(TOOLS, client, 'list_income_sources', {
      sourceType: 'revenue',
    });
    expect(result.isError).toBeFalsy();
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/income/revenues');
  });

  it('errors clearly when a required path param is missing', async () => {
    const fetchImpl = jest.fn();
    const client = fakeClient(fetchImpl);
    const result = await dispatchToolCall(TOOLS, client, 'manage_transactions', { action: 'get' });
    expect(result.isError).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('dispatchToolCall — ndjson bodies', () => {
  it('sends the ndjson arg verbatim with an auto-generated Idempotency-Key, and does not include it in a JSON body', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { itemCount: 1, results: [] }));
    const client = fakeClient(fetchImpl);
    const ndjson = '{"account":"Daily","amountMinor":-100}';
    const result = await dispatchToolCall(TOOLS, client, 'manage_transactions', {
      action: 'import',
      confirm: true,
      ndjson,
    });
    expect(result.isError).toBeFalsy();
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.body).toBe(ndjson);
    expect(init.headers['Content-Type']).toBe('application/x-ndjson');
    expect(typeof init.headers['Idempotency-Key']).toBe('string');
    expect(init.headers['Idempotency-Key'].length).toBeGreaterThan(0);
  });

  it('returns ndjson export responses as raw text, not re-parsed JSON', async () => {
    const ndjsonBody = '{"id":"tx_1"}\n{"id":"tx_2"}';
    const fetchImpl = jest.fn(
      async () =>
        new Response(ndjsonBody, {
          status: 200,
          headers: { 'content-type': 'application/x-ndjson' },
        }),
    );
    const client = fakeClient(fetchImpl);
    const result = await dispatchToolCall(TOOLS, client, 'manage_transactions', {
      action: 'export',
      confirm: true,
    });
    expect(result.content[0]).toEqual({ type: 'text', text: ndjsonBody });
  });
});

describe('dispatchToolCall — error mapping', () => {
  it('surfaces an RFC 9457 problem response as an isError result without a stack trace', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(403, {
        type: 'https://money-manager.dev/problems/auth_insufficient_scope',
        title: 'Insufficient scope',
        status: 403,
        detail: 'This token lacks the transactions:w scope.',
        code: 'auth_insufficient_scope',
      }),
    );
    const client = fakeClient(fetchImpl);
    const result = await dispatchToolCall(TOOLS, client, 'manage_transactions', {
      action: 'create',
      account: 'Daily',
      amountMinor: -100,
      date: '2026-01-01',
      time: '09:00',
      category: '@Food',
      comment: '',
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('auth_insufficient_scope');
    expect(text).toContain('transactions:w');
    expect(text).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  it('never includes the API token anywhere in a returned error result', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(500, { status: 500 }));
    const client = fakeClient(fetchImpl);
    const result = await dispatchToolCall(TOOLS, client, 'manage_transactions', { action: 'list' });
    expect(JSON.stringify(result)).not.toContain('mmpat_test');
  });
});
