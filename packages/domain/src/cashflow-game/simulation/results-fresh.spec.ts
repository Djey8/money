import * as fs from 'fs';
import * as path from 'path';
import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { strategyRulesDigest } from './digest';

const FILE = path.join(__dirname, '../../../../../docs/domain/strategy/data/results.json');
const CARD_FILE = path.join(
  __dirname,
  '../../../../../docs/domain/strategy/data/card-results.json',
);

/**
 * The strategy lab's numbers in the manual and in docs/domain/CASHFLOW_STRATEGY_LAB.md were measured on certain rules. When a
 * card, a profession, the loan rule, the board or the simulator changes, they are stale: run `node scripts/strategy-lab.js`
 * again (and read what the new numbers say before the prose in the manual is trusted).
 */
describe('the strategy lab results', () => {
  it('were measured on the rules as they are now', () => {
    const results = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const playable = CASHFLOW_GAME_SETS.filter(
      (set) => set.id === 'cashflow' || set.id === 'custom-jfk',
    );
    expect(results.meta.rulesDigest).toBe(strategyRulesDigest(playable));
  });
});

/** The same for the card lab (`node scripts/card-lab.js`): what each card is worth was measured on these rules too. */
describe('the card lab results', () => {
  it('were measured on the rules as they are now', () => {
    const results = JSON.parse(fs.readFileSync(CARD_FILE, 'utf8'));
    const playable = CASHFLOW_GAME_SETS.filter(
      (set) => set.id === 'cashflow' || set.id === 'custom-jfk',
    );
    expect(results.meta.digest).toBe(strategyRulesDigest(playable));
  });
});
