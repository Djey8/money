import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import type { CashflowDealCard, CashflowDeckKind } from '../types';
import { botPolicy } from './bot-catalog';
import { askingPriceMinor, botTradeMove, sellChance } from './bot-trade';
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
    expect(low).toBeGreaterThanOrEqual(deposit * 0.08 - 100);
    expect(high).toBeLessThanOrEqual(deposit * 0.2 + 100);
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
    expect(botTradeMove(table, me(table), never, () => 0, at + 26_000)).toEqual({
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
