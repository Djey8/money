# Bot starting ratings

Written by `scripts/calibrate-bot-ratings.js` (400 tables per bot, four seats, strict rules, commit 3c24f1e).
Each bot played tables of four against three other bots; its share of won tables becomes the rating (25% is par = 1500, about +120 per doubling of the odds, floor 1000, cap 2200). These are only the starting points: a bot's rating then moves slowly with the games it really plays.

| Bot (persona--level)          | Rating |   Won |  Tables |
| ----------------------------- | -----: | ----: | ------: |
| character-investor            |   1736 | 56.5% | 226/400 |
| character-chaser              |   1733 | 56.0% | 224/400 |
| character-marketer            |   1706 | 52.3% | 209/400 |
| character-trader              |   1703 | 51.7% | 207/400 |
| character-investor--strong    |   1701 | 51.5% | 206/400 |
| champion-latest               |   1698 | 51.0% | 204/400 |
| character-banker              |   1698 | 51.0% | 204/400 |
| champion-latest--strong       |   1691 | 50.0% | 200/400 |
| champion-v1                   |   1689 | 49.8% | 199/400 |
| character-gambler             |   1689 | 49.8% | 199/400 |
| character-chaser--strong      |   1680 | 48.5% | 194/400 |
| character-gambler--strong     |   1675 | 47.8% | 191/400 |
| character-banker--strong      |   1673 | 47.5% | 190/400 |
| character-marketer--strong    |   1670 | 47.0% | 188/400 |
| character-trader--strong      |   1668 | 46.8% | 187/400 |
| champion-v1--strong           |   1659 | 45.5% | 182/400 |
| champion-v1--casual           |   1638 | 42.5% | 170/400 |
| character-investor--casual    |   1620 | 40.0% | 160/400 |
| champion-latest--casual       |   1604 | 37.8% | 151/400 |
| character-trader--casual      |   1597 | 36.8% | 147/400 |
| character-cautious            |   1589 | 35.8% | 143/400 |
| character-banker--casual      |   1587 | 35.5% | 142/400 |
| character-marketer--casual    |   1583 | 35.0% | 140/400 |
| character-chaser--casual      |   1574 | 33.8% | 135/400 |
| all-rounder                   |   1570 | 33.3% | 133/400 |
| all-rounder--strong           |   1570 | 33.3% | 133/400 |
| character-cautious--strong    |   1562 | 32.3% | 129/400 |
| character-gambler--casual     |   1535 | 29.0% | 116/400 |
| character-banker--beginner    |   1514 | 26.5% | 106/400 |
| character-cautious--casual    |   1505 | 25.5% | 102/400 |
| champion-v1--beginner         |   1502 | 25.3% | 101/400 |
| character-chaser--beginner    |   1483 | 23.3% |  93/400 |
| character-investor--beginner  |   1483 | 23.3% |  93/400 |
| champion-latest--beginner     |   1478 | 22.8% |  91/400 |
| character-gambler--beginner   |   1471 | 22.0% |  88/400 |
| all-rounder--casual           |   1458 | 20.8% |  83/400 |
| character-trader--beginner    |   1458 | 20.8% |  83/400 |
| character-marketer--beginner  |   1455 | 20.5% |  82/400 |
| character-cautious--beginner  |   1400 | 15.8% |  63/400 |
| best-found                    |   1390 | 15.0% |  60/400 |
| all-rounder--beginner         |   1376 | 14.0% |  56/400 |
| best-found--strong            |   1341 | 11.8% |  47/400 |
| best-found--casual            |   1328 | 11.0% |  44/400 |
| big-deals-when-rich           |   1323 | 10.8% |  43/400 |
| big-deals-when-rich--casual   |   1304 |  9.8% |  39/400 |
| big-deals-when-rich--strong   |   1284 |  8.8% |  35/400 |
| cash-properties               |   1248 |  7.2% |  29/400 |
| leveraged-big--casual         |   1248 |  7.2% |  29/400 |
| leveraged-big--strong         |   1248 |  7.2% |  29/400 |
| leveraged-big                 |   1228 |  6.5% |  26/400 |
| best-found--beginner          |   1220 |  6.3% |  25/400 |
| big-deals-when-rich--beginner |   1213 |  6.0% |  24/400 |
| picky-properties              |   1205 |  5.8% |  23/400 |
| bridge-loans                  |   1197 |  5.5% |  22/400 |
| stocks-for-deposits--strong   |   1188 |  5.3% |  21/400 |
| leveraged-big--beginner       |   1170 |  4.8% |  19/400 |
| cash-properties--strong       |   1160 |  4.5% |  18/400 |
| mlm-then-properties           |   1160 |  4.5% |  18/400 |
| bridge-loans--strong          |   1150 |  4.3% |  17/400 |
| stocks-for-deposits--casual   |   1139 |  4.0% |  16/400 |
| bridge-loans--casual          |   1127 |  3.8% |  15/400 |
| picky-properties--strong      |   1101 |  3.3% |  13/400 |
| stocks-for-deposits           |   1101 |  3.3% |  13/400 |
| cash-properties--casual       |   1087 |  3.0% |  12/400 |
| mlm-then-properties--strong   |   1087 |  3.0% |  12/400 |
| picky-properties--casual      |   1087 |  3.0% |  12/400 |
| bridge-loans--beginner        |   1071 |  2.8% |  11/400 |
| cash-properties--beginner     |   1054 |  2.5% |  10/400 |
| mlm-then-properties--casual   |   1054 |  2.5% |  10/400 |
| picky-properties--beginner    |   1036 |  2.3% |   9/400 |
| mlm-then-properties--beginner |   1000 |  1.3% |   5/400 |
| never-buy                     |   1000 |  0.0% |   0/400 |
| never-buy--beginner           |   1000 |  0.0% |   0/400 |
| never-buy--casual             |   1000 |  0.0% |   0/400 |
| never-buy--strong             |   1000 |  0.0% |   0/400 |
| stocks-for-deposits--beginner |   1000 |  1.8% |   7/400 |

## Measuring the bots again (the procedure)

The leaderboard keeps the games the bots really played. A bot's rating is its **base** (the start rating of this table) plus every
change its games made - so the base can be replaced at any time without losing a single game:

1. Change the bots (a new strategy, a new champion, a rule change) and run `node scripts/calibrate-bot-ratings.js --tables 400 --write`.
   It writes `bot-ratings.ts` with `BOT_RATINGS_VERSION` raised by one, and this document.
2. Commit and deploy as usual. At its next start the backend (`reconcileBases` in `services/game-stats.js`, log line `basesMoved`)
   moves every bot whose base differs: base := the new start rating, rating and best rating move by the same difference, the old base is
   kept in `baseHistory`. Games played before are not touched: their ratings in the player card are shown on the current base
   (`ratingAfter + current base - the base they were played on`). A bot that is new (a new strategy) gets a profile at its start rating.
3. The player card shows the base ("Base rating", and since when) and the chart starts on it.

`rebuild` (the CLI) is a different thing: it recomputes every rating from the stored result records with the current bases.
