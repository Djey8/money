import { CAPABILITIES, unlistedCommands } from './capabilities';
import { DREAM_POLICIES, KNOB_RANGES } from './policies';

describe('the capabilities of a Dreamfund player', () => {
  it('lists every command of the table', () => {
    expect(unlistedCommands()).toEqual([]);
  });

  it('has unique ids, and every knob it names exists', () => {
    const ids = CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const known = new Set<string>([
      ...Object.keys(KNOB_RANGES),
      'ride',
      'takeDreams',
      'clearLoanBySale',
      'insure',
    ]);
    for (const capability of CAPABILITIES) {
      for (const knob of capability.knobs ?? []) expect(known.has(knob)).toBe(true);
    }
  });

  it('keeps the moves no bot makes visible', () => {
    const open = CAPABILITIES.filter((c) => c.status === 'open').map((c) => c.id);
    expect(open).toEqual(['plan-purchase']);
  });

  it('lets every strategy be tuned and rebuilt with other knobs', () => {
    for (const policy of DREAM_POLICIES) {
      const tuned = policy.retune({
        bufferMonths: 2,
        stepUpYield: 0.2,
        clearLoanBySale: true,
        insure: 'all',
      });
      expect(tuned.id).toBe(policy.id);
      expect(tuned.bufferMonths).toBe(2);
      expect(tuned.stepUp).not.toBeNull();
      expect(tuned.clearLoanBySale).toBe(true);
      expect(tuned.insure).toBe('all');
    }
  });
});
