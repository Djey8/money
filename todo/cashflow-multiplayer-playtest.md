# Cashflow multiplayer - playtest checklist

The first time the table screens meet a real server and real browsers. Use the local self-hosted stack (`mm-local-selfhosted`
skill: `scripts/local-env.ps1 up`, app on `:8080`, game password `localtest`) with **game accounts only** - a normal account must
never see any of this. Two to four people (or one person with several browsers / private windows) is enough to start.

Write down anything that looks wrong, with what you did just before it. Known gaps are listed at the end so they are not reported
as bugs.

## 1. Before anyone sits down

- [ ] Log in with a **normal** account: no "Play with friends" entry in the menu; `/tables` shows "game accounts only" (403), and
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

## 7. The end

- [ ] First to escape: the game ends, everyone sees the ranking and the reason.
- [ ] "Save to my games" files your own final books; a second press does not file it twice; the game shows in the saved games.
- [ ] The host can rewind the last turn (via the API or an agent, not in the screen yet) and everyone sees it.

## 8. Agents

- [ ] An agent (MCP) takes a seat at a table with people, plays only from `legalActions`, and the others see its moves like any
      player's.

## Known gaps (not bugs)

- No printed card flavour text from the solo game's catalog at the table; no "what would this do" preview before buying.
- Trade offers go to the whole table (the API can target one player).
- No per-player profession card or history list; properties count at the deposit paid on the balance sheet.
- Host controls in the screen: start, leave. Kick, settings changes and rewind are API-only for now.
- The countdown uses your device's clock against the server's deadline (display only; the server decides timeouts).
- es/fr/cn/ar wording needs a native review.
- No replay viewer, chat or friend list (Phase X).
