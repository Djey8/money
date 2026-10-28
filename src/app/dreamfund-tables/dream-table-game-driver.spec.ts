import { DreamTableGameDriver } from './dream-table-game-driver';
import type { TableSessionService } from '../tables/table-session.service';

describe('DreamTableGameDriver', () => {
  const make = (refusal: string | null = null) => {
    const played: Record<string, unknown>[] = [];
    const session = {
      playForResult: jest.fn(async (command: Record<string, unknown>) => {
        played.push(command);
        return { events: [{ type: 'rolled', seat: 0, data: { dice: [4] } }], appliedVersion: 5 };
      }),
      untilVersion: jest.fn(async () => undefined),
      problem: () => null,
    } as unknown as TableSessionService;
    return { driver: new DreamTableGameDriver(session, () => refusal), played };
  };

  it('says it plays the Dreamfund, so the solo screen opens the stack tiles', () => {
    expect(make().driver.dreamfund).toBe(true);
  });

  it("rolls with the Dreamfund's own command, and hands back what happened", async () => {
    const { driver, played } = make();
    const outcome = await driver.roll();
    expect(played).toEqual([{ type: 'roll' }]);
    expect(outcome.ok).toBe(true);
    expect(outcome.events[0].type).toBe('rolled');
  });

  it("ends the turn and leaves a decision open with the table's commands", async () => {
    const { driver, played } = make();
    await driver.finish();
    await driver.pass();
    expect(played).toEqual([{ type: 'end_turn' }, { type: 'skip' }]);
  });

  it('refuses a move of play out of turn before anything is sent, and the classic deals altogether', async () => {
    const { driver, played } = make('Not your turn.');
    expect((await driver.roll()).message).toBe('Not your turn.');
    expect((await driver.buy('x')).ok).toBe(false);
    expect(played).toEqual([]);
  });

  it('turns what a tile card decides into the commands of the table', async () => {
    const { driver, played } = make();
    await driver.dreamMove({ decision: 'pay', pay: 3 });
    await driver.dreamMove({ decision: 'answer', answer: 'option', option: 'x' });
    await driver.dreamMove({ decision: 'takeCard', cardId: 'S01', units: 2 });
    await driver.dreamMove({ decision: 'ladder', holding: 'ETF', action: 'cash' });
    await driver.dreamMove({ decision: 'leave' });
    expect(played).toEqual([
      { type: 'pay_emergency', pay: 3 },
      { type: 'answer_life', decision: 'option', option: 'x' },
      { type: 'take_opportunity', cardId: 'S01', units: 2 },
      { type: 'harvest_ladder', holding: 'ETF', action: 'cash' },
      { type: 'skip' },
    ]);
    expect((await driver.dreamMove({ decision: 'nonsense' })).ok).toBe(false);
  });
});
