import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { HARVEST_CARDS } from '../../cashflow-harvest-cards';
import { OPPORTUNITY_CARDS as SKETCH_CARDS } from '../../cashflow-opportunity-cards';
import { tuneOpportunityCards } from '../../cashflow-opportunity-tuning';
import { DREAM_POLICIES } from './policies';
import type { DreamGameRecord } from './world';

/**
 * The statistics of a simulation as a page the players can read (JFK, 2026-10-26): what each way of playing achieves, how a game
 * unfolds, which cards carry a win and which events break a game. It is generated from the records of `runBatch`, never typed by hand,
 * in English or German.
 */

const OPPORTUNITY = tuneOpportunityCards(SKETCH_CARDS);
const SET = CASHFLOW_GAME_SETS.find((set) => set.id === 'jfk-stories');

type Lang = 'en' | 'de';
const titles = new Map<string, { en: string; de: string; kind: string }>();
for (const card of OPPORTUNITY) {
  titles.set(card.id, { en: card.title.en, de: card.title.de, kind: `Opportunity · ${card.pile}` });
}
for (const card of HARVEST_CARDS) {
  titles.set(card.id, { en: card.title.en, de: card.title.de, kind: 'Harvest' });
}
for (const [kind, deck] of [
  ['Emergency', SET?.decks?.emergency],
  ['Life', SET?.decks?.life],
  ['Dream', SET?.decks?.dream],
] as const) {
  for (const card of (deck ?? []) as { id: string; title: { en: string; de: string } }[]) {
    titles.set(card.id, { en: card.title.en, de: card.title.de, kind });
  }
}

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
/** A turn is one roll of the dice; a Payday (a month) comes about every 2.5 rolls on the Medium maps. */
const monthsText = (turns: number | null) => (turns === null ? '-' : `${Math.round(turns / 2.5)}`);
const won = (rows: DreamGameRecord[]) =>
  rows.length ? rows.filter((row) => row.outcome === 'won').length / rows.length : 0;
const bankrupt = (rows: DreamGameRecord[]) =>
  rows.length ? rows.filter((row) => row.outcome === 'bankrupt').length / rows.length : 0;

export interface StatsDocOptions {
  profession: string;
  maxTurns: number;
  shapes: string[];
  lang?: Lang;
}

/** The strategies in words: what each one does, in both languages. */
const NAMES: Record<string, [string, string]> = {
  saver: ['Cautious saver', 'Vorsichtiger Sparer'],
  etf: ['ETF investor', 'ETF-Anleger'],
  property: ['Property builder', 'Immobilienaufbauer'],
  hustler: ['Side hustler', 'Nebenprojekt-Gründer'],
  gambler: ['Gambler', 'Zocker'],
  expert: ['Informed investor', 'Informierter Anleger'],
  dividend: ['Dividend snowball', 'Dividenden-Schneeball'],
  sapling: ['Sapling business builder', 'Sapling-Unternehmer'],
  tree: ['Tree saver', 'Tree-Sparer'],
  dreamer: ['Dream chaser', 'Traumjäger'],
  steady: ['Steady builder', 'Stetiger Aufbauer'],
  passive: ['Free cards only', 'Nur Gratis-Karten'],
};
const IDEAS: Record<string, [string, string]> = {
  saver: [
    'Keeps cash, takes only the safest cards (savings, bonds, a world ETF) and funds the reserve and the dream first.',
    'Hält Bargeld, nimmt nur die sichersten Karten (Ersparnisse, Anleihen, einen Welt-ETF) und füllt zuerst Notgroschen und Traum.',
  ],
  etf: [
    'Puts the free money into index and dividend ETFs and bonds, little else.',
    'Steckt das freie Geld in Index- und Dividenden-ETFs und Anleihen, sonst kaum etwas.',
  ],
  property: [
    'Saves for the Tree pile and buys rental properties with a mortgage.',
    'Spart für den Tree-Stapel und kauft Mietimmobilien mit Hypothek.',
  ],
  hustler: [
    'Starts side hustles and small businesses from the Seed and Sapling piles, one after the other.',
    'Startet nacheinander Nebenprojekte und kleine Unternehmen aus dem Seed- und Sapling-Stapel.',
  ],
  gambler: [
    'Goes for crypto, hot tips, collectibles and the hype ladder.',
    'Setzt auf Krypto, heiße Tipps, Sammlerstücke und die Hype-Leiter.',
  ],
  expert: [
    'Takes every free saving, then whatever pays most for its price from all three piles, plans the reserve and the dream by payment plans and starts the dream only once the passive income carries part of the costs.',
    'Nimmt jede Gratis-Ersparnis, dann aus allen drei Stapeln, was für den Preis am meisten zahlt, plant Notgroschen und Traum mit Zahlungsplänen und startet den Traum erst, wenn das passive Einkommen einen Teil der Kosten trägt.',
  ],
  dividend: [
    'Builds a snowball of dividend shares from all piles.',
    'Baut aus allen Stapeln einen Schneeball von Dividendenaktien auf.',
  ],
  sapling: [
    'Builds businesses and hustles from the Sapling pile and never buys property.',
    'Baut Unternehmen und Nebenprojekte aus dem Sapling-Stapel auf und kauft nie Immobilien.',
  ],
  tree: [
    'Collects savings and Seed cards until a Tree is affordable, then buys only Trees.',
    'Sammelt Ersparnisse und Seed-Karten, bis ein Tree bezahlbar ist, und kauft dann nur Trees.',
  ],
  dreamer: [
    'Funds the dreams first, with safe cards on the side.',
    'Finanziert zuerst die Träume, nebenbei mit sicheren Karten.',
  ],
  steady: [
    'Like the informed investor but with three months of cash in hand and no risky cards.',
    'Wie der informierte Anleger, aber mit drei Monaten Bargeld und ohne riskante Karten.',
  ],
  passive: [
    'Takes only the free savings cards and never invests.',
    'Nimmt nur die Gratis-Spar-Karten und investiert nie.',
  ],
};

