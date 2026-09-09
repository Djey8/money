import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../../src/index';
import { TOOLS } from '../../src/tools/registry';

async function connectedClient(config?: { apiUrl: string; apiToken: string }) {
  const server = buildServer(config);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('buildServer', () => {
  it('lists the registry tools plus explain_concept', async () => {
    const client = await connectedClient();
    const result = await client.listTools();
    const expectedNames = [...TOOLS.map((t) => t.name), 'explain_concept'].sort();
    expect(result.tools.map((t) => t.name).sort()).toEqual(expectedNames);
  });

  it('returns an error result for an unknown tool call rather than throwing', async () => {
    const client = await connectedClient({
      apiUrl: 'http://localhost:3000/api/v1',
      apiToken: 'mmpat_test',
    });
    const result = await client.callTool({ name: 'does_not_exist', arguments: {} });
    expect(result.isError).toBe(true);
  });

  it('refuses to dispatch a tool call when built without a config (no MM_API_URL/MM_API_TOKEN)', async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: 'get_identity', arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/not configured/i);
  });
});
