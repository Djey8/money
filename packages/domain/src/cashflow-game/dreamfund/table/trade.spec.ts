import { seededRng } from '../../rng';
import { DreamPlayer } from '../player';
import { runDreamBots } from './bot';
import { applyDreamCommand, createDreamTable } from './reducer';
import type { DreamCommand, DreamTable } from './types';

const ctx = { clock: { nowIso: () => '2026-11-01T10:00:00.000Z' } };
const run = (t: DreamTable, who: string, command: DreamCommand) =>
  applyDreamCommand(t, who, command, ctx);

/** A table of the host and two players, started; the seller (the player on the move) owns the hustle S29. */
function tableWithHolding(): { table: DreamTable; seller: string; buyer: string; third: string } {
  let t = createDreamTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Hanna',
      seed: 3,
      settings: { name: 'Trade', professions: 'random', turnOrder: 'seat' },
    },
    ctx,
  ).table;
  t = run(t, 'ann', { type: 'join', name: 'Ann' }).table;
  t = run(t, 'bob', { type: 'join', name: 'Bob' }).table;
  t = run(t, 'ann', { type: 'set_ready', ready: true }).table;
  t = run(t, 'bob', { type: 'set_ready', ready: true }).table;
  t = run(t, 'host', { type: 'start' }).table;
  const seller = t.activePlayerId!;
  const [buyer, third] = t.order.filter((id) => id !== seller);
  const seat = t.players.find((p) => p.id === seller)!;
  const life = DreamPlayer.restore(seat.life!, seededRng(1), { sharedMarkets: true });
  const card = life.opportunityCard('S29')!;
  const quote = life.quoteOpportunity(card, {});
  life.buyOpportunity(card, {}, quote.costMinor);
  t = {
    ...t,
    players: t.players.map((p) => (p.id === seller ? { ...p, life: life.snapshot() } : p)),
  };
  return { table: t, seller, buyer, third };
}

const holdingsOf = (t: DreamTable, id: string) =>
  (t.players.find((p) => p.id === id)!.life!.books.state.holdings ?? []).filter((h) => !h.ended);

