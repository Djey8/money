# The Cashflow game: rules, spaces and strategy

A human-readable rulebook for the Cashflow board-game companion (`todo/cashflow-game.md`), for a player reading
this directly and for an agent using `explain_concept` (once Phase 4 wires the game into the MCP tools — today
it isn't, by design: `todo/cashflow-game.md` decision 2). If you're only using the app, read sections 1–5; section
6 is for whoever extends this feature.

## 1. What the app does and doesn't do

This is a **companion**, not a digital board. You play the physical board with a real die — your own token, your
own dice rolls, your own opponents if you have them. The app's job is to do the bookkeeping instantly and
correctly whenever you land on something, so you can focus on the decisions.

- **A "cashflow" account is a dedicated play account.** Its whole Transaction/Subscription/Balance-Sheet/Grow data
  _is_ the game — there's no personal finance mixed in, and nothing you do here reaches a real account.
- **Everything financial is a real entity** — the same Transactions, Subscriptions, and Grow projects a personal
  account has. The game doesn't invent a parallel bookkeeping system; it uses the app the way you'd use it
  yourself, just faster.
- **The app never decides for you.** It shows you the numbers — can you afford the deposit, what does the loan
  cost, would this purchase bankrupt you — and you decide whether to take the deal. That's the whole point of the
  game: learning to read those numbers before you commit.

## 2. Payday and the game's own calendar

Payday is the one space that always pays out (or costs you, if you're in debt): salary in, fixed expenses out. In
the app, this is one click, done at the game's own date (independent of the real calendar — it never touches any
other transaction, unlike the mechanism it replaces).

**Payday always runs — it is never skipped by the app**, even with an active Charity or Downsized reminder showing
(see section 4). Those are about the physical board's turn order, which this single-player tool has no way to see;
only you know when your own next turns have actually happened.

## 3. The life-simulation spaces (no card needed)

These don't need a physical card's text — they're simple, fixed rules. In the app, tell it what you landed on:

| Space         | Effect                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Baby**      | +1 child (max 3). Adds — or scales up — one "Children Expenses" Subscription, which then shows up in every future Payday.                                                         |
| **Charity**   | Pay 10% of your current income once. Reminder: for your next 3 turns you may choose 1 or 2 dice. Dismiss it yourself when done.                                                   |
| **Downsized** | Pay your total expenses once. Reminder: sit out while your opponents play their next 2 turns. Also ends an active Charity reminder. Dismiss it yourself when your turns are back. |

The Charity/Downsized reminder badges have a small "×" to dismiss them once you've actually sat out or used up
your dice-choice turns — the app can't know that on its own, so it doesn't try to.

## 4. Deal cards: buying shares and property — this is just Grow

**This is the same passive-income machinery the whole app already has for Rich-Dad-style investing** — the
Cashflow game doesn't need its own version. When a Deal card lets you buy, go to the Grow page and record it
exactly like any Grow purchase; see `grow_guide` for the full mechanics. What differs is only the _strategy_:

**Small Deal — shares (a liquidity tool, not passive income).** Create a Grow project with `kind: share`, then
`buyProject` (quantity × price). Buy as much as you want, on credit if you need to (take a Bank loan, section 5) —
shares aren't ongoing income here, they're a way to turn a good entry price into a cash windfall later. When
you're ready, `sellProject`. **The cash from selling shares is what funds a bigger property deposit** — that's
the whole reason to hold them.

**Small/Big Deal — property (the passive-income vehicle).** Create a Grow project with `kind: investment`,
`depositMinor` (paid immediately — from cash on hand, or a Bank loan if you're short) and `amountMinor` (the
mortgage, becomes a Liability). `cashflowMinor` is the property's periodic income; recording it (`cashflowProject`)
adds it to your real income statement and Subscriptions **automatically** — this is your passive income, growing
your monthly cashflow every time you add a property. Small Deal properties are cheaper with modest cashflow; Big
Deal properties need a much larger deposit (up to the game set's ceiling) but add proportionally more cashflow.
`paybackProject` pays down the mortgage early if you want to; you can also pay off a mortgage-financed property's
loan in full at any time, same as any liability.

**The strategic tension (this is the whole game):** if you finance part of a deposit with a Bank loan, that loan
costs the game set's rate (10%/month per increment in the placeholder set) forever until repaid. A property adding
€600/month is only a good deal if the loan you needed for it costs less than that. Borrowing €6,000 at 10%/month
costs €600/month — exactly wiping out the example above. The app doesn't block this; it's the decision you're
there to make. Compare the loan's monthly cost (Bank loan section, or the interest Subscription it creates) against
the cashflow a property adds before you commit.

## 5. Bank loans

Take or repay in the game set's fixed increment (€1,000 at 10%/month in the placeholder set) from the Cashflow
game page — this is the one mechanic the app fully automates, because the math is exact and mechanical (unlike a
Deal, which is a judgment call). It keeps one Liability and one interest Subscription in sync; never edit those by
hand. Pay off any liability in full at any point in the game, exactly like any personal account.

## 6. Winning, losing, and reading the dashboard

- **Escaping the rat race** (the game's win condition for this phase): passive income — property cashflow, not
  share trades — exceeds your total expenses. Not automated yet (needs a way to sum only investment-kind Grow
  cashflow cleanly — tracked in `todo/cashflow-game.md`).
- **Losing**: if your **monthly cashflow** (income minus expenses across every Subscription the game owns — the
  dashboard shows this figure live) goes negative, every future Payday drains cash rather than adding to it. The
  app shows a clear warning at that point, but doesn't lock you out — it's a warning to fix things (sell an asset,
  pay off a loan) before your next Payday, not a hard stop.
- **You decide every deal.** A good player doesn't take every Deal card — the game is won by reading the numbers
  (deposit affordable? loan cost vs. added cashflow? would this push monthly cashflow negative?) before buying,
  not by buying everything offered.

## 7. For whoever extends this (agents, future sessions)

- Deal-card purchases are **not** modeled as new Cashflow-game entities — they're ordinary Grow projects. Don't
  build a parallel buy/sell system; point the player (or the Grow typed actions, once Phase 4 exists) at the
  existing ones.
- Every Grow project, Asset, Investment, Share and Liability on a cashflow account belongs to the game — no
  `#cashflow` marker needed (unlike Subscriptions, which need one to tell `gameSubscriptionTitles` what to include
  in Payday); decision 2 already means the whole account is the game.
- Real card text/values (Deal, Market, Doodad) and the physical board's space sequence are still needed from JFK
  before Phase 2/3 can be built — nothing here invents them.

## 8. Solo mode: the app plays the board

When a game starts, next to the language you choose **how to play**: _with the physical board_ (everything above), or
**solo in the app**, where the app rolls the dice and walks your token round the rat race. The mode is fixed for that
game. The board is the German "Cashflow - Verlasse das Hamsterrad!" rat race, drawn as a ring of 24 spaces (12 Deals,
3 Doodad, 3 Payday, 3 Market, one each of Charity, Downsized and Baby).

- **Start.** Before the first roll the totem waits outside the rat race, top middle, with "Start" written below it;
  with the first roll it moves inside the ring and goes round the tiles. The token starts at START, just before the first space: a first roll of _n_ lands on space _n_ (the
  Deals space next to START for a 1). **The first roll starts the game officially**: it also pays your first Payday,
  so you have your savings plus one Payday before the token has moved.
- **A turn is one roll, and it reveals itself in order.** The dice tumble and come to rest on their number (the faces
  you see are the engine's result - the tumble never decides anything), the token walks space by space, and the moment
  the totem is on its tile the landing speaks (no extra wait). Press **Skip** to jump ahead; with "reduce motion" set the
  token jumps by itself. The dice are thrown with a bounce, the faces slow down, they land with one small pop and then stay still on the number.
- **Payday** pays whenever you **land on or pass** a Payday space, once per Payday space. It also advances the game's
  calendar one month, as in the companion. An info box at the top of the dashboard, like the "card does not apply" notice, shows what
  it paid (income, expenses, the monthly result); it goes with the next thing you do or with its X - the info boxes of
  the game vanish that way.
- **A kept Multi-Level-Marketing card** gets its bonus roll at the Payday - the same game turn. The Payday info box stays
  while you press the MLM roll, and the outcome (the bonus paid, or not) appears as a second info box next to it; your
  next action clears both.
- **Baby, Charity, Downsized** resolve on the spot (a Baby space with three children changes nothing). **Charity and
  Downsized pay cash, and the balance never goes negative:** when cash is short, the Bank loan is taken first (the
  shortfall rounded up to the loan step, as its own step in the history) and then the payment is made - in solo and with
  the physical board alike. **Charity**
  donates 10 % of your income, then for the next **3 turns** you may choose **1 or 2 dice** before each roll - **two dice are selected by default**, switch to one if you prefer.
  **Downsized** pays your expenses; the spanner is only a reminder (playing alone nobody takes a turn in between, so
  nothing is skipped) and your **next roll removes it**.
- **Deals, Doodad, Market** show a dialog first ("You landed on Deals"). **Open the card** starts the card flow you
  know (Deals asks for the Small or Big pile first; you draw a random card or look for a specific one) - nothing opens
  by itself. The turn stays open - **you cannot roll again** - until you press **Done** after dealing with the card, or
  **Pass** to leave it (Pass is a step of its own, so Undo brings the card back).
- **Selling a card to a friend** is for property and special-asset cards only (also in companion mode): **a share card
  belongs to whoever drew it** and cannot be sold.
- **One roll is one step in the history**, however many Paydays and spaces it touched: one Undo takes back the whole
  roll, with the token.
- **The game ends** when you **escape the rat race** (passive income covers all your monthly expenses - the Fast
  Track is not part of the app) or go **bankrupt** (your monthly cashflow is negative). The end screen shows the
  rounds, turns, cash and monthly picture and offers to save the game.
- Solo is for **cashflow game accounts** like the rest of the game, in the self-hosted edition's game content.

The turn logic is the `@money/domain` package's (`board.ts`, `movement.ts`, `turn.ts`, `game-end.ts`); the app only
shows it and forwards the buttons. A seeded game plays out identically every time, which is how the rules are tested
(`solo-simulation.spec.ts`).

## 9. Playing as an agent (Pro API and MCP)

A game account (an email containing `cashflow`) can be played by an agent through the Pro API or the MCP tools `get_cashflow_game` and `play_cashflow_game`. It plays the same rules as the app - the rules are shared code - and the account ends up exactly as if a person had played the same moves: the books, the game state and the history are written the way the app writes them, so the player can undo what an agent played, and the other way round.

**The loop.** Call `get_cashflow_game` action `game` before every move. It returns the state, the books' figures and `legalActions`: the only moves the game accepts now. In a solo game:

1. `start` with `mode: "solo"` (pick the set and profession from `sets`).
2. While `turn.phase` is `roll`: `roll` (`dice: 2` while Charity runs). The first roll pays the opening Payday; every Payday the token enters is paid.
3. While it is `decide`, `pendingDecision.kind` names the pile: for `deal`, `draw_card` from `dealSmall` or `dealBig`, then `buy_deal {cardId, quantity?}` or `pass_card`; for `doodad`, `draw_card` then `pay_doodad {cardId}`; for `market`, `draw_card` then `play_market {cardId}` or `pass_card`. A stock split or a paid dice card leaves a waiting `roll_decision`.
4. Stop when `outcome` is `escaped` (passive income covers every expense) or `bankrupt` (a negative monthly cashflow).

**Not yet through the API:** special-asset Deal cards (gold, loan to a relative, Multi-Level-Marketing) and selling positions. Pass those cards.

**Undo and history.** `undo {count?}` takes steps back; `history` is the step log. **Saved games:** `save` (use `compact: true` for analysis games: about a tenth of the size), `saves`, `save`, `load_save`, `end_game`, `rename_save`, `delete_save`, `prune_saves`. Every saved game sits inside the account's one database document, so `storage` in the saves list says how much room is left and a save past the budget is refused. **An agent that saves many games cleans up afterwards**: at most 100 saves stay (`storage.keepAtMost`), the important ones.
