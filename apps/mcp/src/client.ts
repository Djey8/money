export interface ProblemDetails {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  code?: string;
}

/** Mirrors the RFC 9457 shape produced by backend/middleware/api-auth.js's `problem()` helper. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly detail?: string;

  constructor(problem: ProblemDetails) {
    super(problem.title ?? `Request failed with status ${problem.status}`);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
    this.detail = problem.detail;
  }
}

export type BodyFormat = 'json' | 'ndjson' | 'none';

export interface ApiRequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  bodyFormat?: 'json' | 'ndjson';
}

export interface ApiResponse {
  status: number;
  format: BodyFormat;
  json?: unknown;
  text?: string;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Thin fetch wrapper for the self-hosted Pro API. Every request carries the
 * PAT from MM_API_TOKEN as a Bearer token — never as a tool argument, never
 * logged (see docs/adr/0008-mcp-server-design.md's "token via env var only"
 * rule and src/config.ts).
 */
export class ApiClient {
  constructor(
    private readonly apiUrl: string,
    private readonly apiToken: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async request(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<ApiResponse> {
    const base = this.apiUrl.replace(/\/+$/, '');
    const url = new URL(base + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      ...options.headers,
    };

    let body: string | undefined;
    if (options.body !== undefined) {
      if (options.bodyFormat === 'ndjson') {
        headers['Content-Type'] = 'application/x-ndjson';
        body = String(options.body);
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
      }
    }

    const response = await this.fetchImpl(url.toString(), {
      method: method.toUpperCase(),
      headers,
      body,
    });

    const contentType = response.headers.get('content-type') ?? '';

    if (!response.ok) {
      let problem: ProblemDetails = { status: response.status };
      if (contentType.includes('json')) {
        try {
          const parsed = (await response.json()) as Partial<ProblemDetails>;
          problem = { ...parsed, status: response.status };
        } catch {
          // Body wasn't valid JSON despite the content-type header; fall back
          // to a bare status-only problem rather than throwing a second,
          // more confusing error out of the error-handling path itself.
        }
      }
      throw new ApiError(problem);
    }

    if (contentType.includes('application/x-ndjson')) {
      return { status: response.status, format: 'ndjson', text: await response.text() };
    }
    if (contentType.includes('json')) {
      return { status: response.status, format: 'json', json: await response.json() };
    }
    return { status: response.status, format: 'none' };
  }
}
