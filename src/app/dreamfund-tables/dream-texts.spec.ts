import {
  cardText,
  characterName,
  characters,
  dreamMoney,
  dreamTexts,
  eventText,
  lifeCardOf,
} from './dream-texts';

describe('the words and the content of the Dreamfund tables', () => {
  it('has the ten characters, their names and the money of the game', () => {
    expect(characters('en')).toHaveLength(10);
    expect(characterName('jan-oberarzt', 'en')).toBe('Dr. Jan');
    expect(characterName('lena-pflege', 'de')).toBe('Lena');
    expect(dreamMoney(123400, 'en')).toBe('1,234 DT');
    expect(dreamMoney(123400, 'de')).toBe('1.234 TT');
  });

  it('writes in German where it is written, and in English otherwise', () => {
    expect(dreamTexts('de').roll).toBe('Würfeln');
    expect(dreamTexts('en').roll).toBe('Roll the dice');
    expect(dreamTexts('fr').roll).toBe('Roll the dice');
  });

  it('finds the cards of the piles by id, in the language of the table', () => {
    expect(cardText('opportunity', 'S29', 'en').title).toBeTruthy();
    expect(cardText('opportunity', 'S29', 'de').title).toBeTruthy();
    expect(cardText('opportunity', 'nope', 'en').title).toBe('nope');
    expect(lifeCardOf('L01', 'en').type).toBeTruthy();
  });

  it('tells the history in words, by seat', () => {
    const names = ['Ann', 'Bob'];
    const money = (minor: number) => `${minor / 100}`;
    const line = (type: string, seat: number | null, data?: Record<string, unknown>) => ({
      seq: 1,
      version: 1,
      at: '',
      type,
      seat,
      data,
    });
    expect(eventText(line('turn_started', 1), names, 'en', money)).toBe('Bob is on the move.');
    expect(eventText(line('player_won', 0), names, 'de', money)).toBe('Ann hat gewonnen!');
    expect(
      eventText(line('trade_made', 0, { holding: 'X', priceMinor: 5000 }), names, 'en', money),
    ).toBe('Trade: X for 50.');
    expect(eventText(line('something_else', 0), names, 'en', money)).toBe('');
  });
});
