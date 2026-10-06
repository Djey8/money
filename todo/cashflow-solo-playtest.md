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
- [ ] The MLM roll dialog appears only **after the totem has finished moving** (not while it is still walking).
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
