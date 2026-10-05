# Solo mode - manual playtest checklist (slice C7)

No Playwright for this (dev-cycle rule: reserved for deliberate one-off debugging). Play it on a phone and on a desktop,
in light and dark, with a cashflow account on the self-hosted edition. Tick what works, note what does not.

## Start

- [ ] New game: after the profession, the language question also asks _how to play_; "With the physical board" is
      pre-selected and plays exactly as before.
- [ ] "Solo in the app" starts the game; the dashboard shows the ring, the token at START and a Roll button - and no
      Payday button and no "which space did you land on" grid.

## Rolling

- [ ] Roll: die face(s) appear, the token walks space by space, a Payday flashes when it is entered, Skip jumps to
      the landing.
- [ ] A first roll of 1 lands on the Deals space next to START; a 6 lands on the first Payday.
- [ ] Passing a Payday pays it (round goes up, Payday lines appear in Transactions); landing on one pays it once.
- [ ] Baby adds a child (a fourth Baby space does nothing); Charity donates and offers 1 or 2 dice for 3 turns, then
      back to one die; Downsized pays the expenses and the spanner goes at the next roll.
- [ ] With "reduce motion" on, the token jumps instead of walking.

## Cards

- [ ] Landing on Deals asks for the Small or Big pile, then the usual find-or-draw flow; Doodad and Market open theirs.
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

(JFK's playtest notes go here.)
