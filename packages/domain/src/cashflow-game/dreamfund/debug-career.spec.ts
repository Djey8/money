import { DreamPlayer } from './player';

const player = () =>
  DreamPlayer.fromSeed({
    seed: 5,
    professionId: 'dual-student-informatik',
    rules: { mode: 'free' } as never,
  });

describe('mocking the career and a Payday (a debug game)', () => {
  it('puts the character one stage before the one asked for, due for the promotion', () => {
    const p = player();
    const before = p.books.subscriptions.find((s) => s.title === p.state.gameSubscriptionTitles[0]);
    expect(p.debugCareer('C5M')).toBe(true);
    // C5M follows C4: the character is the Senior Data Engineer, with the Paydays the promotion asks for
    expect(p.state.career?.stage).toBe('C4');
    expect(p.state.career?.paydaysInStage).toBeGreaterThanOrEqual(1);
    const salary = p.books.subscriptions.find((s) => s.title === p.state.gameSubscriptionTitles[0]);
    expect(Math.abs(salary!.amountMinor)).toBeGreaterThan(Math.abs(before!.amountMinor));
    expect(p.careerRoll()?.kind).not.toBe('waiting');
  });

  it('refuses the first stage, and a stage that is not there', () => {
    const p = player();
    expect(p.debugCareer('C1')).toBe(false);
    expect(p.debugCareer('C99')).toBe(false);
  });

  it('a mocked Payday posts the month', () => {
    const p = player();
    const round = p.state.round;
    p.debugPayday();
    expect(p.state.round).toBe(round + 1);
  });
});
