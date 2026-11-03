/**
 * The words of the Insurances decision (JFK, 2026-11-03). English and German are written; another language shows English until it is
 * translated, as the other Dreamfund texts do.
 */
export interface InsuranceTexts {
  title: string;
  introTitle: string;
  intro1: string;
  intro2: string;
  introStart: string;
  introLater: string;
  begin: string;
  next: string;
  back: string;
  done: string;
  close: string;
  skip: string;
  stepOf: string;
  cost: string;
  perMonth: string;
  covers: string;
  effect: string;
  advice: string;
  cardsN: string;
  cardsOne: string;
  noCards: string;
  held: string;
  notHeld: string;
  startsNext: string;
  endsNext: string;
  chooseOne: string;
  none: string;
  value: Record<'essential' | 'useful' | 'situational' | 'rarely', string>;
  summary: string;
  total: string;
  nothing: string;
  billHint: string;
  button: string;
  needsCar: string;
  needsPet: string;
  overview: string;
}

const EN: InsuranceTexts = {
  title: 'Your insurances',
  introTitle: 'Insurances',
  intro1:
    'An insurance is a small price every month against a big damage that happens rarely. You pay the premium at every Payday; when an event card hits what the insurance protects, you pay only the deductible (never more than 500) instead of everything.',
  intro2:
    'Each insurance below protects you against particular events. We go through them one by one, the most important first. You can hop in or out whenever you like - the bill of the next month is in your Subscriptions.',
  introStart: 'Before the first roll your choice counts at once.',
  introLater:
    'A change counts from your next Payday - the premium and the cover start together, so nobody can insure just before the fire.',
  begin: 'Go through the insurances',
  next: 'Next',
  back: 'Back',
  done: 'Done',
  close: 'Close',
  skip: 'Skip to the summary',
  stepOf: '{n} of {total}',
  cost: 'It costs you',
  perMonth: 'a month',
  covers: 'It protects you against',
  effect: 'What it does in the game',
  advice: 'Is it worth it?',
  cardsN: '{n} event cards in the game are covered by it.',
  cardsOne: '1 event card in the game is covered by it.',
  noCards:
    'No event card is covered by it yet - until the cards are written it has no effect in the game, and the premium would still be paid.',
  held: 'Hopped in',
  notHeld: 'Not hopped in',
  startsNext: 'starts with the next Payday',
  endsNext: 'ends with the next Payday',
  chooseOne: 'Choose one - you cannot have both.',
  none: 'None',
  value: {
    essential: 'Essential',
    useful: 'Useful',
    situational: 'Only for some lives',
    rarely: 'Rarely worth it',
  },
  summary: 'Your monthly bill',
  total: 'Together a month',
  nothing: 'You hold no insurance.',
  billHint: 'These premiums are posted at your next Payday. The Subscriptions list shows the same.',
  button: 'Insurances',
  needsCar: 'Offered because you have a car.',
  needsPet: 'Offered because you have a pet.',
  overview: 'All insurances',
};

const DE: Partial<InsuranceTexts> = {
  title: 'Deine Versicherungen',
  introTitle: 'Versicherungen',
  intro1:
    'Eine Versicherung ist ein kleiner Preis jeden Monat gegen einen großen Schaden, der selten passiert. Du zahlst die Prämie bei jedem Zahltag; trifft eine Ereigniskarte, was die Versicherung schützt, zahlst du nur den Selbstbehalt (nie mehr als 500) statt alles.',
  intro2:
    'Jede Versicherung unten schützt dich vor bestimmten Ereignissen. Wir gehen sie nacheinander durch, die wichtigste zuerst. Du kannst jederzeit ein- und aussteigen - die Rechnung des nächsten Monats steht in deinen Abos.',
  introStart: 'Vor dem ersten Wurf zählt deine Wahl sofort.',
  introLater:
    'Eine Änderung zählt ab dem nächsten Zahltag - Prämie und Schutz beginnen gemeinsam, niemand versichert sich kurz vor dem Brand.',
  begin: 'Versicherungen durchgehen',
  next: 'Weiter',
  back: 'Zurück',
  done: 'Fertig',
  close: 'Schließen',
  skip: 'Zur Zusammenfassung',
  stepOf: '{n} von {total}',
  cost: 'Sie kostet dich',
  perMonth: 'im Monat',
  covers: 'Sie schützt dich vor',
  effect: 'Was sie im Spiel bewirkt',
  advice: 'Lohnt sie sich?',
  cardsN: '{n} Ereigniskarten im Spiel sind dadurch gedeckt.',
  cardsOne: '1 Ereigniskarte im Spiel ist dadurch gedeckt.',
  noCards:
    'Noch keine Ereigniskarte ist dadurch gedeckt - bis die Karten geschrieben sind, hat sie im Spiel keine Wirkung, die Prämie würde trotzdem gezahlt.',
  held: 'Eingestiegen',
  notHeld: 'Nicht eingestiegen',
  startsNext: 'beginnt mit dem nächsten Zahltag',
  endsNext: 'endet mit dem nächsten Zahltag',
  chooseOne: 'Wähle eine - beide zusammen geht nicht.',
  none: 'Keine',
  value: {
    essential: 'Unverzichtbar',
    useful: 'Sinnvoll',
    situational: 'Nur für manche Leben',
    rarely: 'Selten lohnend',
  },
  summary: 'Deine Monatsrechnung',
  total: 'Zusammen im Monat',
  nothing: 'Du hast keine Versicherung.',
  billHint: 'Diese Prämien werden mit dem nächsten Zahltag gebucht. Die Abo-Liste zeigt dasselbe.',
  button: 'Versicherungen',
  needsCar: 'Im Angebot, weil du ein Auto hast.',
  needsPet: 'Im Angebot, weil du ein Haustier hast.',
  overview: 'Alle Versicherungen',
};

export function insuranceTexts(lang: string): InsuranceTexts {
  return lang.slice(0, 2) === 'de' ? { ...EN, ...DE } : EN;
}
