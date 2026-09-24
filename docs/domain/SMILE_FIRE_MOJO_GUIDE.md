# Smile, Fire and Mojo: buckets, contributions and plans

The operating guide for agents using `manage_smile`, `manage_fire` and `manage_mojo` (REST: `/api/v1/smile`,
`/fire`, `/mojo`). Read this before creating a project or moving money. Payment-plan maths is in
`payment_plan_formula`; Fire coverage in `fire_coverage_formula`.

## 1. What they are

| Fund      | Purpose (Barefoot Investor)                                  | Structure                                               |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| **Smile** | Medium-term goals you save up for (a trip, a car)            | Projects, each with one or more **buckets** (sub-goals) |
| **Fire**  | Emergency funds (car repair, medical) — _not_ retirement     | Same shape as Smile: projects with buckets              |
| **Mojo**  | The long-term emergency reserve, sized in months of expenses | One balance with a target                               |

A Smile/Fire project has: `title` (unique), `sub`, `description`, `phase` (`idea` → `planning` → `saving` → `ready`
→ `completed`), `targetDate`, `completionDate`, `buckets`, `links`, `actionItems`, `notes`, `plannedSubscriptions`
(payment plans), and read-only `totals` (sum of its buckets). A bucket has `id`, `title` (unique within the project,
case-insensitive), `targetMinor`, the derived `amountMinor`, and optional `notes`, `links`, `targetDate`,
`completionDate`.

## 2. The one rule: amounts come only from transactions

**Bucket amounts and the Mojo balance are never stored input.** On every write, the server resets them to zero and
replays every transaction in order. You cannot set `amountMinor` — it is rejected. To put money in, record a
contribution (`contribute`, section 4). Consequences you must know:

- **Which transactions count** (matched by name, exactly):

  | Fund  | A transaction counts when its category is                                                 | From which account |
  | ----- | ----------------------------------------------------------------------------------------- | ------------------ |
  | Smile | `@<project title>`                                                                        | any                |
  | Fire  | `@<project title>` **or** `@<bucket title>`                                               | any                |
  | Mojo  | `@Mojo` (capped) — or any transaction **on** the Mojo account (uncapped, adds or removes) | —                  |

- **Direction doesn't matter** for Smile/Fire: the amount's absolute value fills buckets. So **never record a
  purchase as an ordinary transaction with the project's category** — buying the flight as `@Vacation` would _add_
  to the buckets. When the real bill for a bucket is paid, **settle** the bucket (section 5).
- **Where the money goes inside a project**:
  - with `#bucket:<Title>:<amount>` tags in the comment: to exactly those buckets (title match is
    case-insensitive);
  - without tags — **Smile**: split evenly across the buckets that still have room; **Fire**: `@<project>` goes to
    the **first** bucket, `@<bucket>` to that bucket.
- **Capping**: a bucket never exceeds its target, and Mojo (for `@Mojo`) never exceeds its target. A contribution
  larger than the room left is **stored reduced** — the transaction's amount (and its tags) are rewritten. Money
  never "overflows" into another bucket.
- **Fire auto-completes**: when every bucket of a Fire fund is full, its `phase` becomes `completed` and
  `completionDate` is set.
- **Untagged Smile contributions move when buckets change**: they are re-split across whatever buckets exist at each
  replay, so adding a bucket shifts them. `contribute` always writes explicit tags, so money it records never
  shifts. (Contributions entered in the app without tags still follow this rule.)
- Changing a target re-caps immediately (lowering one can reduce stored contributions); every write returns
  `effects` showing exactly what moved.

## 3. Editing projects and buckets

- `create`: `title` plus either `targetMinor` (creates one bucket named after the project) or `buckets`
  `[{title, targetMinor, notes?, links?, targetDate?, completionDate?}]`.
- `update` — change only what you send:
  - single buckets by id: `bucketsAdd: [{title, targetMinor}]`, `bucketsUpdate: [{id, title?, targetMinor?, notes?,
…}]` (`null` removes an optional field), `bucketsRemove: [id]`;
  - single list entries: `actionItemsAdd/Update/Remove`, `notesAdd/Update/Remove`, `linksAdd/Update/Remove` (by
    index into the list as returned by `get`);
  - sending `buckets`, `actionItems`, `notes` or `links` itself replaces the whole list (keep bucket `id`s to keep
    their money; each action item needs its `done`).
- **Renaming** the project or a bucket (same id) carries over to every transaction, subscription and payment plan
  that refers to it by name — no money is orphaned.
- **Guarded money**: removing a bucket that holds money (or leaving it out of a whole-list replace) is refused unless
  `force: true`. With force, its tags are stripped and that money is redistributed by the default rule (Fire: its
  `@<bucket>` contributions move to the fund's first bucket). Deleting a project that holds money needs
  `force: true` too: its contributions remain as transactions but count toward nothing, and active payment plans end.
- A project always keeps at least one bucket.

## 4. Putting money in: `contribute`

```json
{ "action": "contribute", "projectId": "smile_…", "amountMinor": 20000 }
{ "action": "contribute", "projectId": "smile_…", "buckets": [{ "bucketId": "bucket_…", "amountMinor": 15000 }], "account": "Smile", "comment": "September" }
{ "action": "contribute", "amountMinor": 10000 }            // manage_mojo
```

- Records one transaction the way the app does: money leaves `account` (default `Smile` / `Fire` / `Fire` for
  Mojo), so its amount is negative; category `@<project>` (or `@Mojo`); bucket split as `#bucket:` tags written by
  the server. Don't put `#bucket:` tags in `comment` yourself.
- The response has `requestedMinor` and `appliedMinor` (after capping), the rebuilt `project`, and `effects`. A
  target that's already full is refused.
- Income statement: a contribution is an expense of its source account under the project's tag.
- `list_transactions` shows exactly the transactions a project's (or Mojo's) amounts are rebuilt from, each with
  parsed `bucketAllocations`. Edit or delete them with the transactions tool; the amounts rebuild automatically.

