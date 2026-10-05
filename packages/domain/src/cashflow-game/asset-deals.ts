import type { GameBooks } from './books';
import { setPhaseAfterTrade } from './deals';
import { emptyEffects, type BookGrowUpdate, type GameEffects } from './effects';
import type { CardDeps } from './market-cards';
import { placeOneOffTransactions } from './rounds';
import type { CashflowAssetDeal, CashflowGameState } from './types';

/**
 * Special assets, dice cards and gold coins as pure rules (todo/cashflow-game-pro.md slice A1(e)): a card paid for and
 * decided by a die (gold, the loan to a relative), a kept card rolled for at every Payday (Multi-Level-Marketing), a
 * stock split's roll, and selling coins one by one. Same shape as every rule: books in (minor units), a clock and the
 * game's text in, `GameEffects` out; nothing is mutated. The roll itself is an input - the player's real die, or the
 * app's - so the rules stay deterministic.
 */

const dealsOf = (state: CashflowGameState): CashflowAssetDeal[] => state.assetDeals ?? [];

/** Sets fields on one asset deal, matched by title. */
function withDeal(
  state: CashflowGameState,
  title: string,
  patch: Partial<CashflowAssetDeal>,
): CashflowGameState {
  return {
    ...state,
    assetDeals: dealsOf(state).map((deal) => (deal.title === title ? { ...deal, ...patch } : deal)),
  };
}

/** Kept cards that are rolled for at every Payday (Multi-Level-Marketing). */
export function recurringOwned(state: CashflowGameState): CashflowAssetDeal[] {
  return dealsOf(state).filter((deal) => deal.recurring && deal.stage === 'owned');
}

/** The Payday roll covers every kept card of the same kind, and a roll pays once per card. */
function sameKind(a: CashflowAssetDeal, b: CashflowAssetDeal): boolean {
  return a.rollDue === true && a.costMinor === b.costMinor && a.payoutMinor === b.payoutMinor;
}

/** Paid dice cards still waiting for their roll - the open decisions on the dashboard. The Payday rolls of kept cards are one decision for the whole group, shown once. */
export function openDecisions(state: CashflowGameState): CashflowAssetDeal[] {
  const waiting = dealsOf(state).filter((deal) => deal.stage === 'awaitingRoll');
  const due = recurringOwned(state).filter((deal) => deal.rollDue);
  return due.length ? [...waiting, due[0]] : waiting;
}

/** How many cards the open Payday roll covers: a roll pays once per card, so two cards win (or miss) together. */
export function paydayRollCount(state: CashflowGameState, deal: CashflowAssetDeal): number {
  if (!deal.recurring) return 1;
  return recurringOwned(state).filter((other) => sameKind(other, deal)).length;
}

// ── Hooks around the Add dialog's Buy Asset / Sell Asset ───────────────────────────────────────

export interface GambleHook {
  /** The card is a dice gamble: it is paid for but must not become an asset until the roll decides it. */
  gamble: boolean;
  /** The game state change to apply when it is; null otherwise. */
  effects: GameEffects | null;
}

/**
 * Called by the Add dialog's Buy Asset before it books the asset. A dice-gamble card is *paid* but does not become an
 * asset yet - it waits for the roll (`resolveGamble`) - so this says so and the dialog skips creating it. A plain offer
 * is booked as usual. `awaitingRoll` counts too: pressing Buy again on a card that is already paid and waiting must not
 * hand out the coins without the roll. A recurring card (Multi-Level-Marketing) is simply bought; its dice come at every
 * Payday.
 */
export function beforeAssetBuy(state: CashflowGameState, title: string): GambleHook {
  const deal = dealsOf(state).find(
    (d) => d.title === title && (d.stage === 'planned' || d.stage === 'awaitingRoll'),
  );
  if (!deal?.successOn || deal.recurring) return { gamble: false, effects: null };
  return {
    gamble: true,
    effects: emptyEffects(withDeal(state, title, { stage: 'awaitingRoll' }), null),
  };
}

