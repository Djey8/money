import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { ApiClient, ApiError } from '../client.js';
import { OPERATIONS, type Operation } from '../generated/operations.js';
import type { EntityTool, SimpleTool, ToolAction, ToolDefinition } from './registry.js';

type JsonSchema = Record<string, unknown>;
type Args = Record<string, unknown>;

function operationProperties(operation: Operation): Record<string, JsonSchema> {
  const properties: Record<string, JsonSchema> = {};
  for (const param of [...operation.pathParams, ...operation.queryParams]) {
    properties[param.name] = param.schema;
  }
  if (operation.requestBodySchema && typeof operation.requestBodySchema.properties === 'object') {
    Object.assign(properties, operation.requestBodySchema.properties as Record<string, JsonSchema>);
  }
  return properties;
}

function collectActionProperties(actions: ToolAction[]): {
  properties: Record<string, JsonSchema>;
  hasConfirm: boolean;
} {
  const properties: Record<string, JsonSchema> = {};
  let hasConfirm = false;
  for (const toolAction of actions) {
    const operation = OPERATIONS[toolAction.operationId];
    if (!operation) {
      throw new Error(
        `MCP tool registry references unknown operationId "${toolAction.operationId}" — ` +
          'the registry has drifted from the generated OpenAPI manifest. Run `npm run generate`.',
      );
    }
    Object.assign(properties, operationProperties(operation));
    if (toolAction.ndjsonBodyArg) {
      properties[toolAction.ndjsonBodyArg] = {
        type: 'string',
        description: 'Raw newline-delimited JSON content, sent verbatim as the request body.',
      };
    }
    if (toolAction.confirm) hasConfirm = true;
  }
  return { properties, hasConfirm };
}

/** Builds the MCP `tools/list` entries from the hand-authored registry + generated manifest. */
export function buildToolList(tools: ToolDefinition[]): Tool[] {
  return tools.map((tool) => {
    if (tool.kind === 'explain') {
      const topicNames = Object.keys(tool.topics);
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: { topic: { type: 'string', enum: topicNames } },
          required: ['topic'],
        },
      };
    }

    if (tool.kind === 'simple') {
      const actionNames = Object.keys(tool.actions);
      const { properties, hasConfirm } = collectActionProperties(Object.values(tool.actions));
      if (actionNames.length > 1) {
        properties.action = { type: 'string', enum: actionNames };
      }
      if (hasConfirm) {
        properties.confirm = {
          type: 'boolean',
          description: 'Must be true to run a delete or bulk-scoped action.',
        };
      }
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties,
          required: actionNames.length > 1 ? ['action'] : [],
        },
      };
    }

    // entity tool
    const entityNames = Object.keys(tool.entities);
    const allActions = entityNames.flatMap((entity) => Object.values(tool.entities[entity]));
    const { properties, hasConfirm } = collectActionProperties(allActions);
    const actionNameSets = entityNames.map((entity) => Object.keys(tool.entities[entity]));
    const allActionNames = Array.from(new Set(actionNameSets.flat()));
    properties[tool.entityParam] = { type: 'string', enum: entityNames };
    if (allActionNames.length > 1) {
      properties.action = { type: 'string', enum: allActionNames };
    }
    if (hasConfirm) {
      properties.confirm = {
        type: 'boolean',
        description: 'Must be true to run a delete or bulk-scoped action.',
      };
    }
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties,
        required: [tool.entityParam],
      },
    };
  });
}

function textResult(text: string, isError = false): CallToolResult {
  return { isError, content: [{ type: 'text', text }] };
}

function resolveAction(
  tool: SimpleTool | EntityTool,
  args: Args,
): { action: ToolAction; error?: undefined } | { action?: undefined; error: CallToolResult } {
  if (tool.kind === 'simple') {
    const actionNames = Object.keys(tool.actions);
    const requested = typeof args.action === 'string' ? args.action : undefined;
    const chosen = requested ?? (actionNames.length === 1 ? actionNames[0] : undefined);
    if (!chosen) {
      return { error: textResult(`"action" is required, one of: ${actionNames.join(', ')}`, true) };
    }
    const action = tool.actions[chosen];
    if (!action) {
      return {
        error: textResult(
          `Unknown action "${chosen}" for ${tool.name}. Valid: ${actionNames.join(', ')}`,
          true,
        ),
      };
    }
    return { action };
  }

  const entityValue =
    typeof args[tool.entityParam] === 'string' ? (args[tool.entityParam] as string) : undefined;
  const entityNames = Object.keys(tool.entities);
  if (!entityValue || !tool.entities[entityValue]) {
    return {
      error: textResult(
        `"${tool.entityParam}" is required, one of: ${entityNames.join(', ')}`,
        true,
      ),
    };
  }
  const entityActions = tool.entities[entityValue];
  const actionNames = Object.keys(entityActions);
  const requested = typeof args.action === 'string' ? args.action : undefined;
  const chosen = requested ?? (actionNames.length === 1 ? actionNames[0] : undefined);
  if (!chosen) {
    return { error: textResult(`"action" is required, one of: ${actionNames.join(', ')}`, true) };
  }
  const action = entityActions[chosen];
  if (!action) {
    return {
      error: textResult(
        `Unknown action "${chosen}" for ${tool.name}/${entityValue}. Valid: ${actionNames.join(', ')}`,
        true,
      ),
    };
  }
  return { action };
}

