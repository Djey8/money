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

describe('gameMarkerFor: the cards of the Dreamer', () => {
  const kinds: Record<string, 'opportunity' | 'life' | 'emergency' | 'career' | 'harvest'> = {
    'ai subscription audit': 'opportunity',
    'gym membership': 'life',
    'car breakdown': 'emergency',
    'junior data analyst': 'career',
    'wheat sale': 'harvest',
  };
  const cardKindOf = (title: string) => kinds[title.toLowerCase()] ?? null;
  const book = (category: string, amount = -100) => ({
    amount,
    category,
    comment: `${category}\n#dreamfund`,
  });

  it('marks a booking tagged #dreamfund whose category is the title of a card', () => {
    expect(gameMarkerFor(book('@Gym Membership'), true, cardKindOf)).toBe('life');
    expect(gameMarkerFor(book('@Car breakdown'), true, cardKindOf)).toBe('emergency');
    expect(gameMarkerFor(book('@Junior Data Analyst', -300), true, cardKindOf)).toBe('career');
    expect(gameMarkerFor(book('@AI Subscription Audit', 6), true, cardKindOf)).toBe('opportunity');
    expect(gameMarkerFor(book('@Wheat sale', 900), true, cardKindOf)).toBe('harvest');
  });

  it('leaves ordinary bookings, untagged ones and a normal account alone', () => {
    expect(gameMarkerFor(book('@Groceries'), true, cardKindOf)).toBeNull();
    expect(
      gameMarkerFor(
        { amount: -5, category: '@Gym Membership', comment: 'my own note' },
        true,
        cardKindOf,
      ),
    ).toBeNull();
    expect(gameMarkerFor(book('@Gym Membership'), false, cardKindOf)).toBeNull();
    expect(gameMarkerFor(book('@Gym Membership'), true)).toBeNull();
  });
});
