# Solo mode - manual playtest checklist (slice C7)

No Playwright for this (dev-cycle rule: reserved for deliberate one-off debugging). Play it on a phone and on a desktop,
in light and dark, with a cashflow account on the self-hosted edition. Tick what works, note what does not.

## Start

- [ ] New game: after the profession, the language question also asks _how to play_; "With the physical board" is
      pre-selected and plays exactly as before.
- [ ] The last row of the dashboard is a red **Reset game** (the same row design as My games, red text and border): it asks first, then wipes the game (nothing is saved) and
      the panel shows the start panel again.
- [ ] Delete buttons in the games list are red like the other delete buttons (and the bin on each row too).
- [ ] Every game in the list has a bin; it asks the normal delete confirmation, and the game is gone afterwards.
- [ ] On the start screen your old games are **not** listed; a "My games" button below Start opens just the list
      (played and ongoing games, with Import), and a game can be continued from there.
- [ ] "Solo in the app" starts the game; the dashboard shows the ring, the token at START and a Roll button - and no
      Payday button and no "which space did you land on" grid.

## Rolling

- [ ] Roll: the dice tumble (slowly enough to see) and then rest on their number; a beat later the token walks space by
      space; the moment the totem is on its tile the dialog or the action appears (no extra wait); Skip jumps ahead.
- [ ] Coming back to the dashboard (from a card, or after a reload) shows the dice still on the last number - no replay.
- [ ] **The very first roll pays your first Payday** (savings plus one Payday), whatever you roll.
- [ ] A Payday (passed, landed on, or the opening one) shows a compact info box at the top of the dashboard (like the
      "card does not apply" notice, with an X) with income, expenses and the monthly result - each amount with one sign - and it goes with your next action (any tap) or the X.
- [ ] A market card's "does not apply" notice goes the same way, with the next action.
- [ ] **Nothing of a roll shows before the totem is on its tile**: Charity's two-dice choice, the new child, the spanner and
      the cash change only once the animation has settled (the Payday box still comes as the totem passes its tile).
- [ ] The MLM roll dialog appears only **after the totem has finished moving** (not while it is still walking).
- [ ] Selling a property to a market buyer books exactly what the card says: e.g. a 2.000 deposit with +10.000 profit
      books **12.000** (the Amount field shows the 10.000 profit, the dialog adds the deposit back) - not 14.000.
      Same for a **percent** buyer (e.g. +20 % on a 70.000 property with 10.000 deposit: 24.000, not 34.000).
      Same for every property buyer: fixed profit, the **condo (Wohnung)** fixed price, the **apartment complex** price per unit.
- [ ] A won MLM roll books the bonus on the **Income** account (not Daily), one transaction per kept card.
- [ ] With a kept MLM card, a Payday shows its box, **stays while you press the MLM roll**, and the outcome (the bonus, or
      not) appears as a second info box next to it; the next action clears both.
- [ ] The dice are thrown (bounce and turn), the faces slow down, they land with one pop and then rest still.
- [ ] A first roll of 1 lands on the Deals space next to START; a 6 lands on the first Payday.
- [ ] Passing a Payday pays it (round goes up, Payday lines appear in Transactions); landing on one pays it once.
- [ ] Landing on Downsized (or Charity) with too little cash takes the Bank loan first, then pays - the balance is never
      negative, and a message says what was borrowed.
- [ ] Under Charity **two dice are selected by default**; switching to one dice works; a later Charity space selects two again.
- [ ] Bank loan / Payback loan: the steps field starts at 1 every time the screen opens, and again after a settle (it
      does not keep the 2 of "settle all").
- [ ] Baby adds a child (a fourth Baby space does nothing); Charity donates and offers 1 or 2 dice for 3 turns, then
      back to one die; Downsized pays the expenses and the spanner goes at the next roll.
- [ ] With "reduce motion" on, the token jumps instead of walking.

## Cards

- [ ] Landing on Deals shows "You landed on Deals" with Open the card / Done / Pass - the card does **not** open by
      itself; Open the card asks for the Small or Big pile, then the usual find-or-draw flow; Doodad and Market open theirs.
- [ ] "Sell to a friend" is offered on property and asset cards, **not on share cards**.
- [ ] Before the first roll the totem waits outside the ring at the top middle with "START" below it (no line); with
      the first roll it moves inside the ring and goes round the tiles, and "START" is gone.
- [ ] The card screens (Deals pile choice, and the Deal / Doodad / Market card lists) show the tile symbol with its
      coloured border at the **right end of the heading**, so you see which deck you are in.
- [ ] While the card is open the Roll button is gone; "Open the card" reopens it after closing it; "Done" and "Pass"
      reopen the roll.
- [ ] Undo after Pass brings the card back; Undo after a roll takes back the move, the Paydays and the landing together.
- [ ] Reload the page in the middle of a turn: token, dice and the open card are still there.

## The end

- [ ] Buying enough passive income ends the game as escaped (the end screen shows the numbers); a negative monthly
      cashflow ends it as bankrupt; nothing can be rolled afterwards.
