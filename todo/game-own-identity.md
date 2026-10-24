# Making the game completely our own

Status: **planning only** (2026-10-25). Nothing in the code has been renamed or removed. The classic content stays as it is, for testing and
the whole flow, until the own version can replace it. Tomorrow JFK gives the detailed plans (board, cards, characters, missions, win
condition); this document is the analysis they start from, and the questions they have to answer.

> Not legal advice. It lists what I can see in the code and what is generally known about protecting games. Before the game is sold,
> a lawyer who knows games / IP (Germany and the EU first, then the US) has to look at the finished own version, and the new name needs a
> proper trademark search.

---

## 1. What the game takes from the physical game today

The solo and multiplayer game is a digital version of the board game _Cashflow_ (the German box "Cashflow - Verlasse das Hamsterrad!"). It
is built to be that game, so the overlap is large and in four different layers. They are not equally risky.

| Layer                   | What is in the code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Where                                                                        | How close to the original                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| **Name and vocabulary** | "Cashflow" as the name of the game (menus, routes, API paths, MCP tools, docs, the game password mechanism, even the e-mail rule: an address with `cashflow` in it is a game account), "Rat Race" (89 files), "Fast Track", "Doodad" (230 files), "Payday", "Big Deal / Small Deal", "Market", "Downsized", "Charity", "Baby", "Rich Dad / Poor Dad" in the docs and the manual (12 files)                                                                                                                                          | everywhere; `cashflow-game` appears in 235 files                             | exactly the original's words               |
| **Board**               | A ring of 24 spaces in the order of the printed board: `CLASSIC_LAYOUT` (deal, doodad, deal, charity, deal, payday, ...), with the three Payday, three Market, three Doodad, one Baby and one Downsized space where the board has them. The file itself says it was transcribed from a picture of the German board                                                                                                                                                                                                                  | `packages/domain/src/cashflow-game/board.ts`                                 | a copy of the layout                       |
| **Rules**               | Roll 1 die (2 under Charity), walk the ring, Payday adds income minus expenses, a Doodad is paid, a Market card affects everybody, a Baby adds a child (max 3) and an expense, Downsized pays every expense once and sits out, Charity costs 10 % of the income, the rat race is escaped when passive income covers the expenses, the Bank loan in steps of 1,000 at 10 % a month                                                                                                                                                   | `engine.ts`, `turn.ts`, `rounds.ts`, `loan.ts`, `game-end.ts`, `movement.ts` | the rules of the game, played the same way |
| **Content**             | About 110 printed cards: 23 small deals, 6 big deals, 42 doodads, 39 market cards, with their texts in six languages (`classic-deal-small.ts`, `classic-deal-big.ts`, `classic-doodad.ts`, `classic-market.ts`, `src/assets/i18n/cashflow-cards/*.json`); the share names OK4U, ON2U, MYT4U, GRO4US (and the like); the property cards with the printed prices and numbers; 12 professions with the printed salary, expense lines and starting cash (`cashflow-content.ts`, set id `cashflow`, "Classic Edition"); the starter kits | `classic-*.ts`, `cashflow-content.ts`, `src/assets/i18n/cashflow-cards/`     | transcribed from the physical cards        |

What the code does **not** take: the artwork, the box, the logo, the board's picture. The own screens are original.

Other things that look like the original but are only ours: the second game set `custom-jfk` (three professions of ours), the table
engine (online play), the bots and their ratings, the leaderboard, the Pro API and the MCP tools. Those are the product; they stay.

### The app's own concepts have the same question

The _money app_ around the game uses the buckets **Daily, Splurge, Smile, Fire, Mojo** with the split 60/10/10/20, and **Grow** for investing.
To my knowledge these come from Scott Pape's book _The Barefoot Investor_ (Daily Expenses, Splurge, Smile, Fire Extinguisher, Mojo) and
from the Rich Dad books. The project's own instructions say so. This is not part of the game plan, but it is the same kind of risk the
moment the app is sold or advertised with these names, so it belongs on the list: own names (or a clear licence) before monetizing.

---

## 2. What is protected and what is not (the short, careful version)