export function statsMarkdown(records: DreamGameRecord[], options: StatsDocOptions): string {
  const lang: Lang = options.lang ?? 'en';
  const de = lang === 'de';
  const t = (en: string, german: string) => (de ? german : en);
  const pct = (value: number) => `${Math.round(value * 100)}%`;
  const money = (minor: number) => Math.round(minor / 100).toLocaleString(de ? 'de-DE' : 'en');
  const titleOf = (id: string) => titles.get(id)?.[lang] ?? id;
  const kindOf = (id: string) => titles.get(id)?.kind ?? '';
  const nameOf = (id: string) => NAMES[id]?.[de ? 1 : 0] ?? id;
  const kindText = (kind: string) =>
    de ? kind.replace('Emergency', 'Notfall').replace('Life', 'Leben') : kind;

  const lines: string[] = [];
  const byPolicy = new Map<string, DreamGameRecord[]>();
  for (const record of records) {
    byPolicy.set(record.policyId, [...(byPolicy.get(record.policyId) ?? []), record]);
  }
  const order = DREAM_POLICIES.map((policy) => policy.id).filter((id) => byPolicy.has(id));
  const wins = records.filter((record) => record.outcome === 'won');
  const months = Math.round(options.maxTurns / 2.5);

  lines.push(
    t(
      `${records.length.toLocaleString('en')} games were played by ${order.length} ways of playing, on the maps ${options.shapes.join(', ')}, up to ${options.maxTurns} rolls of the dice each (about ${months} months). The same seeds were used for every strategy, so the differences come from how they play, not from luck of the draw. ${options.profession} starts every game the same way.`,
      `${records.length.toLocaleString('de-DE')} Spiele wurden mit ${order.length} Spielweisen gespielt, auf den Karten ${options.shapes.join(', ')}, jeweils bis zu ${options.maxTurns} Würfen (etwa ${months} Monate). Für jede Strategie wurden dieselben Startwerte benutzt, die Unterschiede kommen also vom Spielstil, nicht vom Kartenglück. ${options.profession} startet jedes Spiel gleich.`,
    ),
    '',
    t(
      `Overall **${pct(won(records))}** of the games were won and **${pct(bankrupt(records))}** ended in bankruptcy; the rest were not decided after ${options.maxTurns} rolls.`,
      `Insgesamt wurden **${pct(won(records))}** der Spiele gewonnen und **${pct(bankrupt(records))}** endeten in der Pleite; die übrigen waren nach ${options.maxTurns} Würfen nicht entschieden.`,
    ),
    '',
    t('### Ways of playing', '### Spielweisen'),
    '',
    t(
      '| Strategy | What it does | Won | Bankrupt | Month of the win (typical) | Net worth at the end | Passive income at its best |',
      '| Strategie | Was sie tut | Gewonnen | Pleite | Monat des Siegs (typisch) | Vermögen am Ende | Passives Einkommen (Spitze) |',
    ),
    '|---|---|---|---|---|---|---|',
  );
  for (const id of order) {
    const rows = byPolicy.get(id)!;
    const winTurns = rows.filter((row) => row.wonTurn !== undefined).map((row) => row.wonTurn!);
    lines.push(
      `| **${nameOf(id)}** | ${IDEAS[id]?.[de ? 1 : 0] ?? ''} | ${pct(won(rows))} | ${pct(bankrupt(rows))} | ${monthsText(median(winTurns))} | ${money(median(rows.map((row) => row.netWorthMinor)) ?? 0)} | ${money(median(rows.map((row) => row.peakPassiveMinor)) ?? 0)} |`,
    );
  }

  lines.push(
    '',
    t('### How a game unfolds', '### Wie ein Spiel verläuft'),
    '',
    t(
      'The four goals are reached in a typical order. The table shows the month in which the half of the players who got there reached each goal, and how many got there at all.',
      'Die vier Ziele werden in einer typischen Reihenfolge erreicht. Die Tabelle zeigt den Monat, in dem die Hälfte der Spieler, die es geschafft haben, das jeweilige Ziel erreicht hat, und wie viele überhaupt dorthin kamen.',
    ),
    '',
    t(
      '| Strategy | Reserve full | Debts repaid | Life dream lived | Passive income covers the expenses |',
      '| Strategie | Notgroschen voll | Schulden getilgt | Lebenstraum erfüllt | Passives Einkommen deckt die Ausgaben |',
    ),
    '|---|---|---|---|---|',
  );
  const goal = (rows: DreamGameRecord[], pick: (row: DreamGameRecord) => number | undefined) => {
    const turns = rows.map(pick).filter((turn): turn is number => turn !== undefined);
    return turns.length
      ? `${t('month', 'Monat')} ${monthsText(median(turns))} (${pct(turns.length / rows.length)})`
      : '-';
  };
  for (const id of order) {
    const rows = byPolicy.get(id)!;
    lines.push(
      `| ${nameOf(id)} | ${goal(rows, (r) => r.reserveFullTurn)} | ${goal(rows, (r) => r.debtsRepaidTurn)} | ${goal(rows, (r) => r.dreamLivedTurn)} | ${goal(rows, (r) => r.independentTurn)} |`,
    );
  }

  // the cards that carry a win
  const cardRows = [...new Set(records.flatMap((record) => Object.keys(record.taken)))]
    .map((id) => {
      const taken = records.filter((record) => record.taken[id]);
      const without = records.filter((record) => !record.taken[id]);
      return {
        id,
        title: titleOf(id),
        kind: kindOf(id),
        games: taken.length,
        share: taken.length / records.length,
        shareOfWins: wins.length
          ? wins.filter((record) => record.taken[id]).length / wins.length
          : 0,
        winWhenTaken: won(taken),
        winWithout: won(without),
        lift: mean(taken.map((r) => r.netWorthMinor)) - mean(without.map((r) => r.netWorthMinor)),
      };
    })
    .filter((row) => row.games >= Math.max(10, records.length * 0.02));
  const pile = (kind: string) => kind.replace('Opportunity · ', '');

  lines.push(
    '',
    t('### The cards that carry a win', '### Die Karten, die einen Sieg tragen'),
    '',
    t(
      'Of all won games, the share in which the card was taken (a card in nearly every win is a pillar of the game):',
      'Anteil der gewonnenen Spiele, in denen die Karte genommen wurde (eine Karte in fast jedem Sieg ist eine Säule des Spiels):',
    ),
    '',
    t(
      '| Card | Pile | Taken in these wins | Win chance when taken | Win chance without it | Difference in net worth |',
      '| Karte | Stapel | In diesen Siegen genommen | Siegchance mit der Karte | Siegchance ohne sie | Unterschied im Vermögen |',
    ),
    '|---|---|---|---|---|---|',
  );
  for (const row of [...cardRows].sort((a, b) => b.shareOfWins - a.shareOfWins).slice(0, 18)) {
    lines.push(
      `| ${row.title} (${row.id}) | ${pile(row.kind)} | ${pct(row.shareOfWins)} | ${pct(row.winWhenTaken)} | ${pct(row.winWithout)} | ${row.lift >= 0 ? '+' : '−'}${money(Math.abs(row.lift))} |`,
    );
  }

  const strong = [...cardRows]
    .filter((row) => row.winWhenTaken - row.winWithout > 0.15)
    .sort((a, b) => b.winWhenTaken - b.winWithout - (a.winWhenTaken - a.winWithout))
    .slice(0, 10);
  const weak = [...cardRows]
    .filter((row) => row.share > 0.15 && row.winWhenTaken < row.winWithout - 0.03)
    .sort((a, b) => a.winWhenTaken - a.winWithout - (b.winWhenTaken - b.winWithout))
    .slice(0, 10);
  lines.push(
    '',
    t('### Cards that tip the balance', '### Karten, die das Gleichgewicht kippen'),
    '',
    t(
      '**Very strong** (a win is much more likely when the card is taken - candidates to weaken):',
      '**Sehr stark** (mit der Karte ist ein Sieg viel wahrscheinlicher - Kandidaten zum Abschwächen):',
    ),
    '',
    ...(strong.length
      ? strong.map(
          (row) =>
            `- ${row.title} (${row.id}, ${pile(row.kind)}): ${pct(row.winWhenTaken)} ${t('won with it,', 'gewonnen mit ihr,')} ${pct(row.winWithout)} ${t('without.', 'ohne sie.')}`,
        )
      : [
          t(
            '- none: no single card decides the game.',
            '- keine: keine einzelne Karte entscheidet das Spiel.',
          ),
        ]),
    '',
    t(
      '**Taken often but they hold a player back** (candidates to strengthen):',
      '**Oft genommen, aber sie bremsen den Spieler** (Kandidaten zum Verstärken):',
    ),
    '',
    ...(weak.length
      ? weak.map(
          (row) =>
            `- ${row.title} (${row.id}, ${pile(row.kind)}): ${t('taken in', 'genommen in')} ${pct(row.share)} ${t('of the games,', 'der Spiele,')} ${pct(row.winWhenTaken)} ${t('won with it,', 'gewonnen mit ihr,')} ${pct(row.winWithout)} ${t('without.', 'ohne sie.')}`,
        )
      : [t('- none.', '- keine.')]),
  );

  // the events
  const eligible = records.filter((record) => record.turns >= 60 || record.outcome !== 'bankrupt');
  const eventRows = [...new Set(records.flatMap((record) => Object.keys(record.drawnEarly ?? {})))]
    .map((id) => {
      // only the first 60 rolls count: a won game stops early, so later cards would make every event look harmless
      const met = eligible.filter((record) => record.drawnEarly?.[id]);
      const not = eligible.filter((record) => !record.drawnEarly?.[id]);
      return {
        id,
        title: titleOf(id),
        kind: kindOf(id),
        games: met.length,
        winMet: won(met),
        winNot: won(not),
        brokeMet: bankrupt(met),
      };
    })
    .filter((row) => row.games >= Math.max(10, records.length * 0.05) && row.kind !== 'Dream');
  const harsh = [...eventRows]
    .filter((row) => row.kind === 'Emergency' || row.kind === 'Life')
    .sort((a, b) => a.winMet - a.winNot - (b.winMet - b.winNot))
    .slice(0, 12);
  lines.push(
    '',
    t('### Events that hit hardest', '### Ereignisse, die am härtesten treffen'),
    '',
    t(
      'Cards from the Emergency and Life stacks that were met in the first 60 rolls (every game gets that far), and how the games went on: the games that met the card against those that did not.',
      'Karten aus dem Notfall- und dem Lebensstapel, die in den ersten 60 Würfen vorkamen (so weit kommt jedes Spiel), und wie die Spiele weitergingen: die Spiele mit der Karte gegen die ohne.',
    ),
    '',
    t(
      '| Event | Stack | Met in | Win chance after | Win chance otherwise | Bankrupt after |',
      '| Ereignis | Stapel | Vorgekommen in | Siegchance danach | Siegchance sonst | Pleite danach |',
    ),
    '|---|---|---|---|---|---|',
    ...harsh.map(
      (row) =>
        `| ${row.title} (${row.id}) | ${kindText(row.kind)} | ${pct(row.games / records.length)} ${t('of the games', 'der Spiele')} | ${pct(row.winMet)} | ${pct(row.winNot)} | ${pct(row.brokeMet)} |`,
    ),
  );
  const luckyHarvest = [...eventRows]
    .filter((row) => row.kind === 'Harvest')
    .sort((a, b) => b.winMet - b.winNot - (a.winMet - a.winNot));
  lines.push(
    '',
    t(
      '### The market cards that help most and hurt most',
      '### Die Marktkarten, die am meisten helfen und am meisten schaden',
    ),
    '',
    t(
      '| Market card | Win chance after | Win chance otherwise | Bankrupt after |',
      '| Marktkarte | Siegchance danach | Siegchance sonst | Pleite danach |',
    ),
    '|---|---|---|---|',
    ...[...luckyHarvest.slice(0, 6), ...luckyHarvest.slice(-6)].map(
      (row) =>
        `| ${row.title} (${row.id}) | ${pct(row.winMet)} | ${pct(row.winNot)} | ${pct(row.brokeMet)} |`,
    ),
  );

  // why games end badly
  const broke = records.filter((record) => record.outcome === 'bankrupt');
  const causes = new Map<string, number>();
  for (const record of broke) {
    const last = record.lastEvents.filter((event) => /^\d+:(E|L|H) /.test(event)).slice(-2);
    for (const event of last) {
      const id = event.split(' ')[1];
      const name = `${titleOf(id)} (${id})`;
      causes.set(name, (causes.get(name) ?? 0) + 1);
    }
  }
  lines.push(
    '',
    t('### What came just before a bankruptcy', '### Was kurz vor einer Pleite kam'),
    '',
  );
  if (broke.length === 0) {
    lines.push(t('No game ended in bankruptcy.', 'Kein Spiel endete in der Pleite.'));
  } else {
    lines.push(
      t(
        `${broke.length} games ended in bankruptcy (${pct(broke.length / records.length)}). The last two cards before it:`,
        `${broke.length} Spiele endeten in der Pleite (${pct(broke.length / records.length)}). Die letzten zwei Karten davor:`,
      ),
      '',
      ...[...causes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => `- ${name}: ${count}`),
    );
  }

  // what the winners look like
  if (wins.length > 0) {
    const turns = wins.map((record) => record.wonTurn ?? record.turns);
    lines.push(
      '',
      t('### What a won game looks like', '### Wie ein gewonnenes Spiel aussieht'),
      '',
      t(
        `- Typical win: month ${monthsText(median(turns))} (the quickest ${monthsText(Math.min(...turns))}, the slowest ${monthsText(Math.max(...turns))}).`,
        `- Typischer Sieg: Monat ${monthsText(median(turns))} (der schnellste ${monthsText(Math.min(...turns))}, der langsamste ${monthsText(Math.max(...turns))}).`,
      ),
      t(
        `- Passive income at the end: ${money(median(wins.map((record) => record.passiveMinor)) ?? 0)} a month against expenses of ${money(median(wins.map((record) => record.expensesMinor)) ?? 0)}.`,
        `- Passives Einkommen am Ende: ${money(median(wins.map((record) => record.passiveMinor)) ?? 0)} im Monat bei Ausgaben von ${money(median(wins.map((record) => record.expensesMinor)) ?? 0)}.`,
      ),
      t(
        `- Dream points collected: ${Math.round(mean(wins.map((record) => record.dreamPoints)))} on average.`,
        `- Gesammelte Traumpunkte: durchschnittlich ${Math.round(mean(wins.map((record) => record.dreamPoints)))}.`,
      ),
      t(
        `- Bank loan at its highest: ${money(median(wins.map((record) => record.peakBankLoanMinor)) ?? 0)}.`,
        `- Höchster Bankkredit: ${money(median(wins.map((record) => record.peakBankLoanMinor)) ?? 0)}.`,
      ),
    );
  }
  return lines.join('\n');
}

/** Puts the statistics between the markers of a page: `<!-- stats:name:start -->` ... `<!-- stats:name:end -->`. */
export function injectStats(page: string, name: string, stats: string): string {
  const start = `<!-- stats:${name}:start -->`;
  const end = `<!-- stats:${name}:end -->`;
  const from = page.indexOf(start);
  const to = page.indexOf(end);
  if (from < 0 || to < 0) throw new Error(`The page has no markers for ${name}.`);
  return `${page.slice(0, from + start.length)}\n\n${stats}\n\n${page.slice(to)}`;
}
