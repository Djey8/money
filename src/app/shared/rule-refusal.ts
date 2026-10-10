/**
 * The game rules refuse things with English sentences (the domain package is shared with the Pro API, whose callers read
 * English). The app shows them in the player's language: each sentence is recognised by its wording and replaced by the
 * text under `CashflowGame.rules.msg.<id>`; a sentence it does not know is shown as it is.
 */

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface Pattern {
  id: string;
  test: RegExp;
  params?: (match: RegExpMatchArray) => Record<string, unknown>;
}

const PATTERNS: Pattern[] = [
  { id: 'noFreeForm', test: /do not allow free-form transactions/ },
  {
    id: 'freeCap',
    test: /limit a free amount to (\d+) minor units/,
    params: (m) => ({ max: (Number(m[1]) / 100).toLocaleString() }),
  },
  { id: 'priceFixed', test: /fix the price of a sale/ },
  { id: 'noLoan', test: /do not allow a Bank loan/ },
  {
    id: 'loanCap',
    test: /cap the Bank loan at (\d+) minor units/,
    params: (m) => ({ max: (Number(m[1]) / 100).toLocaleString() }),
  },
  { id: 'noSelling', test: /do not allow selling/ },
  {
    id: 'noBuyer',
    test: /^No buyer for (.+): these game rules only allow selling/,
    params: (m) => ({ title: m[1] }),
  },
  { id: 'drawFirst', test: /deal the card for a space: draw it first/ },
  { id: 'otherCard', test: /only allow the card that was offered on this space/ },
  { id: 'noSpaceForCard', test: /only deal a card for the space you landed on/ },
  { id: 'alreadyOffered', test: /A card was already offered on this space/ },
  { id: 'playedNoPass', test: /card of this space has been played: it cannot be passed/ },
  { id: 'payDoodad', test: /do not allow passing a payment/ },
  {
    id: 'buyNeedsCard',
    test: /only allow buying (.+) while its card is in hand/,
    params: (m) => ({ title: m[1] }),
  },
  { id: 'buyCardInHand', test: /only allow buying the card in hand/ },
  { id: 'rollOnly', test: /only allow the roll of the app/ },
  { id: 'diceFirst', test: /Roll the dice of your open card first/ },
  {
    id: 'alreadyOwned',
    test: /You already own (.+): a property is bought once|You already own this property/,
  },
  { id: 'cardPlayed', test: /This card has been played already/ },
  { id: 'waitsForDoodad', test: /The game waits for the payment/ },
];

/** The sentence in the player's language, or the sentence itself when it is not a game-rules refusal. */
export function translateRuleRefusal(message: string, translate: Translate | undefined): string {
  if (!translate) return message;
  for (const pattern of PATTERNS) {
    const match = message.match(pattern.test);
    if (match) {
      const key = `CashflowGame.rules.msg.${pattern.id}`;
      const text = translate(key, pattern.params ? pattern.params(match) : undefined);
      return text === key ? message : text;
    }
  }
  return message;
}