- **Rules and mechanics** (roll, move, collect, pay) are in general **not** protected by copyright. Many countries say so explicitly; the
  protected part is the _expression_: the text of the rules, the card texts, the art, the layout as a work. A game that plays "like"
  another is normal (hundreds of roll-and-move economy games exist).
- **Names, logos, slogans** are protected by **trademark law**. "Cashflow" is, to my knowledge, a registered trademark of the Rich Dad
  company for the game and for related goods. That makes the name the most dangerous single word in the whole project, and it is in the
  app's name for the game, in URLs, in the API, in the MCP connector. A trademark claim is also the cheapest for the other side to make
  (a takedown at an app store, a cease-and-desist, a domain claim) - and monetizing is what makes them look.
- **Card texts, profession cards, the printed numbers together with the names** are the _expression_ of a specific game and can be
  copyright (and, as a collection, database) protected. The classic cards in the code are a transcription: for a private test that is
  one thing, for a product it is another.
- **Look and feel / trade dress**: a ring board with those spaces in that order, plus those card kinds, plus the profession cards, taken
  together is what makes a copy recognisable. Each single part may be harmless; the sum is the fingerprint.
- **Words that are fine on their own**: Payday, Market, Deal, Baby, Charity, Doodad are ordinary words - but "Doodad" in a money game and
  "Rat Race" for the loop are the vocabulary of the books and the game, and the combination with the rest is what points to it. Safe
  approach: do not keep them.
- **Do not**: use the old name in the store listing, the keywords, the domain, ads ("like Cashflow"), or in the MCP / API names that
  are public; copy card texts; keep the exact profession figures; keep share tickers.

Practical rule for the own version: **different world, different words, different numbers, different board, different art - same
engine.** The more the content comes from our own tools (generators, our own design), the less any claim can say it was copied.

---

## 3. Keyword and identifier audit - what to change, when

_Now_ = the word is visible to players or outside the code (listing, API, docs). _Later_ = internal identifier, can wait until the
rename is decided, then one mechanical pass.

| Term                                                                            | Where it is                                                                                                                                                                                                                                                                                                                               | Action                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Cashflow" as the game's name                                                   | UI texts (`CashflowGame.*` i18n keys: 439 per language), menu entries, the page title, the docs and the manual, MCP connector "Agent Cashflow Game", tool `play_cashflow_game`, API paths under `/game/...`, the registration rule (email contains `cashflow`), env `CASHFLOW_GAME_PASSWORD_SHA256`, route `cashflow-game`, folders and files | **Now**: pick the new name and change every visible string, the connector and tool names, the docs. **Later**: identifiers, routes, the e-mail rule, env names. Note: "Cashflow" as an _accounting_ word (the Cashflow page, monthly cashflow) is generic and stays. |
| "Rat Race"                                                                      | board, texts, bots' descriptions, manual, i18n                                                                                                                                                                                                                                                                                            | **Now** replace with the own concept (the loop / the treadmill / the "daily grind" - decided with the board)                                                                                                                                                         |
| "Fast Track"                                                                    | docs, notes (not implemented: "outer Fast Track is out of scope")                                                                                                                                                                                                                                                                         | do not build it under that name; design the own second phase                                                                                                                                                                                                         |
| "Doodad" / "Schnickschnack"                                                     | `classic-doodad.ts`, the Doodad pile, board space kind `doodad`, texts                                                                                                                                                                                                                                                                    | replace by the **Emergency / Dream** system (see 5): no "doodad" anywhere                                                                                                                                                                                            |
| "Big Deal / Small Deal", "Deal" cards, "Market" cards                           | piles, board spaces, texts                                                                                                                                                                                                                                                                                                                | own concept: investments as _offers_, opportunities; market events as _news_ - names decided with the cards                                                                                                                                                          |
| "Baby", "Charity", "Downsized", "Payday"                                        | board space kinds, the turn engine (`rounds.ts`)                                                                                                                                                                                                                                                                                          | **Now** (visible words). **Later** (engine): replace the fixed enum by a **life event** registry (see 5)                                                                                                                                                             |
| Professions (Janitor/Teacher/Doctor ...) and their numbers                      | `cashflow-content.ts`, `classic-*`, i18n                                                                                                                                                                                                                                                                                                  | the job titles are generic, **the printed figures are not ours**: new **characters** with own numbers and own stories                                                                                                                                                |
| Share names and tickers (OK4U, ON2U, MYT4U, GRO4US ...), the card flavour texts | `classic-*.ts`, `symbols.ts`, i18n                                                                                                                                                                                                                                                                                                        | replace with an own world (own companies, own assets)                                                                                                                                                                                                                |
| Property types and numbers ("3Br/2Ba house for 45k/2k down" and the like)       | `classic-deal-*.ts`, EFH/ETW/MFH symbols                                                                                                                                                                                                                                                                                                  | own assets, own price ranges, generated by a tool                                                                                                                                                                                                                    |
| "Rich Dad", "Poor Dad", "Kiyosaki", "Cashflow 101"                              | docs, manual, marketing notes, the instructions panel (`instructions.component.html`) and the i18n files of the app                                                                                                                                                                                                                       | remove from everything public; in internal notes they may stay as history                                                                                                                                                                                            |
| Board layout (24 spaces, picture of the box)                                    | `board.ts`                                                                                                                                                                                                                                                                                                                                | new board(s): see 5 (figure-eight, snake, branching)                                                                                                                                                                                                                 |
| Barefoot-Investor names (Daily/Splurge/Smile/Fire/Mojo, 60/10/10/20)            | the whole money app and the game's dashboard                                                                                                                                                                                                                                                                                              | own names for the buckets before monetizing (decide with the game's world)                                                                                                                                                                                           |

