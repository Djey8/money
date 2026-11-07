# Dreamer bot calibration

Written by `scripts/dreamfund-calibrate.js` (the runs below, newest last). A run relearns each type of bot from the champion of the run before it, rates all bots on tables of bots only, and plays the best masters against each other. Read `docs/domain/DREAMFUND_BOTS.md` for how it works.

## Latest run: 202611061134 (full, 183.64 min)

### Types

| type     | verdict                   | win rate (old -> new) | bankrupt (old -> new) | score          | games | capabilities used per game                                                                                                                     |
| -------- | ------------------------- | --------------------- | --------------------- | -------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| saver    | **new champion** (z 14.3) | 7% -> 31%             | 25% -> 25%            | 0.183 -> 0.382 | 600   | buy-card 13.8, buy-pension 6.7, sell-buyer 1.4                                                                                                 |
| etf      | **new champion** (z 16.8) | 27% -> 66%            | 25% -> 18%            | 0.357 -> 0.735 | 600   | buy-card 15.5, buy-pension 8.1, sell-buyer 2.4                                                                                                 |
| property | **new champion** (z 2.4)  | 43% -> 46%            | 32% -> 28%            | 0.461 -> 0.505 | 600   | buy-card 9.4, buy-pension 8.0, sell-buyer 0.4                                                                                                  |
| hustler  | **new champion** (z 7.9)  | 59% -> 69%            | 25% -> 25%            | 0.663 -> 0.773 | 600   | buy-card 17.4, buy-pension 6.1, sell-buyer 1.4                                                                                                 |
| gambler  | kept (z 0.9)              | 0% -> 2%              | 32% -> 32%            | 0.109 -> 0.117 | 600   | buy-card 17.9, buy-pension 6.9, sell-buyer 2.0, sell-window 1.1, ride-hype 0.3                                                                 |
| expert   | **new champion** (z 3.4)  | 72% -> 74%            | 23% -> 24%            | 0.810 -> 0.851 | 600   | buy-card 22.0, buy-pension 4.1, sell-buyer 2.7, buy-course 1.0                                                                                 |
| dividend | **new champion** (z 12.7) | 37% -> 55%            | 28% -> 28%            | 0.426 -> 0.588 | 600   | buy-card 20.0, buy-pension 8.2, sell-buyer 3.1                                                                                                 |
| sapling  | **new champion** (z 9.0)  | 71% -> 76%            | 25% -> 24%            | 0.793 -> 0.862 | 600   | buy-card 16.0, buy-pension 4.9, sell-buyer 1.5, buy-course 0.7                                                                                 |
| tree     | **new champion** (z 16.3) | 22% -> 50%            | 27% -> 24%            | 0.311 -> 0.555 | 600   | buy-card 10.7, buy-pension 9.4, sell-buyer 0.6, buy-course 0.3                                                                                 |
| dreamer  | **new champion** (z 14.4) | 32% -> 57%            | 30% -> 30%            | 0.365 -> 0.597 | 600   | buy-card 15.6, buy-pension 8.3, sell-buyer 1.9, buy-course 0.9                                                                                 |
| steady   | **new champion** (z 8.0)  | 63% -> 70%            | 24% -> 24%            | 0.702 -> 0.784 | 600   | buy-card 21.0, buy-pension 5.4, sell-buyer 2.2, buy-course 1.2                                                                                 |
| passive  | **new champion** (z 6.8)  | 0% -> 0%              | 29% -> 26%            | 0.100 -> 0.130 | 600   | buy-card 6.5                                                                                                                                   |
| flipper  | **new champion** (z 8.2)  | 70% -> 76%            | 23% -> 22%            | 0.799 -> 0.879 | 600   | buy-card 22.1, buy-pension 4.2, sell-buyer 2.6, buy-course 1.1, sell-window 1.1, sell-to-clear-loan 0.4, sell-step-up 0.2, repay-bank-loan 0.1 |
| scholar  | **new champion** (z 6.9)  | 71% -> 75%            | 23% -> 23%            | 0.793 -> 0.861 | 600   | buy-card 20.1, buy-pension 6.0, sell-buyer 2.7, buy-course 1.3, sell-to-clear-loan 0.6, repay-bank-loan 0.3                                    |

### Tournament, easy (3000 tables, 8 new bots)

1. tree 1674
2. sapling 1661
3. expert 1654
4. tree--strong 1647
5. expert--strong 1636
6. gambler--strong 1625
7. tree--casual 1613
8. flipper 1605
9. dividend 1601
10. dividend--strong 1593
11. flipper--strong 1583
12. etf 1581

### Tournament, medium (3000 tables, 8 new bots)

1. gambler 1631
2. tree 1624
3. expert 1620
4. sapling 1617
5. expert--strong 1614
6. etf 1611
7. tree--strong 1603
8. sapling--strong 1601
9. dividend 1596
10. etf--strong 1592
11. flipper 1584
12. gambler--strong 1583

### Tournament, hard (3000 tables, 8 new bots)

1. tree 1647
2. tree--strong 1629
3. expert 1625
4. etf 1623
5. dividend 1621
6. gambler--strong 1602
7. etf--strong 1596
8. expert--strong 1586
9. gambler 1586
10. passive 1582
11. hustler 1577
12. saver 1574

### Gauntlet - the champion of the champions

**sapling**

| bot      | share of its tables won | rating (average of the difficulties) |
| -------- | ----------------------- | ------------------------------------ |
| sapling  | 33% (1200 seats)        | 1617                                 |
| expert   | 29% (1200 seats)        | 1633                                 |
| tree     | 26% (1200 seats)        | 1648                                 |
| etf      | 25% (1200 seats)        | 1605                                 |
| gambler  | 20% (1200 seats)        | 1594                                 |
| dividend | 18% (1200 seats)        | 1606                                 |

## History

| run          | mode | minutes | new champions                                                                                              | champion of the champions |
| ------------ | ---- | ------- | ---------------------------------------------------------------------------------------------------------- | ------------------------- |
| 202611061134 | full | 183.64  | saver, etf, property, hustler, expert, dividend, sapling, tree, dreamer, steady, passive, flipper, scholar | sapling                   |
