export interface McpConfig {
  apiUrl: string;
  apiToken: string;
}

/**
 * The MCP server never accepts MM_API_URL/MM_API_TOKEN as a tool argument or
 * config file value — env vars only, per docs/adr/0008-mcp-server-design.md
 * and the same rationale as the encryption-key handling in PLAN.md D-5:
 * nothing capable of ending up in a transcript or prompt.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const apiUrl = env.MM_API_URL;
  const apiToken = env.MM_API_TOKEN;

  const missing: string[] = [];
  if (!apiUrl) missing.push('MM_API_URL');
  if (!apiToken) missing.push('MM_API_TOKEN');
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Set MM_API_URL (e.g. http://localhost:3000/api/v1) and MM_API_TOKEN ' +
        '(a personal access token minted via POST /api/v1/auth/tokens or `mm-admin token create`).',
    );
  }

  return { apiUrl: apiUrl as string, apiToken: apiToken as string };
}

export interface McpHttpConfig {
  apiUrl: string;
  port: number;
}

/**
 * Config for the Streamable HTTP transport (docs/adr/0008): unlike stdio,
 * there is no single MM_API_TOKEN — each remote client supplies its own PAT
 * as a Bearer token per session (see http-server.ts), so only the shared
 * backend URL and listen port come from the environment.
 */
export function loadHttpConfig(env: NodeJS.ProcessEnv = process.env): McpHttpConfig {
  const apiUrl = env.MM_API_URL;
  if (!apiUrl) {
    throw new Error(
      'Missing required environment variable MM_API_URL (e.g. http://backend:3000/api/v1). ' +
        'MM_API_TOKEN is not used in HTTP transport mode — each client supplies its own ' +
        'token as an Authorization: Bearer header.',
    );
  }
  const port = Number(env.MM_MCP_PORT ?? 3939);
  // 0 is valid (and standard for tests): it tells Node to bind an OS-assigned
  // ephemeral port rather than a fixed one.
  if (!Number.isInteger(port) || port < 0) {
    throw new Error(`MM_MCP_PORT must be a non-negative integer, got: ${env.MM_MCP_PORT}`);
  }
  return { apiUrl, port };
}
