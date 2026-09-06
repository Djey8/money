# 0008. MCP server design

## Status

Accepted — implementation detail to be finalized in Phase 5

## Context

Master prompt §4.6/§7 requires deciding: generated from OpenAPI vs. hand-written, transport (stdio for Claude Code/Desktop, streamable HTTP for remote use), and how tokens are supplied (env var/config, never in prompts). `RISKS_AND_QUESTIONS.md` C-3/D-6 already decided the MCP layer does not need to implement the `todo/ai.md` anonymization principle, since a self-hosted PAT is treated as sufficient consent.

## Decision

- **Package**: `apps/mcp`, a new npm workspace member (extends the workspace introduced in ADR-0005), TypeScript, one MCP tool per operation group (not one tool per raw HTTP endpoint — e.g. a single `manage_transactions` tool with an `action` parameter covering list/create/update/delete/copy reads more naturally to an LLM than five near-identical tools, mirroring how `docs/api/AGENTS.md`'s task-oriented framing works). Read-only "explain" tools for domain concepts (e.g. `explain_barefoot_allocation`, `explain_grow_pnl`) are backed by `docs/domain/` content, loaded at startup, not re-fetched per call.
- **Schema generation**: tool input schemas are derived from `docs/api/openapi.yaml` (ADR-0007) at build time by a small generator script — not hand-duplicated, and not regenerated from route code directly (there is no route-code generation source per ADR-0007's decision). Tool descriptions (the free-text "when to use this, what it returns, side effects" per master prompt §5.1) are hand-written, not derived, since a good LLM-facing description requires judgment a generator can't produce from a schema alone.
- **Transport**: stdio as the primary, default transport (Claude Code, Claude Desktop) — matches the master prompt's explicit preference and needs no additional infrastructure. Streamable HTTP is added as a second transport for remote/multi-user use (e.g. claude.ai connectors) once local stdio use is validated in the Phase 5 smoke test — not built speculatively ahead of that validation.
- **Token supply**: `MM_API_URL` and `MM_API_TOKEN` environment variables only. The server never accepts a token as a tool argument, never logs it, and never echoes it back in a tool result — matching the encryption-key handling rule in ADR-0001/`PLAN.md` D-5 (same rationale: nothing capable of ending up in a transcript or prompt).
- **Destructive tools**: any tool whose underlying endpoint requires the `:bulk` scope, or is a delete, requires an explicit `confirm: true` argument, and its description states this plainly, per master prompt §7. This is enforced twice — once by the tool declining to act without `confirm: true`, and again by the underlying API endpoint's own scope/idempotency requirements (ADR-0006) — so a bug in one layer doesn't remove the safeguard entirely.
- **`.mcp.json`**: provided at the project root for Claude Code (project scope), documented setup snippet for Claude Desktop, verified at implementation time against the current Claude Code MCP docs (`code.claude.com/docs/en/mcp.md`) rather than assumed from this ADR, since MCP configuration conventions can change between when this is written and when Phase 5 is implemented.

## Consequences

- The MCP layer has a hard dependency on the OpenAPI spec (ADR-0007) being accurate and current — another reason the spec-sync CI check matters, since MCP tool generation would otherwise silently drift too.
- Grouping tools by operation rather than 1:1 with endpoints means the MCP layer has its own thin dispatch logic (mapping a tool call + action to the right HTTP call) — a small amount of code that has no OpenAPI-spec equivalent and needs its own tests.
- If MCP's stdio smoke test (master prompt §7, `docs/api/MCP.md`) surfaces that Money Manager isn't a good fit for MCP for some reason discovered during implementation, the master prompt's own fallback applies: document the plain-HTTP workflow for a Claude chat instead — this ADR doesn't foreclose that, it just states MCP is the first thing attempted, per instruction.
