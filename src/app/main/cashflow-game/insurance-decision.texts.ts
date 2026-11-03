/**
 * The words of the Insurances decision (JFK, 2026-11-03). English and German are written; another language shows English until it is
 * translated, as the other Dreamfund texts do.
 */
export interface InsuranceTexts {
  title: string;
  intro: string;
  introStart: string;
  introLater: string;
  done: string;
  close: string;
  back: string;
  covers: string;
  held: string;
  notHeld: string;
  startsNext: string;
  endsNext: string;
  total: string;
}

const EN: InsuranceTexts = {
  title: 'Insurances',
  intro:
    'An insurance is a small price every month against a big damage that happens rarely. Open one to read what it protects you against, and hop in or out with its switch.',
  introStart: 'Before the first roll your choice counts at once.',
  introLater:
    'A change counts from your next Payday - the premium and the cover start together, so nobody can insure just before the fire.',
  done: 'Done',
  close: 'Close',
  back: 'Back',
  covers: 'It protects you against',
  held: 'Hopped in',
  notHeld: 'Not hopped in',
  startsNext: 'Starts with the next Payday.',
  endsNext: 'Ends with the next Payday.',
  total: 'Together a month',
};

const DE: Partial<InsuranceTexts> = {
  title: 'Versicherungen',
  intro:
    'Eine Versicherung ist ein kleiner Preis jeden Monat gegen einen großen Schaden, der selten passiert. Öffne eine, um zu lesen, wovor sie dich schützt, und steige mit dem Schalter ein oder aus.',
  introStart: 'Vor dem ersten Wurf zählt deine Wahl sofort.',
  introLater:
    'Eine Änderung zählt ab dem nächsten Zahltag - Prämie und Schutz beginnen gemeinsam, niemand versichert sich kurz vor dem Brand.',
  done: 'Fertig',
  close: 'Schließen',
  back: 'Zurück',
  covers: 'Sie schützt dich vor',
  held: 'Eingestiegen',
  notHeld: 'Nicht eingestiegen',
  startsNext: 'Beginnt mit dem nächsten Zahltag.',
  endsNext: 'Endet mit dem nächsten Zahltag.',
  total: 'Zusammen im Monat',
};

export function insuranceTexts(lang: string): InsuranceTexts {
  return lang.slice(0, 2) === 'de' ? { ...EN, ...DE } : EN;
}
