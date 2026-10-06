import type { CardPlanText } from './deals';
import type { GameText } from './game-text';
import type { CashflowDealCard, CashflowDoodadCard } from './types';

/**
 * The words a card brings into the account in the game's language (todo/cashflow-game-pro.md slice D3): what a planned
 * Deal's Grow project reads, and the category and joke of a Doodad payment. Composed here so the Pro API writes exactly
 * what the game page does - the page still has its own copy of the Deal part (`planText`), which it can drop in favour
 * of this one.
 */

/** What one physical card prints besides its language-neutral numbers. */
export interface CardPrintedText {
  success?: string;
  failure?: string;
  heading?: string;
  title?: string;
  description?: string;
  note?: string;
  comment?: string;
}

/** The per-language card text catalog (assets/i18n/cashflow-cards/<lang>.json), with its fallback to English. */
export interface CardTextSource {
  textFor(cardId: string): CardPrintedText;
  symbolFor(symbol: string | undefined): string | undefined;
  sharedText(key: string): string;
  groupName(group: string): string;
}

export interface CardTextDeps {
  /** The app's `CashflowGame.*` strings. */
  text: GameText;
  cards: CardTextSource;
  /** An amount as the card text words it ("4.000 €"). */
  money: (amountMinor: number) => string;
}

function diceWinLabel(successOn: number, text: GameText): string {
  return text(successOn >= 6 ? 'CashflowGame.cardDiceWin' : 'CashflowGame.cardDiceWinRange', {
    n: successOn,
  });
}

/** What the Grow project gets from a drawn Deal card: its description (the card itself), note, label and strategy. */
export function dealPlanText(card: CashflowDealCard, deps: CardTextDeps): CardPlanText {
  const { text, cards, money } = deps;
  const printed = cards.textFor(card.id);
  const t = (key: string) => text(`CashflowGame.${key}`);
  const amount = (minor?: number) => money(minor ?? 0);

  if (card.assetKind === 'asset') {
    const name = printed.title ?? card.title;
    const isDice = Boolean(card.successOn);
    const facts = [
      `${t('dealCost')}: ${amount(card.costMinor)}`,
      card.payoutMinor
        ? `${t(card.recurring ? 'cardPaydayPayout' : 'cardPayout')}: ${amount(card.payoutMinor)}`
        : `${t('cardCoins')}: ${card.quantity ?? 0}`,
      isDice ? diceWinLabel(card.successOn!, text) : '',
    ]
      .filter(Boolean)
      .join('\n');
    return {
      title: name,
      description: [
        name,
        printed.description,
        isDice ? '' : cards.sharedText('investmentRule'),
        facts,
      ]
        .filter(Boolean)
        .join('\n\n'),
      note: printed.note,
      symbol: cards.symbolFor(card.symbol),
      strategy: isDice ? diceWinLabel(card.successOn!, text) : undefined,
      success: printed.success,
      failure: printed.failure,
    };
  }

  if (card.assetKind !== 'share') {
    const deposit = card.depositMinor ?? 0;
    const mortgage = card.mortgageMinor ?? 0;
    const numbers = [
      `${t('dealCost')}: ${amount(deposit + mortgage)}`,
      `${t('dealDeposit')}: ${amount(deposit)}`,
      `${t('dealMortgage')}: ${amount(mortgage)}`,
      `${t('dealCashflow')}: +${amount(card.cashflowMinor)}`,
    ].join('\n');
    return {
      title: printed.title ?? card.title,
      description: [
        printed.heading
          ? `${printed.heading}\n${printed.title ?? card.title}`
          : (printed.title ?? card.title),
        printed.description,
        cards.sharedText('investmentRule'),
        numbers,
      ]
        .filter(Boolean)
        .join('\n\n'),
      note: printed.note,
      symbol: cards.symbolFor(card.symbol),
    };
  }

  const description = [
    `${card.title} (${card.symbol ?? card.title})`,
    printed.description,
    cards.sharedText('shareRule'),
    `${text('CashflowGame.cardPriceToday')}: ${amount(card.priceMinor)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const strategy =
    card.rangeMinMinor !== undefined && card.rangeMaxMinor !== undefined
      ? `${text('CashflowGame.cardTradingRange')}: ${amount(card.rangeMinMinor)} - ${amount(card.rangeMaxMinor)}`
      : undefined;
  return { description, note: printed.note, strategy };
}

/** What a Doodad payment is called in the books: its spending group in the game's language, else the card's name. */
export function doodadPaymentCategory(card: CashflowDoodadCard, deps: CardTextDeps): string {
  return card.group
    ? deps.cards.groupName(card.group)
    : (deps.cards.textFor(card.id).title ?? card.title);
}

/** The card's heading in the game's language (a star card is the jackpot of the pile). */
export function doodadPaymentTitle(card: CashflowDoodadCard, deps: CardTextDeps): string {
  const name = deps.cards.textFor(card.id).title ?? card.title;
  return (card as { star?: boolean }).star ? `${name} ★` : name;
}
