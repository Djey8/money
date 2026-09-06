# Money Manager Pro API

The self-hosted Pro API is versioned under `/api/v1`. Its source-of-truth contract is [openapi.yaml](openapi.yaml).

## Create an agent token

Use an authenticated browser session, never another PAT, to issue an agent token. The plaintext token is returned only in this response.

```bash
curl -X POST http://localhost:3000/api/v1/auth/tokens \
  -H "Authorization: Bearer <session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"household-agent","scopes":["transactions:rw","reports:r"],"expiresInDays":90}'
```

Store the returned `mmpat_...` value in a secret manager. Revoke it through `DELETE /api/v1/auth/tokens/{tokenId}` when no longer needed.
