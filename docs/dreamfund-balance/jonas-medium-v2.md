# Dreamfund simulation

2400 games - {"games":100,"shapes":["ring","infinity"],"maxTurns":150,"rules":{}}

| strategy | map             | level  | games | won | bankrupt | timeout | error | turns to win (p25 / median / p75) | reserve     | debts       | dream       | independent | net worth | peak passive | bank loan peak | points |
| -------- | --------------- | ------ | ----- | --- | -------- | ------- | ----- | --------------------------------- | ----------- | ----------- | ----------- | ----------- | --------- | ------------ | -------------- | ------ |
| saver    | ring medium     | medium | 100   | 0%  | 0%       | 100%    | 0%    | -                                 | 113 (77%)   | 117 (69%)   | 121 (67%)   | -           | 65,578    | 275          | 0              | 9.8    |
| etf      | ring medium     | medium | 100   | 2%  | 0%       | 98%     | 0%    | 134 / 135.5 / 137                 | 77.5 (94%)  | 102 (83%)   | 113 (78%)   | 135.5 (2%)  | 66,768    | 768          | 0              | 11.9   |
| property | ring medium     | medium | 100   | 8%  | 1%       | 91%     | 0%    | 133 / 136 / 141                   | 68 (98%)    | 86 (93%)    | 112 (82%)   | 134.5 (8%)  | 74,265    | 305          | 0              | 0.0    |
| hustler  | ring medium     | medium | 100   | 17% | 0%       | 83%     | 0%    | 130 / 136 / 143                   | 69 (100%)   | 90 (92%)    | 112 (85%)   | 136 (17%)   | 67,051    | 1,330        | 0              | 13.6   |
| gambler  | ring medium     | medium | 100   | 0%  | 1%       | 99%     | 0%    | -                                 | 50 (100%)   | 70.5 (100%) | 115 (77%)   | -           | 83,017    | 76           | 0              | 0.0    |
| expert   | ring medium     | medium | 100   | 44% | 0%       | 56%     | 0%    | 115 / 131 / 138                   | 42.5 (100%) | 56 (99%)    | 98.5 (94%)  | 131 (44%)   | 80,649    | 2,345        | 0              | 16.3   |
| dividend | ring medium     | medium | 100   | 4%  | 0%       | 96%     | 0%    | 122 / 133 / 147                   | 50 (100%)   | 63 (99%)    | 115 (79%)   | 133 (4%)    | 76,525    | 621          | 0              | 9.7    |
| sapling  | ring medium     | medium | 100   | 40% | 0%       | 60%     | 0%    | 115 / 127 / 140                   | 42.5 (100%) | 54 (100%)   | 95.5 (96%)  | 127 (40%)   | 74,336    | 2,364        | 0              | 17.6   |
| tree     | ring medium     | medium | 100   | 1%  | 0%       | 99%     | 0%    | 143 / 143 / 143                   | 42 (100%)   | 54 (100%)   | 110 (91%)   | 143 (1%)    | 61,595    | 55           | 0              | 12.9   |
| dreamer  | ring medium     | medium | 100   | 0%  | 1%       | 99%     | 0%    | -                                 | 113 (74%)   | 123 (51%)   | 119 (67%)   | -           | 58,706    | 67           | 0              | 9.4    |
| steady   | ring medium     | medium | 100   | 17% | 0%       | 83%     | 0%    | 125 / 132 / 143                   | 73.5 (98%)  | 82 (95%)    | 118 (81%)   | 132 (17%)   | 80,764    | 1,390        | 0              | 11.0   |
| passive  | ring medium     | medium | 100   | 0%  | 2%       | 98%     | 0%    | -                                 | 119 (67%)   | 121 (54%)   | 123.5 (54%) | -           | 61,771    | 41           | 0              | 8.6    |
| saver    | infinity medium | medium | 100   | 0%  | 0%       | 100%    | 0%    | -                                 | 113 (77%)   | 117 (69%)   | 121 (67%)   | -           | 65,578    | 275          | 0              | 9.8    |
| etf      | infinity medium | medium | 100   | 2%  | 0%       | 98%     | 0%    | 134 / 135.5 / 137                 | 77.5 (94%)  | 102 (83%)   | 113 (78%)   | 135.5 (2%)  | 66,768    | 768          | 0              | 11.9   |
| property | infinity medium | medium | 100   | 8%  | 1%       | 91%     | 0%    | 133 / 136 / 141                   | 68 (98%)    | 86 (93%)    | 112 (82%)   | 134.5 (8%)  | 74,265    | 305          | 0              | 0.0    |
| hustler  | infinity medium | medium | 100   | 17% | 0%       | 83%     | 0%    | 130 / 136 / 143                   | 69 (100%)   | 90 (92%)    | 112 (85%)   | 136 (17%)   | 67,051    | 1,330        | 0              | 13.6   |
| gambler  | infinity medium | medium | 100   | 0%  | 1%       | 99%     | 0%    | -                                 | 50 (100%)   | 70.5 (100%) | 115 (77%)   | -           | 83,017    | 76           | 0              | 0.0    |
| expert   | infinity medium | medium | 100   | 44% | 0%       | 56%     | 0%    | 115 / 131 / 138                   | 42.5 (100%) | 56 (99%)    | 98.5 (94%)  | 131 (44%)   | 80,649    | 2,345        | 0              | 16.3   |
| dividend | infinity medium | medium | 100   | 4%  | 0%       | 96%     | 0%    | 122 / 133 / 147                   | 50 (100%)   | 63 (99%)    | 115 (79%)   | 133 (4%)    | 76,525    | 621          | 0              | 9.7    |
| sapling  | infinity medium | medium | 100   | 40% | 0%       | 60%     | 0%    | 115 / 127 / 140                   | 42.5 (100%) | 54 (100%)   | 95.5 (96%)  | 127 (40%)   | 74,336    | 2,364        | 0              | 17.6   |
| tree     | infinity medium | medium | 100   | 1%  | 0%       | 99%     | 0%    | 143 / 143 / 143                   | 42 (100%)   | 54 (100%)   | 110 (91%)   | 143 (1%)    | 61,595    | 55           | 0              | 12.9   |
| dreamer  | infinity medium | medium | 100   | 0%  | 1%       | 99%     | 0%    | -                                 | 113 (74%)   | 123 (51%)   | 119 (67%)   | -           | 58,706    | 67           | 0              | 9.4    |
| steady   | infinity medium | medium | 100   | 17% | 0%       | 83%     | 0%    | 125 / 132 / 143                   | 73.5 (98%)  | 82 (95%)    | 118 (81%)   | 132 (17%)   | 80,764    | 1,390        | 0              | 11.0   |
| passive  | infinity medium | medium | 100   | 0%  | 2%       | 98%     | 0%    | -                                 | 119 (67%)   | 121 (54%)   | 123.5 (54%) | -           | 61,771    | 41           | 0              | 8.6    |

