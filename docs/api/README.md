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

## Create a transaction

Use a PAT with `transactions:w`. Money is always supplied as an integer minor-unit amount; negative values are expenses.

```bash
curl -X POST http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"account":"Daily","amountMinor":-1250,"date":"2026-09-06","time":"09:30","category":"@Groceries","comment":"Weekly shop"}'
```

The server assigns the transaction ID, retries a CouchDB conflict safely, and rebuilds the linked derived account and fund state in the same user-document write.
