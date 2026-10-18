import {
  applyCommand,
  createTable,
  fixedClock,
  identityText,
  projectFor,
  type GameBooks,
  type Table,
  type TableCommand,
} from '@money/domain';
import { CASHFLOW_GAME_SETS } from '../shared/cashflow-content';
import { ProfileComponent } from './../panels/profile/profile.component';
import { AppStateService } from '../shared/services/app-state.service';
import { CashflowGameService } from '../shared/services/cashflow-game.service';
import { applyBooksToApp } from './table-mode.service';

const ctx = {
  gameSets: CASHFLOW_GAME_SETS,
  clock: fixedClock('2026-10-15', '2026-10-15T09:00:00.000Z'),
  text: identityText,
  money: (minor: number) => `${minor / 100}`,
  plainMoney: (minor: number) => `${minor / 100}`,
  cards: {
    textFor: () => ({}),
    symbolFor: (symbol: string | undefined) => symbol,
    sharedText: () => '',
    groupName: (group: string) => group,
  },
} as unknown as Parameters<typeof createTable>[1];

const CLASSIC = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;

function holdingProperty(
  cardId = 'classic-small-efh-45k-2k',
  deck: 'dealSmall' | 'dealBig' = 'dealSmall',
): Table {
  let table = createTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Host',
      settings: { name: 'T', professions: 'random', turnOrder: 'seat', maxSeats: 4 },
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
  const who = table.activePlayerId!;
  const ids = CLASSIC.decks![deck]!.map((c) => c.id).filter((id) => id !== cardId);
  table = {
    ...table,
    turnRolled: true,
    drawnCardIds: { ...table.drawnCardIds, [deck]: ids },
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
  table = applyCommand(table, who, { type: 'draw_card', deck }, ctx).table;
  return applyCommand(table, who, { type: 'plan_deal', cardId }, ctx).table;
}

describe('the Buy button of a planned property at a table', () => {
  beforeEach(() => {
    (AppStateService as unknown as { _instance?: unknown })._instance = undefined;
    ProfileComponent.mail = 'player@cashflow.test';
  });

  it('is not refused by the solo rules once the card is planned and on screen', () => {
    const table = holdingProperty();
    const mover = table.players.find((p) => p.id === table.activePlayerId)!;
    const view = projectFor(table, mover.id);
    const books = view.players[view.youSeat!].books as unknown as GameBooks;
    applyBooksToApp(AppStateService.instance, books, {
      dealSmall: [],
      dealBig: [],
      market: [],
      doodad: [],
    });
    const game = AppStateService.instance.cashflowGame;
    expect(game.turn?.pending).toMatchObject({ played: true, offered: { title: 'EFH' } });
    expect(CashflowGameService.buyRefusalFor('EFH', 'property')).toBeNull();
  });

  it('is allowed for every property and asset card of the game', () => {
    const refused: string[] = [];
    for (const deck of ['dealSmall', 'dealBig'] as const) {
      for (const card of CLASSIC.decks![deck]!) {
        if (card.assetKind === 'share') continue;
        (AppStateService as unknown as { _instance?: unknown })._instance = undefined;
        const table = holdingProperty(card.id, deck);
        const mover = table.players.find((p) => p.id === table.activePlayerId)!;
        const view = projectFor(table, mover.id);
        applyBooksToApp(
          AppStateService.instance,
          view.players[view.youSeat!].books as unknown as GameBooks,
          {
            dealSmall: [],
            dealBig: [],
            market: [],
            doodad: [],
          },
        );
        const project = AppStateService.instance.allGrowProjects[0];
        const reason = CashflowGameService.buyRefusalFor(
          project.title,
          project.investment ? 'property' : project.isAsset ? 'asset' : 'share',
        );
        if (reason) refused.push(`${card.id} (${project.title}): ${reason}`);
      }
    }
    expect(refused).toEqual([]);
  });
});
