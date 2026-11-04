import { cardText, dreamMoney } from './dream-texts';

/**
 * What happens at a Dreamfund table, in words (todo/dreamfund-tables-solo-ui.md, R5): the headline of each event for the popups and the
 * history of the table layer, and the detail of the ones that have one (a card, a price). The classic events (a roll, a trade, a
 * player who is away) have their words already; these are the Dreamfund's own.
 */

const EN: Record<string, string> = {
  payday: 'got paid on a Payday',
  payday_opening: 'got the opening Payday',
  emergency: 'landed on an Emergency',
  life: 'landed on a Life card',
  career: 'tried for a promotion',
  dream: 'landed on a Dream tile',
  opportunity: 'looked for an Opportunity',
  opportunity_taken: 'took an Opportunity',
  opportunity_offers: 'was offered Opportunities',
  opportunity_planned: 'planned an investment in Grow',
  opportunity_passed: 'passed on the Opportunities',
  life_answered: 'decided about a Life card',
  dream_taken: 'took a dream',
  dream_declined: 'left the dreams',
  harvest: 'drew a Harvest card',
  harvest_sold: 'sold into the Harvest',
  holding_sold: 'sold a holding',
  money_moved: 'moved money',
  job_search: 'looked for a job',
  goal_reached: 'reached a goal',
  player_won: 'reached all the goals',
  turn_started: 'is on the move',
};

const DE: Record<string, string> = {
  payday: 'hat Zahltag gehabt',
  payday_opening: 'hat den Start-Zahltag bekommen',
  emergency: 'ist auf einem Notfall gelandet',
  life: 'ist auf einer Lebenskarte gelandet',
  career: 'hat es mit einer Beförderung versucht',
  dream: 'ist auf einem Traumfeld gelandet',
  opportunity: 'hat nach einer Chance gesucht',
  opportunity_taken: 'hat eine Chance genutzt',
  opportunity_offers: 'bekam Chancen angeboten',
  opportunity_planned: 'hat eine Anlage in Grow geplant',
  opportunity_passed: 'hat die Chancen ausgelassen',
  life_answered: 'hat über eine Lebenskarte entschieden',
  dream_taken: 'hat einen Traum genommen',
  dream_declined: 'hat die Träume gelassen',
  harvest: 'hat eine Ernte-Karte gezogen',
  harvest_sold: 'hat in die Ernte verkauft',
  holding_sold: 'hat eine Beteiligung verkauft',
  money_moved: 'hat Geld bewegt',
  job_search: 'hat nach einem Job gesucht',
  goal_reached: 'hat ein Ziel erreicht',
  player_won: 'hat alle Ziele erreicht',
  turn_started: 'ist am Zug',
};

/** The headline of a Dreamfund event (empty for an event that is not the Dreamfund's own). */
export function dreamEventTitle(
  type: string,
  lang: string,
  data?: Record<string, unknown>,
): string {
  const words = lang === 'de' ? DE : EN;
  return (type === 'payday' && data?.['opening'] ? words['payday_opening'] : words[type]) ?? '';
}

const GOALS: Record<string, { en: string; de: string }> = {
  reserve: { en: 'the reserve', de: 'die Reserve' },
  debts: { en: 'no debts', de: 'schuldenfrei' },
  dream: { en: 'the dream', de: 'der Traum' },
  points: { en: 'the dream points', de: 'die Traumpunkte' },
  independence: { en: 'independence', de: 'Unabhängigkeit' },
  won: { en: 'everything', de: 'alles' },
};

const WHAT: Record<string, { en: string; de: string }> = {
  emergency: { en: 'emergency paid', de: 'Notfall bezahlt' },
  reserve: { en: 'into the reserve', de: 'in die Reserve' },
  dream: { en: 'into the dream', de: 'in den Traum' },
  debt: { en: 'debt repaid', de: 'Schuld getilgt' },
  bank_loan: { en: 'bank loan repaid', de: 'Bankkredit getilgt' },
  emergency_fund: { en: 'paid into an emergency', de: 'in einen Notfall gezahlt' },
};

