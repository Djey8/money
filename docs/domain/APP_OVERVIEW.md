# Money Manager: how the app works (start here)

Read this first. It explains the model behind every tool: where money lives, what drives what, and which tool does
which job. For coaching the user (reviews, metrics, recommendations) read `advisor_playbook` next. Deeper topics:

| Topic                               | Read it for                                                      |
| ----------------------------------- | ---------------------------------------------------------------- |
| `advisor_playbook`                  | Reviews, health metrics, insights, how to recommend              |
| `smile_fire_mojo_guide`             | Savings goals, buckets, contributions, settlement, payment plans |
| `grow_guide`                        | Investments: projects, positions, buy/sell/dividend/cashflow     |
| `kpi_formulas`                      | The two savings-rate / fixed-cost-ratio formulas                 |
| `fire_coverage_formula`             | How many months of expenses Mojo covers                          |
| `payment_plan_formula`              | How a payment plan's instalment is calculated                    |
| `budget_from_subscriptions_formula` | Seeding a month's budget from subscriptions                      |
| `grow_pnl_formula`                  | A Grow project's profit and loss                                 |
| `grow_dsl_formula`                  | The stored trade comment format (read-only knowledge)            |

## 1. Two ideas, one app

Money Manager combines two personal-finance philosophies:

- **The Barefoot Investor** (Scott Pape) — _where does each euro go?_ Income is split automatically into a few
  accounts with a clear job each (spend, enjoy, save for goals, handle emergencies, keep a reserve). The app's
  accounts, the Smile/Fire projects and Mojo come from here.
- **Rich Dad Poor Dad** (Robert Kiyosaki) — _does it put money in your pocket or take it out?_ Build or buy
  **assets** that produce cashflow, avoid **liabilities** that drain it, and grow passive income until it covers
  your expenses. The balance sheet, income statement and **Grow** projects come from here.

The first gives day-to-day control; the second the long-term direction. Advice should use both (see
`advisor_playbook`).

## 2. The accounts and the income split

Every transaction sits on one **account**:

