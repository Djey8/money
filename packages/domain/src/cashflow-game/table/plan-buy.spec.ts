import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { applyCommand, createTable } from './reducer';
import { tableLegalActions } from './legal';
import { testContext } from './testing';
import { TableCommandError, type Table, type TableCommand } from './types';

const ctx = {
  ...testContext,
  // the room's language names a property differently from the card's own key (EFH is the single-family home, SFH in English)
  cards: {
    ...testContext.cards,
    symbolFor: (symbol: string | undefined) => (symbol === 'EFH' ? 'SFH' : symbol),
  },
};
const CLASSIC = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;
const efhId = 'classic-small-efh-45k-2k';

function playingTable(): Table {
  let table = createTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Host',
      settings: { name: 'T', professions: 'random', turnOrder: 'seat', maxSeats: 8 },
      seed: 3,
    },
    ctx,
  ).table;
  const steps: [string, TableCommand][] = [
    ['p1', { type: 'join', name: 'P1' }],
    ['p1', { type: 'set_ready', ready: true }],
    ['host', { type: 'start' }],
  ];
  for (const [who, command] of steps) table = applyCommand(table, who, command, ctx).table;
  return table;
}

/** The player on the move stands on a Deals space with the Duplex-like card on top of the small pile, and has drawn it. */
function holdingCard(): Table {
  let table = playingTable();
  const who = table.activePlayerId!;
  const ids = CLASSIC.decks!.dealSmall!.map((c) => c.id).filter((id) => id !== efhId);
  table = {
    ...table,
    turnRolled: true,
    drawnCardIds: { ...table.drawnCardIds, dealSmall: ids },
    players: table.players.map((p) =>
      p.id === who
        ? {
            ...p,
            books: {
              ...p.books!,
              state: {
                ...p.books!.state,
                turn: { phase: 'decide', count: 1, pending: { kind: 'deal', spaceIndex: 7 } },
              },
            },
          }
        : p,
    ),
  };
  return applyCommand(table, who, { type: 'draw_card', deck: 'dealSmall' }, ctx).table;
}

const me = (table: Table) => table.players.find((p) => p.id === table.activePlayerId)!;
const ids = (table: Table) => tableLegalActions(table, table.activePlayerId!).map((a) => a.action);

describe('the solo flow for a Deal card at a table: plan it, then buy the plan', () => {
  it('planning makes a Grow project and pays nothing; the card is in play and can be bought or ticked off', () => {
    const drawn = holdingCard();
    expect(ids(drawn)).toEqual(expect.arrayContaining(['plan_deal', 'buy_deal']));
    expect(ids(drawn)).not.toContain('buy_planned');
    const cash = me(drawn).books!.transactions.length;
    const planned = applyCommand(
      drawn,
      drawn.activePlayerId!,
      { type: 'plan_deal', cardId: efhId },
      ctx,
    );
    expect(planned.events.map((e) => e.type)).toContain('card_played');
    const books = me(planned.table).books!;
    expect(books.growProjects.find((p) => p.title === 'SFH')?.status).toBe('planned');
    expect(books.investments).toEqual([]);
    expect(books.transactions.length).toBe(cash);
    const pending = books.state.turn!.pending!;
    // the card names the project it became, in the room's language - the Buy button looks for exactly that title
    const project = books.growProjects.find((p) => p.status === 'planned')!;
    expect(project.title).toBe('SFH');
    expect(project.phase).toBe('plan');
    expect(pending).toMatchObject({
      played: true,
      offered: { cardId: efhId, title: project.title },
    });
    // the turn waits: the card is not settled
    expect(planned.table.activePlayerId).toBe(drawn.activePlayerId);
    expect(ids(planned.table)).toEqual(expect.arrayContaining(['buy_planned', 'finish_card']));
    expect(ids(planned.table)).not.toContain('plan_deal');
  });

  it('buying the plan books the property, once, and settles the card', () => {
    const drawn = holdingCard();
    const who = drawn.activePlayerId!;
    const planned = applyCommand(drawn, who, { type: 'plan_deal', cardId: efhId }, ctx).table;
    const bought = applyCommand(planned, who, { type: 'buy_planned', title: 'SFH' }, ctx);
    const books = bought.table.players.find((p) => p.id === who)!.books!;
    expect(books.investments.map((i) => i.tag)).toEqual(['SFH']);
    // bought: the project is on its way from the plan to execution, as in the solo game
    expect(books.growProjects.find((p) => p.title === 'SFH')?.phase).toBe('execute');
    // the card was settled: the turn is over and the table went on
    expect(bought.table.activePlayerId).not.toBe(who);
  });

  it('refuses to buy what was not planned, or the wrong title', () => {
    const drawn = holdingCard();
    const who = drawn.activePlayerId!;
    expect(() => applyCommand(drawn, who, { type: 'buy_planned', title: 'SFH' }, ctx)).toThrow(
      TableCommandError,
    );
    const planned = applyCommand(drawn, who, { type: 'plan_deal', cardId: efhId }, ctx).table;
    expect(() => applyCommand(planned, who, { type: 'buy_planned', title: 'NOPE' }, ctx)).toThrow(
      TableCommandError,
    );
  });

  it('a planned card can be ticked off without buying, and the clock plays that for a player who ran out of time', () => {
    const drawn = holdingCard();
    const who = drawn.activePlayerId!;
    const planned = applyCommand(drawn, who, { type: 'plan_deal', cardId: efhId }, ctx).table;
    const finished = applyCommand(planned, who, { type: 'finish_card' }, ctx);
    expect(finished.table.activePlayerId).not.toBe(who);
    expect(me({ ...finished.table, activePlayerId: who }).books!.investments).toEqual([]);
  });

  it('finish_card is refused for a card that was not played', () => {
    const drawn = holdingCard();
    expect(() => applyCommand(drawn, drawn.activePlayerId!, { type: 'finish_card' }, ctx)).toThrow(
      TableCommandError,
    );
  });
});
