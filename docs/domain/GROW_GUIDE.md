# Grow: how to manage projects, positions and trades through the API

The operating guide for agents using `manage_grow` (REST: `/api/v1/grow...`). Read this before creating or
changing a Grow project. Formats of the stored comment strings are in `grow_dsl_formula`, the P&L report in
`grow_pnl_formula`.

## 1. Two families of project

| `type`                                                          | What it tracks                                                          | Fields that matter                                                                                                                                                                                                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `income-growth` (default)                                       | An investment: an **asset**, a **share** position, or an **investment** | `kind` + the plan (`share`/`investment`/`liabilitie`/`amountMinor`/`cashflowMinor`); money moves only through the actions in section 4.                                                                                                            |
| `expense-insight`, `budget-optimization`, `subscription-action` | A plan to spend less — no position, no trades                           | `category` (`@tag` or array), `currentCostMinor`, `targetCostMinor`, `monthlySavingsMinor`, `annualSavingsMinor`, `reasoning`, `alternative`, `alternativeCostMinor` (subscription), `pattern`, `insights` (expense-insight). All freely editable. |

Every project also has: `title` (required, unique among Grow projects), `sub`, `description`, `strategy`, `risks`,
`riskScore` (**0–5**), `phase` (`idea` → `research` → `plan` → `execute` → `monitor` → `completed`), `status` (legacy
free text, see section 8), `links` `[{label, url}]`, `actionItems` `[{text, done, priority: low|medium|high, dueDate?}]`,
`notes` `[{text, createdAt}]`.

There is **no** `currentAmountMinor`/`targetAmountMinor`, and no `complete`/`abandoned` phase — unknown fields are
rejected.

## 2. Kind, and the link to the balance sheet

An `income-growth` project has at most one **kind**, which decides what buy/sell act on:

| `kind`       | Balance-sheet entry it acts on                                                         | Embedded copy on the project                  |
| ------------ | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| `asset`      | Asset `{tag, amount}`                                                                  | — (`isAsset: true`)                           |
| `share`      | Share `{tag, quantity, price}`                                                         | `share {tag, quantity, priceMinor}`           |
| `investment` | Investment `{tag, deposit, amount=mortgage}` **plus** Liability `M-<title>` (mortgage) | `investment {tag, depositMinor, amountMinor}` |

**The project's `title` is the link key**: the balance-sheet entry is the one whose `tag` equals the title exactly.
A financing loan is the Liability tagged with the title. Consequences:

- A share bought under the title `SOL` lands on the Share tagged `SOL`. A share tagged `SLO` is invisible to it.
- To link an existing position (e.g. Share `IOTA`), give the project that exact title.
- **Renaming** the project (`update {title}`) renames everything linked, in one write: the balance-sheet entry, the
  loan, the `M-` mortgage, every `@<title>` transaction category and the title inside trade comments, and
  `@<title>` subscriptions. It is refused if the new title is already a balance-sheet tag.

Set the kind at create (`kind: "share"`, or legacy `share: true`) or later with `update {kind}` — switching
initializes an empty embedded copy for the new kind and clears the others.

## 3. The plan (no money moves)

Create and `update` accept the project's **planned** values. They create no transaction and move no money:

- `share: {quantity, priceMinor}` — requires kind `share`. A changed `priceMinor` is also written to the
  balance-sheet Share's price (never its quantity) — this is how you **revalue** a share position.
