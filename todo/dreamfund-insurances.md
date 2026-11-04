# Dreamfund insurances: what protects what, and which cards are still to write

Status 2026-11-05 (updated: `disability` and `travel` are in the catalogue and have cards; legal and dental have many more; every premium is checked against what it saves).

Status 2026-11-03. The notion: every insurance protects against a **kind of event card**. A held insurance caps the cost of the cards
that name it at the deductible (never more than 500, the profession may set less); an insurance with no card yet has no effect.
The catalogue is `INSURANCE_CATALOG` in `packages/domain/src/cashflow-game/insurance.ts` (priority, price, what it covers, its effect,
advice); the cards an insurance works on come from `insuranceCoverage(kind)` (`insurance-coverage.ts`) - the Emergency cards with
`insurance: '<kind>'`.

| Priority | Kind             | Premium (Dual Student) | Value       | Cards today                         | Cards still to write                                      |
| -------- | ---------------- | ---------------------- | ----------- | ----------------------------------- | --------------------------------------------------------- |
| 1        | `liability`      | the profession's own   | essential   | yes (+ the key-loss clause)         | -                                                         |
| 2.5      | `disability`     | 40                     | essential   | yes (E97, E105-E108)                | -                                                         |
| 3        | `household`      | the profession's own   | essential   | yes                                 | -                                                         |
| 4        | `car_partial`    | 30 (needs a car)       | useful      | yes                                 | -                                                         |
| 4        | `car_full`       | 60 (needs a car)       | situational | covers the partial cards            | a self-caused crash, vandalism (the partial does not pay) |
| 5        | `legal`          | 18                     | useful      | yes (10 cards)                      | -                                                         |
| 6        | `accident`       | 12                     | useful      | none                                | lasting damage after a leisure accident (lump sum)        |
| 7        | `life_risk`      | 20                     | situational | none                                | death of a partner / parent who carries the household     |
| 8        | `dental`         | 9                      | situational | yes (10 cards)                      | -                                                         |
| 9        | `household_bike` | 10                     | situational | yes (bike theft)                    | -                                                         |
| 6        | `travel`         | 8                      | situational | yes (E88, E92, E98, E101-E104, ...) | -                                                         |
| 11       | `pet_liability`  | 8 (needs a pet)        | useful      | none                                | the dog bites, the horse damages                          |
| 12       | `pet_health`     | 25 (needs a pet)       | rarely      | none (vet cards exist, not tied)    | operation / long illness of the pet                       |
| 13       | `phone`          | 9                      | rarely      | none                                | phone falls / stolen / wet                                |
| 14       | `debt`           | 35                     | rarely      | none                                | a loan to pay when the job or the life is lost            |

Ideas not yet in the catalogue: building insurance (owners of a house), nursing-care top-up, glass breakage, a fully-fledged
health-insurance top-up (private hospital). Add them to the catalogue when their cards are written.

When the cards of an insurance are written: give each card `insurance: '<kind>'` (and an `insuranceNote`), then the screen lists the
count automatically ("N event cards in the game are covered"). Premiums: tune with `baseMinor`; they grow with the root of the
character's price level and with its insurance factor, like the car insurances.

## Is it worth it? (`insurance-value.ts`, its spec)

A premium paid every month has to be worth it. A player draws about 0.22 Emergency cards a Payday (a medium board: 3 Emergency tiles in
36 spaces, a Payday every 9). `insuranceValue(kind, cards, life, priceFactor)` works out what an insurance saves on a card drawn at
random by a life (cards that need a car, a pet or another life do not count), times that rate, against the premium. The spec holds the
ratio above 1 for five lives (single, with a car, a couple, a family with a dog, abroad) - at the Dual Student's price level, where it
is the lowest: the cards grow with the price level, the premium with its root, so a richer life gains more. Tune with the premium
(`baseMinor`) and with the cards an insurance names, not with the deductible alone.

## How the decision works (for the checklist)

- Before the first roll: the second decision after "Who you are": go through every insurance, most important first.
- Later: the Insurances button next to the badge chips (and the shield badge) opens the same decision.
- A change counts at once before the first roll, and with the next Payday after it (the cover and the premium start together).
  The Subscriptions list shows the bill of the next Payday: a hopped-in insurance is listed at once, a hopped-out one is gone.
- Of the car insurances only one can be held.