/**
 * After the dialog's Buy Asset: a plain offer is now owned; a gamble is paid and waits for its roll (and the player is
 * brought to the dashboard, where the roll is decided - `decisionNeeded`). Otherwise the project moves to its trade
 * phase like any other buy.
 */
export function afterAssetBuy(books: GameBooks, title: string): GameEffects {
  const deal = dealsOf(books.state).find((d) => d.title === title);
  if (deal?.stage === 'awaitingRoll') {
    const effects = emptyEffects(books.state, null);
    if (books.growProjects.some((project) => project.title === title)) {
      effects.growUpdates = [{ title, status: 'awaiting roll', phase: 'execute' }];
    }
    effects.decisionNeeded = true;
    return effects;
  }
  const state =
    deal?.stage === 'planned' ? withDeal(books.state, title, { stage: 'owned' }) : books.state;
  return setPhaseAfterTrade({ ...books, state }, title, 'buy') ?? emptyEffects(state, null);
}

/** After the dialog's Sell Asset: the project is sold only when the asset is gone; otherwise it still holds what is left. */
export function afterAssetSell(books: GameBooks, title: string): GameEffects {
  const stillOwned = books.assets.some((asset) => asset.tag === title);
  const state = stillOwned
    ? books.state
    : withDeal(books.state, title, { stage: 'sold', rollDue: false });
  const effects =
    setPhaseAfterTrade({ ...books, state }, title, 'sell') ?? emptyEffects(state, null);
  const phase = effects.growUpdates.find((update) => update.title === title);
  if (phase) phase.status = stillOwned ? 'bought' : 'sold';
  return effects;
}

export interface SellCoinsResult {
  /** False for an ordinary asset (or no coins), which keeps its usual sale. */
  sold: boolean;
  effects: GameEffects | null;
}

/**
 * Sells `quantity` coins of a special asset at `priceMinor` each (JFK, 2026-10-03: "5 x 1000" sells five coins for
 * 1.000 apiece). The Asset keeps the cost of the coins that are left - proportional, so selling half removes half of
 * what it cost - and goes away entirely with the last coin; the Grow project says how many coins remain. The money
 * coming in is the dialog's income transaction. No History step: the dialog's own covers it.
 */
export function sellCoins(
  books: GameBooks,
  title: string,
  quantity: number,
  priceMinor: number,
  deps: CardDeps,
): SellCoinsResult {
  const deal = dealsOf(books.state).find((d) => d.title === title && d.stage === 'owned');
  if (!deal || !(quantity > 0)) return { sold: false, effects: null };
  const left = Math.max(0, Math.round((deal.coins - quantity) * 100) / 100);
  const keep = deal.coins > 0 ? left / deal.coins : 0;
  const effects = emptyEffects(
    withDeal(books.state, title, left <= 0 ? { coins: 0, stage: 'sold' } : { coins: left }),
    null,
  );
  const asset = books.assets.find((candidate) => candidate.tag === title);
  if (asset) {
    if (left <= 0) effects.assetRemovals = [title];
    else effects.assetUpserts = [{ tag: title, amountMinor: Math.round(asset.amountMinor * keep) }];
  }
  const project = books.growProjects.find((candidate) => candidate.title === title);
  if (project) {
    const update: BookGrowUpdate = {
      title,
      notes: [
        ...project.notes,
        {
          text: deps.text('CashflowGame.coinsSoldNote', {
            sold: quantity,
            price: deps.money(priceMinor),
            left,
          }),
          createdAt: deps.clock.nowIso(),
        },
      ],
    };
    if (left > 0) update.amountMinor = Math.round(project.amountMinor * keep);
    effects.growUpdates = [update];
  }
  return { sold: true, effects };
}

// ── Resolving a roll ───────────────────────────────────────────────────────────────────────────

