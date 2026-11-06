# Dreamfund bots - how they play, how they are found and how they are rated

The bots of the Dreamfund (the seats a host fills, the opponents in the tournaments, the names on the leaderboard) are not scripted. Each is
a **type** (a way to play), at a **skill level**, and its numbers come from a **calibration** that can be run again at any time. This page
is the whole system. The latest results are in `docs/dreamfund-balance/CALIBRATION.md`.

## 1. What a bot can do: the capabilities

`packages/domain/src/cashflow-game/dreamfund-sim/capabilities.ts` lists everything a player can do, as data - 26 capabilities in six groups
(cards, life, money, selling, table, book). Each names the commands of the table that do it and says who decides it:

| status     | meaning                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| `strategy` | the policy decides every time it comes up (which pile, which card, whether to sell into a window, ride a hype) |
| `knob`     | a capability of its own that a strategy turns on and tunes: pensions, courses, insurances, selling to step up  |
| `engine`   | the same for every bot, by the rules (how a forced emergency is paid, the roll)                                |
| `person`   | bookkeeping or the table's business; it does not change the game                                               |
| `open`     | a move that exists and that no bot makes yet - kept visible on purpose (today: planning a purchase for later)  |

A test fails when the game gets a command that no capability lists, so a new move cannot be forgotten: add it to the list, then teach the
bots (or mark it `open`). Every simulated game also counts which capabilities the bot used (`record.used`), and a calibration prints it
per type - the proof that nothing is left out.

The capabilities added with the calibration (2026-11-06), which the first strategies did not have:

- **sell to step up** - sell a holding at the standing price when it has gained (`stepUpGain`), pays little for what it is worth
  (`stepUpYield`, a year's yield on its value) and has been held long enough (`stepUpHold` Paydays), so the money can go into a bigger card.
  The tax on the profit of a sale (a table setting) is counted before.
- **sell to clear a loan** (`clearLoanBySale`) - a Bank loan costs 10% a month and nothing earns that: sell and repay at once.
- **insurances** (`insure`: keep, all, core, none) - hold or drop each insurance against the cost of the emergencies it covers.
- **pensions and courses** (`pensionBoost`, `courseBoost`) - how much more a plan paid into, or a course or a degree, is wanted than its numbers say.

## 2. The types

A type is a base (what it takes, what it leaves: its taste for cards, its piles) plus **knobs** (`DreamKnobs` in `policies.ts`): how much
cash it keeps, how fast it plans, how much it risks, when it sells, and the capabilities above. The 14 types in `BASE_POLICIES`:
saver, etf, property, hustler, gambler, expert, dividend, sapling, tree, dreamer, steady, passive - and the two for the new capabilities,
**flipper** (sell, step up, repeat) and **scholar** (the employer's money, the pension and the courses first).

`DREAM_POLICIES` is what the bots play: each type with the knobs of its **champion** (`champions.generated.ts`, written by the calibration).
A type without a champion plays as written. A new type is one more entry in `BASE_POLICIES`; the next calibration measures it.

A **skill level** (master, strong, casual, beginner) is the same type that slips with a chance per decision (0, 10%, 25%, 45%). The master is
the champion itself; the others are measured, not assumed. A bot's id is `type` or `type--level`.

## 3. The calibration

```
node scripts/dreamfund-calibrate.js --mode fast     # minutes: has anything changed?
node scripts/dreamfund-calibrate.js --mode medium   # about an hour
node scripts/dreamfund-calibrate.js --mode full     # hours: the deep calibration
```

Options: `--types a,b` (only these), `--skip-search`, `--skip-tournament`, `--fresh` (start the search from the types as written, not from
the champions), `--seed N`, `--workers N`, `--no-write` (do not touch the domain). A run learns from the run before it and writes
`docs/dreamfund-balance/` (`champions.json`, `bot-ratings-*.json`, `runs.json` - the history, `CALIBRATION.md` - the report).

1. **Capabilities** - the list is checked and the use of each capability per type is counted.
2. **Relearn** - for each type the search starts from the **champion of the last run** and moves one to three knobs at a time
   (`search.ts`). A change is scored on the same list of fresh random games as the champion it challenges (a paired comparison, so luck
   cancels) - games spread over every character, every difficulty and every map shape and size. The score is the aim of the game: a win is
   one plus up to a half for how early it came (the first to finish wins the table), a bankruptcy costs 0.3, a game that ran out of turns
   is worth the goals it reached. A change replaces the incumbent when it is better by 1.5 standard errors; at the end the result meets the
   champion it started from on games neither has seen and **is kept only when it is better by 2**. So a run that finds nothing leaves
   everything as it was.
3. **Tournament** - all bots, every type at every level, play tables of four against each other on each difficulty (random characters,
   40 rounds) and are rated with the board's own pairwise Elo, starting from the ratings of the last run. A bot new to the list starts at
   1500 and travels to its place. K falls from 24 to 8 over the run, so the first tables place the bots and the last ones settle them. The
   ratings of the processes are averaged and the mean of all is kept at 1500 - a person's start - so the best bots sit near 1700 and a person
   plays their way up to them.
4. **Gauntlet** - the six best masters (by their average over the difficulties) meet again on fresh seeds; the one that wins most of its tables
   is the **champion of the champions**, named in the report.
5. **Write** - `champions.generated.ts` and `bot-ratings.generated.ts` (the starting ratings of the board's bots), then the report.

What the search does not see: the other players. It plays the solo simulation (fast, thousands of games); the tournament and the gauntlet
are the test of the result against each other on shared piles and markets.

## 4. From ratings to the board

A bot's rating on the leaderboard is its **base** (what the calibration found, `botStartRating`) plus what its games have made of it. A new
calibration moves the base and keeps what the games earned (`reconcileBase`, run at start-up). Every bot and every person has one rating
and a profile.

## 5. The profile and the fact table

Opening a player on the Dreamfund leaderboard shows their profile: the rating, the line of how it moved (from 1500, or the bot's base, over
the last games), the counters, and the **fact table**. Every finished table files, for each player, what their life came to
(`dreamfund/table/facts.ts`), in the four places of the method:

- **Grow** - cards bought, sold, held; share lots, properties, businesses, pension plans, courses; money put in.
- **Fire** - reserve (and whether it was full), debts left or repaid, the Bank loan, emergencies paid.
- **Smile** - the life dream lived, dreams lived and their money, dreams still open, saved, dream points.
- **Income** - passive income, salary, cash flow, living costs, what the cards earned, independence, net worth.

The profile adds these up over the games that have one and shows the total and the average per game (`GET /game/dreamfund/players/{id}`:
`facts`, `history`). Games played before the fact table existed have none and are not counted in it.

## 6. Adding to it

- **A new capability**: add the command to the game, add it to `capabilities.ts` (a test makes you), give the policy a knob or a decision for
  it (`DreamBot` in `dreamfund/bot.ts` decides; the simulation and the table bot both call it), add the knob to `KNOB_RANGES`, run a
  calibration - the search will tell whether it helps and for which types.
- **A new type**: one more `makePolicy(...)` in `BASE_POLICIES`; the next calibration finds its champion and its rating.
- **A new card or rule**: run `--mode medium`; the champions move by themselves where the cards changed what wins.
