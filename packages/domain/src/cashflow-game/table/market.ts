import { marketCardPlan } from '../actions';
import { resolveGamble } from '../asset-deals';
import { applyEffectsToBooks, type GameBooks } from '../books';
import { endIfOver } from '../game-end';
import { marketCardKind, updateSharePrice, type MarketCardKind } from '../market-cards';
import { rollDie } from '../rng';
import { currentTurn } from '../turn';
import type { CashflowDealCard, CashflowMarketCard } from '../types';
import type { PlayDeps } from './play';
import { tableRng } from './table-rng';
import type { Table, TablePlayer } from './types';

/**
 * Cards that are for the whole table (todo/cashflow-multiplayer.md slice T4). A Market card is read out to everyone: the moment
 * it is drawn it takes effect for **every** player in the game, whoever drew it and whether or not it is their turn - the
 * drawer cannot pass on a card that hurts them. Each player's effect is the solo card rule over their own books
 * (`marketCardPlan`): a buyer card makes an offer for the properties *they* own, a boost raises *their* cashflow, a cost
 * card charges the players who own a property (the Bank loan covers a short purse), a stock split is decided by **one** roll
 * of the table's die for all holders. Selling into an offer is the player's own move afterwards (`sell_position`).
 *
 * A stock card (Deal pile) drawn by someone moves the share's price for every other player who holds it, and offers them a sale
 * at that price; only the drawer can buy.
 */

export interface TableWideEffect {
  playerId: string;
  /** What the card did to this player; `price` for a moved share price. */
  kind: MarketCardKind | 'price';
  detail: Record<string, unknown>;
}

export interface TableWide {
  table: Table;
  /** One entry for each player the card actually did something to (the drawer always has one). */
  effects: TableWideEffect[];
}

/**
 * Market cards whose printed text says that only the person who drew them is affected, though the card is read out to the table
 * ("Neues Managementsystem"). A fact about the table rules, kept here so the card data - and every number measured on it - stays as
 * it is.
 */
const DRAWER_ONLY_CARDS = new Set(['classic-market-boost-mgmt-400']);

const inGame = (player: TablePlayer): player is TablePlayer & { books: GameBooks } =>
  player.status === 'active' &&
  player.books !== null &&
  currentTurn(player.books.state).phase !== 'over';

function replaceBooks(table: Table, playerId: string, books: GameBooks): Table {
  return {
    ...table,
    players: table.players.map((p) => (p.id === playerId ? { ...p, books } : p)),
  };
}

/** The part of a card's result worth telling the table, without the card text (that is shown once). */
function detailOf(kind: MarketCardKind, result: Record<string, unknown>): Record<string, unknown> {
  switch (kind) {
    case 'buyer':
    case 'gold':
      return { matched: result.matched };
    case 'split':
      return { share: result.share };
    case 'boost':
      return { changed: result.changed };
    case 'cost':
      return { property: result.property, costMinor: result.costMinor };
    default:
      return {};
  }
}

const applies = (kind: MarketCardKind, detail: Record<string, unknown>): boolean => {
  switch (kind) {
    case 'buyer':
    case 'gold':
      return ((detail.matched as unknown[] | undefined) ?? []).length > 0;
    case 'split':
      return detail.share !== null && detail.share !== undefined;
    case 'boost':
      return ((detail.changed as unknown[] | undefined) ?? []).length > 0;
    case 'cost':
      return detail.property !== null && detail.property !== undefined;
    default:
      return false;
  }
};

