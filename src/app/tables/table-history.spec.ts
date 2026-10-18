import type { TableView } from '@money/domain';
import { historyLines } from './table-history';
import type { TableEventLine } from './table-session.service';

const view = {
  players: [
    { seat: 0, name: 'Ann', color: '#e74c3c' },
    { seat: 1, name: 'Ben', color: '#3498db' },
  ],
} as unknown as TableView;

const event = (
  seq: number,
  type: string,
  seat: number | null,
  data?: Record<string, unknown>,
): TableEventLine => ({ seq, version: seq, at: '2026-10-16T10:00:00Z', type, seat, data });

describe('historyLines', () => {
  it('lists what every player did, newest first, numbered in the order it happened', () => {
    const lines = historyLines(
      view,
      [
        event(1, 'turn_started', 0),
        event(2, 'rolled', 0, { dice: [3], total: 3, landed: 'deal' }),
        event(3, 'card_drawn', 0, { deck: 'dealSmall', card: { id: 'c1', title: 'Duplex' } }),
        event(4, 'turn_held', null),
        event(5, 'card_passed', 0),
        event(6, 'rolled', 1, { dice: [2, 4], total: 6, landed: 'market' }),
      ],
      'en',
    );
    // bookkeeping (turn_started, turn_held) is not history
    expect(lines.map((line) => [line.number, line.who, line.title])).toEqual([
      [4, 'Ben', 'rolled the dice'],
      [3, 'Ann', 'passes on the card'],
      [2, 'Ann', 'drew a card'],
      [1, 'Ann', 'rolled the dice'],
    ]);
    expect(lines[0].detail).toBe('🎲 2 + 4 = 6 → market');
    expect(lines[0].color).toBe('#3498db');
    expect(lines[2].detail).toBe('Duplex');
    expect(lines[3].detail).toBe('🎲 3 → deal');
  });

  it('words the undo vote and tells which card was bought and what it cost', () => {
    const lines = historyLines(
      view,
      [
        event(1, 'card_played', 1, {
          action: 'buy_deal',
          card: { id: 'c', title: 'Gold' },
          costMinor: 500000,
        }),
        event(2, 'undo_proposed', 0),
        event(3, 'undo_approved', null),
      ],
      'en',
    );
    expect(lines.map((line) => line.title)).toEqual([
      'the table went back one turn',
      'asked to go back one turn',
      'buys',
    ]);
    expect(lines[2].detail).toMatch(/^Gold · 5[.,]000$/);
    expect(lines[0].who).toBe('');
  });
});