Files that have to go through a rename pass (internal, mechanical): `packages/domain/src/cashflow-game/**` (about 70 files), `.../table/**`,
`src/app/main/cashflow-game/**`, `src/app/tables/**`, `backend/routes/game-*.js`, `backend/services/game-*.js`, `apps/mcp/src/tools/*game*`,
`docs/domain/CASHFLOW_*.md`, `docs/api/*`, the i18n files (`CashflowGame.*`), the Playwright and unit tests.

---

## 4. A name for the game - ideas

Criteria: short, easy in German and English, not a word the physical game or its books use, says "escape / freedom / flow", is free as a
domain and as a trademark in games (Nice classes 9, 28, 41), and works for a money-app family. **Every name below still needs a real
search (DPMA / EUIPO / USPTO, TMview, the app stores, domains)** - I cannot check any of them from here.

| Idea                                 | Feel                                                         | Note                                                                           |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **Breakaway**                        | leaving the pack, the escape                                 | simple; very likely used by other games - search first                         |
| **Exit Lane**                        | the lane out of the loop                                     | short, visual (lanes on the board); maybe already a game                       |
| **Slipstream**                       | running ahead in the wind of passive income                  | nice metaphor for compounding; used for other products                         |
| **Runway**                           | financial runway = the months you can live; take-off         | strong with the Mojo (3x expenses) idea; very common word                      |
| **Freewheel**                        | the bike that keeps going without pedalling = passive income | German "Freilauf"; likely taken in some class                                  |
| **Long Way Out**                     | the road out                                                 | storytelling; a phrase, easier to protect than a single word                   |
| **Compound** / **Compound Quest**    | compounding as the quest                                     | clear for money people; "Compound" is a common word                            |
| **Escape Velocity**                  | physics: the speed to leave                                  | good for the "passive income covers expenses" moment; certainly used elsewhere |
| **Mojo Road**                        | from the buckets of the app                                  | links to the app, but "Mojo" is the Barefoot name                              |
| **Pocket Garden** / **Money Garden** | grow things with patience                                    | different from the "race" tone; fits Grow/Smile                                |
| **Tinder & Spark** (fire)            | build the fire that keeps burning                            | a stretch; fits the Fire bucket                                                |
| **Moneyline** / **Cashline**         | a line you walk                                              | too generic                                                                    |
| **Daily Escape**                     | the Daily bucket plus escape                                 | works as a subtitle                                                            |
| **Loopbreaker**                      | breaking the loop                                            | clear and own; check games                                                     |
| **Nestwerk** (DE) / **Nest Egg Run** | nest egg                                                     | warm, DE-first; "Nest Egg" is a phrase in many names                           |

