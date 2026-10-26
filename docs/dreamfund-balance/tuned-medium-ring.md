# Dreamfund simulation

420 games - {"games":60,"maxTurns":150,"rules":{}}

| strategy | map         | level  | games | won | bankrupt | timeout | error | turns to win (p25 / median / p75) | reserve     | debts     | dream       | independent | net worth | peak passive | bank loan peak | points |
| -------- | ----------- | ------ | ----- | --- | -------- | ------- | ----- | --------------------------------- | ----------- | --------- | ----------- | ----------- | --------- | ------------ | -------------- | ------ |
| saver    | ring medium | medium | 60    | 0%  | 0%       | 100%    | 0%    | -                                 | 117 (72%)   | 121 (63%) | 121 (62%)   | -           | 56,624    | 67           | 0              | 9.3    |
| etf      | ring medium | medium | 60    | 2%  | 0%       | 98%     | 0%    | 134 / 134 / 134                   | 80.5 (93%)  | 104 (80%) | 118 (75%)   | 134 (2%)    | 62,200    | 639          | 0              | 10.6   |
| property | ring medium | medium | 60    | 7%  | 0%       | 93%     | 0%    | 139 / 139.5 / 149                 | 76 (98%)    | 89 (92%)  | 113 (80%)   | 139.5 (7%)  | 66,643    | 55           | 0              | 0.0    |
| hustler  | ring medium | medium | 60    | 33% | 0%       | 67%     | 0%    | 117 / 120.5 / 135                 | 72.5 (100%) | 94 (92%)  | 112.5 (83%) | 120.5 (33%) | 57,711    | 1,330        | 0              | 10.8   |
| gambler  | ring medium | medium | 60    | 0%  | 2%       | 98%     | 0%    | -                                 | 52.5 (100%) | 74 (100%) | 119 (82%)   | -           | 81,382    | 69           | 0              | 0.0    |
| expert   | ring medium | medium | 60    | 57% | 0%       | 43%     | 0%    | 115 / 125.5 / 145                 | 46 (100%)   | 60 (98%)  | 103.5 (93%) | 125.5 (57%) | 69,078    | 2,402        | 0              | 14.9   |
| passive  | ring medium | medium | 60    | 0%  | 2%       | 98%     | 0%    | -                                 | 122 (68%)   | 123 (52%) | 124.5 (50%) | -           | 60,149    | 35           | 0              | 8.2    |

## Cards (what they were worth to the games they were taken in)

| card | title                       | games | won when taken | won without | net worth lift |
| ---- | --------------------------- | ----- | -------------- | ----------- | -------------- |
| S36  | Annual Contract Check       | 420   | 14%            | 0%          | 68,501         |
| S05  | Free Bank Account           | 420   | 14%            | 0%          | 68,501         |
| S02  | Switch Electricity Provider | 420   | 14%            | 0%          | 68,501         |
| S04  | Cheaper Mobile Plan         | 420   | 14%            | 0%          | 68,501         |
| S06  | Ask for a Job Ticket        | 420   | 14%            | 0%          | 68,501         |
| S01  | AI Subscription Audit       | 420   | 14%            | 0%          | 68,501         |
| P20  | Buy a Small Online Shop     | 2     | 100%           | 14%         | 40,421         |
| P01  | Negotiate Your Salary       | 30    | 43%            | 12%         | 38,232         |
| P02  | World ETF Lump Sum          | 28    | 29%            | 13%         | 37,152         |
| T10  | Parking Space Package       | 2     | 0%             | 14%         | 35,480         |
| P03  | Emerging Markets ETF        | 5     | 60%            | 13%         | 34,163         |
| P30  | Bond Ladder                 | 30    | 20%            | 14%         | 33,902         |
| P08  | Altcoin Basket              | 27    | 0%             | 15%         | 30,814         |
| P24  | E-Bike Rental Fleet         | 10    | 100%           | 12%         | 30,626         |
| P29  | Laundry Pick-Up Service     | 7     | 71%            | 13%         | 30,311         |
| P10  | Startup Crowdfunding Ticket | 30    | 0%             | 15%         | 29,160         |
| P31  | Rare Card Collection        | 33    | 0%             | 15%         | 27,324         |
| P21  | SaaS Side Project           | 10    | 60%            | 13%         | 24,573         |
| S03  | Meal Prep Sundays           | 314   | 17%            | 6%          | 23,893         |
| P27  | Self-Storage Container      | 13    | 46%            | 13%         | 20,381         |
| P17  | Rent Out a Room             | 2     | 100%           | 14%         | 19,975         |
| P26  | Car for Car Sharing         | 15    | 60%            | 12%         | 19,763         |
| S35  | Fixed-Term Deposit          | 59    | 24%            | 12%         | 19,533         |
| P19  | Create an Online Course     | 10    | 70%            | 13%         | 19,197         |
| P06  | SolarWind Energy            | 5     | 40%            | 14%         | 18,548         |
| P11  | P2P Lending                 | 12    | 33%            | 13%         | 17,731         |
| S23  | Graded Vintage Card         | 42    | 0%             | 16%         | 16,843         |
| S18  | Bitcoin Slice               | 46    | 0%             | 16%         | 16,633         |
| S20  | MoonDoge Token              | 51    | 0%             | 16%         | 16,248         |
| P04  | European REIT               | 10    | 70%            | 13%         | 15,773         |

## What came just before a bankruptcy

(the last three cards of each bankrupt game)

- L L05: 1
- H H42: 1
- E E26: 1
- H H87: 1
- L L06: 1
- C failed: 1
