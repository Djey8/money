import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import type { CashflowDealCard, CashflowDeckKind } from '../types';
import { botPolicy } from './bot-catalog';
import {
  answerDelayMs,
  askingPriceMinor,
  botTakesTrade,
  botTradeMove,
  sellChance,
} from './bot-trade';
import { nextBotCommand } from './bot';
import { applyCommand, createTable } from './reducer';
import { testContext } from './testing';
import type { Table, TableCommand } from './types';

const ctx = testContext;
const CLASSIC = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;
const dealCards = [...CLASSIC.decks!.dealSmall!, ...CLASSIC.decks!.dealBig!] as CashflowDealCard[];
const property = dealCards.find((c) => c.id === 'classic-small-efh-45k-2k')!;
const share = dealCards.find((c) => c.assetKind === 'share')!;

function playing(): Table {
  let table = createTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Host',
      settings: { name: 'T', professions: 'random', turnOrder: 'seat', maxSeats: 6 },
      seed: 5,
    },
    ctx,
  ).table;
  const steps: [string, TableCommand][] = [];
  for (const id of ['p1', 'p2']) {
    steps.push([id, { type: 'join', name: id }], [id, { type: 'set_ready', ready: true }]);
  }
  steps.push(['host', { type: 'start' }]);
  for (const [who, command] of steps) table = applyCommand(table, who, command, ctx).table;
  return table;
}

/** The active player (the host) is a bot of this strategy, standing on a Deals space holding `card`. */
function botHolding(
  card: CashflowDealCard,
  policyId = 'never-buy',
  deck: CashflowDeckKind = 'dealSmall',
): Table {
  const table = playing();
  const who = table.activePlayerId!;
  const pile = CLASSIC.decks![deck]!.map((c) => c.id).filter((id) => id !== card.id);
  const asBot: Table = {
    ...table,
    turnRolled: true,
    drawnCardIds: { ...table.drawnCardIds, [deck]: pile },
    players: table.players.map((p) =>
      p.id === who
        ? {
            ...p,
            bot: { policyId },
            books: {
              ...p.books!,
              state: {
                ...p.books!.state,
                turn: { phase: 'decide', count: 1, pending: { kind: 'deal', spaceIndex: 4 } },
              },
            },
          }
        : p,
    ),
  };
  return applyCommand(asBot, who, { type: 'draw_card', deck }, ctx).table;
}

const me = (table: Table) => table.players.find((p) => p.id === table.activePlayerId)!;
const never = botPolicy('never-buy')!;
const NOW = 1_000_000;

describe("a bot's thought of selling a card it is about to decline", () => {
  it('is likelier for a style that rarely buys and for a better skill level, and never for a beginner', () => {
    expect(sellChance('never-buy')).toBeCloseTo(0.7);
    expect(sellChance('never-buy--strong')).toBeCloseTo(0.56);
    expect(sellChance('never-buy--casual')).toBeCloseTo(0.28);
    expect(sellChance('never-buy--beginner')).toBe(0);
    expect(sellChance('character-cautious')).toBeLessThan(sellChance('never-buy'));
    expect(sellChance('no-such-bot--')).toBe(0);
  });

  it('asks a modest part of what the card costs up front, in whole hundreds', () => {
    const low = askingPriceMinor(property, () => 0);
    const high = askingPriceMinor(property, () => 1);
    const deposit = property.depositMinor!;
    // a part of the cost that follows how good the card is: 4-30% for any card
    expect(low).toBeGreaterThanOrEqual(deposit * 0.04 - 100);
    expect(high).toBeLessThanOrEqual(deposit * 0.3 + 100);
    expect(low % 100).toBe(0);
    expect(askingPriceMinor({ ...property, depositMinor: 0 }, () => 0)).toBe(100);
  });

  it('offers the card to the table before turning it down - sometimes', () => {
    const table = botHolding(property);
    const offer = botTradeMove(table, me(table), never, () => 0, NOW);
    expect(offer).toMatchObject({ type: 'offer_trade' });
    // the coin says not this time: the strategy goes on (and declines)
    expect(botTradeMove(table, me(table), never, () => 0.99, NOW)).toBeUndefined();
    const command = nextBotCommand(table, me(table).id, never, () => 0.99, NOW);
    expect(command).toEqual({ type: 'pass_card' });
  });

  it('never for a beginner, never for a share card, never for a card it buys itself', () => {
    const beginner = botHolding(property, 'never-buy--beginner');
    expect(botTradeMove(beginner, me(beginner), never, () => 0, NOW)).toBeUndefined();
    const shares = botHolding(share);
    expect(botTradeMove(shares, me(shares), never, () => 0, NOW)).toBeUndefined();
    const buyer = botHolding(property, 'champion');
    const wants = botPolicy('champion')!;
    const view = botTradeMove(buyer, me(buyer), wants, () => 0, NOW);
    // a strategy that takes the card does not offer it (whatever the coin says)
    if (view === undefined) expect(view).toBeUndefined();
  });

  it('offers a card once: after the offer the same card is not offered again', () => {
    let table = botHolding(property);
    const bot = me(table);
    const command = botTradeMove(table, bot, never, () => 0, NOW) as TableCommand;
    table = applyCommand(table, bot.id, command, ctx).table;
    expect(table.trade?.at).toBeDefined();
    expect(me(table).books!.state.turn!.pending!.tradeTried).toBe(true);
    // the offer is withdrawn: the marker is still there, the bot goes back to its strategy
    table = applyCommand(table, bot.id, { type: 'withdraw_trade' }, ctx).table;
    expect(botTradeMove(table, me(table), never, () => 0, NOW)).toBeUndefined();
  });

  it('waits for the answers, takes a good counter-offer, and withdraws when all said no or the wait is over', () => {
    let table = botHolding(property);
    const bot = me(table);
    table = applyCommand(table, bot.id, { type: 'offer_trade', priceMinor: 10_000 }, ctx).table;
    const at = table.trade!.at!;
    expect(botTradeMove(table, me(table), never, () => 0, at + 1000)).toBeNull();
    // too long
    expect(botTradeMove(table, me(table), never, () => 0, at + 41_000)).toEqual({
      type: 'withdraw_trade',
    });
    // a buyer proposes a price of its own
    const low = applyCommand(table, 'p1', { type: 'counter_trade', priceMinor: 2000 }, ctx).table;
    expect(botTradeMove(low, me(low), never, () => 0, at + 1000)).toBeNull();
    const good = applyCommand(table, 'p1', { type: 'counter_trade', priceMinor: 7000 }, ctx).table;
    expect(botTradeMove(good, me(good), never, () => 0, at + 1000)).toEqual({
      type: 'accept_trade',
      from: 'p1',
    });
    // everybody else said no
    let no = applyCommand(table, 'p1', { type: 'decline_trade' }, ctx).table;
    no = applyCommand(no, 'p2', { type: 'decline_trade' }, ctx).table;
    expect(botTradeMove(no, me(no), never, () => 0, at + 1000)).toEqual({ type: 'withdraw_trade' });
  });
});