My three to search first: **Loopbreaker** (own word, tells the story), **Long Way Out** (a phrase, easy to protect, storytelling), **Slipstream**
(good metaphor, needs the search). Keep the _classic_ version under no public name at all.

---

## 5. How the game has to change so that it is really ours (architecture)

JFK's ideas, translated into what the code must be able to do. Each is a piece of work in its own right.

### 5.1 Boards (not one ring)

Today the board is an array in a ring and `moveToken(board, from, total)` is modular arithmetic (`board.ts`, `movement.ts`); the table, the
screens, the bots and the history all read `boardPosition: number`. For a figure-eight, a snake, forks, shortcuts:

- The board becomes **data**: a graph (spaces, links, optional direction, optional "choose a way" spaces), a _layout_ for drawing (ring,
  infinity, snake, free coordinates) and a _kind_ for each space. The ring is the simplest graph.
- A move is a **walk of N steps along links**; at a fork the player **decides** (a new pending decision, like the dice choice under
  Charity) - or the board fixes it.
- The game screen's ring component (`app-rat-race-board`) draws from the layout; it must not know "24 spaces".
- Several boards, chosen per table or per mode; a board has an `id` and a version (results and the leaderboard refer to it).

### 5.2 Space kinds and events - a registry instead of a fixed list

`RatRaceSpaceKind = 'deal' | 'doodad' | 'payday' | 'market' | 'charity' | 'downsized' | 'baby'` is a closed union that the engine,
the turn, the legal moves, the bots and the screens switch on. Replace it by **event definitions** (data + small effect functions):

- `trigger`: a space kind, a card draw, a calendar month, a random roll;
- `choices`: e.g. **pay now** / **payment plan from the bank** / **ask a friend**, each with its effects;
- `effects`: cash, a subscription (monthly expense or income), a status (sits out, extra die), a mission step;
- optional **links into the app**: an emergency draws from the **Fire** page (plan, amount, schedule), a dream is a **Smile** project
  paid by a monthly subscription, a buffer is the **Mojo**.

This is the heart of "the app is the game": the cards are not decoration; each fills out one of the app's components.

### 5.3 Emergencies, dreams, the buffer - the app inside the game

- **Emergency** instead of Doodad: an event with an amount; the player may pay it, or take a _payment plan_ (the app's subscriptions
  already do that: a monthly line that ends when paid; the bank plan is an interest-bearing liability). Unpaid emergencies can compound.
- **Dream** (Smile): a big wish card the player cannot afford yet; they open a Smile project, schedule it, pay with a monthly subscription;
  delivery makes a bonus (happiness / mission progress) - the opposite of a cost.
- **Mojo**: the buffer, always **3x the monthly expenses** (the rule changes when expenses change); filled before certain missions; spendable
  once full - the engine needs `mojoTarget = 3 * monthlyExpenses` as a derived value (the app's Mojo page has a fixed target today).
- **Grow**: investments are the app's Grow projects (already: the game's "Grow" bridge); the own assets have to map onto it.

### 5.4 Characters, missions, win condition

- **Character** replaces profession: story, salary, expenses, starting kit, a **personal mission list**, a special ability or weakness.
- **Missions**: a list of steps ("fill the Mojo", "pay the car loan off", "own two income streams") that unlocks the win; some are
  common, some per character.
- **Win condition**: not only "passive income >= expenses". A rule set combining missions + Mojo + passive coverage (the table engine
  already has `endCondition`, `checkEnd`, ranking; missions plug in there).
- Everything in `game-end.ts`, `rankPlayers`, the leaderboard's outcome words (`escaped`) depends on the one condition: it needs a
  `goal` abstraction (progress 0..1 + done?).

### 5.5 Content as packs

One **game pack** = board(s) + event definitions + decks + characters + missions + texts (six languages) + a version and a
`licence/origin` flag. The engine loads a pack; the classic set becomes a pack flagged `internal: true` that is never shipped. Then:

- a **release guard** like the edition guard: the build fails if a pack with `internal: true` (or any `classic-*` id) is in the
  shipped bundle, the API docs, the MCP tool texts, or the i18n files;
- the strategy lab, the champion search and the bot ratings run per pack (they are measured on rules and content; a new pack means new numbers
  - the freshness checks already exist);