export interface RollOutcome {
  won: boolean;
  /** The die that was rolled, when known - it is written into the History and the project's notes. */
  roll?: number;
}

export interface GambleResult {
  effects: GameEffects;
  /** Which kind of decision it settled, so the caller can name what it logs. */
  kind: 'paydayRoll' | 'split' | 'gamble';
  /** The share a split applied to. */
  share?: string;
}

const rollNote = (outcome: RollOutcome, text: string) =>
  `🎲 ${outcome.roll ? `${outcome.roll}: ` : ''}${text}`;

/**
 * One Payday roll for every kept card of the same kind (JFK, 2026-10-03: "you just throw once and either you get twice
 * or nothing"): a win books one income per card, a miss books nothing - the cards stay in execution either way. A
 * separate History step from the Payday itself.
 */
function resolvePaydayRoll(
  books: GameBooks,
  target: CashflowAssetDeal,
  outcome: RollOutcome,
  deps: CardDeps,
): GambleResult {
  const group = recurringOwned(books.state).filter((other) => sameKind(other, target));
  const label = group.length > 1 ? `${target.title} ×${group.length}` : target.title;
  const payoutMinor = target.payoutMinor ?? 0;
  const resultText =
    (outcome.won ? target.successText : target.failureText) ??
    deps.text(outcome.won ? 'CashflowGame.diceWonPayoutToast' : 'CashflowGame.diceLostToast', {
      amount: deps.money(payoutMinor * group.length),
    });
  const now = deps.clock.nowIso();

  const done = new Set(group.map((deal) => deal.title));
  const effects = emptyEffects(
    {
      ...books.state,
      assetDeals: dealsOf(books.state).map((deal) =>
        done.has(deal.title) ? { ...deal, rollDue: false } : deal,
      ),
    },
    {
      kind: outcome.won ? 'diceWon' : 'diceLost',
      detail: outcome.roll ? `${label} · 🎲 ${outcome.roll}` : label,
    },
  );
  effects.growUpdates = group.flatMap((deal) => {
    const project = books.growProjects.find((p) => p.title === deal.title);
    return project
      ? [
          {
            title: deal.title,
            notes: [...project.notes, { text: rollNote(outcome, resultText), createdAt: now }],
          },
        ]
      : [];
  });
  if (outcome.won) {
    effects.appendedTransactions = placeOneOffTransactions(
      group.map((deal) => ({
        account: 'Daily',
        amountMinor: payoutMinor,
        date: '',
        time: '',
        category: `@${deal.title}`,
        comment: `${deal.title} payout\n#cashflow`,
      })),
      books,
      deps.clock.todayIso(),
    );
  }
  effects.persist.grow = true;
  return { effects, kind: 'paydayRoll' };
}

/**
 * The split roll (JFK, 2026-10-03): 1-3 (`won`) doubles the quantity of the share, 4-6 halves it (the half you keep
 * rounds up). Only the quantity changes - no price, no cash, no cost. One undo step, and a note on the share's Grow
 * project.
 */
function resolveShareSplit(
  books: GameBooks,
  deal: CashflowAssetDeal,
  outcome: RollOutcome,
  deps: CardDeps,
): GambleResult {
  const tag = deal.split?.shareTag ?? '';
  const share = books.shares.find((candidate) => candidate.tag === tag);
  const from = share?.quantity || 0;
  const to = outcome.won ? from * 2 : Math.ceil(from / 2);
  const effects = emptyEffects(
    { ...books.state, assetDeals: dealsOf(books.state).filter((d) => d.title !== deal.title) },
    {
      kind: outcome.won ? 'shareSplit' : 'shareReverseSplit',
      detail: `${tag} · ${outcome.roll ? `🎲 ${outcome.roll} · ` : ''}${from} → ${to}`,
    },
  );
  if (share) effects.shareUpserts = [{ ...share, quantity: to }];
  const project = books.growProjects.find((candidate) => candidate.title === tag);
  if (project) {
    const update: BookGrowUpdate = {
      title: tag,
      notes: [
        ...project.notes,
        {
          text: rollNote(
            outcome,
            deps.text(outcome.won ? 'CashflowGame.splitDouble' : 'CashflowGame.splitHalve', {
              share: tag,
              from,
              to,
            }),
          ),
          createdAt: deps.clock.nowIso(),
        },
      ],
    };
    if (project.share && project.share.quantity === from) {
      update.share = { ...project.share, quantity: to };
    }
    effects.growUpdates = [update];
  }
  effects.persist = { subscriptions: false, grow: true, balanceSheet: true };
  return { effects, kind: 'split', share: tag };
}

