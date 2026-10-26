# Dreamfund (Traumtopf) - reviewing a game, and what an agent can do

For agents (MCP). Read `dreamfund_game_en` (or `dreamfund_game_de`) first: it explains the whole game - the accounts, the map, every card
type, the goals, and the statistics of the simulation that the review is compared with.

## What an agent can do today

| Task                                                                            | How                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teach or explain the game                                                       | `explain_concept` topic `dreamfund_game_en` / `dreamfund_game_de`, then answer from it.                                                                             |
| Judge a game that was played                                                    | `get_cashflow_game` action `review` (the running game) or `review_save` (a saved game, `id`). The game must have its step history: save it in full (not `compact`). |
| Read the state of the account                                                   | `get_cashflow_game` action `game` (the books: cash, subscriptions, Grow projects with their notes).                                                                 |
| Play Dreamfund moves (plan a card, buy, sell, roll a die, dreams, life, career) | **Not available through the API yet.** The classic Cashflow moves are; the Dreamfund tiles are played in the app.                                                   |

## The review of a Dreamfund game

`review` returns `kind: "dreamfund"` with a `review` object and a `text` in Markdown. It does not play positions on with a strategy (the
classic analyst does that); it reads the story of the game from the history - the position before every step and the position now:

- `milestones`: the month (a month is a Payday, the `round`) of the first monthly income, the full reserve, the repaid debts, the lived
  dream and financial independence.
- `timeline`: up to 24 points - cash, reserve, Bank loan, passive income, expenses, cash flow, number of holdings.
- `purchases`: what was bought, when, for how much, and what it pays a month.
- `loans`: the peak of the Bank loan and how often it grew. `emergencies.count`. `missedChances`: cards that were planned and not bought in time.
- `idleCapitalShare`: the share of the invested capital in holdings that pay no monthly cash flow.
- `savingCards`: how many of the six free saving cards were taken (every won game of the simulation took all six).
- `findings`: the points to make, each good (`good`), bad (`bad`) or a tip (`tip`), with the month when there is one.

The benchmark is the simulation of 2,400 games of Jonas on Medium: the best ways of playing reach the reserve about month 17, the debts
22, the dream 39 and independence 52. A human game can be faster (luck on the dice cards) or slower.

## How to give the feedback

1. Say what the game was and how it ended, in two sentences, with the numbers of `final`.
2. Name the turning point: the finding with the largest cost - a Bank loan that was never paid back, a dream funded before any income,
   capital in coins and collectibles, a saving card left in the pile.
3. Say what to do differently, concretely, in the order of the milestones: the free savings first, a small hustle for the first income,
   the reserve and the debts by payment plans, Sapling businesses for the main income, the dream when the income carries part of it.
4. Do not judge luck: a bad die on a card is not a mistake. Judge the decisions: what was bought, what was left, what was borrowed.
5. Offer to look at one purchase in detail: `get_cashflow_game` action `game` shows the Grow project with its notes (every payment, offer,
   die and sale is written there with its numbers).

## Saving a game for review

In the app: **My games > Save**, in full. Through the API: `play_cashflow_game` action `save` (without `compact: true`, which drops the
history the review needs). A saved game is judged with `review_save`.