## 5. Paying the real bill: settle a bucket

When you actually pay for what a bucket saved for, **settle** it with the actual cost:

```json
{
  "action": "settle_bucket",
  "projectId": "smile_…",
  "bucketId": "bucket_…",
  "actualMinor": 65000,
  "receipt": "Mountain guide invoice 123"
}
```

The server records one transaction tagged `#settle:<bucket>:<actual>` (with your receipt text) whose amount is the
**difference** to what the bucket had saved — the savings were already booked when you contributed, so only the
difference moves:

| Saved | Actual | Settlement transaction            | Bucket afterwards       |
| ----- | ------ | --------------------------------- | ----------------------- |
| 500   | 650    | −150 (topped up from `account`)   | settled, 650 (plan 500) |
| 40    | 50     | −10                               | settled, 50 (plan 40)   |
| 60    | 50     | +10 released back to `account`    | settled, 50 (plan 60)   |
| 0     | 50     | −50                               | settled, 50             |
| 500   | 500    | 0 (kept — it carries the receipt) | settled, 500            |

- The bucket shows `status: "settled"`, `settledMinor` (actual), `settledDate` and `varianceMinor` (actual − plan)
  next to its planned `targetMinor`. Totals: `targetMinor` uses actual costs, `plannedTargetMinor` the plan.
- `surplus: { "moveToBucketId": "…" }` moves a surplus into another bucket of the project instead of releasing it.
- A settled bucket takes no more contributions; payment plans treat it as done; a Fire fund whose last bucket is
  settled completes.
- **Settle again** to correct the actual cost (it edits the same settlement). **`unsettle_bucket`** removes the
  settlement: the bucket reopens with the savings it had. Deleting the settlement transaction does the same.
- It's all derived from the settlement transaction, so editing an earlier contribution recomputes the difference.
- Never write `#settle:` tags yourself — they're refused on ordinary transactions.

## 6. Payment plans (recurring contributions)

1. `create_payment_plan` computes a per-period amount to fill the chosen buckets (`selectedBucketIds`, `[]` = all)
   by `targetDate` — status `planned`, nothing happens yet.
2. `activate_payment_plan` creates the real **subscription** (negative amount from the plan's account into
   `@<project>` with the plan's `#bucket:` tags). Transactions are then generated by `manage_subscriptions refresh`,
   which skips a contribution once the target is full.
3. `update_payment_plan` edits and recalculates (`manualAmountMinor` overrides the amount, `null` returns to the
   calculated one); an active plan's subscription follows.
4. `deactivate_payment_plan` ends the subscription today (reactivating restarts it today);
   `delete_payment_plan` (`confirm: true`) deactivates first.

Statuses: `planned` → `active` → `completed` (target buckets all full or settled: its subscription ends that day) or
`inactive` (deactivated, or its subscription was deleted). This is **reconciled on every write**, so changes made in
the app are picked up. A completed or inactive plan can be activated again.

- **The plan owns its subscription**: `manage_subscriptions` refuses to update or delete it — use the plan actions.
- When bucket targets change, plans that follow their calculated amount (no `manualAmountMinor`) are recalculated
  over the time left, and an active plan's subscription follows.

## 7. Mojo

- `get` → `{amountMinor, targetMinor, remainingMinor, percentFilled}`; `update_target` re-caps immediately.
- `@Mojo` contributions fill up to the target; transactions **on** the `Mojo` account change it directly (spending
  from Mojo reduces it). `contribute` records an `@Mojo` contribution.

## 8. Worked example

Save €1,000 for a trip, €600 flight and €400 hotel, €150 a month from October:

```json
{ "action": "create", "title": "Lisbon", "buckets": [{ "title": "Flight", "targetMinor": 60000 }, { "title": "Hotel", "targetMinor": 40000 }] }
{ "action": "contribute", "projectId": "smile_…", "amountMinor": 20000 }
{ "action": "create_payment_plan", "projectId": "smile_…", "planTitle": "Lisbon monthly", "startDate": "2026-10-01", "targetDate": "2027-04-01", "frequency": "monthly", "account": "Smile", "manualAmountMinor": 15000 }
{ "action": "activate_payment_plan", "projectId": "smile_…", "planId": "plan_…" }
```

The first contribution splits €100/€100 (written as tags); the plan then funds both buckets monthly until they're
full (the plan then completes on its own). When you pay the flight — say €640 — `settle_bucket` Flight with
`actualMinor: 64000`: the settlement tops up the missing €40. Not an ordinary `@Lisbon` purchase.

## 9. Pitfalls

- Setting `amountMinor` on a bucket is refused — use `contribute`.
- A purchase recorded as an ordinary transaction with the project's category fills it instead of spending it —
  settle the bucket instead.
- A plan-owned subscription can't be edited through `manage_subscriptions` — change the plan.
- Fire is emergencies, not retirement; Fire untagged `@<project>` money always lands in the first bucket.
- Deleting a funded bucket/project needs `force` — read `effects` afterwards.