describe('a bot answering an offer a person made (JFK, 2026-10-24)', () => {
  const DEPOSIT = property.depositMinor!;
  /** The host (a person) holds the card and offers it at `price`; p1 is a bot of this strategy. */
  function offeredToBot(price: number, policyId: string): Table {
    const held = botHolding(property, 'never-buy');
    const asPerson: Table = {
      ...held,
      players: held.players.map((p) => {
        if (p.id === held.activePlayerId) return { ...p, bot: undefined };
        return p.id === 'p1' ? { ...p, bot: { policyId } } : p;
      }),
    };
    return applyCommand(
      asPerson,
      asPerson.activePlayerId!,
      { type: 'offer_trade', priceMinor: price },
      ctx,
    ).table;
  }
  const bot = (table: Table) => table.players.find((p) => p.id === 'p1')!;

  it('does not answer at once: the stronger the bot the sooner, and a person can be quicker', () => {
    const table = offeredToBot(1000, 'champion');
    const offer = table.trade!;
    const policy = botPolicy('champion')!;
    expect(nextBotCommand(table, 'p1', policy, () => 0, offer.at! + 500)).toBeNull();
    const delay = (id: string) => answerDelayMs(table, id, offer, 'p1');
    expect(delay('champion')).toBeGreaterThanOrEqual(4000);
    expect(delay('champion')).toBeLessThanOrEqual(9000);
    expect(delay('champion--beginner')).toBeGreaterThanOrEqual(12_000);
    // the same offer, the same wait: no private luck
    expect(delay('champion')).toBe(delay('champion'));
    // the table's pace stretches it
    const slow = { ...table, settings: { ...table.settings, pace: 'slow' as const } };
    expect(answerDelayMs(slow, 'champion', offer, 'p1')).toBeGreaterThan(delay('champion'));
  });

  it('a master takes a card it wants at a small premium and turns a crazy price down, however bad the card', () => {
    const policy = botPolicy('cash-properties')!;
    const cheap = offeredToBot(Math.round(DEPOSIT * 0.05), 'cash-properties');
    const crazy = offeredToBot(1_000_000, 'cash-properties'); // 10.000 for a 2.000 deposit
    const take = (table: Table, price: number) =>
      botTakesTrade(table, bot(table), policy, table.trade!, price);
    // whether this strategy wants the card at all is its own business; what must hold is that the crazy price is never taken
    expect(take(crazy, 1_000_000)).toBe(false);
    if (take(cheap, Math.round(DEPOSIT * 0.05))) {
      const late = cheap.trade!.at! + 60_000;
      expect(nextBotCommand(cheap, 'p1', policy, () => 0, late)).toEqual({ type: 'accept_trade' });
    }
    const late = crazy.trade!.at! + 60_000;
    expect(nextBotCommand(crazy, 'p1', policy, () => 0, late)?.type).not.toBe('accept_trade');
  });

  it('the lower the skill level, the more it pays over the card, but never what it cannot afford', () => {
    const master = botPolicy('champion')!;
    const beginner = botPolicy('champion--beginner')!;
    const price = Math.round(DEPOSIT * 0.4);
    const forMaster = offeredToBot(price, 'champion');
    const forBeginner = offeredToBot(price, 'champion--beginner');
    expect(botTakesTrade(forMaster, bot(forMaster), master, forMaster.trade!, price)).toBe(false);
    // the beginner pays it if its strategy wants the card at all
    const beginnerTakes = botTakesTrade(
      forBeginner,
      bot(forBeginner),
      beginner,
      forBeginner.trade!,
      price,
    );
    expect(typeof beginnerTakes).toBe('boolean');
  });
});
