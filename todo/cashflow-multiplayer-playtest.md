# Cashflow multiplayer - playtest checklist

The first time the table screens meet a real server and real browsers. Use the local self-hosted stack (`mm-local-selfhosted`
skill: `scripts/local-env.ps1 up`, app on `:8080`, game password `localtest`) with **game accounts only** - a normal account must
never see any of this. Two to four people (or one person with several browsers / private windows) is enough to start.

Write down anything that looks wrong, with what you did just before it. Known gaps are listed at the end so they are not reported
as bugs.

## Start here: the 30-minute path (alone, with bots)

You do not need friends for the first look. One browser, one game account, bots as the other players.

1. Register `solo@cashflow.test` (any password) with the game password `localtest`, log in.
2. Menu -> "Multiplayer" -> **Open a table**: name "Test", 4 seats, public, no clock, first to escape. Nickname: anything.
3. In the table's lobby: **Add a bot** three times - pick _Lucky Lena_ (master), _Allie All-Round_ (casual) and _Sleepy Sam_
   (master). Look at the skill menu and the descriptions.
4. Press **Ready**, then **Start the game**, pick a profession.
5. Play your turns: roll, draw a card, buy or pass, pay Doodads. Watch the bots move **by themselves, one step at a time, about a
   second apart**; open each player's tab in "Look at a player".
6. Play to the end (or until you have seen a Market card, a sale and a payday). Press "Save to my games".

If something looks wrong, write down: what you pressed, what you expected, what happened. Then use the sections below for the
rest.

## Start here (2026-10-17): the game is played in the solo game's own screen

The lobby (`Multiplayer`) is only for opening, joining and setting up a table. Once the game runs you are **in the Cashflow
Game screen**: it opens by itself (Friends in the menu takes you straight back into your running game; "Table lobby" in the bar on
top goes to the lobby). Same roll button, same card screens, same Grow page, same History as the solo game - plus:

- [ ] **The bar on top**: whose turn, the round, the clock, every player as a chip (tap one to look at their books - dashboard,
      Grow, subscriptions - read only; "Back to my books" returns).
- [ ] **The other players' turns are told round by round**: their dice tumble, their token walks space by space, the card they
      draw is shown with its numbers, what they pay or get appears as a patch (Payday +, Doodad -).
