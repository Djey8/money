import { factGroups } from './dream-player-facts';

const text = { groups: { grow: 'Grow' }, labels: { growBought: 'Bought' } };

describe('the fact table of a profile', () => {
  it('shows nothing before a game has facts', () => {
    expect(factGroups(undefined, text)).toEqual([]);
    expect(factGroups({ games: 0, totals: {} }, text)).toEqual([]);
  });

  it('gives the total and the average per game, money in major units and a yes-or-no as a share', () => {
    const groups = factGroups(
      {
        games: 4,
        totals: { growBought: 10, fireReserveMinor: 1200000, fireReserveFull: 3, netWorthMinor: 0 },
      },
      text,
    );
    expect(groups.map((g) => g.id)).toEqual(['grow', 'fire', 'smile', 'income']);
    const bought = groups[0].rows.find((r) => r.label === 'Bought');
    expect(bought).toEqual({ label: 'Bought', total: '10', perGame: '2.5' });
    const fire = groups[1].rows;
    expect(fire.find((r) => r.label === 'fireReserveMinor')).toMatchObject({
      total: '12,000',
      perGame: '3,000',
    });
    expect(fire.find((r) => r.label === 'fireReserveFull')?.perGame).toBe('75%');
  });
});