/** Plays the Market card `cardId`, just drawn by `drawerId`, over every player's books. The version is the command's job. */
export function playMarketForTable(
  table: Table,
  drawerId: string,
  cardId: string,
  deps: PlayDeps,
): TableWide {
  const drawer = table.players.find((p) => p.id === drawerId);
  const card = drawer?.books?.gameSet?.decks?.market?.find(
    (candidate) => candidate.id === cardId,
  ) as CashflowMarketCard | undefined;
  if (!drawer?.books || !card) throw new Error(`No Market card with the id '${cardId}'.`);

  const kind = marketCardKind(card);
  const stream = tableRng(table.rngState);
  const withRng = { ...deps, rng: stream.rng };
  // One die for the whole table decides a stock split: 1-3 doubles the shares, 4-6 halves them.
  let splitRoll: number | null = null;
  let next = table;
  const effects: TableWideEffect[] = [];

  for (const player of table.players.filter(inGame)) {
    // "Only the person who drew this card is affected": nobody else gets the boost (the small Business Boom says everybody)
    if (kind === 'boost' && DRAWER_ONLY_CARDS.has(card.id) && player.id !== drawerId) continue;
    const plan = marketCardPlan(player.books, card, withRng);
    const result = { ...(plan.result ?? {}) } as Record<string, unknown>;

    // A cost card applies only to the person who drew it - and they pay it with a move of their own (the Add dialog's payment, as
    // a Doodad is paid): nothing is booked now, the game waits for the payment (a clock that runs out pays it for them).
    if (kind === 'cost') {
      if (player.id !== drawerId) continue;
      if (result.property) {
        const open = player.books.state.turn?.pending;
        const waiting =
          open && player.books.state.turn
            ? {
                ...player.books,
                state: {
                  ...player.books.state,
                  turn: {
                    ...player.books.state.turn,
                    pending: { ...open, paymentDue: true, played: false },
                  },
                },
              }
            : player.books;
        next = replaceBooks(next, player.id, waiting);
        effects.push({ playerId: player.id, kind, detail: detailOf(kind, result) });
        continue;
      }
    }

    let books = plan.effects.reduce(applyEffectsToBooks, player.books);

    if (kind === 'split' && result.share) {
      splitRoll ??= rollDie(stream.rng);
      const settled = resolveGamble(
        books,
        `SPLIT-${String(result.share)}`,
        { won: splitRoll <= 3, roll: splitRoll },
        withRng,
      );
      books = applyEffectsToBooks(books, settled.effects);
      result.roll = splitRoll;
      result.won = splitRoll <= 3;
    }
    // The card took effect for everybody as it was opened. For the drawer it is played and stays in hand until they tick it off
    // (a cost is paid by it); everyone else is not on a space.
    const pending = books.state.turn?.pending;
    if (player.id === drawerId && currentTurn(books.state).phase === 'decide' && pending) {
      books = {
        ...books,
        state: {
          ...books.state,
          turn: { ...books.state.turn!, pending: { ...pending, played: true, paymentDue: false } },
        },
      };
    }
    books = { ...books, state: endIfOver(books.state, books.subscriptions) };
    next = replaceBooks(next, player.id, books);

    const detail = {
      ...detailOf(kind, result),
      ...(result.roll !== undefined ? { roll: result.roll, won: result.won } : {}),
    };
    if (player.id === drawerId || applies(kind, detail)) {
      effects.push({ playerId: player.id, kind, detail });
    }
  }
  return { table: { ...next, rngState: stream.state() }, effects };
}

/**
 * A stock card was drawn: its price is the market's price for everyone who holds the share. Each other holder's Grow project
 * and balance sheet take the new price and they get an offer to sell at it. (The drawer's own price update is part of their
 * `buy_deal`, as in solo play.)
 */
export function movePriceForHolders(
  table: Table,
  drawerId: string,
  card: CashflowDealCard,
  deps: PlayDeps,
): TableWide {
  const symbol = card.symbol ?? card.title;
  const stream = tableRng(table.rngState);
  let next = table;
  const effects: TableWideEffect[] = [];
  for (const player of table.players.filter(inGame)) {
    if (player.id === drawerId) continue;
    const books = player.books;
    const holds = books.shares.some((share) => share.tag === symbol && share.quantity > 0);
    const project = books.growProjects.some((p) => p.title === symbol && Boolean(p.share?.tag));
    if (!holds || !project) continue;
    const priced = updateSharePrice(
      books,
      card,
      { description: deps.cards.textFor(card.id).description },
      deps,
    );
    next = replaceBooks(next, player.id, applyEffectsToBooks(books, priced.effects));
    effects.push({
      playerId: player.id,
      kind: 'price',
      detail: { share: symbol, priceMinor: card.priceMinor ?? 0 },
    });
  }
  return { table: { ...next, rngState: stream.state() }, effects };
}
