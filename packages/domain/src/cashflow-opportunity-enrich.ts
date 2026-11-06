import type { OpportunityCard } from './cashflow-game/opportunity-deck';
import {
  act,
  ENRICH_DE,
  link,
  type CardEnrichment,
  type EnrichAction,
  type EnrichLink,
} from './cashflow-enrich-kit';
import { CAREER_PENSION_CARDS } from './cashflow-opportunity-career';
import { SAPLING_ENRICH } from './cashflow-enrich-sapling';
import { SEED_ENRICH } from './cashflow-enrich-seed';
import { TREE_ENRICH } from './cashflow-enrich-tree';

/**
 * The second pass over the Opportunity cards (JFK, 2026-11-05): every card with how to invest, a tip and a warning, a risk with its
 * reason, links to read more and tasks to do. The cards of the sketch and the balance of `cashflow-opportunity-tuning.ts` stay as they
 * are; this lays the texts over them, and gives a scam the monthly cash flow it advertises like any other offer.
 */
export const OPPORTUNITY_ENRICH: Record<string, CardEnrichment> = {
  ...SEED_ENRICH,
  ...SAPLING_ENRICH,
  ...TREE_ENRICH,
};

/** The cards of the second pass that bring their own words (pensions, career and education), put after the first stack. */
export { CAREER_PENSION_CARDS };

/** The German of the new texts, by their English text (registered with the German of the first stack). */
export const OPPORTUNITY_ENRICH_DE = ENRICH_DE;

const MAX_LINKS = 4;
const MAX_ACTIONS = 5;
const MIN_LINKS = 2;
const MIN_ACTIONS = 3;

/** What every card of a kind gets when its own list is short: a place to read, and the next steps that fit the kind. */
function defaultsFor(card: OpportunityCard): { links: EnrichLink[]; actions: EnrichAction[] } {
  if (card.trap || card.growType !== 'income-growth') {
    return {
      links: [
        link('BaFin – Verbraucher', 'https://www.bafin.de/'),
        link('Verbraucherzentrale', 'https://www.verbraucherzentrale.de/'),
      ],
      actions: [
        act(
          'Look the provider up in the BaFin company database',
          'Suche den Anbieter in der Unternehmensdatenbank der BaFin',
          'high',
        ),
        act(
          'Try a small amount first, and take it out again before you put in more',
          'Probiere zuerst einen kleinen Betrag und hole ihn wieder heraus, bevor du mehr einzahlst',
          'high',
        ),
        act(
          'Write down what you would do if it paid nothing',
          'Schreibe auf, was du tätest, wenn es nichts zahlt',
          'medium',
        ),
      ],
    };
  }
  if (card.share) {
    return {
      links: [
        link('Wikipedia – Aktie', 'https://de.wikipedia.org/wiki/Aktie'),
        link('Finanztip – Aktien', 'https://www.finanztip.de/aktien/'),
      ],
      actions: [
        act(
          'Write down the price at which you add and the price at which you sell, before you buy',
          'Schreibe den Kurs, bei dem du nachkaufst, und den Kurs, bei dem du verkaufst, vor dem Kauf auf',
          'high',
        ),
        act(
          'Buy in two or three steps instead of all at once',
          'Kaufe in zwei, drei Schritten statt auf einmal',
          'medium',
        ),
        act(
          'Look at the costs (fund fee, broker fee) before you buy',
          'Sieh dir die Kosten (Fondsgebühr, Brokergebühr) vor dem Kauf an',
          'medium',
        ),
      ],
    };
  }
  if (card.property || card.kind === 'investment') {
    return {
      links: [
        link('Wikipedia – Mietrendite', 'https://de.wikipedia.org/wiki/Mietrendite'),
        link('Wikipedia – Hypothek', 'https://de.wikipedia.org/wiki/Hypothek'),
      ],
      actions: [
        act(
          'Check the rent against the local rent index and the running costs against the last statement',
          'Prüfe die Miete am örtlichen Mietspiegel und die Nebenkosten an der letzten Abrechnung',
          'high',
        ),
        act(
          'Plan a reserve of a few months of rent for repairs and empty months',
          'Plane eine Rücklage von einigen Monatsmieten für Reparaturen und Leerstand',
          'medium',
        ),
        act(
          'Decide in advance at which price you would sell',
          'Lege vorher fest, bei welchem Preis du verkaufen würdest',
          'medium',
        ),
      ],
    };
  }
  if (card.market) {
    return {
      links: [
        link('Wikipedia – Sammlerstück', 'https://de.wikipedia.org/wiki/Sammlerst%C3%BCck'),
        link('Verbraucherzentrale', 'https://www.verbraucherzentrale.de/'),
      ],
      actions: [
        act(
          'Keep the receipt, the papers and the original packaging',
          'Bewahre Beleg, Papiere und Originalverpackung auf',
          'high',
        ),
        act(
          'Compare three prices before you buy and again before you sell',
          'Vergleiche drei Preise vor dem Kauf und noch einmal vor dem Verkauf',
          'medium',
        ),
        act(
          'Write down how long you will hold it and at which price you sell',
          'Schreibe auf, wie lange du es hältst und bei welchem Preis du verkaufst',
          'medium',
        ),
      ],
    };
  }
  return {
    links: [
      link('Gründerplattform', 'https://www.gruenderplattform.de/'),
      link('Wikipedia – Gewerbeanmeldung', 'https://de.wikipedia.org/wiki/Gewerbeanmeldung'),
    ],
    actions: [
      act(
        'Write down the hours a week it takes and what it must earn in the first three months',
        'Schreibe auf, wie viele Stunden pro Woche es braucht und was es in den ersten drei Monaten verdienen muss',
        'high',
      ),
      act(
        'Register what must be registered and ask a tax adviser about VAT',
        'Melde an, was angemeldet werden muss, und frag einen Steuerberater zur Umsatzsteuer',
        'medium',
      ),
      act(
        'After three months decide: grow it, change it or stop',
        'Entscheide nach drei Monaten: ausbauen, ändern oder aufhören',
        'medium',
      ),
    ],
  };
}

