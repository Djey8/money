# Money Manager MCP server

`apps/mcp` exposes the self-hosted Pro API (`docs/api/openapi.yaml`) as MCP tools, so an agent can use Money Manager directly instead of making raw HTTP calls. See `docs/adr/0008-mcp-server-design.md` for the design decisions this implements.

## Setup

1. Mint a PAT with the scopes your agent needs (never `admin` — the API refuses to issue that scope to a PAT):

   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/tokens \
     -H "Authorization: Bearer <session-jwt>" \
     -H "Content-Type: application/json" \
     -d '{"name":"claude-mcp","scopes":["transactions:rw","reports:r"],"expiresInDays":90}'
   ```

2. Build the server once (`npm run build --workspace=apps/mcp`), producing `apps/mcp/dist/index.js`.
3. Add it to Claude Code as a project-scoped server — either edit `.mcp.json` at the repo root directly, or run:

   ```bash
   claude mcp add --scope project --transport stdio money-manager \
     --env MM_API_URL=http://localhost:3000/api/v1 \
     --env MM_API_TOKEN=<the PAT from step 1> \
     -- node apps/mcp/dist/index.js
   ```

   The checked-in `.mcp.json` uses `${MM_API_TOKEN}` expansion so the PAT itself is never committed — set the `MM_API_TOKEN` (and, if not localhost:3000, `MM_API_URL`) environment variable in your own shell before starting Claude Code. Claude Code will prompt for approval the first time it loads a project-scoped server.

4. For Claude Desktop, add the same `command`/`args`/`env` shape to its own MCP server config (see Anthropic's current Claude Desktop docs for the exact file location, which is separate from `.mcp.json`).

`MM_API_URL` and `MM_API_TOKEN` are the **only** way this server is configured — it never accepts a token as a tool argument, never logs it, and never echoes it back in a tool result (`docs/adr/0008-mcp-server-design.md`, same rationale as the encryption-key handling in ADR-0001/`PLAN.md` D-5). If either variable is missing, the server refuses to start and prints exactly which one, to stderr, rather than starting in a half-configured state.

## Tools

One tool per operation group, not one per HTTP endpoint (a `manage_transactions` tool with an `action` argument, rather than five near-identical `transactions_*` tools). Every write/delete/bulk-scoped action requires a PAT with the matching scope — see each tool's own description (returned in `tools/list`) for exactly which. Call `get_identity` first to see what your token is actually allowed to do.

| Tool                    | Covers                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `manage_transactions`   | list/get/create/update/delete/copy/batch/export/import                                       |
| `get_reports`           | income statement, cashflow, balance sheet, KPIs, Fire coverage, Grow P&L (all read-only)     |
| `manage_mojo`           | get/update_target                                                                            |
| `manage_smile`          | list/get/create/update/delete/create_payment_plan                                            |
| `manage_fire`           | list/get/create/update/delete/create_payment_plan                                            |
| `manage_balance_sheet`  | list/get/create/update/delete, for `entityType`: asset, liability, investment, or share      |
| `list_income_sources`   | list, for `sourceType`: revenue, interest, or property (read-only)                           |
| `get_identity`          | the caller's userId, auth type, and exact scope list                                         |
| `manage_grow`           | list/get/create/update/delete plus typed actions: buy/sell/dividend/payback/cashflow/deposit |
| `manage_subscriptions`  | list/get/create/update/delete/batch/export/import/refresh                                    |
| `manage_budget`         | list/upsert/get_row/update_row/delete_row/delete_month/fill_forward/copy/from_subscriptions  |
| `manage_settings`       | get/update                                                                                   |
| `get_encryption_config` | read-only — never returns the raw key                                                        |
| `manage_data`           | export/import/recalculate — the highest-blast-radius resource                                |
| `get_account`           | read-only — email change/delete/verify-password need a browser session, not a PAT            |
| `explain_concept`       | explains a Money Manager domain concept from `docs/domain/`, no API call                     |

Tool input schemas are generated at build time from `docs/api/openapi.yaml` (`apps/mcp/scripts/generate-operations.ts` → `apps/mcp/src/generated/operations.ts`, rebuilt on every `npm run build`/`npm test`, never hand-edited or committed) — the same spec-first source of truth `docs/adr/0007-documentation-architecture.md` established for the HTTP API, so the two surfaces can't silently drift apart. Tool _descriptions_ (when to use a tool, what it returns, its scope/confirm requirements) are hand-written, not generated, per the ADR — a schema alone can't produce a good LLM-facing explanation of intent.

## `confirm: true`

Any tool action that deletes something, or hits an endpoint scoped `:bulk` (batch/export/import/recalculate — the highest-blast-radius operations in the API), refuses to run unless the call also includes `confirm: true`. This is checked independently inside the MCP server itself, before any HTTP request is made — it holds even if the underlying API route has no confirmation requirement of its own (most plain entity deletes don't). `manage_data` requires `confirm: true` for every one of its actions, including `export`, since a full plaintext financial export is sensitive enough to warrant deliberate rather than incidental use.

Calling a gated action without `confirm: true` returns an error result explaining why, and never touches the network.

## Excluded from MCP entirely

`PATCH/DELETE /account`, `POST /account/verify-password`, `PUT /encryption-config`, and all of `/auth/tokens*` are `requireSession`-only routes — a PAT (which is what `MM_API_TOKEN` is) is structurally blocked from calling them regardless of scope, per `PLAN.md` D-19/`docs/adr/0006-api-scopes-and-access-control.md`. There is no MCP tool for them; use the browser session flow (`docs/api/README.md`) or `mm-admin` for those operations. Their read-only counterparts (`GET /account`, `GET /encryption-config`, `GET /me`) remain available as `get_account`, `get_encryption_config`, and `get_identity`.

## Transport

Stdio only for now, matching Claude Code/Desktop's primary transport and needing no extra infrastructure. Streamable HTTP (for remote/multi-user use, e.g. claude.ai connectors) is a possible follow-up once stdio use is validated in practice — not built speculatively ahead of that, per `docs/adr/0008-mcp-server-design.md`.

## Verifying the server yourself

```bash
npm run build --workspace=apps/mcp
MM_API_URL=http://localhost:3000/api/v1 MM_API_TOKEN=<your PAT> node apps/mcp/dist/index.js
```

The process should sit quietly on stdio (no stray stdout output) until an MCP client connects. `apps/mcp/tests/integration/smoke.test.ts` automates exactly this against a live backend + CouchDB, spawning the built server as a real child process and round-tripping a tool call — run it with `npm run test:integration --workspace=apps/mcp` (needs `docker-compose.test.yml`'s CouchDB stack running, same as `backend`'s own integration tests).