/**
 * Settles a paid dice card (JFK, 2026-10-03): `won` (rolled in the app, or reported from a real die) books the coins as
 * an Asset at what was paid - or, for a loan to a relative, pays the cash back; otherwise the money is simply gone and
 * the card is completed. Either way what happened is kept as a note on the Grow project, and the whole thing is one
 * undoable step. A kept card's Payday roll and a stock split's roll are settled the same way.
 *
 * Throws when no dice decision is open for the card.
 */
export function resolveGamble(
  books: GameBooks,
  title: string,
  outcome: RollOutcome,
  deps: CardDeps,
): GambleResult {
  const dueCard = recurringOwned(books.state).find((d) => d.title === title && d.rollDue);
  if (dueCard) return resolvePaydayRoll(books, dueCard, outcome, deps);

  const deal = dealsOf(books.state).find((d) => d.title === title && d.stage === 'awaitingRoll');
  if (!deal) throw new Error('There is no dice decision open for this card.');
  if (deal.split) return resolveShareSplit(books, deal, outcome, deps);

  const payoutMinor = deal.payoutMinor ?? 0;
  const resultText =
    (outcome.won ? deal.successText : deal.failureText) ??
    deps.text(
      outcome.won
        ? payoutMinor
          ? 'CashflowGame.diceWonPayoutToast'
          : 'CashflowGame.diceWonToast'
        : 'CashflowGame.diceLostToast',
      { coins: deal.coins, amount: deps.money(payoutMinor) },
    );
  const effects = emptyEffects(
    withDeal(books.state, title, {
      stage: outcome.won ? (payoutMinor ? 'paidBack' : 'owned') : 'lost',
    }),
    {
      kind: outcome.won ? 'diceWon' : 'diceLost',
      detail: outcome.roll ? `${title} · 🎲 ${outcome.roll}` : title,
    },
  );
  const project = books.growProjects.find((p) => p.title === title);
  if (project) {
    effects.growUpdates = [
      {
        title,
        notes: [
          ...project.notes,
          { text: rollNote(outcome, resultText), createdAt: deps.clock.nowIso() },
        ],
        status: outcome.won ? (payoutMinor ? 'paid back' : 'bought') : 'lost',
        phase: outcome.won && !payoutMinor ? 'execute' : 'completed',
      },
    ];
  }
  if (outcome.won && payoutMinor) {
    // A loan that came back: the cash is income, nothing is owned afterwards.
    effects.appendedTransactions = placeOneOffTransactions(
      [
        {
          account: 'Daily',
          amountMinor: payoutMinor,
          date: '',
          time: '',
          category: `@${title}`,
          comment: `${title} paid back\n#cashflow`,
        },
      ],
      books,
      deps.clock.todayIso(),
    );
  } else if (outcome.won) {
    const owned = books.assets.find((asset) => asset.tag === title);
    effects.assetUpserts = [
      { tag: title, amountMinor: (owned?.amountMinor ?? 0) + deal.costMinor },
    ];
  }
  effects.persist = { subscriptions: false, grow: true, balanceSheet: true };
  return { effects, kind: 'gamble' };
}
