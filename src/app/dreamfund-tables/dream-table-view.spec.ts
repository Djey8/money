import {
  applyDreamCommand,
  createDreamTable,
} from '@money/domain/dist/cashflow-game/dreamfund/table/reducer';
import { projectDreamFor } from '@money/domain/dist/cashflow-game/dreamfund/table/view';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import type { DreamTableView } from './dream-session.service';
import { dreamViewAsTable, lifeOf } from './dream-table-view';
import { DreamTableSessionService } from './dream-table-session.service';

const ctx = { clock: { nowIso: () => '2026-11-01T10:00:00.000Z' } };

function startedTable() {
  let table = createDreamTable(
    {
      id: 't1',
      hostId: 'host',
      hostName: 'Ann',
      seed: 3,
      settings: { name: 'Friday', difficulty: 'hard', professions: 'duplicates' },
    },
    ctx,
  ).table;
  table = applyDreamCommand(
    table,
    'host',
    {
      type: 'add_bot',
      name: 'Bot',
      policyId: 'expert',
      professionId: 'dual-student-informatik',
    },
    ctx,
  ).table;
  table = applyDreamCommand(table, 'host', { type: 'start' }, ctx).table;
  table = applyDreamCommand(
    table,
    'host',
    { type: 'pick_profession', professionId: 'dual-student-informatik' },
    ctx,
  ).table;
  return table;
}

describe('a Dreamfund table in the classic shape', () => {
  const table = startedTable();
  const raw = projectDreamFor(table, 'host') as unknown as DreamTableView;
  const shown = dreamViewAsTable(raw);

  it('carries what the table screens read: seats, books, the queue, the game set of the characters', () => {
    expect(shown.phase).toBe('playing');
    expect(shown.youSeat).toBe(0);
    expect(shown.players).toHaveLength(2);
    expect(shown.settings.gameSetId).toBe('jfk-stories');
    expect(shown.holdSeats).toEqual([]);
    expect(shown.decks.dealSmall).toEqual({ left: 0, discard: [] });
    expect((shown as unknown as { kind: string }).kind).toBe('dreamfund');
    expect(shown.order).toEqual(raw.order);
  });

  it("gives every seat the life's books, with the position the token stands on, and the life beside them", () => {
    for (const seat of [0, 1]) {
      const books = shown.players[seat].books as unknown as {
        state: { boardPosition: number | null };
      };
      expect(books.state).toBeDefined();
      expect(lifeOf(shown, seat)?.books).toBe(shown.players[seat].books);
    }
  });

  it('shows a finished game with the ranking in the classic words', () => {
    const over = dreamViewAsTable({
      ...raw,
      phase: 'finished',
      result: {
        reason: 'round-limit',
        winnerSeat: 1,
        ranking: [
          { seat: 1, rank: 1, outcome: 'won', goalsMet: 2, dreamPoints: 4, score: 900 },
          { seat: 0, rank: 2, outcome: 'playing', goalsMet: 1, dreamPoints: 0, score: 100 },
        ],
      },
    } as unknown as DreamTableView);
    expect(over.result?.ranking.map((entry) => entry.outcome)).toEqual(['escaped', 'playing']);
    expect(over.standings.map((entry) => entry.seat)).toEqual([1, 0]);
  });

  it('turns the moves the server lists into the ones the screens ask for', () => {
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });
    const session = TestBed.runInInjectionContext(
      () => new DreamTableSessionService({} as never, {} as never),
    );
    const mapped = (
      session as unknown as { adaptLegal(actions: unknown[]): { action: string }[] }
    ).adaptLegal([{ type: 'roll' }, { type: 'pay_emergency', hint: {} }]);
    expect(mapped.map((entry) => entry.action)).toEqual(['roll', 'pay_emergency']);
  });
});
