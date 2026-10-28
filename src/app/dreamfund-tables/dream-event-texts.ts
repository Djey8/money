import { cardText, dreamMoney } from './dream-texts';

/**
 * What happens at a Dreamfund table, in words (todo/dreamfund-tables-solo-ui.md, R5): the headline of each event for the popups and the
 * history of the table layer, and the detail of the ones that have one (a card, a price). The classic events (a roll, a trade, a
 * player who is away) have their words already; these are the Dreamfund's own.
 */

const EN: Record<string, string> = {
  payday: 'got paid on a Payday',
  emergency: 'landed on an Emergency',
  life: 'landed on a Life card',
  career: 'tried for a promotion',
  dream: 'landed on a Dream tile',
  opportunity: 'looked for an Opportunity',
  opportunity_taken: 'took an Opportunity',
  harvest: 'drew a Harvest card',
  harvest_sold: 'sold into the Harvest',
  holding_sold: 'sold a holding',
  money_moved: 'moved money',
  goal_reached: 'reached a goal',
  player_won: 'reached all the goals',
  turn_started: 'is on the move',
};

const DE: Record<string, string> = {
  payday: 'hat Zahltag gehabt',
  emergency: 'ist auf einem Notfall gelandet',
  life: 'ist auf einer Lebenskarte gelandet',
  career: 'hat es mit einer Beförderung versucht',
  dream: 'ist auf einem Traumfeld gelandet',
  opportunity: 'hat nach einer Chance gesucht',
  opportunity_taken: 'hat eine Chance genutzt',
  harvest: 'hat eine Ernte-Karte gezogen',
  harvest_sold: 'hat in die Ernte verkauft',
  holding_sold: 'hat eine Beteiligung verkauft',
  money_moved: 'hat Geld bewegt',
  goal_reached: 'hat ein Ziel erreicht',
  player_won: 'hat alle Ziele erreicht',
  turn_started: 'ist am Zug',
};

/** The headline of a Dreamfund event (empty for an event that is not the Dreamfund's own). */
export function dreamEventTitle(type: string, lang: string): string {
  return (lang === 'de' ? DE : EN)[type] ?? '';
}

const GOALS: Record<string, { en: string; de: string }> = {
  reserve: { en: 'the reserve', de: 'die Reserve' },
  debts: { en: 'no debts', de: 'schuldenfrei' },
  dream: { en: 'the dream', de: 'der Traum' },
  independence: { en: 'independence', de: 'Unabhängigkeit' },
  won: { en: 'everything', de: 'alles' },
};

const WHAT: Record<string, { en: string; de: string }> = {
  emergency: { en: 'emergency paid', de: 'Notfall bezahlt' },
  reserve: { en: 'into the reserve', de: 'in die Reserve' },
  dream: { en: 'into the dream', de: 'in den Traum' },
  debt: { en: 'debt repaid', de: 'Schuld getilgt' },
  bank_loan: { en: 'bank loan repaid', de: 'Bankkredit getilgt' },
};

/** The detail line of a Dreamfund event: the card, the price, the goal. */
export function dreamEventDetail(
  type: string,
  data: Record<string, unknown> | undefined,
  lang: string,
): string {
  const l = lang === 'de' ? 'de' : 'en';
  const d = data ?? {};
  switch (type) {
    case 'opportunity_taken': {
      const id = String(d['cardId'] ?? '');
      const title = id ? (cardText('opportunity', id, lang).title ?? id) : '';
      const cost = typeof d['costMinor'] === 'number' ? dreamMoney(d['costMinor'], lang) : '';
      return [title, cost].filter(Boolean).join(' · ');
    }
    case 'harvest': {
      const id = String(d['cardId'] ?? '');
      return id ? (cardText('harvest', id, lang).title ?? id) : '';
    }
    case 'goal_reached':
      return GOALS[String(d['goal'] ?? '')]?.[l] ?? String(d['goal'] ?? '');
    case 'holding_sold': {
      const gross = typeof d['grossMinor'] === 'number' ? dreamMoney(d['grossMinor'], lang) : '';
      return [String(d['holding'] ?? ''), gross].filter(Boolean).join(' · ');
    }
    case 'money_moved': {
      const what = WHAT[String(d['what'] ?? '')]?.[l] ?? '';
      const amount =
        typeof d['amountMinor'] === 'number'
          ? dreamMoney(d['amountMinor'], lang)
          : typeof d['payMinor'] === 'number'
            ? dreamMoney(d['payMinor'], lang)
            : '';
      return [what, amount].filter(Boolean).join(' · ');
    }
    case 'payday':
      return d['round'] === undefined ? '' : `${d['round']}`;
    default:
      return '';
  }
}
