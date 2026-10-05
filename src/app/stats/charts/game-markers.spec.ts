import { gameMarkerFor } from './game-markers';

describe('gameMarkerFor', () => {
  const loan = { amount: 3000, category: '@Bank loan', comment: 'Bank loan taken' };
  const doodad = { amount: -500, category: '@Leisure', comment: 'A jet ski\n\n#doodad' };

  it('marks a bank loan taken or repaid and a Doodad while a game is running', () => {
    expect(gameMarkerFor(loan, true)).toBe('loanTaken');
    expect(gameMarkerFor({ ...loan, amount: -3000 }, true)).toBe('loanRepaid');
    expect(gameMarkerFor(doodad, true)).toBe('doodad');
  });

  it('never marks anything on an account without a running game, whatever it is called', () => {
    expect(gameMarkerFor(loan, false)).toBeNull();
    expect(gameMarkerFor(doodad, false)).toBeNull();
  });

  it('leaves the monthly bank-loan interest and ordinary income alone', () => {
    expect(
      gameMarkerFor({ amount: -300, category: '@Bank loan', comment: 'Interest' }, true),
    ).toBeNull();
    expect(
      gameMarkerFor({ amount: 500, category: '@Salary', comment: '#doodad' }, true),
    ).toBeNull();
  });
});
