# API Agent Guidance

A self-hosted PAT is explicit consent for an agent to access only its granted scopes. Do not send its value in prompts or tool arguments; load it from a local environment variable.

Before making financial requests, call `GET /api/v1/me` with the PAT and inspect the exact scope list. Stop and report the missing scope rather than attempting unrelated endpoints.

PATs cannot create, list, or revoke tokens. Token lifecycle calls require the user's authenticated browser session or a human operator using `mm-admin` directly on the server. The API never issues `admin` scope tokens; use the CLI only for documented break-glass administration.

Every Pro API write is audit logged. Prefer narrowly scoped, expiring tokens and revoke a token as soon as its automation is retired.
