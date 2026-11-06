# Dreamfund strategy - how the game is won

For an agent that guides or plays: what to aim for, what to take, when to sell, what to avoid. It is the knowledge of the simulation
(200 games per strategy, ten characters, three levels - `dreamfund_map`) in the order a game goes. The rules of every card are in
`dreamfund_game_en` / `_de`; the cards themselves are found with `get_cashflow_game` action `dream_cards`.

## The aim

A game is won when **all** of these are true: the **reserve** is three months of living costs, the starting **debts** are repaid, the
**life dream** is funded and lived, and the **passive income** (what cards pay every month) is at least the **cost of living**. Some tables
also ask for **dream points** (from the dreams taken on the Dream tiles). The goals are shown in percent; `table_review` and `table_advice`
tell them. **Income is the bottleneck**: in the simulation the dream and the reserve are reached long before the income is - a player who
funds the dream before any income has rarely won.

## The order of a game

1. **First months - free money and a reserve.** Take the Seed savings cards (a cheaper phone plan, electricity, a job ticket, an audit of
   subscriptions): they cost nothing and lift the month. Take the employer savings plan (S37) and a company pension (S38/S39) when the
   month can carry the payment: they pay out with a bonus (50%, 20%, 45%). Put the free money into the **reserve** until it covers three
   months; one emergency without a reserve becomes a **Bank loan at 10% a month**.
2. **A first income.** A side hustle or a small business (the Seed and Sapling piles), a world ETF or dividend shares, a room rented out.
   At most a few side hustles run at a time. A card that pays every month (look at `cashflowMinor`, or the dice) beats one that only
   might rise.
3. **Debts.** Repay the starting debts (parents' loan, car loan, credit card) when the cash allows; a debt with interest first.
4. **Step up.** Sell a card at a good price (below) and buy a bigger one from the Sapling or Tree pile: a rented property, a larger
   business, a dividend portfolio. This is how a small salary reaches a four-figure passive income: **sell, step up, repeat**.
5. **Raise the pay.** A course or a diploma (S40, P34, P35, T31) costs now and raises the pay after a few Paydays, by a die: worth it
   early, when many years of pay are ahead; keep the reserve.
6. **The dream.** Fund it with what is left, with a plan per Payday; take dreams for the points only when the income is on its way.

## What to take and what to leave

- **Take:** free savings; employer and state benefits; ETFs and dividend funds for the steady part; businesses and properties with a
  cash flow that covers their loan; anything with a payment you can check.
- **Leave:** an offer that promises a **fixed high return** (a weekly interest, 40% a year), a **hot tip** that came to you, a
  **pre-IPO** share, a **timeshare**, a **course that sells trading signals**, a coin nobody has heard of. These look like any other card
  (they even show a monthly cash flow) but are scams; a Harvest card later closes them. Their cards are not marked - judge them by the
  numbers: the more it promises for how little, the less likely it is to be true. The `riskScore` and the `risks` text of a card say what
  can go wrong.
- **Be careful with:** crypto, collectibles and hype (they swing a lot and pay nothing monthly), a Tree card bought with a Bank loan.
- **Never:** keep a Bank loan open when the cash could repay it.

## Selling

Everything you own except savings, plans and courses can be sold. There are three ways, best first:

1. **A Harvest card's offer** - an open market (every share or coin of that market at its price), a buyer with a die for the price (a
   property at 0.85 to 1.3 times its value, a business at 24-36 months of its cash flow, a block of shares at +1% to +20%), or a hype
   to ride. The offer stays open for the table's number of your turns (default 2). `table_advice` lists the open ones in `attention`.
2. **The standing sale** (`sell_holding`) - at any time, at the market price less 5% (a share), 15% (a coin, a collection, a property) or
   for a year of the cash flow (a business). Use it when you must have cash.
3. **A trade with another player** (`offer_trade`) - for a card in hand, at a price you both accept.

A sale at a **profit pays tax** on the profit (default 26.375%, a table setting; 0 = none): count the net before you sell. A sale at a
loss pays nothing. A mortgage is paid off from the proceeds. Sell when the offer is clearly above what you paid (a profit that is worth
the tax), when a card that paid has stopped paying, when the cash is needed for the reserve or an emergency, or when a bigger card is
within reach. Do not sell a card that pays well just because the price rose.

## Who wins in the simulation

On the medium level the best strategies are **expert** (reserve first, then cards that pay every month, sells into good windows) and
**sapling** (builds from the Sapling pile); property and ETF strategies win rarely, a pure saver or gambler almost never. The
`dreamfund_map`table says, per character, which strategy wins most and how often: a bus driver on Easy wins more than 80 in 100, a`surgeon on Hard about 3. When you advise, say how hard the character is.

## Doing it for the user

Ask what they want: win, learn, or collect a particular dream. `table_advice` gives the next move of the strategy and why;
`table_autoplay` plays a few turns with it; for anything particular (a dream first, no risk, no sale) choose the moves yourself with
`table_move`and the cards you read with`dream_cards`. Tell the user what you did and why in plain words. Do not play unattended for
long, and never in a loop that reads the whole table: the review and the advice are the small pages.
