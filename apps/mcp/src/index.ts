#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig, type McpConfig } from './config.js';
import { ApiClient } from './client.js';
import { TOOLS, type ToolDefinition } from './tools/registry.js';
import { buildExplainTool } from './tools/explain.js';
import { buildToolList, dispatchToolCall } from './tools/dispatch.js';

export function buildServer(config?: McpConfig): Server {
  const server = new Server(
    { name: 'money-manager', version: '0.1.0' },
    { capabilities: { tools: {} } },
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
