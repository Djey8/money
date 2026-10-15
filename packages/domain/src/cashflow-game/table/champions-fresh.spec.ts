import * as fs from 'fs';
import * as path from 'path';
import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { strategyRulesDigest } from '../simulation/digest';
import { policyFromSpec } from '../simulation/strategies';
import { CHAMPION_BOOK, CHAMPION_BOOK_DIGEST } from './champion-book';
import { CHARACTERS } from './characters';

const DATA = path.join(__dirname, '../../../../../docs/domain/strategy/data');
const playable = () =>
  CASHFLOW_GAME_SETS.filter((set) => set.id === 'cashflow' || set.id === 'custom-jfk');

/**
 * The self-learning loop's tripwire (todo/cashflow-tournament-and-bots.md): the tournament, the champion book and the characters
 * were measured on certain rules - the cards, the professions, the loan rule, the board, the simulator's version. When any of them
 * changes the numbers (and the champions!) may be out of date, and this fails until `npm run champions:refresh` has searched again.
 * Nothing here loosens by itself: a refresh only replaces a champion when a new strategy beats it on games the search never saw.
 */
describe('the tournament, the champion book and the characters', () => {
  const digest = () => strategyRulesDigest(playable());

  it('the tournament was played on the rules as they are now (npm run champions:refresh)', () => {
    const tournament = JSON.parse(fs.readFileSync(path.join(DATA, 'tournament.json'), 'utf8'));
    expect(tournament.meta.rulesDigest).toBe(digest());
  });

  it('the champion book was searched on the rules as they are now (npm run champions:refresh)', () => {
    if (Object.keys(CHAMPION_BOOK).length === 0) return; // no search has run yet
    expect(CHAMPION_BOOK_DIGEST).toBe(digest());
    const book = JSON.parse(fs.readFileSync(path.join(DATA, 'champion-book.json'), 'utf8'));
    expect(book.meta.rulesDigest).toBe(digest());
    expect(Object.keys(book.entries).sort()).toEqual(Object.keys(CHAMPION_BOOK).sort());
  });

  it('has a champion for every profession of every playable game set, each a strategy that can be played', () => {
    if (Object.keys(CHAMPION_BOOK).length === 0) return;
    const professions = playable().flatMap((set) => set.professions.map((p) => p.id));
    expect(Object.keys(CHAMPION_BOOK).sort()).toEqual([...professions].sort());
    for (const entry of Object.values(CHAMPION_BOOK)) {
      expect(entry.interval.low).toBeLessThanOrEqual(entry.winRate);
      expect(entry.interval.high).toBeGreaterThanOrEqual(entry.winRate);
      expect(entry.tables).toBeGreaterThan(0);
      expect(policyFromSpec(entry.spec).id).toBe(entry.spec.id);
    }
  });

  it('every character is a strategy that can be played, with its measured win share', () => {
    for (const entry of Object.values(CHARACTERS)) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.winRate).toBeGreaterThan(0);
      expect(entry.winRate).toBeLessThanOrEqual(1);
      expect(policyFromSpec(entry.spec).id).toBe(entry.spec.id);
    }
  });
});