| Account   | Job                                                              | Default share of income |
| --------- | ---------------------------------------------------------------- | ----------------------- |
| `Income`  | Money coming in (salary, interest, rent, dividends)              | — (it's the source)     |
| `Daily`   | Everyday spending: rent, food, bills, transport                  | 60%                     |
| `Splurge` | Guilt-free spending on anything                                  | 10%                     |
| `Smile`   | Saving for medium-term goals (Smile projects)                    | 10%                     |
| `Fire`    | Emergency funds for known risks (Fire projects) — not retirement | 20%                     |
| `Mojo`    | The long-term reserve, a safety net sized in months of expenses  | — (filled from others)  |

- **The split is virtual.** An `Income` transaction is never moved by hand: each account's balance is its own
  transactions **plus its share of every `Income` transaction** (`balance(account) = Σ own + Σ round(income × ratio)`).
  The ratios are the user's `allocation` setting (`manage_settings`), default 60/10/10/20, and must sum to 100.
- **No overflow.** A full account doesn't spill into another. Money moves between accounts only when a transaction
  says so.
- **Transfers**: a transaction whose category names an account (`Income`, `Daily`, `Splurge`, `Smile`, `Fire`,
  `Mojo`) is a transfer. Reports exclude transfers from income and expenses.
- **Sign**: negative = money out (expense), positive = money in. Money is always `amountMinor` (integer cents) plus
  an ISO-4217 `currency`.

## 3. Transactions are the source of truth

A transaction is `{account, amountMinor, currency, date, time, category, comment}`. `category` is a tag such as
`@Groceries`. An `@` category that equals the name of something else (a project, a share, a subscription) links
the transaction to it, case-insensitively, by name. There are no hidden IDs, so **renaming breaks links unless the
rename goes through the tool that cascades it** (Grow and Smile/Fire renames do).

Almost everything else is **derived** from transactions and rebuilt on every write:

| Derived                                    | From                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Account balances                           | Transactions on the account + its share of `Income` (section 2)                    |
| Smile/Fire bucket amounts, Mojo            | Transactions with the project's/`@Mojo` category (`smile_fire_mojo_guide`)         |
| Income sources (revenue/interest/property) | `Income` transactions, classified by category (below)                              |
| Grow trades and positions                  | Typed Grow actions (buy/sell/…), which write both the transaction and the position |
| Budget "actuals"                           | That month's transactions per category (section 6)                                 |
| All reports                                | Transactions plus the balance-sheet entities                                       |

**Income classification.** An `Income` transaction becomes:

- **interest / dividend income** when its category matches a **Share**'s tag (or an existing interest entry);
- **property income** when it matches an **Investment**'s tag (or an existing property entry);
- otherwise **revenue** (salary, freelance, …). The income-statement report shows untagged income as `otherIncome`.

So to record rent from the flat tagged `Flat-Berlin`, post `+amount` on `Income` with category `@Flat-Berlin`. The
income-source lists (`list_income_sources`) are read-only because they're rebuilt from these transactions.

Every write returns **`effects`**: before → after for the income statement, balance sheet, Smile, Fire, Mojo and
Grow. Show the user what changed.

## 4. The balance sheet (what you own and owe)

`manage_balance_sheet` holds the entities; `get_reports balance_sheet` totals them:

- **Assets**: `cash`, `shares` (quantity × price), `investments` (e.g. real estate: `amount + deposit`), and other
  assets (`properties`, e.g. a car).
- **Liabilities**: debts (loans, mortgages, credit).
- **Net worth** (= equity) = assets − liabilities. It's a current snapshot; the app keeps no history, so compare
  over time by noting it in a review (e.g. a note on a project, or your own summary).

In accounting terms everything you own is an asset. In **Kiyosaki's** terms only what _puts money in your pocket_ is
an asset: a rented flat with positive cashflow is, the home you live in or a car is not. The advisor playbook uses
this second view to judge the balance sheet.

## 5. Goals and investments

- **Smile projects** (medium-term goals, e.g. a trip) and **Fire projects** (emergency funds, e.g. car repairs) are
  split into **buckets**. Money reaches a bucket only through a contribution transaction; when the real bill is paid
  the bucket is **settled** with its actual cost. A **payment plan** turns a goal into a recurring subscription.
  Full rules: `smile_fire_mojo_guide`.
- **Mojo** is one balance with a target (the reserve). `get_reports fire_coverage` says how many months of
  average expenses it covers.
- **Grow projects** are the Rich-Dad side: an investment (`income-growth`: an asset, a share position or a
  mortgage-financed investment) with a plan, a strategy, risks and typed trades; or a plan to cut costs
  (`expense-insight`, `budget-optimization`, `subscription-action`). Full rules: `grow_guide`.

## 6. Planning: subscriptions and budget

- **Subscriptions** are recurring transactions (weekly … yearly). `refresh` generates the ones that are due. A
  payment plan owns its subscription: change it through the plan.
- **Budget** rows are a monthly plan per category: `{date: YYYY-MM, tag: "@Groceries", amountMinor}` (positive =
  planned spending). The app compares a row with that month's **actual**, the signed sum of the month's transactions
  whose category equals the row's tag (spending is negative), so `remaining = plan + actual`. The row `@others`
  collects every non-`Income` transaction of the month whose category has no budget row. There is no
  budget-vs-actual endpoint: rebuild it with `manage_transactions list` (`from`/`to` for the month, and `category`)
  as `advisor_playbook` describes. `fill_forward`, `copy` and `from_subscriptions` fill a month quickly.

## 7. Reports (read-only, `get_reports`)

| Action             | Answers                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `income_statement` | Income (revenue/interest/property/other) vs expenses per account, net result, savings rate — this vs previous period |
| `cashflow`         | Operating vs investing (to Smile/Fire) vs financing (debt payback) vs Mojo                                           |
| `balance_sheet`    | Assets, liabilities, net worth now                                                                                   |
| `kpis`             | Savings rate, fixed-cost ratio, debt ratio, equity ratio, interest coverage, top expense/income categories           |
| `fire_coverage`    | Months of expenses the Mojo reserve covers                                                                           |
| `grow_pnl`         | One Grow project's cost basis, realised and unrealised profit                                                        |

Periods: `period` = `week|month|quarter|halfyear|year`, `offset` = 0 (current), -1 (previous), … Two savings
rates exist on purpose (`kpi_formulas`); don't merge them.

## 8. Which tool for which job

| The user wants to …                         | Use                                                              |
| ------------------------------------------- | ---------------------------------------------------------------- |
| record spending or income                   | `manage_transactions create` (right account + `@category`)       |
| save for a goal / emergency                 | `manage_smile` / `manage_fire` `contribute`, or a payment plan   |
| pay the bill a goal saved for               | `settle_bucket`                                                  |
| top up the reserve                          | `manage_mojo contribute`                                         |
| buy/sell a share, record rent or a dividend | `manage_grow` typed actions (never the generic transaction tool) |
| add a loan, a flat, a car                   | `manage_balance_sheet` (or a Grow project for an investment)     |
| plan a month                                | `manage_budget` (`from_subscriptions`, `fill_forward`, `upsert`) |
| change the income split, currency, language | `manage_settings`                                                |
| understand their finances                   | `get_reports` + `advisor_playbook`                               |

## 9. Rules for agents

- **Confirm before writing.** Say what you'll record (account, amount, category, date) and wait for a yes; show
  the `effects` afterwards. Actions marked `confirm` (deletes, bulk, export) always need an explicit request.
- Never write the Grow comment format or `#settle:` tags yourself; use the typed actions.
- Bucket amounts and the Mojo balance can't be set, only contributed to. Removing a bucket or project that holds
  money needs `force`.
- `get_identity` shows which scopes the token has. A read-only token (only `:r` scopes) is enough for advice.
