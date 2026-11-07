# Dreamfund: ten characters, three difficulties (2026-10-27)

JFK's brief: ten lives in completely different stages, similar start conditions, a character who earns 10,000 a month should be very hard
to win and one on 2,500 easier; every character has a story, a dream that costs what it really costs and a career; then Easy / Normal /
Hard for all of them, and the full map of characters x strategies x difficulties - the map of bots for multiplayer and the base the
analyzer MCP judges a game plan against.

## How the characters are made comparable

**One price level per character** (`priceFactor`, set to the character's pay relative to the Dual Student's 2,833): the Opportunity,
Harvest and Dream cards, the Bank-loan step, the dream, the debts, the expenses and the Emergency / Life cards (via the living standard)
are all that much bigger. A surgeon plays the same cards as the Dual Student, scaled up. So what a card is worth _in proportion to the
character's life_ is the same for everybody (`card-scale.ts`, `gameSetFor`), and what makes one character harder is a number we choose:

- **ease** - what is left of a month in proportion to the Dual Student's (500 at price level 1). Below 1: harder.
- the German tax and social insurance are worked out from the gross (`german-pay.ts`, checked against the Dual Student's career), so a
  high earner pays a higher share to the state - which is part of why the surgeon is hard.
- debts, savings, dream and ladder are described per character (`cashflow-professions-dreamfund.ts`); the budget is built from them
  (`cashflow-professions-builder.ts`).

## The ten (Medium; euros a month)

| Character                   | Age | Life                                | Gross  | Left of a month | Price level | Debts  | Dream (cost)                         |
| --------------------------- | --- | ----------------------------------- | ------ | --------------- | ----------- | ------ | ------------------------------------ |
| Jonas - dual student IT     | 23  | studying, single                    | 2,833  | 500             | 1.0         | 3,000  | Mountain guide (24,500)              |
| Mehmet - journeyman electr. | 26  | single, first own flat              | 3,150  | 605             | 1.1         | 4,000  | Master craftsman + workshop (27,000) |
| Lena - nurse                | 29  | single mother, one child            | 3,450  | 510             | 1.2         | 4,500  | A year in a camper van (30,500)      |
| Sophie - primary teacher    | 33  | civil servant, single               | 4,350  | 750             | 1.5         | 6,500  | A year under sail (36,400)           |
| Tobias - freelance designer | 36  | self-employed, irregular            | 3,900  | 630             | 1.4         | 7,000  | Studio + gallery loft (40,000)       |
| Katrin - head of marketing  | 40  | married, two kids, row house        | 6,300  | 935             | 2.2         | 8,000  | House on the Baltic Sea (72,000)     |
| Frank - mechanical engineer | 44  | married, teenager, house            | 7,600  | 1,080           | 2.7         | 10,000 | Energy-independent house (84,500)    |
| Heike - garage owner        | 52  | self-employed, four employees       | 5,200  | 810             | 1.8         | 14,000 | A small vineyard (56,000)            |
| Dr. Jan - senior surgeon    | 48  | two teenagers, villa, leasing       | 11,200 | 1,075           | 3.9         | 18,000 | Own practice (136,000)               |
| Peter - bus driver          | 57  | married, grown children, 8y to pens | 2,700  | 545             | 0.95        | 3,000  | Cabin by the lake (27,000)           |

## Difficulty (Easy / Normal / Hard) - a character exists three times

`id`, `id~easy`, `id~hard` (`variantOf` links them; the grid shows one). The story and the dream are the same, the numbers are not:

| What                      | Easy                                                                                                               | Normal (the baseline) | Hard                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------- | ----------------------------------------------------------- |
| Budget                    | ~9 lines, round amounts (50/100/500)                                                                               | ~17 realistic lines   | same lines, tight                                           |
| Left of a month           | +30 %                                                                                                              | as designed (`ease`)  | -30 %                                                       |
| Debts / savings / dream   | -20 % / +50 % / -10 %                                                                                              | -                     | +25 % / -50 % / +10 %                                       |
| Promotions                | roll one lower                                                                                                     | -                     | roll one higher                                             |
| Cards                     | round prices (`niceMinor`) + the existing `DIFFICULTY_SETTINGS` (luck +1, 2 offers, reduced traps, payday selling) | existing              | existing (double traps, strict selling, -2 pp market drift) |
| Parents' support at start | yes + 1,000 bonus                                                                                                  | yes                   | no                                                          |

## The map

`npm run simulate:dreamfund -- --character <id> --difficulty <level> --games N --policies ...` plays every strategy; the matrix
(10 characters x 3 difficulties x 12 strategies, 60 games per cell on the ring map) is `docs/dreamfund-balance/matrix.json` and is
what the bots of the multiplayer step and the analyzer use as the reference. Re-run it whenever a card, a character or a difficulty
number changes - and compare runs only with the same seeds.

## Open

- Tune `ease`, debts and dream per character from the matrix until the best strategy's win rate per character is where we want it
  (Peter / Mehmet easy, Jan very hard) and no character is unwinnable.
- es / fr / cn / ar: the new texts are English fallbacks (native review).
- Multiplayer: the ten characters replace the old test characters (`custom-jfk`) the champion book is built on - a separate step.