/** The cards with the enrichment laid over them (a copy: the cards are never changed). */
export function enrichOpportunityCards(
  cards: readonly OpportunityCard[],
  enrich: Record<string, CardEnrichment> = OPPORTUNITY_ENRICH,
): OpportunityCard[] {
  return cards.map((source) => {
    const extra = enrich[source.id];
    if (!extra) return source;
    const card: OpportunityCard = { ...source };
    if (extra.strategy) card.strategy = extra.strategy;
    if (extra.reasoning) card.reasoning = extra.reasoning;
    if (extra.risks) card.risks = extra.risks;
    if (extra.riskScore !== undefined) card.riskScore = extra.riskScore;
    if (extra.insights) card.insights = extra.insights;
    if (extra.tip) card.tip = extra.tip;
    if (extra.cashflowMinor !== undefined && card.cashflowMinor === undefined) {
      card.cashflowMinor = extra.cashflowMinor;
    }
    const links = [...source.links];
    for (const entry of extra.links ?? []) {
      if (!links.some((candidate) => candidate.url === entry.url)) links.push(entry);
    }
    const defaults = defaultsFor(source);
    for (const entry of defaults.links) {
      if (links.length >= MIN_LINKS) break;
      if (!links.some((candidate) => candidate.url === entry.url)) links.push(entry);
    }
    card.links = links.slice(0, MAX_LINKS);
    const actions = [...source.actions];
    for (const entry of extra.actions ?? []) {
      if (!actions.some((candidate) => candidate.text === entry.text)) actions.push(entry);
    }
    for (const entry of defaults.actions) {
      if (actions.length >= MIN_ACTIONS) break;
      if (!actions.some((candidate) => candidate.text === entry.text)) actions.push(entry);
    }
    card.actions = actions.slice(0, MAX_ACTIONS);
    return card;
  });
}