- `investment: {depositMinor, amountMinor}` — `amountMinor` is the mortgage. Requires kind `investment`.
- `liabilitie: {amountMinor, creditMinor}` — the planned financing loan; `null` removes it.
- `amountMinor` (cash invested), `cashflowMinor` (planned periodic cashflow).
- Changing `share` without `amountMinor` recomputes `amountMinor = quantity × price − loan` (like the app's edit panel).

Embedded objects may be echoed back with their `tag`, but the tag must equal the title.

## 4. Actions (money moves; each creates one transaction)

| Action     | Body (per kind)                                                                                                                                                                                                               | Transaction                                               | Effect                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buy`      | asset: `totalAmountMinor` **or** `quantity` + `priceMinor`; share: `quantity` + `priceMinor` (unit price); investment: `depositMinor` + optional `mortgageMinor`. Optional `liabilitie {loanMinor, creditMinor}` (financing). | Fire account, −(cost − loan)                              | Position grows; `amountMinor` += cost − loan; loan added to the Liability tagged with the title and to `liabilitie`; investment: `M-<title>` += mortgage. |
| `sell`     | asset: `totalAmountMinor` **or** `quantity` + `priceMinor`; share: `quantity` + `priceMinor`; investment: `depositMinor` / `mortgageMinor` (each default 0, not both 0), optional `payback {amountMinor, creditMinor}`.       | Income account, +proceeds (investment: deposit − payback) | Position shrinks (removed at 0); can't exceed the position. Share price becomes the sale price.                                                           |
| `dividend` | share only: `quantity` + `priceMinor` (per unit)                                                                                                                                                                              | Income, +quantity × price                                 | None besides the transaction.                                                                                                                             |
| `payback`  | `amountMinor` + `creditMinor` (needs an attached loan)                                                                                                                                                                        | Fire, −(amount + credit)                                  | Loan reduced (removed at 0/0); `amountMinor` += amount.                                                                                                   |
| `cashflow` | `cashflowMinor`, optional `creditMinor`                                                                                                                                                                                       | Income, cashflow − credit                                 | None besides the transaction.                                                                                                                             |
| `deposit`  | `amountMinor`                                                                                                                                                                                                                 | Fire, −amount                                             | None besides the transaction.                                                                                                                             |

All take optional `date`/`time` (default now). The server writes the transaction's comment — **never write the
`Buy Share …` comment format yourself**: the generic transactions tool rejects it.

Income statement: a buy is a Fire-account expense under `@<title>`; sale proceeds count as income (under
`interests` when a Share has the tag, `properties` for an Investment, otherwise `revenues`) — the full proceeds, as
in the app, not only the gain.

## 5. Managing recorded trades

- `list_transactions` — the project's transactions (category `@<title>`), oldest first, each with parsed
  `growStatements`.
- `update_transaction` (`growId`, `transactionId`, only the fields to change) — edits a trade in place: the old
  effect is undone, the edited trade applied, validated like a new one; id, date and loan are kept unless given.
  `liabilitie: null` / `payback: null` remove a recorded loan / payback.
- `delete_transaction` (`confirm: true`) — deletes the trade and undoes its effect.
- Both are refused when later trades depend on the trade (its units were already sold, its loan paid back): undo
  those later trades first.
- Through the generic transactions tool, a trade's amount/comment/category can't change (date/time/account can), and
  deleting one also undoes its effect.

## 6. Units, rounding, and `effects`

- Money is **integer minor units** (cents): €88.33 → `8833`. `quantity` is a plain decimal (3.54 SOL).
- `quantity × priceMinor` is rounded half away from zero to whole cents (1.77 × 8833 → 15634); quantities keep 8
  decimals.
- Every write returns `effects`: before → after for each income-statement line, balance-sheet entry, Smile/Fire
  bucket, Mojo and Grow project it changed. Read it instead of re-fetching.

## 7. Worked examples

Sell half of a 3.54 SOL position at €88.33:

```json
{ "action": "sell", "growId": "grow_…", "quantity": 1.77, "priceMinor": 8833 }
```

→ transaction `+15634` (Income, `@SOL`); Share `SOL` 3.54 → 1.77; `effects.balanceSheet` shows the change.

Revalue the remaining position to €92.10 (no transaction):

```json
{ "action": "update", "growId": "grow_…", "share": { "priceMinor": 9210 } }
```

A rental flat bought with €50,000 cash and a €200,000 mortgage, planned first:

```json
{ "action": "create", "title": "Rental Flat", "kind": "investment", "investment": { "depositMinor": 5000000, "amountMinor": 20000000 } }
{ "action": "buy", "growId": "grow_…", "depositMinor": 5000000, "mortgageMinor": 20000000 }
```

A spending plan:

```json
{
  "action": "create",
  "title": "Cut takeaway",
  "type": "expense-insight",
  "category": "@takeaway",
  "phase": "plan",
  "currentCostMinor": 4000,
  "targetCostMinor": 2000,
  "monthlySavingsMinor": 2000
}
```

Correct a mistyped buy (was 2 units, should be 3):

```json
{ "action": "update_transaction", "growId": "grow_…", "transactionId": "tx_…", "quantity": 3 }
```

## 8. Pitfalls

- `actionItems`, `notes` and `links` are replaced **as a whole array** by `update` — send the full list, including
  items you're not changing, with each action item's current `done`.
- `status` is legacy free text the actions overwrite with `bought`/`sold`/`paid back`/`paid off`, exactly like the
  app. Track progress in `phase`, and put lasting information in `notes`.
- `riskScore` above 5 is rejected (the app can't display it).
- Don't record a trade as a normal transaction, and don't edit a trade's amount through the transactions tool — use
  the actions above so the project and balance sheet stay consistent.
