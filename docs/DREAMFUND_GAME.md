# Dreamfund (Traumtopf) - the game, the cards and the numbers

Dreamfund is the Money Manager's own money game, played inside your real accounts of the app: you roll the dice, walk a map, and
everything that happens - a salary, a bill, a share you buy, a dream you fund - is booked as a real transaction, a Grow project, a
Smile or Fire project in the game's books. The aim is to build a life you can afford: pay back what you owe, keep a reserve, live
your dream and let your money work for you.

The game's money is the **Traumtaler (TT)**. Everything in this page is about the **Medium** level, the one that is balanced first.
Easy and Hard are prepared but not offered until the numbers hold.

This page is for players. The last part, [the statistics](#the-statistics-of-the-characters), is made from thousands of simulated
games and is written by the simulation itself (see `docs/DREAMFUND_SIMULATION.md` for how to run it).

## In one minute

1. You get a **character** with a salary, bills, a little cash, two debts and a dream (the first one is **Jonas**, a dual student of
   computer science who dreams of becoming a certified mountain guide).
2. You roll the dice and walk a **map** of tiles. Every tile is a stack of cards: an **Opportunity** to invest, a **Harvest** card that
   moves the markets, an **Emergency**, a **Life** event, a **Dream**, a **Career** chance, or a **Payday**.
3. At every **Payday** your salary comes in and your bills go out. What is left is yours to spend, save or invest.
4. You win when **all five goals** on your character's list are true. When your passive income alone pays your bills you earn the
   **Financial independence badge** - but the game goes on until the whole list is done.
5. You lose if your monthly cash flow turns negative: you are **bankrupt**.

## Your money: the five accounts

| Account     | What it is for                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Daily**   | Bills and everyday life: rent, food, insurance. Your salary lands here.                                                          |
| **Splurge** | Spending that is only for fun.                                                                                                   |
| **Smile**   | Your dreams. Every dream is a **Smile project** with buckets (flights, hotel, equipment...) that you fill.                       |
| **Fire**    | What must be paid: emergencies, the reserve, investments. Every payment to an Emergency or a purchase is a **Fire** transaction. |
| **Mojo**    | Your emergency reserve: three months of expenses. It is a Fire project from day one and may only be used for emergencies.        |

**Grow** is where investments live: every card you take becomes a **Grow project** (a share, an investment or an asset) with its
numbers, notes and tasks. You buy and sell with the normal Buy and Sell buttons of Grow.

**Payment plans.** A big goal (the reserve, a dream bucket) is not paid at once: you set up a payment plan that moves part of
every month's free money into it. The game does not force you; it shows what is due.

**The Bank loan.** If a payment is bigger than your cash, the Bank lends you the missing amount automatically. It costs **10% of the
loan every month** (a setting) - a loan is an emergency tool, not a way of investing.

**Insurance.** You start with liability and household insurance. An emergency that an insurance covers costs you only the deductible;
you can hop in or out of an insurance with the next Payday. Without it, the bill is yours.

## The map

A Dreamfund map is a closed track of tiles in a shape - **ring, infinity, rectangle, square or mountain** - and a size (**24, 36 or 48
tiles**). The map is made once when the game starts and never changes. A medium map of 36 tiles has:

| Tile           | Count | Colour | What happens                                                                     |
| -------------- | ----- | ------ | -------------------------------------------------------------------------------- |
| 💰 Payday      | 4     | gold   | Salary in, bills out. About every 2.5 rolls is a month.                          |
| 🌱 Opportunity | 14    | purple | Choose a pile and an investment to plan.                                         |
| 🌾 Harvest     | 6     | amber  | A market card: the markets move, windows to sell, buyers, hype, scams.           |
| 😊 Dream       | 3     | green  | Dreams to take, and Dream moments.                                               |
| 🔥 Emergency   | 3     | red    | Something breaks and has to be paid.                                             |
| ❤ Life         | 4     | pink   | A turn of life: love, a baby, a move, a gym membership, a parent who needs help. |
| 🎓 Career      | 2     | blue   | A promotion to roll for.                                                         |

Your **totem** stands next to the tile you are on, on the line from the middle of the map through the tile, and points at it. Before
the first roll it waits at START.

## A turn

1. **Roll** the dice (one or two; some cards say which).
2. The totem walks. Passing a Payday tile pays you; landing on a tile opens its card.
3. Deal with the card - the cards below explain how - and press **Done** (_Fertig_).
4. If a Harvest card touched something you own, **Done** takes you to Grow, where the affected projects are marked and every effect is
   written into the project's notes.

**Every die is yours to throw.** Whenever a card is decided by a die you press the golden dice yourself. Before you throw, the card shows
**what each number does**, coloured green (good), red (bad) or grey. This is true for Life cards, for Opportunity cards (the purchase
waits for your throw and Done is refused until you have thrown) and for the dice of Harvest cards (shown on the card).
Harvest cards still roll their own dice when you draw them; the draw is your action.

**Undo.** The last action of a turn can be undone.

## The cards

### 🌱 Opportunity - things to invest in (98 cards)

Landing on an Opportunity tile, you first **choose a pile**:

| Pile           | Cards | What it is                                                                               | Money needed                       |
| -------------- | ----- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| 🌱 **Seed**    | 36    | Savings tricks, small shares, side hustles, coins, small bets.                           | a few TT                           |
| 🌿 **Sapling** | 32    | Bigger shares, businesses with a loan, hustles that need start capital, a parking space. | hundreds to thousands              |
| 🌳 **Tree**    | 30    | Rental flats, shops, franchises, a laundromat, a vending network.                        | tens of thousands, with a mortgage |

You are offered one to three cards (a setting; the default is two). **Every card is one of four kinds**, marked by a coloured badge:

- **Share** - units with a price; you choose how many to buy, with no limit from the card.
- **Investment** - a property or a loan with a deposit, a mortgage and a monthly cash flow.
- **Asset** - everything else: a business, a hustle, a coin, a collection.
- **Saving** - a free card that lowers one of your expenses.

Each card also carries **keywords** (its market and its group: _World stocks_, _Business_, _Property_, _Vending_...). The Harvest cards
use the same words, so you can see at once whether a market card is about something you own.

**Plan this card.** Taking a card means **planning** it: a Grow project is made with everything the card says, and a note shows how
much you have in cash and how much you would have to borrow. You are taken to Grow; a share opens in edit mode so you can set the
units. When you press **Buy** the Add dialog books it. **Decline the offer** puts the cards back.

**A card is only buyable while it is in hand.** If you plan a card and do not buy it, the offer is gone when the turn ends - the project
closes with a note "Chance missed". A setting (_Turns a planned card can be bought_, 1 to 3, default 1) gives you more turns.

**Savings cards** cost nothing: they lower the matching expense line (electricity, mobile plan, bank fees...). The Grow project counts
**what you have saved so far**, so later you can tell what the saving bought you.

**Side hustles** take your evenings: only three can run at once (a setting); a fourth replaces one.

**Dice cards.** Many cards say "a die decides": a hustle that grows or does not, a business with a good or bad opening, a collection
that is worth much or little. The card lists every number; you throw the die after you have bought.

**Traps.** Some offers look like normal investments and are not (a "2% a week" lending app, a "pre-IPO" tip, a timeshare). Their
numbers are not given away. The Harvest cards later show which were scams.

### 🌾 Harvest - the markets (87 cards)

Every market has an **index** that starts at 1.00 and drifts at every Payday (World stocks, Bonds, Tech, Gold, Bitcoin, Property...).
What you own is worth its card price times the index of its market.

A Harvest card can:

- **move indices** (a crash, a boom) - the value of what you own follows;
- open a **window to sell** in a market: only then can you sell shares and coins there;
- bring a **buyer** for a property, a business or a collection, at a price that depends on a die;
- start a **hype ladder**: stay in while the die wins, cash out before it collapses;
- **change the cash flow** of businesses or properties, pause payouts, cut rents, add repairs;
- **reveal a scam** and show what was really behind the offer;
- change **everyone's costs** for good (inflation) or for some Paydays.

Each card shows its **group** (market, shares, crypto, hype, metals, collectibles, property, business, lending, scam), the **words** it is
about - red when you own something with that word -, an **"Affects you / Not about you"** badge, what it does to everybody, and what it
means for you. Every affected Grow project gets a note and a highlight.

**Selling what the cards gave you.** What the Opportunity cards made is sold at the price of a Harvest card: in an open market, to a
buyer, or on a hype. The offer stays open (for a few rolls, depending on the rules) even after you pressed **Done**: the project's
**Sell** button in Grow then sells at the card's price.

**There is always a way out.** A market card with a window or a buyer is the _best_ exit, but it is rare - about one landing in a hundred rolls
speaks of a given holding. So the **Sell** button of a project also sells **at any time at the market price, less a discount**: 5% for a share,
15% for a coin, a collection or a property (the mortgage comes off the proceeds), and a business or a hustle for a year of what it pays
(half of what a buyer on a card pays). Nothing is sold below that, and savings and scams cannot be sold at all.

### 🔥 Emergency (45 cards)

Something breaks. Cards come in five tiers - **spark, flame, blaze, wildfire, inferno** - from a broken bike grip to a house fire. An
insurance may cover the bill; the rest is paid from your cash, by a payment plan, or by the Bank loan. In the guided and strict modes an
emergency has to be dealt with before the game goes on.

### ❤ Life (27 cards)

Love, a baby, moving in together, a new job, a bad flatmate, a parent who needs help, lifestyle creep. There are four kinds:

- **Fate** - it happens (you only press _Let it happen_).
- **Choice** - you accept or decline (if the rules allow declining).
- **Dice** - a die decides (the baby card: a 1-2 means a baby is on its way in three Paydays).
- **Giving** - give, lend, or pass.

Life leaves **lines** behind: a monthly cost that runs for a number of Paydays (a parent who needs help: 6) or for good (lifestyle creep).

### 🎓 Career

Your character climbs a ladder. Jonas starts as a _Dual Student_ (net 1,955 TT a month) and can reach _Junior Data Analyst_, _Data
Engineer_, _Senior Data Engineer_, and then split into the technical path (_Staff Data Engineer_, _Chief Data Architect_) or the
management path (_Data Team Lead_, _Head of Data_, _Director of Data_). A promotion needs a minimum number of Paydays and a
successful roll. A promotion raises your salary - and your living costs.

### 😊 Dream (48 cards) and Dream moments

Dreams are cards worth **points**, in tiers from _little_ to _legendary_, in categories like travel, adventure, vehicles, home, learning,
creating and giving. Taking a dream makes a **Smile project** with buckets you fill by payment plans. You can have a few open at once.
**Dream moments** (an early-bird offer, a gift from family, a last-minute deal, a travel buddy, inspiration, side-project money,
points for patience, a dream swap) help a dream along.

## The notes of a project

Whatever happens to a Grow, Fire or Smile project is written into its **notes**, with the numbers: what a payment cost, how much cash you
had and how much the Bank lent you for it; what a buyer offers (the price, the costs of the sale, what is still owed, what you would
receive) or what a market window pays per unit; every step of a hype with the die rolled and what the stake is worth; a sale with what
was paid out and the cash afterwards; a dream moment with the cost before and after and what you have saved so far.

## What is running on your account

A strip above the map shows **every effect that is working on your money right now** and **how many Paydays are left**: costs that run
for a while, gains, pauses ("pays nothing for 2 Paydays"), money that is locked, a job search, effects that are on their way and
what has changed for good. The character's info lists them in full. When an effect ends, the Payday says so and the project's notes
record it - so cash flow never comes back "by magic".

## The goals and how a game is won

Every character has a list of goals. For Jonas, **all five must be true**:

1. Pay back the loan from your parents (1,500 TT).
2. Pay back the car loan (1,500 TT).
3. Fund and live the **dream** - every bucket of the project full.
4. Build the **reserve**: three monthly expenses in the Mojo.
5. Become **financially independent**: passive income covers all monthly expenses.

**The Financial independence badge** 💎 appears as soon as the passive income covers the expenses (the part of the expenses that
comes from your salary - income tax and social insurance - is not counted against your passive income, because it stops when the
salary stops). The game goes on: the badge is a milestone, not the end.

**When every goal is done** the **win screen** appears, with a trophy, the ticked goals and the numbers of your game; you may keep playing.

**Bankruptcy.** If the monthly cash flow turns negative the game ends.

**How long is a game?** A normal game is about **90 turns** (roughly 36 months), a fast one 30, a long one 120.

## Rules and settings

The game's rules are chosen at the start and cannot change during it:

| Mode       | What it means                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Free**   | Everything is allowed: open any card, sell any time, add any transaction.                                                   |
| **Guided** | One random card per tile, buying only with the card in hand, selling only while a market card offers a buyer (for 3 rolls). |
| **Strict** | One card per tile, dice only from the app, no free transactions; made for playing with others.                              |

Settings worth knowing: cards offered per Opportunity landing (1-3), side hustles at once (1-5), copies of each savings card (1-3),
turns a planned card stays buyable (1-3), the interest of the Bank loan, whether a dream or a life choice may be declined, whether a
promotion has to be rolled for.

**Your own settings.** The **Settings** row of the game menu has switches that only you see, kept in your browser: **Notifications** (the
small confirmations that pop up; errors always show) and **Messages on the map** (the Payday that just passed, market notices). Turn the
notifications off on a phone if they cover buttons.

**The independence badge** compares the passive income with the **cost of living**: the expenses without the income tax and social
insurance that stop with the salary. The badge says both numbers.

## Ways to win

The simulation (below) has tried twelve ways of playing. They are ideas to steal:

- **The informed investor** takes every free saving, then whatever pays most for its price from all three piles, funds the reserve
  and the dream by payment plans, and starts the dream only when the passive income helps carry it.
- **The Sapling builder** lives on businesses and hustles from the middle pile and never buys property.
- **The hustler** starts one side hustle after the other and reinvests every month.
- **The dividend snowball** collects dividend shares of all piles and reinvests.
- **The Tree saver** takes only free savings until a Tree is affordable, then buys only Trees.
- **The steady builder** keeps three months of cash and takes no risky card.

What does not work: living on free cards only, speculating on crypto and hot tips, and putting the dream before everything.

## The statistics of the characters

The statistics come from the simulation: bots play the whole game thousands of times with different ways of playing and the same
seeds, so that the difference in results comes from the strategy. They are used to find cards and numbers that are too strong, too weak
or that break the game, and to balance each character. **A turn is a roll of the dice; about 2.5 turns make a month.**

### Jonas - dual student of computer science

Starting position: salary 2,833 TT gross (net 1,955 TT), expenses 2,333 TT (rent 800, groceries 300, insurances and taxes), 500 TT cash,
a loan from the parents (1,500 TT) and a car loan (1,500 TT), one BMW share and some IOTA coins. Dream: _certified mountain guide_
(training about 17,000 TT in course fees alone, plus equipment).

<!-- stats:jonas:start -->

2,400 games were played by 12 ways of playing, on the maps ring, infinity, up to 150 rolls of the dice each (about 60 months). The same seeds were used for every strategy, so the differences come from how they play, not from luck of the draw. Jonas starts every game the same way.

Overall **11%** of the games were won and **0%** ended in bankruptcy; the rest were not decided after 150 rolls.

### Ways of playing

| Strategy                     | What it does                                                                                                                                                                                                       | Won | Bankrupt | Month of the win (typical) | Net worth at the end | Passive income at its best |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | -------- | -------------------------- | -------------------- | -------------------------- |
| **Cautious saver**           | Keeps cash, takes only the safest cards (savings, bonds, a world ETF) and funds the reserve and the dream first.                                                                                                   | 0%  | 0%       | -                          | 65,578               | 275                        |
| **ETF investor**             | Puts the free money into index and dividend ETFs and bonds, little else.                                                                                                                                           | 2%  | 0%       | 54                         | 66,768               | 768                        |
| **Property builder**         | Saves for the Tree pile and buys rental properties with a mortgage.                                                                                                                                                | 8%  | 1%       | 54                         | 74,265               | 305                        |
| **Side hustler**             | Starts side hustles and small businesses from the Seed and Sapling piles, one after the other.                                                                                                                     | 17% | 0%       | 54                         | 67,051               | 1,330                      |
| **Gambler**                  | Goes for crypto, hot tips, collectibles and the hype ladder.                                                                                                                                                       | 0%  | 1%       | -                          | 83,017               | 76                         |
| **Informed investor**        | Takes every free saving, then whatever pays most for its price from all three piles, plans the reserve and the dream by payment plans and starts the dream only once the passive income carries part of the costs. | 44% | 0%       | 52                         | 80,649               | 2,345                      |
| **Dividend snowball**        | Builds a snowball of dividend shares from all piles.                                                                                                                                                               | 4%  | 0%       | 53                         | 76,525               | 621                        |
| **Sapling business builder** | Builds businesses and hustles from the Sapling pile and never buys property.                                                                                                                                       | 40% | 0%       | 51                         | 74,336               | 2,364                      |
| **Tree saver**               | Collects savings and Seed cards until a Tree is affordable, then buys only Trees.                                                                                                                                  | 1%  | 0%       | 57                         | 61,595               | 55                         |
| **Dream chaser**             | Funds the dreams first, with safe cards on the side.                                                                                                                                                               | 0%  | 1%       | -                          | 58,706               | 67                         |
| **Steady builder**           | Like the informed investor but with three months of cash in hand and no risky cards.                                                                                                                               | 17% | 0%       | 53                         | 80,764               | 1,390                      |
| **Free cards only**          | Takes only the free savings cards and never invests.                                                                                                                                                               | 0%  | 2%       | -                          | 61,771               | 41                         |

### How a game unfolds

The four goals are reached in a typical order. The table shows the month in which the half of the players who got there reached each goal, and how many got there at all.

| Strategy                 | Reserve full    | Debts repaid    | Life dream lived | Passive income covers the expenses |
| ------------------------ | --------------- | --------------- | ---------------- | ---------------------------------- |
| Cautious saver           | month 45 (77%)  | month 47 (69%)  | month 48 (67%)   | -                                  |
| ETF investor             | month 31 (94%)  | month 41 (83%)  | month 45 (78%)   | month 54 (2%)                      |
| Property builder         | month 27 (98%)  | month 34 (93%)  | month 45 (82%)   | month 54 (8%)                      |
| Side hustler             | month 28 (100%) | month 36 (92%)  | month 45 (85%)   | month 54 (17%)                     |
| Gambler                  | month 20 (100%) | month 28 (100%) | month 46 (77%)   | -                                  |
| Informed investor        | month 17 (100%) | month 22 (99%)  | month 39 (94%)   | month 52 (44%)                     |
| Dividend snowball        | month 20 (100%) | month 25 (99%)  | month 46 (79%)   | month 53 (4%)                      |
| Sapling business builder | month 17 (100%) | month 22 (100%) | month 38 (96%)   | month 51 (40%)                     |
| Tree saver               | month 17 (100%) | month 22 (100%) | month 44 (91%)   | month 57 (1%)                      |
| Dream chaser             | month 45 (74%)  | month 49 (51%)  | month 48 (67%)   | -                                  |
| Steady builder           | month 29 (98%)  | month 33 (95%)  | month 47 (81%)   | month 53 (17%)                     |
| Free cards only          | month 48 (67%)  | month 48 (54%)  | month 49 (54%)   | -                                  |

### The cards that carry a win

Of all won games, the share in which the card was taken (a card in nearly every win is a pillar of the game):

| Card                              | Pile    | Taken in these wins | Win chance when taken | Win chance without it | Difference in net worth |
| --------------------------------- | ------- | ------------------- | --------------------- | --------------------- | ----------------------- |
| Annual Contract Check (S36)       | seed    | 100%                | 11%                   | 0%                    | +74,613                 |
| Free Bank Account (S05)           | seed    | 100%                | 11%                   | 0%                    | +74,613                 |
| Switch Electricity Provider (S02) | seed    | 100%                | 11%                   | 0%                    | +74,613                 |
| Cheaper Mobile Plan (S04)         | seed    | 100%                | 11%                   | 0%                    | +74,613                 |
| Ask for a Job Ticket (S06)        | seed    | 100%                | 11%                   | 0%                    | +74,613                 |
| AI Subscription Audit (S01)       | seed    | 100%                | 11%                   | 0%                    | +74,613                 |
| Declutter and Sell (S07)          | seed    | 98%                 | 12%                   | 3%                    | +9,775                  |
| Meal Prep Sundays (S03)           | seed    | 94%                 | 13%                   | 3%                    | +23,160                 |
| Weekend IT Freelancing (S29)      | seed    | 83%                 | 25%                   | 3%                    | +13,150                 |
| Tutoring (S31)                    | seed    | 75%                 | 22%                   | 4%                    | +11,990                 |
| Bike Courier Weekends (S34)       | seed    | 59%                 | 25%                   | 6%                    | +5,518                  |
| Phone Flipping (S30)              | seed    | 53%                 | 29%                   | 7%                    | +8,453                  |
| Snack Vending Machine (P15)       | sapling | 47%                 | 49%                   | 7%                    | +18,051                 |
| Sell Digital Templates (S33)      | seed    | 45%                 | 27%                   | 7%                    | +6,521                  |
| Freelance Data Consulting (P18)   | sapling | 43%                 | 48%                   | 7%                    | +22,904                 |
| Dividend ETF (S12)                | seed    | 43%                 | 21%                   | 8%                    | +14,506                 |
| Autowerk AG (Car Maker) (S13)     | seed    | 42%                 | 23%                   | 8%                    | +11,643                 |
| Print-on-Demand Shop (S32)        | seed    | 41%                 | 29%                   | 8%                    | +6,271                  |

### Cards that tip the balance

**Very strong** (a win is much more likely when the card is taken - candidates to weaken):

- E-Bike Rental Fleet (P24, sapling): 62% won with it, 10% without.
- Laundry Pick-Up Service (P29, sapling): 56% won with it, 7% without.
- Rent Out a Room (P17, sapling): 54% won with it, 10% without.
- Snack Vending Machine (P15, sapling): 49% won with it, 7% without.
- Freelance Data Consulting (P18, sapling): 48% won with it, 7% without.
- High-Income Covered-Call ETF (P05, sapling): 47% won with it, 7% without.
- SaaS Side Project (P21, sapling): 47% won with it, 8% without.
- Create an Online Course (P19, sapling): 45% won with it, 9% without.
- Photo Booth Rental (P23, sapling): 44% won with it, 8% without.
- Used Food Truck (P22, sapling): 45% won with it, 9% without.

**Taken often but they hold a player back** (candidates to strengthen):

- none.

### Events that hit hardest

Cards from the Emergency and Life stacks that were met in the first 60 rolls (every game gets that far), and how the games went on: the games that met the card against those that did not.

| Event                       | Stack     | Met in           | Win chance after | Win chance otherwise | Bankrupt after |
| --------------------------- | --------- | ---------------- | ---------------- | -------------------- | -------------- |
| Bike Stolen (E18)           | Emergency | 7% of the games  | 5%               | 12%                  | 1%             |
| Family in Need (L24)        | Life      | 21% of the games | 6%               | 12%                  | 0%             |
| Thinking About a Baby (L05) | Life      | 8% of the games  | 5%               | 12%                  | 0%             |
| Grandpa's Old Car (L11)     | Life      | 24% of the games | 6%               | 13%                  | 0%             |
| Break-Up (L04)              | Life      | 9% of the games  | 5%               | 12%                  | 0%             |
| Storm on the Balcony (E44)  | Emergency | 11% of the games | 6%               | 12%                  | 1%             |
| Fridge Dies in Summer (E24) | Emergency | 19% of the games | 8%               | 12%                  | 0%             |
| Falling in Love (L01)       | Life      | 42% of the games | 9%               | 13%                  | 0%             |
| Forgotten Free Trial (E41)  | Emergency | 14% of the games | 8%               | 12%                  | 1%             |
| Friend's Bike Grip (E01)    | Emergency | 14% of the games | 8%               | 12%                  | 1%             |
| Dunning Letter (E06)        | Emergency | 13% of the games | 8%               | 12%                  | 1%             |
| Broken Glasses (E10)        | Emergency | 20% of the games | 8%               | 12%                  | 0%             |

### The market cards that help most and hurt most

| Market card                  | Win chance after | Win chance otherwise | Bankrupt after |
| ---------------------------- | ---------------- | -------------------- | -------------- |
| Major Repair (H56)           | 25%              | 10%                  | 0%             |
| Collector Hype (H40)         | 24%              | 10%                  | 0%             |
| Year of Catastrophes (H15)   | 19%              | 10%                  | 1%             |
| Parking Shortage (H61)       | 18%              | 10%                  | 1%             |
| Emerging Markets Rally (H24) | 17%              | 10%                  | 1%             |
| Energy Transition Boom (H22) | 17%              | 10%                  | 2%             |
| Bonds Tumble (H27)           | 5%               | 12%                  | 0%             |
| Penny Stock Rocket (H41)     | 5%               | 12%                  | 0%             |
| Vacancy (H55)                | 5%               | 12%                  | 1%             |
| Inflation Spike (H08)        | 4%               | 12%                  | 0%             |
| Exchange Collapse (H32)      | 3%               | 12%                  | 0%             |
| Hype Fades (H50)             | 2%               | 12%                  | 0%             |

### What came just before a bankruptcy

10 games ended in bankruptcy (0%). The last two cards before it:

- It's a Baby! (L06): 4
- Give 10% (L22): 2
- Buyer for Your Property (H53): 2
- Gold Rush (H42): 2
- Burglary (E26): 2
- Currency Crisis (H23): 2
- Fund Manager Rebalances (H87): 2
- Car Maker Misses Forecast (H13): 2

### What a won game looks like

- Typical win: month 53 (the quickest 38, the slowest 60).
- Passive income at the end: 2,846 a month against expenses of 5,801.
- Dream points collected: 17 on average.
- Bank loan at its highest: 0.

<!-- stats:jonas:end -->

#### What the simulation found, and what we changed

_Read the tables with care: with 200 games per way of playing, differences of a few points are noise. Only big gaps mean something._

- **The Sapling pile was too strong.** In a first play a Sapling business with 8,000 TT of capital paid up to 3,900 TT a month on a
  six - more than the whole salary, in the seventh month of the game. Since then a Sapling business pays **40%** of what the sketch
  said: the best single Sapling card now pays about 1,500 TT a month on a six and 300-650 on average. Three thousand a month is
  only possible with a Tree.
- **The Sapling pile is still the engine of the game.** The ten cards with the biggest gap in the win chance are all Sapling cards
  (E-Bike Rental Fleet, Laundry Pick-Up, Rent Out a Room, Snack Vending Machine, Freelance Data Consulting...): a player who owns one of
  them wins about half of the games, one who owns none wins about one in ten. That is meant - a good start is what a promotion buys - but
  none of them may become much better.
- **The Trees are out of reach for Jonas.** Almost nobody buys a Tree: a flat needs 11,000 TT of cash and Jonas saves 300-450 TT
  a month. The "Tree saver" wins 1% of its games. Trees are the late game of a character with a better salary, or of a player who has
  a few Saplings running. If the Trees should matter earlier, the cheapest Tree (a studio flat) or the Tree pile's cost is the knob.
- **The free savings cards are a pillar.** Every won game took all six free savings cards (the electricity provider, the mobile plan,
  the free bank account, the job ticket, the AI subscription audit, the contract check): together they are worth 40-50 TT a month for
  nothing, and a player without them hardly ever wins. They are also the reason "Free cards only" does not win: they are the start,
  not the way.
- **Four ways of playing work**: the informed investor (44%), the Sapling builder (40%), the steady builder (17%) and the side hustler
  (17%). The wins come about month 51-54 (a normal game is about 36 months, so Medium is still too hard on average; the quickest
  win was month 38).
- **Four ways of playing do not work, as intended**: living on free cards only, the gambler, the dream chaser and the tree saver win
  almost never. The gambler and the free-cards player are also the only ones who go bankrupt now and then.
- **Dream before everything loses.** The dream chaser reaches the dream first (month 48) but never builds income.
- **Events.** No Emergency or Life card breaks the game by itself. The ones that cost most are the monthly lines: _Family in Need_,
  _Grandpa's Old Car_, _Lifestyle Creep_, a baby. A player who meets them early wins less often, but never by more than a few points.
  In the market cards _Hype Fades_, _Exchange Collapse_ and _Inflation Spike_ are the worst; _Major Repair_ and _Collector Hype_
  help a lot, which says more about who owns property and collectibles than about the card.
- **The first human game was far faster than any bot** (financial independence in month 7, against month 38 for the quickest bot). It
  needed a promotion, a 6 on a business die and a lucky purchase; the changes above take that path away. The next play will tell whether
  Medium is now too hard or right.

#### How these tables are made

Run `npm run simulate:dreamfund -- --games 100 --shapes ring,infinity --max-turns 150 --out docs/dreamfund-balance/run.md --doc
docs/DREAMFUND_GAME.md --doc-de docs/DREAMFUND_GAME.de.md` (build the domain package first). The tables above are rewritten between the markers; the text around them is
written by hand. The raw games are saved beside the report as JSON.

### Other characters

The next characters are balanced against Jonas's numbers (the same piles and the same cards, a different salary, expenses, debts
and dream) and get their own statistics here.