const DECISIONS: Record<string, { en: string; de: string }> = {
  accept: { en: 'accepted', de: 'angenommen' },
  decline: { en: 'declined', de: 'abgelehnt' },
  pass: { en: 'passed', de: 'weitergegeben' },
  fate: { en: 'it happened', de: 'es ist passiert' },
  give: { en: 'gave', de: 'gegeben' },
  lend: { en: 'lent', de: 'geliehen' },
};

type Deck = 'emergency' | 'life' | 'dream' | 'opportunity' | 'harvest';

/** The names of the cards of a list of ids, in one line. */
function names(deck: Deck, ids: unknown, lang: string): string {
  return (Array.isArray(ids) ? ids : [])
    .map((id) => cardText(deck, String(id), lang).title)
    .join(', ');
}

/** The card an event is about, when it names one: so a history line can open it. */
export function dreamEventCard(
  type: string,
  data: Record<string, unknown> | undefined,
): string | undefined {
  const id = data?.['cardId'];
  if (typeof id === 'string' && id) return id;
  const offers = data?.['offers'];
  return type === 'dream_declined' || type === 'opportunity_passed' || type === 'opportunity_offers'
    ? typeof (offers as unknown[] | undefined)?.[0] === 'string'
      ? String((offers as unknown[])[0])
      : undefined
    : undefined;
}

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
    case 'job_search':
      return `🎲 ${d['roll']} (${l === 'de' ? 'nötig' : 'needed'} ${d['rollFrom']}+) · ${d['result'] === 'found' ? (l === 'de' ? 'gefunden' : 'found') : l === 'de' ? 'verpasst' : 'missed'}`;
    case 'emergency':
      return d['cardId'] ? cardText('emergency', String(d['cardId']), lang).title : '';
    case 'life':
      return d['cardId'] ? cardText('life', String(d['cardId']), lang).title : '';
    case 'dream':
      return names('dream', d['offers'], lang);
    case 'opportunity_planned':
      return cardText('opportunity', String(d['cardId'] ?? ''), lang).title;
    case 'opportunity_offers':
    case 'opportunity_passed':
      return names('opportunity', d['offers'], lang);
    case 'dream_declined':
      return names('dream', d['offers'], lang);
    case 'dream_taken':
      return cardText('dream', String(d['cardId'] ?? ''), lang).title;
    case 'life_answered': {
      const said = String(d['decision'] ?? '');
      return [cardText('life', String(d['cardId'] ?? ''), lang).title, DECISIONS[said]?.[l] ?? said]
        .filter(Boolean)
        .join(' · ');
    }
    case 'money_moved': {
      const what = WHAT[String(d['what'] ?? '')]?.[l] ?? '';
      if (d['what'] === 'emergency_fund' && d['cardId']) {
        return `${cardText('emergency', String(d['cardId']), lang).title} · ${dreamMoney(Number(d['amountMinor']), lang)}`;
      }
      if (d['what'] === 'emergency' && d['cardId']) {
        const plan =
          typeof d['how'] === 'number' ? ` · ${d['how']} ×` : d['how'] === 'later' ? ' · Fire' : '';
        const pay =
          typeof d['payMinor'] === 'number' ? ` · ${dreamMoney(d['payMinor'], lang)}` : '';
        return `${cardText('emergency', String(d['cardId']), lang).title}${pay}${plan}`;
      }
      const amount =
        typeof d['amountMinor'] === 'number'
          ? dreamMoney(d['amountMinor'], lang)
          : typeof d['payMinor'] === 'number'
            ? dreamMoney(d['payMinor'], lang)
            : '';
      return [what, amount].filter(Boolean).join(' · ');
    }
    case 'payday':
      return d['round'] === undefined ? '' : `${l === 'de' ? 'Monat' : 'Month'} ${d['round']}`;
    default:
      return '';
  }
}