- [ ] **End turn / Continue** sit where the roll button is: once your space is settled the roll button becomes **End turn** and
      the bot or the next player waits for it (you can still borrow, repay or roll the die of a card first). Somebody a Market
      card or a stock price card lets sell sees **Continue** (and the buyers' offers in the bar) - nobody else has anything to
      confirm. The button is not usable while the last move of somebody else is still being told.
- [ ] **Pace**: the host chooses fast / normal / slow when opening the table: the bot's step every 1.5 / 3.5 / 6 s, the telling follows.
- [ ] **Looking at a player**: the blue highlight follows the chip you pressed; their dashboard, Grow, Subscriptions, Balance ... are
      readable, but there is no dice, no card button, no Bank loan, no Add (+); the board does not change.
- [ ] **History survives**: leave the table (Table lobby), open it again: the whole history is there.
- [ ] **Remove table** (host only, for now): the bar's "Remove table" or the bin in the lobby's "My tables": closed for everybody and deleted.
- [ ] **Resign** replaces "Reset game": you give up the seat and lose, the others play on.
- [ ] **Your own card, as in solo**: Open the card -> pick Small/Big Deal -> **Plan this** -> the Grow page opens on the planned
      project (set the share count) -> **Buy** there -> back in the game. "Sell to a friend" offers it to the table.
- [ ] **History** is everybody's moves, newest first (who, what, dice, card).
- [ ] **Undo is a vote**: "Undo" asks the table; it happens when more than half of the people say yes (Yes/No in the bar). The
      host can switch undoing off when the table is opened.
- [ ] The normal pages (Home, Subscriptions, Grow ...) show the table character's books while a game runs, and nothing you do
      there touches your own account; "Table lobby" reloads the app on your own account.

Sections 3-5 below describe the older table page (still there for spectators and as a fallback).

## Since 2026-10-18: what to look at first on the real server

The things built after the first playtest. Tick them on the Pi (or the local stack) before telling anybody else.

**Lobby and the plus button**

- [ ] Multiplayer shows the buttons, then _My tables_ (only when you have some, private ones marked), _Open tables_, _Recent tables_
      (collapsed), _Join with an invite code_. No "Start or join" heading.
- [ ] _Open tables_ shows the newest five and scrolls for the rest; every table says when it was opened.
- [ ] The **+** in the top bar opens _New table_ with all the settings; opening one goes to it. A private table you open shows in _My tables_.
- [ ] **Initials**: type two letters in the lobby (or in New table), join: your token shows them for everybody. Empty: the first two
      letters of your name. They are still there after a reload.

**While playing**

- [ ] **Latest** (the line under the bar) never runs ahead: after your roll it first says the dice, and "-> market" only when your
      token has landed; another player's move appears when its telling reaches it.
- [ ] A Market cost card, a share price card of a bot (you hold the share): you can only **sell** at that price, also off your turn; there is no Buy button (only the player who drew the card can buy).
- [ ] A planned deal you did not buy (the card is settled) goes from _Plan_ to _Completed_ in Grow; drawing the card again makes it _Plan_.
- [ ] The winning move (a buy on the Grow page that gets you out) brings up the game dashboard with the result by itself.
- [ ] The **Repay** button on the dashboard says how much is owed. The stats page redraws after a Payday or a Doodad you pay.
- [ ] The cashflow entry of the menu says **Solo** with nothing loaded and **Cashflow Game** with a game loaded; leaving a table (Table
      lobby) unloads it, a solo game can be started and saved, and the table can be joined again.
- [ ] Drawing a card shows the shuffle, then the card pops up; the token on the move glows in its own colour.

**Rating and bots**

- [ ] _Add a bot_ shows each bot's rating for the chosen skill level ("... - Hard - 1650").
- [ ] After a **ranked** game with at least 8 rounds the game-over panel says how your rating moved; _Leaderboard_ shows you only after
      you switched "Show me on the leaderboard" on; bots appear after their first rated game.
- [ ] The manual has a chapter **Scoring and the leaderboard** in your language.

**Profile picture**

- [ ] Settings > Edit profile: choose a picture, it is on the top-left of every page at once; Remove brings the default back.
- [ ] A listed person's picture is in the leaderboard row and in their card. A normal (non-game) self-hosted account can set one too.

## 1. Before anyone sits down

- [ ] Log in with a **normal** account: no "Multiplayer" entry in the menu; `/tables` shows "game accounts only" (403), and
      the rest of the app is unchanged.
- [ ] Log in with a **game** account: the menu shows the entry, and it opens the lobby.
- [ ] Switch the app language (en/de/es/fr/cn/ar): the lobby, the table and the cards follow; Arabic reads right-to-left.

## 2. Lobby

- [ ] Open a table (public, 4 seats, no clock, first to escape). Your invite code is shown.
- [ ] A second account sees it under open tables, joins, and the host sees them arrive.
- [ ] A third account joins with the invite code only (make that table private).
- [ ] Ready / not ready toggles show for everyone at once. The host cannot start until two or more are ready.
- [ ] Leave and rejoin: your seat is kept or freed as expected.

## 3. Picking and the first turns

- [ ] Everyone picks a profession (also try "random"); the picks stay hidden until the last one is in.
- [ ] The game starts: one token per player at START, each with its own colour and letter.
- [ ] The player on the move sees "Your turn" and Roll; the others see whose turn it is and no buttons.
- [ ] A roll moves only that token; the others see it move without reloading.
- [ ] A payday is paid when a token passes it.

## 4. Cards

- [ ] Deals space: draw Small or Big; everyone can read the card; only the player on the move gets Buy / Pass.
- [ ] Buying a share asks for a count; buying twice with one card is refused.
- [ ] Doodad: Pay works; a refused move shows the server's own words.
- [ ] Market space: the card is drawn at once and hits everyone it applies to; owners of a matching property see "Offers for you"
      and can sell **on or off their turn**; the offer is gone after the sale.
- [ ] A player cannot sell without a card on the table.
- [ ] Offer the Deal card in hand to the table at a price: others can take it, counter, or decline; the seller can accept a
      counter. Nothing moves until both agree. Shares cannot be offered.
- [ ] Bank loan: take one and repay it.

## 5. Looking at the others

- [ ] The standings update after moves; click each player's tab and read their income statement and balance sheet.
- [ ] The feed shows what happened, in your language, newest first.

## 6. Time and presence

- [ ] Start a table with a per-move clock (30-60 s). The bar empties and turns red in the last 10 s.
- [ ] Let one turn run out: the server plays the most passive move (roll, pass the card), and the feed says so.
- [ ] Time out twice (or the host's setting): the player is marked away, their turns play at once, "I'm back" returns them.
- [ ] A bank clock shows each player's bank; the one on the move runs down.
- [ ] Host pauses: the clock stops, nobody can move; resume gives the time back.
- [ ] Switch to another tab on your turn: the tab title says "● Your turn". Press "Notify me" and check a notification arrives
      when the tab is hidden.
- [ ] Switch the network off for a few seconds, then on: the reconnect banner appears and goes, and the table catches up
      (nothing missed, nothing doubled).
- [ ] Close the browser and come back to `/tables`: "My tables" shows the running table and it opens where it was.
- [ ] Try it on a phone: nothing scrolls sideways, the buttons are easy to hit.

## 6b. Bots

- [ ] The host sees "Add a bot" in the lobby (a guest does not). The menu lists the characters with a level and a one-line
      description, plus the skill menu (master / strong / casual / beginner).
- [ ] A bot shows with a robot marker in the lobby and at the table; the host can remove it in the lobby ("Remove").
- [ ] The bot is always ready; the game does not start while a human is not ready.
- [ ] The bot picks its own profession (and, if you chose a profession for it through the API, that one).
- [ ] A bot's turn plays by itself, step by step, with a short pause - roll, card, buy or pass - and every step appears in the feed
      and in "Look at a player" like a person's.
- [ ] A bot sells into a Market offer on its own (watch the feed after a Market card).
- [ ] A **beginner** bot makes visible mistakes (passes good deals, pays what it could skip, forgets to repay the loan); a
      **master** bot (Lucky Lena, Stock Sasha, Champion Cleo II) is hard to beat. Play one table against masters only.
- [ ] A bot never shows an account or an id anywhere (the feed, the standings, the network tab).
- [ ] With the per-move clock on (30 s): a bot never runs out of time; a person who does is played for by the server.
- [ ] Reload the page in the middle of a bot's turn: the table comes back and the bots go on.
- [ ] Restart the backend container (`podman restart mm-local-backend`) with bots at a running table: the table survives and the
      bots go on after a few seconds.
- [ ] **Doodads:** at a table you cannot pass a Doodad (no pass button; the game asks you to pay) under the guided _and_ the strict
      rules. In the solo game you still can.
- [ ] The lobby's "How it works" link opens the Cashflow manual; its last six sections (24-29) describe tables, the clock, selling
      and trading, bots and champions, how the champions were found (with two tables of numbers) and playing with an agent.

## 7. The end

- [ ] First to escape: the game ends, everyone sees the ranking and the reason.
- [ ] "Save to my games" files your own final books; a second press does not file it twice; the game shows in the saved games.
- [ ] The host can rewind the last turn (via the API or an agent, not in the screen yet) and everyone sees it.

## 8. Agents

- [ ] An agent (MCP) takes a seat at a table with people **and bots**, plays only from `legalActions`, and the others see its moves
      like any player's. (`table_bots` lists the bots, `table_add_bot` seats one with a `level`.)
- [ ] Ask the agent to beat the bots: it should play by the rules; check that it cannot pass a Doodad and that a refused move
      comes back with the rule's own words.

## Known gaps (not bugs)

- No printed card flavour text from the solo game's catalog at the table; no "what would this do" preview before buying.
- Trade offers go to the whole table (the API can target one player).
- No per-player profession card or history list; properties count at the deposit paid on the balance sheet.
- Host controls in the screen: start, leave, add/remove bots. Kick of a person, settings changes and rewind are API-only for now.
- The countdown uses your device's clock against the server's deadline (display only; the server decides timeouts).
- es/fr/cn/ar wording needs a native review.
- No replay viewer, chat or friend list (Phase X).
- Bots: the character names and descriptions are English only (they come from the server); bot move timing is a fixed 1.2 s.
- Counting cards is possible for people and agents (the piles are public) but the bots do not use it - it gave them no edge.
