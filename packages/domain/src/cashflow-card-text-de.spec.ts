import { CARD_TEXT_DE } from './cashflow-card-text-de-data';
import { cardText, registerCardTextDe } from './cashflow-card-text-de';

describe('the German of the card texts', () => {
  it('is English until the table is registered, never throws, and then German', () => {
    expect(cardText('Seed · savings', 'de')).toBe('Seed · savings');
    registerCardTextDe(undefined as never);
    expect(cardText('Seed · savings', 'de')).toBe('Seed · savings');
    registerCardTextDe(CARD_TEXT_DE);
    expect(cardText('Seed · savings', 'de')).toBe('Seed · Sparen');
    expect(cardText('Seed · savings', 'en')).toBe('Seed · savings');
    registerCardTextDe({});
  });
});