- the leaderboard and ratings carry the pack id (a rating on the old game is not a rating on the new).

### 5.6 Bots

The strategies talk in terms of properties, shares, MLM, loans, Doodad pass/pay. They need the **generic actions** of the new game
(invest, borrow, pay now/plan, choose a way, buy a dream, work on a mission) and a vocabulary of "what a card offers" (cost, yield, risk,
duration) - then the same style differences (careful, banker, gambler ...) can be written once and apply to every pack. The calibration
and champion search carry over.

### 5.7 What stays untouched

The table engine (queue, rewind, clocks, away players, spectators), the API, MCP, the Pro features, accounts and encryption, the
leaderboard and rating maths, the local stack and the tools, the money app (budget, locations, subscriptions ...). The renames are
mechanical; the redesign is in the _content_ and in three engine seams: board, events, goal.

---

## 6. Order of work (proposal)

1. **Decide the name and the world** (JFK) - then the visible rename: UI strings, the connector and tool names, the listing, the docs.
   Cheap, and the biggest legal win (trademark).
2. **Fence the classic content**: flag it `internal`, add the release guard, take it out of the manual, the MCP resources and the public
   docs. The own game can keep running on it in the meantime.
3. **Seam 1: events registry** (replace the fixed space kinds; baby/charity/downsized become definitions of the classic pack - behaviour
   unchanged, tests prove it).
4. **Seam 2: board graph** (the ring as one board; then the figure-eight and the snake; fork decisions).
5. **Seam 3: goal / missions** (the old win as one goal; then missions and the Mojo rule).
6. **Pack 0 of our own**: one board, one character, ~20 cards, to play end to end with bots; then the lab and the ratings.
7. Content in volume (characters, cards, texts in six languages), art, sound; then the lawyer's review and the trademark filing before
   the first paid release.

Each step is playable at its end (the classic pack keeps working until step 6 replaces it).

---

## 7. What I need from JFK tomorrow

Board and flow:

1. Which boards first: the figure-eight (a crossing in the middle - who goes first through it?), the snake (one way? back and forth?), the
   ring? Fixed number of spaces or varying? Do tokens block each other?
2. How many players, solo vs. table: the same board for both?
3. A turn today is: roll, move, one space effect, Payday on the way. What is the own turn? (Dice or cards or both? Choices before the roll?)

Events and money: 4. The list of life events you want (emergencies, windfalls, dreams, job changes ...): triggered by a space, by a card pile, or by the calendar
(the game month)? How many a game? 5. Emergency: _pay now / payment plan / ask a friend_ - what are the exact terms of the plan (interest, length)? Can an emergency be skipped? 6. Dream (Smile): who decides the amount, is it random per character, is it a mission or an optional bonus? 7. Mojo: 3x the monthly expenses - is it a requirement to win, to take risks, or only a buffer to spend? Does it shrink when it is used? 8. Money units: keep real currencies with a generated economy or a game currency? (The app's amounts are real money formats.)

Characters and goal: 9. How many characters at the start, what makes each unique (ability, weakness, mission list)? 10. The win: all missions? Passive income as well? A score for ranked tables (not everybody escapes)? 11. Are there goals that need other players (trade, deals, help)? The offers system exists - keep and extend?

Product: 12. The name candidates you like; the tone (serious money coach, light family game, competitive). 13. Is the money app's own naming (Smile/Fire/Mojo ...) staying or becoming own words together with the game? 14. What about the leaderboard history and ratings built on the classic game - restart per pack, or keep as "season 0"? 15. Languages for the first release (six now) and art style (flat, illustrated, minimal?).

---

## 8. Risks I would not skip

- The longer the classic transcription stays in the shipped code, the more there is to defend; fence it now (step 2) even though
  it is "only" for tests.
- Do the visible rename **before** any public marketing, listing, domain purchase or social handle with the game's name.
- Keep the old `custom-jfk` set only if its numbers are ours (the three professions are; the card piles are the classic ones).
- A trademark search for the new name before art and domain money is spent; a single-word generic name is hard to protect, a coined word
  or a phrase is easier.
- Print / board-game side (not planned): a physical product multiplies the exposure; own board art, own box.