- [ ] "Save game" and "New game" on the end screen work; a saved solo game loads again with its token and turn.

## Screen sizes (responsive pass, 2026-10-06)

Reviewed with screenshots at 375 x 667 (iPhone SE, the baseline), 320 x 568, 390 x 844, a phone on its side (667 x 375),
a tablet (768 x 1024) and 1440 x 900. Please check on your own devices - dark mode and Arabic (right to left) were not
part of the screenshots.

- [ ] **Phone**: the panel is a full-screen sheet with a slim header; Cash, Round and the game date are one row; "Monthly
      cashflow" and Undo share the next line; the whole ring is in view with the Roll button as a bar at the bottom of the
      screen, no scrolling needed to play a turn.
- [ ] **Phone**: landing on a card space puts "You landed on ..." with Open the card / Done / Pass in that bottom bar, the
      die beside the title; the ring stays in view above it.
- [ ] **Phone**: after the first roll the ring grows (the empty START area is gone); Bank loan is full width, My games /
      History / Menu / reset game sit two to a line.
- [ ] **Phone**: the quick filters of the card lists are one scrolling line each (not seven wrapped rows); the card list
      scrolls inside the sheet; Shuffle / View card / Start game and My games are spaced and aligned.
- [ ] **Phone**: the language screen shows six languages in two rows and Start game stays at the bottom without scrolling.
- [ ] **Phone on its side**: the stats are one strip, the ring beside the roll / decision.
- [ ] **Tablet and wide screen**: one column about 800 px wide; the ring stays big (up to 560 px), the dice and the Roll
      button (or the decision) sit **under it in one row**, in a bar that stays in reach; Bank loan and the rows two to a line.
- [ ] **Phone quick filters** on the card lists are **dropdowns** (two per line: kind and type, offer, account and
      category) instead of chips; the big screens keep the chips.
- [ ] **Subscriptions table** (whole app): on a small phone (up to 520 px) the Category column is hidden so the table fits
      the page; at 320 px it scrolls inside its own box rather than widening the page.
- [ ] Bank loan and **Repay loan** screens show how much **Cash** you have.
- [ ] **Escaping the rat race ends the game at once** (also when it happens through a purchase made in the Add dialog or
      a sale) - no extra roll; Undo of that move brings the game back.

## Languages and layout

- [ ] All solo texts read right in en / de / es / fr / cn / ar (arabic right-to-left), nothing cut off at phone width.
- [ ] The ring stays square and readable at 360 px width; cells have names for screen readers.

## Findings

First playtest (2026-10-06), handled in the next build - please re-check:

- Board stays always open in solo mode (kept as it was).
- A roll of 1 showed the Deals card at once, confusing -> a dialog waits for you; the card opens on request. (No extra
  wait on the landing: the dialog comes the moment the totem is placed.)
- START: no line; the totem waits outside the ring, top middle, "Start" below it, and moves inside with the first roll.
- Card screens show the tile symbol of their deck, on the right of the heading.
- Settling the bank loan left the steps field at 2 -> it goes back to 1.
- Selling a property to a market buyer paid the deposit twice (14.000 instead of 12.000) -> the Amount field is the profit.
- The MLM bonus was booked on Daily -> now on Income.
- Escaping the rat race still needed one more roll to end the game -> the game ends the moment the books say so.
- Subscriptions table did not fit a small phone -> Category column hidden below 520 px (whole app).
- Repay loan did not show the cash -> it does (also on Borrow).
- Mobile quick filters ran off the screen -> dropdowns on phones.
- Wide screens: ring kept big, controls under it in one row, panel about 800 px.
- Charity / Baby / Downsized took effect the moment the dice were thrown (two-dice choice already visible) -> a roll is
  now only worked out first and applied once the totem has settled.
- Adding a transaction (a Doodad) did not refresh the Stats page underneath -> the Add dialog now tells the pages.
- The MLM roll dialog came at once while the totem was still walking -> it waits until the totem has stopped.
- MLM: the Payday box stays through the MLM roll and the outcome is a second info box.
- Charity: two dice are selected by default (change to one if wanted).
- START overlapped the ring -> now above it with a line to the first tile, gone after the first move.
- The first roll starts the game: first Payday + savings.
- The dice animation was unreliable and too fast, and replayed whenever the dice came back into view -> slower tumble
  that happens only during the roll; otherwise the dice rest still.
- The Payday banner was too small and vanished too fast -> big banner with the amounts, stays until the next roll.
- A share card could be sold to a friend -> not any more (property and asset cards only).
- Payday notice: signs doubled ("++2.500") -> one sign each; now a compact info box at the top with an X that also goes
  with the next action. Reset game is the same row design as My games, in red.
- Dice animation improved (thrown, decelerating faces, one landing pop).
- Wrong settings at the start -> a red Reset game button at the end of the dashboard (asks, wipes, back to start).
- Old games could only be deleted from inside an opened row -> a bin on every row of the list (normal confirmation).
- Downsized took the balance negative -> it borrows first (also Charity), in solo and companion.
- Old games cluttered the start screen -> behind a "My games" button below Start.

(JFK's further notes go here.)
