import type { TableView } from '@money/domain';
import { TablePresenter, type Stage } from './table-presenter';
import type { TableEventLine } from './table-session.service';

const view = {
  youSeat: 0,
  players: [
    { seat: 0, name: 'Ann', color: '#e74c3c' },
    { seat: 1, name: 'Ben', color: '#3498db' },
  ],
} as unknown as TableView;

const line = (
  seq: number,
  type: string,
  seat: number | null,
  data?: Record<string, unknown>,
): TableEventLine => ({ seq, version: seq, at: '', type, seat, data });

async function untilIdle(presenter: TablePresenter): Promise<void> {
  for (let i = 0; i < 400 && presenter.busy(); i += 1) await new Promise((r) => setTimeout(r, 5));
}

describe('TablePresenter', () => {
  it('lists the events it has not finished telling, and the rolls whose dice are at rest (the history waits for them)', async () => {
    jest.useFakeTimers();
    try {
      const presenter = new TablePresenter(() => 'en');
      presenter.push(
        [line(7, 'rolled', 1, { dice: [3, 3], total: 6, from: 4, to: 10, paydays: 0 })],
        view,
      );
      expect(presenter.unfinished().has(7)).toBe(true);
      expect(presenter.rested().has(7)).toBe(false);
      let rested = false;
      for (let t = 0; t < 8000 && presenter.busy(); t += 20) {
        if (presenter.rested().has(7)) {
          rested = true;
          // at rest, but the token is still on its way
          expect(presenter.unfinished().has(7)).toBe(true);
        }
        await jest.advanceTimersByTimeAsync(20);
      }
      expect(rested).toBe(true);
      expect(presenter.unfinished().size).toBe(0);
      expect(presenter.rested().size).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("holds a roller's token where it was, walks it space by space, then lets the books have it", async () => {
    jest.useFakeTimers();
    try {
      const presenter = new TablePresenter(() => 'en');
      const seen = new Set<number | null | undefined>();
      const stages: Stage[] = [];
      const rolled: number[][] = [];
      presenter.push(
        [line(1, 'rolled', 1, { dice: [3], total: 3, from: 4, to: 7, paydays: 0 })],
        view,
      );
      // before anything has been told the token is where the roll started
      expect(presenter.tokenAt()).toEqual({ 1: 4 });
      expect(presenter.busy()).toBe(true);
      for (let t = 0; t < 8000 && presenter.busy(); t += 20) {
        seen.add(presenter.tokenAt()[1]);
        const stage = presenter.stage();
        if (stage) stages.push(stage);
        const dice = presenter.dice();
        if (dice && !dice.tumbling) rolled.push(dice.faces);
        await jest.advanceTimersByTimeAsync(20);
      }
      expect(presenter.busy()).toBe(false);
      expect(presenter.tokenAt()).toEqual({});
      expect(presenter.stage()).toBeNull();
      // it walked: 5, 6, 7 appear on the way
      seen.delete(undefined); // after the walk the token is handed back to the books
      expect(seen).toEqual(new Set([4, 5, 6, 7]));
      expect(stages.some((s) => s.who === 'Ben')).toBe(true);
      // the dice come to rest on the faces the other end rolled, in the game screen's own dice
      expect(rolled[0]).toEqual([3]);
      expect(presenter.dice()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not tell my own moves, bookkeeping, or anything once stopped', async () => {
    const presenter = new TablePresenter(() => 'en', 0);
    presenter.push(
      [line(1, 'rolled', 0, { dice: [2], total: 2, from: 1 }), line(2, 'turn_started', 1)],
      view,
    );
    expect(presenter.busy()).toBe(false);
    expect(presenter.tokenAt()).toEqual({});
    presenter.stop();
    presenter.push([line(3, 'card_passed', 1)], view);
    expect(presenter.busy()).toBe(false);
  });

  it('tells a drawn card with its numbers and a Doodad with what it cost', async () => {
    const presenter = new TablePresenter(() => 'en', 0);
    const told: Stage[] = [];
    presenter.push(
      [
        line(1, 'card_drawn', 1, {
          deck: 'dealSmall',
          card: { title: 'Duplex', depositMinor: 500000, cashflowMinor: 30000 },
        }),
        line(2, 'card_played', 1, {
          action: 'pay_doodad',
          card: { title: 'New TV' },
          costMinor: 40000,
        }),
      ],
      view,
    );
    for (let i = 0; i < 300 && presenter.busy(); i += 1) {
      const stage = presenter.stage();
      if (stage && told[told.length - 1] !== stage) told.push(stage);
      await new Promise((r) => setTimeout(r, 1));
    }
    const card = told.find((s) => s.card?.title === 'Duplex')!;
    expect(card.card!.tone).toBe('deal');
    expect(card.card!.lines.join(' ')).toMatch(/Down payment: 5[.,]000/);
    const doodad = told.find((s) => s.patch?.tone === 'minus')!;
    expect(doodad.patch!.text).toMatch(/−400/);
  });

  it('tells a Dreamfund move of another player on the stage, and not the own ones', async () => {
    jest.useFakeTimers();
    try {
      const presenter = new TablePresenter(() => 'en');
      const stages: Stage[] = [];
      presenter.push(
        [
          line(1, 'opportunity_taken', 1, { cardId: 'S01', costMinor: 50000 }),
          line(2, 'goal_reached', 0, { goal: 'reserve' }),
        ],
        view,
      );
      for (let t = 0; t < 8000 && presenter.busy(); t += 20) {
        const stage = presenter.stage();
        if (stage && stages[stages.length - 1] !== stage) stages.push(stage);
        await jest.advanceTimersByTimeAsync(20);
      }
      expect(stages.map((stage) => stage.headline)).toEqual(['took an Opportunity']);
      expect(stages[0].who).toBe('Ben');
    } finally {
      jest.useRealTimers();
    }
  });
});
