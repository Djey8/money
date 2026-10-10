import { translateRuleRefusal } from './rule-refusal';
// Node globals: the spec tsconfig carries no node typings.
declare const require: (id: string) => any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

const LANGUAGES = ['en', 'de', 'es', 'fr', 'cn', 'ar'];
const i18n = (language: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.join(__dirname, `../../assets/i18n/${language}.json`), 'utf8'));

/** Every sentence the game rules can refuse with (packages/domain rules.ts and neighbours), by the id it is shown as. */
const SENTENCES: Record<string, string> = {
  noFreeForm:
    'These game rules do not allow free-form transactions: use the game moves (cards, selling, Payday).',
  freeCap: 'These game rules limit a free amount to 5000 minor units.',
  priceFixed:
    'These game rules fix the price of a sale to the offer of the Market card; it cannot be named.',
  noLoan: 'These game rules do not allow a Bank loan.',
  loanCap: 'These game rules cap the Bank loan at 200000 minor units.',
  noSelling: 'These game rules do not allow selling.',
  noBuyer:
    'No buyer for OK4U: these game rules only allow selling while a Market card offers a price for it.',
  drawFirst: 'These game rules deal the card for a space: draw it first.',
  otherCard: 'These game rules only allow the card that was offered on this space (ds-1).',
  noSpaceForCard: 'These game rules only deal a card for the space you landed on.',
  alreadyOffered:
    'A card was already offered on this space: play it or pass. These game rules deal one card.',
  playedNoPass:
    'The card of this space has been played: it cannot be passed any more, tick it off.',
  payDoodad:
    'These game rules do not allow passing a payment (a Doodad or a cost card): pay it, the game waits for the payment.',
  buyNeedsCard:
    'These game rules only allow buying EFH while its card is in hand or a price card of it is open.',
  buyCardInHand:
    'These game rules only allow buying the card in hand: the card picked on this space.',
  rollOnly: 'These game rules only allow the roll of the app: the outcome cannot be reported.',
  diceFirst: 'Roll the dice of your open card first: the card of this space comes after it.',
  alreadyOwned: 'You already own EFH: a property is bought once.',
  cardPlayed: 'This card has been played already: a card is played once, tick it off.',
  waitsForDoodad:
    'The game waits for the payment: pay it first, nothing else can be played, bought or sold. A Bank loan is possible.',
};

describe('translateRuleRefusal', () => {
  it.each(LANGUAGES)('has a text for every refusal in %s', (language) => {
    const texts = i18n(language);
    for (const id of Object.keys(SENTENCES)) {
      expect(texts[`CashflowGame.rules.msg.${id}`]).toBeTruthy();
    }
  });

  it('turns each sentence into the text of its id, with the title or the amount filled in', () => {
    const translate = (key: string, params?: Record<string, unknown>) =>
      `T:${key}${params ? JSON.stringify(params) : ''}`;
    for (const [id, sentence] of Object.entries(SENTENCES)) {
      expect(translateRuleRefusal(sentence, translate)).toContain(`CashflowGame.rules.msg.${id}`);
    }
    expect(translateRuleRefusal(SENTENCES['noBuyer'], translate)).toContain('"title":"OK4U"');
    expect(translateRuleRefusal(SENTENCES['buyNeedsCard'], translate)).toContain('"title":"EFH"');
    expect(translateRuleRefusal(SENTENCES['freeCap'], translate)).toContain('"max"');
  });

  it('leaves another sentence, or a missing translator, alone', () => {
    expect(translateRuleRefusal('Could not start the game.', (key) => key)).toBe(
      'Could not start the game.',
    );
    expect(translateRuleRefusal(SENTENCES['noLoan'], undefined)).toBe(SENTENCES['noLoan']);
    // a language without the key shows the sentence, not the key
    expect(translateRuleRefusal(SENTENCES['noLoan'], (key) => key)).toBe(SENTENCES['noLoan']);
  });
});