const RESERVED_ARG_KEYS = new Set(['action', 'confirm']);

export async function dispatchToolCall(
  tools: ToolDefinition[],
  client: ApiClient,
  name: string,
  rawArgs: unknown,
): Promise<CallToolResult> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    return textResult(`Unknown tool: ${name}`, true);
  }
  const args: Args = rawArgs && typeof rawArgs === 'object' ? (rawArgs as Args) : {};

  if (tool.kind === 'explain') {
    const topicKey = typeof args.topic === 'string' ? args.topic : undefined;
    const topicNames = Object.keys(tool.topics);
    const topic = topicKey ? tool.topics[topicKey] : undefined;
    if (!topic) {
      return textResult(`"topic" is required, one of: ${topicNames.join(', ')}`, true);
    }
    return textResult(topic.content);
  }

  const resolved = resolveAction(tool, args);
  if (resolved.error) return resolved.error;
  const { action: toolAction } = resolved;

  if (toolAction.confirm && args.confirm !== true) {
    return textResult(
      `${name} requires confirm: true for this action because it is a delete or bulk-scoped ` +
        'operation. Re-call with confirm: true once you intend to proceed.',
      true,
    );
  }

  const operation = OPERATIONS[toolAction.operationId];
  if (!operation) {
    return textResult(`Internal error: unknown operationId "${toolAction.operationId}".`, true);
  }

  const reservedKeys = new Set(RESERVED_ARG_KEYS);
  if (tool.kind === 'entity') reservedKeys.add(tool.entityParam);
  if (toolAction.ndjsonBodyArg) reservedKeys.add(toolAction.ndjsonBodyArg);

  let path = operation.path;
  for (const param of operation.pathParams) {
    const value = args[param.name];
    if (value === undefined) {
      return textResult(`Missing required argument "${param.name}" for ${name}.`, true);
    }
    path = path.replace(`{${param.name}}`, encodeURIComponent(String(value)));
    reservedKeys.add(param.name);
  }

  const query: Record<string, string | number | boolean | undefined> = {};
  for (const param of operation.queryParams) {
    if (args[param.name] !== undefined) {
      query[param.name] = args[param.name] as string | number | boolean;
    }
    reservedKeys.add(param.name);
  }

  const headers: Record<string, string> = {};
  if (operation.requiresIdempotencyKey) {
    headers['Idempotency-Key'] = randomUUID();
  }

  let body: unknown;
  let bodyFormat: 'json' | 'ndjson' | undefined;
  if (operation.requestBodyFormat === 'ndjson') {
    const argKey = toolAction.ndjsonBodyArg;
    const value = argKey ? args[argKey] : undefined;
    if (typeof value !== 'string') {
      return textResult(`Missing required string argument "${argKey}" for ${name}.`, true);
    }
    body = value;
    bodyFormat = 'ndjson';
  } else if (operation.requestBodyFormat === 'json') {
    const bodyArgs: Args = {};
    for (const [key, value] of Object.entries(args)) {
      if (!reservedKeys.has(key)) bodyArgs[key] = value;
    }
    body = bodyArgs;
    bodyFormat = 'json';
  }

  try {
    const response = await client.request(operation.method, path, {
      query,
      headers,
      body,
      bodyFormat,
    });
    if (response.format === 'ndjson') {
      return textResult(response.text ?? '');
    }
    if (response.format === 'json') {
      return textResult(JSON.stringify(response.json, null, 2));
    }
    return textResult(`OK (status ${response.status})`);
  } catch (error) {
    if (error instanceof ApiError) {
      const parts = [error.code ?? String(error.status), error.message];
      if (error.detail) parts.push(error.detail);
      return textResult(parts.join(': '), true);
    }
    throw error;
  }
}