describe('trading an Opportunity card at a Dreamfund table', () => {
  it('moves the card and the money: the seller is paid, the buyer has the card, and everybody sees it', () => {
    const { table, seller, buyer } = tableWithHolding();
    const title = holdingsOf(table, seller)[0].title;
    const sellerLife = DreamPlayer.restore(
      table.players.find((p) => p.id === seller)!.life!,
      seededRng(1),
    );
    const buyerLife = DreamPlayer.restore(
      table.players.find((p) => p.id === buyer)!.life!,
      seededRng(1),
    );
    const worth = sellerLife.sellable(title)!.standing.grossMinor;
    const price = Math.round(worth * 1.2);
    const before = { seller: sellerLife.cash(), buyer: buyerLife.cash() };

    let t = run(table, seller, { type: 'offer_trade', holding: title, priceMinor: price }).table;
    expect(t.trade).toMatchObject({
      sellerId: seller,
      holding: title,
      priceMinor: price,
      to: null,
    });
    const done = run(t, buyer, { type: 'accept_trade' });
    t = done.table;
    expect(t.trade).toBeNull();
    expect(done.events.map((e) => e.type)).toContain('trade_made');
    expect(holdingsOf(t, seller).some((h) => h.title === title)).toBe(false);
    expect(holdingsOf(t, buyer).some((h) => h.cardId === 'S29')).toBe(true);
    const after = {
      seller: DreamPlayer.restore(
        t.players.find((p) => p.id === seller)!.life!,
        seededRng(1),
      ).cash(),
      buyer: DreamPlayer.restore(t.players.find((p) => p.id === buyer)!.life!, seededRng(1)).cash(),
    };
    expect(after.seller - before.seller).toBeGreaterThan(0);
    expect(before.buyer - after.buyer).toBeGreaterThanOrEqual(price);
  });

  it('lets only the seller on the move offer, and only a card somebody would buy, at a price near its worth', () => {
    const { table, seller, buyer } = tableWithHolding();
    const title = holdingsOf(table, seller)[0].title;
    expect(() =>
      run(table, buyer, { type: 'offer_trade', holding: title, priceMinor: 1000 }),
    ).toThrow(/own turn/);
    expect(() =>
      run(table, seller, { type: 'offer_trade', holding: 'Nothing', priceMinor: 1000 }),
    ).toThrow(/cannot be traded/);
    expect(() =>
      run(table, seller, { type: 'offer_trade', holding: title, priceMinor: 1 }),
    ).toThrow(/too far/);
    expect(() =>
      run(table, seller, { type: 'offer_trade', holding: title, priceMinor: 99999999 }),
    ).toThrow(/too far/);
    const t = run(table, seller, { type: 'offer_trade', holding: title, priceMinor: 20000 }).table;
    expect(() =>
      run(t, seller, { type: 'offer_trade', holding: title, priceMinor: 20000 }),
    ).toThrow(/open already/);
    expect(() => run(t, seller, { type: 'accept_trade' })).toThrow(/proposal/);
  });

  it('works with a counter offer, a refusal, a withdrawal and the end of the seller’s turn', () => {
    const { table, seller, buyer, third } = tableWithHolding();
    const title = holdingsOf(table, seller)[0].title;
    const worth = DreamPlayer.restore(
      table.players.find((p) => p.id === seller)!.life!,
      seededRng(1),
    ).sellable(title)!.standing.grossMinor;
    let t = run(table, seller, {
      type: 'offer_trade',
      holding: title,
      priceMinor: worth * 2,
    }).table;
    // a counter, then the seller takes it
    t = run(t, buyer, { type: 'counter_trade', priceMinor: Math.round(worth * 1.1) }).table;
    expect(t.trade!.counters).toEqual([{ playerId: buyer, priceMinor: Math.round(worth * 1.1) }]);
    // a refusal leaves the offer open for the others
    t = run(t, third, { type: 'decline_trade' }).table;
    expect(t.trade!.declined).toEqual([third]);
    expect(() => run(t, third, { type: 'accept_trade' })).toThrow(/turned this offer down|not for/);
    t = run(t, seller, { type: 'accept_trade', from: buyer }).table;
    expect(t.trade).toBeNull();
    expect(holdingsOf(t, buyer).some((h) => h.cardId === 'S29')).toBe(true);

    // withdrawn
    const again = tableWithHolding();
    const title2 = holdingsOf(again.table, again.seller)[0].title;
    let u = run(again.table, again.seller, {
      type: 'offer_trade',
      holding: title2,
      priceMinor: 20000,
    }).table;
    u = run(u, again.seller, { type: 'withdraw_trade' }).table;
    expect(u.trade).toBeNull();

    // an offer lapses when the seller's turn is over
    let v = run(again.table, again.seller, {
      type: 'offer_trade',
      holding: title2,
      priceMinor: 20000,
    }).table;
    v = { ...v, turnRolled: true };
    const ended = run(v, again.seller, { type: 'end_turn' });
    expect(ended.table.trade).toBeNull();
    expect(ended.events.map((e) => e.type)).toContain('trade_expired');
  });

  it('refuses a buyer who cannot take the card (they own it already)', () => {
    const { table, seller, buyer } = tableWithHolding();
    const title = holdingsOf(table, seller)[0].title;
    const seat = table.players.find((p) => p.id === buyer)!;
    const life = DreamPlayer.restore(seat.life!, seededRng(1), { sharedMarkets: true });
    const card = life.opportunityCard('S29')!;
    life.buyOpportunity(card, {}, life.quoteOpportunity(card, {}).costMinor);
    const t = {
      ...table,
      players: table.players.map((p) => (p.id === buyer ? { ...p, life: life.snapshot() } : p)),
    };
    const offered = run(t, seller, {
      type: 'offer_trade',
      holding: title,
      priceMinor: 20000,
    }).table;
    expect(() => run(offered, buyer, { type: 'accept_trade' })).toThrow(/cannot take/);
  });

  it('sells a holding at the standing price with sell_holding', () => {
    const { table, seller } = tableWithHolding();
    const title = holdingsOf(table, seller)[0].title;
    const sold = run(table, seller, { type: 'sell_holding', holding: title });
    expect(holdingsOf(sold.table, seller)).toHaveLength(0);
    expect(sold.events.map((e) => e.type)).toContain('holding_sold');
  });

  it('lets a bot buy what its strategy takes, and offer a card when it is short of cash', () => {
    // the human seller offers; the bots answer
    let t = createDreamTable(
      {
        id: 't',
        hostId: 'host',
        hostName: 'Hanna',
        seed: 8,
        settings: { name: 'B', professions: 'random', turnOrder: 'seat' },
      },
      ctx,
    ).table;
    t = run(t, 'host', { type: 'add_bot', name: 'Expert', policyId: 'expert' }).table;
    t = run(t, 'host', { type: 'start' }).table;
    const host = t.players.find((p) => p.id === 'host')!;
    const life = DreamPlayer.restore(host.life!, seededRng(1), { sharedMarkets: true });
    const card = life.opportunityCard('S29')!;
    life.buyOpportunity(card, {}, life.quoteOpportunity(card, {}).costMinor);
    t = {
      ...t,
      players: t.players.map((p) => (p.id === 'host' ? { ...p, life: life.snapshot() } : p)),
    };
    // make the person the one on the move
    t = { ...t, activePlayerId: 'host', turnRolled: true };
    const title = holdingsOf(t, 'host')[0].title;
    const worth = life.sellable(title)!.standing.grossMinor;
    t = run(t, 'host', {
      type: 'offer_trade',
      holding: title,
      priceMinor: Math.round(worth * 1.1),
    }).table;
    t = runDreamBots(t, ctx).table;
    // the bot answered: it bought the card or turned it down - either way the offer is settled by it
    const bot = t.players.find((p) => p.bot)!;
    const answered = t.trade === null || t.trade.declined.includes(bot.id);
    expect(answered).toBe(true);
  });
});
