'use strict';

const { parseSubscriptionImportLines } = require('../../routes/api');

const validLine = (overrides = {}) =>
  JSON.stringify({
    account: 'Daily',
    amountMinor: -1000,
    startDate: '2026-01-01',
    category: '@Streaming',
    ...overrides,
  });

describe('parseSubscriptionImportLines', () => {
  it('rejects a non-string body', () => {
    expect(parseSubscriptionImportLines(undefined)).toEqual({
      error: 'A newline-delimited JSON (NDJSON) body is required.',
    });
    expect(parseSubscriptionImportLines(null)).toEqual({
      error: 'A newline-delimited JSON (NDJSON) body is required.',
    });
  });

  it('rejects an empty or whitespace-only body', () => {
    expect(parseSubscriptionImportLines('')).toEqual({
      error: 'A newline-delimited JSON (NDJSON) body is required.',
    });
    expect(parseSubscriptionImportLines('   \n\n  \n')).toEqual({
      error: 'A newline-delimited JSON (NDJSON) body is required.',
    });
  });

  it('parses multiple valid lines, ignoring blank lines and surrounding whitespace', () => {
    const body = [`  ${validLine({ category: '@A' })}  `, '', validLine({ category: '@B' })].join(
      '\n',
    );
    const result = parseSubscriptionImportLines(body);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      op: 'create',
      fields: expect.objectContaining({ category: '@A' }),
    });
    expect(result.items[1]).toEqual({
      op: 'create',
      fields: expect.objectContaining({ category: '@B' }),
    });
  });

  it('handles CRLF line endings the same as LF', () => {
    const body = `${validLine({ category: '@A' })}\r\n${validLine({ category: '@B' })}`;
    const result = parseSubscriptionImportLines(body);
    expect(result.items).toHaveLength(2);
  });

  it('reports a per-line error for invalid JSON without discarding other lines', () => {
    const body = [validLine(), 'not valid json'].join('\n');
    const result = parseSubscriptionImportLines(body);
    expect(result.items[0]).toMatchObject({ op: 'create', fields: expect.any(Object) });
    expect(result.items[1]).toMatchObject({
      op: 'create',
      error: expect.stringContaining('Line 2'),
    });
  });

  it('reports a per-line error for invalid subscription fields without discarding other lines', () => {
    const body = [validLine(), JSON.stringify({ account: 'Daily' })].join('\n');
    const result = parseSubscriptionImportLines(body);
    expect(result.items[0]).toMatchObject({ op: 'create' });
    expect(result.items[0].error).toBeUndefined();
    expect(result.items[1]).toMatchObject({
      op: 'create',
      error: expect.stringContaining('Line 2'),
    });
  });

  it('rejects a body exceeding the line-count cap', () => {
    const body = Array.from({ length: 10001 }, () => validLine()).join('\n');
    const result = parseSubscriptionImportLines(body);
    expect(result.error).toMatch(/cannot exceed 10000 lines/);
  });

  it('reports a per-line error for a single line exceeding the length cap, without ever parsing it as JSON', () => {
    const hugeLine = `{"account":"Daily","comment":"${'x'.repeat(20000)}"}`;
    const body = [validLine(), hugeLine].join('\n');
    const result = parseSubscriptionImportLines(body);
    expect(result.items[0]).toMatchObject({ op: 'create' });
    expect(result.items[1]).toMatchObject({
      op: 'create',
      error: expect.stringContaining('exceeds'),
    });
  });
});
