#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig, type McpConfig } from './config.js';
import { ApiClient } from './client.js';
import { TOOLS, type ToolDefinition } from './tools/registry.js';
import { buildExplainTool } from './tools/explain.js';
import { buildToolList, dispatchToolCall } from './tools/dispatch.js';

/**
 * Sent to the client on initialize: where an agent should start. The detail
 * lives in docs/domain (served by explain_concept), not here.
 */
export const SERVER_INSTRUCTIONS =
  "Money Manager is the user's personal finance app: the Barefoot Investor account system " +
  '(Daily/Splurge/Smile/Fire/Mojo) plus Rich-Dad-Poor-Dad investing (Grow, balance sheet). ' +
  'Before anything else, read explain_concept topic app_overview (how the app works and which tool does what). ' +
  'To review finances, give insights or recommendations, read advisor_playbook. Read a feature guide ' +
  '(smile_fire_mojo_guide, grow_guide) before writing to that feature. Reviews are read-only; confirm every ' +
  'write with the user first and show the returned effects.';

export function buildServer(config?: McpConfig): Server {
  const server = new Server(
    { name: 'money-manager', version: '0.1.0' },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  const allTools: ToolDefinition[] = [...TOOLS, buildExplainTool()];
  const client = config ? new ApiClient(config.apiUrl, config.apiToken) : undefined;
  const toolList = buildToolList(allTools);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolList }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!client) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Server is not configured with MM_API_URL/MM_API_TOKEN.' }],
      };
    }
    return dispatchToolCall(allTools, client, request.params.name, request.params.arguments);
  });

  return server;
}

async function main(): Promise<void> {
  if (process.env.MM_MCP_TRANSPORT === 'http') {
    const { startHttpServer } = await import('./http-server.js');
    await startHttpServer();
    return;
  }
  const config = loadConfig();
  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      `money-manager-mcp failed to start: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(1);
  });
}
