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

## Edit or delete a transaction

```bash
curl -X PATCH http://localhost:3000/api/v1/transactions/tx_01234567-89ab-cdef-0123-456789abcdef \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amountMinor":-1500}'

curl -X DELETE http://localhost:3000/api/v1/transactions/tx_01234567-89ab-cdef-0123-456789abcdef \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

Both require `transactions:w` and rebuild the derived account and fund state the same way `POST /transactions` does. `PATCH` accepts a partial body — send only the fields you want to change.

## Copy a transaction

```bash
curl -X POST http://localhost:3000/api/v1/transactions/tx_01234567-89ab-cdef-0123-456789abcdef/copy \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Duplicates the source transaction's account, amount, category, and comment into a new transaction dated today (send a body with any of `account`/`amountMinor`/`date`/`time`/`category`/`comment` to override).

## Batch create/update/delete transactions

Requires a PAT with `transactions:bulk` (a separate grant from `transactions:w`) and a unique `Idempotency-Key` per logical batch — reusing the same key with the same body replays the original result; reusing it with a different body is rejected.

```bash
curl -X POST http://localhost:3000/api/v1/transactions/batch \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
        "atomic": false,
        "operations": [
          {"op":"create","account":"Daily","amountMinor":-850,"date":"2026-09-07","time":"08:15","category":"@Coffee","comment":""},
          {"op":"update","id":"tx_01234567-89ab-cdef-0123-456789abcdef","amountMinor":-1500},
          {"op":"delete","id":"tx_11111111-89ab-cdef-0123-456789abcdef"}
        ]
      }'
```

The response is always `200` once the request itself is well-formed; check each item's own `status` (`created`/`updated`/`deleted`/`error`, or `not_applied` when `atomic: true` rolled the whole batch back) rather than assuming success from the HTTP status alone.
