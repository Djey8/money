import { TableGameDriver } from './table-game-driver';
import type { TableSessionService } from './table-session.service';

function fakeSession(answer: unknown, problem: string | null = null) {
  const calls: Record<string, unknown>[] = [];
  const session = {
    playForResult: jest.fn(async (command: Record<string, unknown>) => {
      calls.push(command);
      return answer;
    }),
    untilVersion: jest.fn(async () => undefined),
    problem: () => problem,
  } as unknown as TableSessionService;
  return { session, calls };
}

describe('TableGameDriver', () => {
  it('sends each solo move as the table command of the same name', async () => {
    const { session, calls } = fakeSession({ appliedVersion: 7, events: [] });
    const driver = new TableGameDriver(session);
    await driver.roll(2);
    await driver.draw('dealSmall');
    await driver.buy('card-1', 10);
    await driver.buy('card-2');
    await driver.payDoodad('doodad-1');
    await driver.payMarket('market-1');
    await driver.pass();
    await driver.rollDecision('MLM');
    await driver.bankLoan(-100000);
    await driver.plan('card-3');
    await driver.buyPlanned('EFH', 2);
    await driver.finish();
    await driver.sellPosition('EFH');
    expect(calls).toEqual([
      { type: 'roll', dice: 2 },
      { type: 'draw_card', deck: 'dealSmall' },
      { type: 'buy_deal', cardId: 'card-1', quantity: 10 },
      { type: 'buy_deal', cardId: 'card-2' },
      { type: 'pay_doodad', cardId: 'doodad-1' },
      { type: 'pay_market', cardId: 'market-1' },
      { type: 'pass_card' },
      { type: 'roll_decision', title: 'MLM' },
      { type: 'bank_loan', amountMinor: -100000 },
      { type: 'plan_deal', cardId: 'card-3' },
      { type: 'buy_planned', title: 'EFH', quantity: 2 },
      { type: 'finish_card' },
      { type: 'sell_position', input: { title: 'EFH' } },
    ]);
  });

  it('waits for the table to reach the version the move made, then returns its events', async () => {
    const { session } = fakeSession({
      appliedVersion: 9,
      events: [{ type: 'rolled', seat: 1, data: { dice: [3] } }],
    });
    const outcome = await new TableGameDriver(session).roll(1);
    expect(session.untilVersion).toHaveBeenCalledWith(9);
    expect(outcome).toEqual({
      ok: true,
      events: [{ type: 'rolled', seat: 1, data: { dice: [3] } }],
    });
  });

  it('reports a refused move with the words the server gave', async () => {
    const { session } = fakeSession(null, 'It is not your turn.');
    const outcome = await new TableGameDriver(session).roll(1);
    expect(outcome).toEqual({ ok: false, message: 'It is not your turn.', events: [] });
    expect(session.untilVersion).not.toHaveBeenCalled();
  });
});