## Cards (what they were worth to the games they were taken in)

| card | title                           | games | won when taken | won without | net worth lift |
| ---- | ------------------------------- | ----- | -------------- | ----------- | -------------- |
| T09  | Senior Care Apartment           | 4     | 50%            | 11%         | 78,060         |
| S36  | Annual Contract Check           | 2400  | 11%            | 0%          | 74,613         |
| S05  | Free Bank Account               | 2400  | 11%            | 0%          | 74,613         |
| S02  | Switch Electricity Provider     | 2400  | 11%            | 0%          | 74,613         |
| S04  | Cheaper Mobile Plan             | 2400  | 11%            | 0%          | 74,613         |
| S06  | Ask for a Job Ticket            | 2400  | 11%            | 0%          | 74,613         |
| S01  | AI Subscription Audit           | 2400  | 11%            | 0%          | 74,613         |
| T10  | Parking Space Package           | 10    | 40%            | 11%         | 53,094         |
| T27  | Farmland in Eastern Germany     | 18    | 11%            | 11%         | 48,415         |
| T21  | Corporate Bond Ladder           | 46    | 13%            | 11%         | 43,567         |
| T18  | Big ETF Lump Sum                | 34    | 6%             | 11%         | 40,975         |
| P30  | Bond Ladder                     | 262   | 22%            | 10%         | 35,531         |
| P02  | World ETF Lump Sum              | 266   | 24%            | 9%          | 35,480         |
| T17  | Dividend Portfolio of 20 Stocks | 42    | 5%             | 11%         | 34,257         |
| P08  | Altcoin Basket                  | 94    | 0%             | 12%         | 32,582         |
| P27  | Self-Storage Container          | 140   | 36%            | 10%         | 31,933         |
| T02  | Auction Flat in Gelsenkirchen   | 74    | 14%            | 11%         | 30,687         |
| P01  | Negotiate Your Salary           | 262   | 31%            | 9%          | 30,487         |
| P20  | Buy a Small Online Shop         | 46    | 52%            | 10%         | 29,780         |
| P10  | Startup Crowdfunding Ticket     | 96    | 0%             | 12%         | 29,232         |
| P04  | European REIT                   | 208   | 40%            | 8%          | 29,070         |
| P03  | Emerging Markets ETF            | 166   | 41%            | 9%          | 28,855         |
| P05  | High-Income Covered-Call ETF    | 230   | 47%            | 7%          | 27,241         |
| P31  | Rare Card Collection            | 100   | 0%             | 12%         | 26,983         |
| P29  | Laundry Pick-Up Service         | 186   | 56%            | 7%          | 25,294         |
| P19  | Create an Online Course         | 134   | 45%            | 9%          | 25,209         |
| P24  | E-Bike Rental Fleet             | 58    | 62%            | 10%         | 23,400         |
| S03  | Meal Prep Sundays               | 1902  | 13%            | 3%          | 23,160         |
| P18  | Freelance Data Consulting       | 236   | 48%            | 7%          | 22,904         |
| T01  | Studio Flat in Chemnitz         | 132   | 15%            | 11%         | 21,968         |

## What came just before a bankruptcy

(the last three cards of each bankrupt game)

- L L06: 4
- L L22: 2
- O T08: 2
- H H53: 2
- L L05: 2
- H H42: 2
- E E26: 2
- L L01: 2
- H H23: 2
- H H87: 2
- C failed: 2
- H H67: 2
