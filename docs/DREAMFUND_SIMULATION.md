# Dreamfund simulation

Many whole games of the Dreamfund edition played by bots, to find the balance: how often a strategy wins, how long it takes, how
often it goes bankrupt, and which cards are worth taking. The first target is the Dual Student on the **Medium** difficulty; Easy and
Hard are prepared in `packages/domain/src/cashflow-game/difficulty.ts` and are not offered to players until the Medium numbers hold.

## Run it

```bash
npm run simulate:dreamfund -- --games 100 --shapes ring,infinity --sizes medium --out docs/dreamfund-balance/run.md
```

| Option                | Meaning                                                                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--games N`           | Games per strategy and map (the seeds count up, so a run can be repeated)                                                                                                                                  |
| `--policies a,b`      | Strategies to play (default all): `saver etf property hustler gambler expert dividend sapling tree dreamer steady passive`                                                                                 |
| `--shapes`, `--sizes` | Maps: `ring infinity rectangle square mountain`, `small medium large`                                                                                                                                      |
| `--difficulty`        | `easy`, `medium` (default) or `hard`: the character is played in its Easy / Hard version (`id~easy`, `id~hard`) and the settings of the level                                                              |
| `--character id`      | The character to play (default `dual-student-informatik`): `mehmet-elektroniker lena-pflege sophie-lehrerin tobias-designer katrin-marketing frank-ingenieur jan-oberarzt heike-werkstatt peter-busfahrer` |
| `--mode`              | The rules of the game: `free` (default), `guided`, `strict`                                                                                                                                                |
| `--max-turns N`       | A game not decided after this many rolls is a timeout (default 400)                                                                                                                                        |
| `--first-seed N`      | Seed of the first game                                                                                                                                                                                     |
| `--out file.md`       | Writes the report there and the raw games beside it as `.json`                                                                                                                                             |
| `--doc page.md`       | Writes the readable statistics into a page between `<!-- stats:jonas:start -->` and `<!-- stats:jonas:end -->` (`--doc-name`, `--profession`); see `docs/DREAMFUND_GAME.md`                                |

## The map: every character, difficulty and strategy

```bash
npm run matrix:dreamfund -- --games 200 --out docs/dreamfund-balance \
  --benchmarks packages/domain/src/cashflow-game/analysis/dreamfund-benchmarks.ts \
  --doc docs/DREAMFUND_GAME.md --doc-de docs/DREAMFUND_GAME.de.md
```

`scripts/dreamfund-matrix.js` plays every character (10) on every difficulty (3) with every strategy (12) - 200 games each from the same
seeds, in parallel (`--jobs`, default: cores minus one; about two hours on 16 cores) - and writes `docs/dreamfund-balance/matrix.json`
(the numbers), `MATRIX.md` (the table), the compact map the analyst reads (`dreamfund-benchmarks.ts`, generated, do not edit) and the table
between the `<!-- matrix:start -->` markers of the two game pages. Use `--dist` with a copy of `packages/domain/dist` so that building
the package while it runs does not change the games, and `--from <work dir>` to make the pages again from the raw games of an earlier
run. Run it again whenever a card, a character or a number changes - and compare runs only with the same options and seeds.

The characters are balanced by one price level each (the cards, the debts and the dream are that much bigger - `card-scale.ts`) and by
what is left of a month in proportion to it (`ease` in `cashflow-professions-dreamfund.ts`); `todo/dreamfund-professions.md` has the
targets (Peter and Mehmet easiest, Dr. Jan very hard) and the difficulty numbers (`VARIANT_TUNING` in the builder).

## What it plays

`packages/domain/src/cashflow-game/dreamfund-sim/`:

- `world.ts` - `DreamSim`: one game, from the same rules the app runs (`playTurn`, the stacks of cards, Opportunity purchases, the
  Harvest market). The reserve (Mojo) and the dreams are plain numbers here; what a player does on the Fire and Smile pages is
  reduced to its money.
- `policies.ts` - the strategies as data: how much cash to keep, where the free money of a Payday goes, which cards to take, when to
  sell, whether to ride a hype.
- `batch.ts` - many games, the summary table and the per-card statistics.
- `cli.ts` - the command line above.

## Winning

All of it, as on the character's goal list: the reserve is three months of expenses, the parents' loan and the car loan are repaid,
the life dream is funded and lived, and the passive income is at least the monthly expenses.

## What the report says

One row per strategy, map and level: the share of games won, bankrupt and timed out, the turns to win (quartiles), the turn each
condition was first met (and the share of games that met it), net worth, passive income, the bank loan and dream points. A second
table lists each Opportunity card by what it was worth to the games it was taken in; a third what came just before a bankruptcy.

## What the bots do not do yet

- Payment plans with surcharge, partial payments to projects, the Fire project of an emergency: an emergency is paid at once (from
  cash, then the reserve, then the Bank loan).
- Dream moments (M01-M08) and the choices inside some cards (a roll again, a reroll).
- The multiplayer rule that everyone may sell what one player draws; with one player it makes no difference.
- Selling by the difficulty's selling mode: Medium's sell windows are played, the Payday mode of Easy is not.

Each of these is a place to make the bots closer to a player, and each changes the numbers a little. Compare two runs only with the
same options and seeds.
