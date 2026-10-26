import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { HARVEST_CARDS } from '../../cashflow-harvest-cards';
import { OPPORTUNITY_CARDS as SKETCH_CARDS } from '../../cashflow-opportunity-cards';
import { tuneOpportunityCards } from '../../cashflow-opportunity-tuning';
import { DREAM_POLICIES } from './policies';
import type { DreamGameRecord } from './world';

/**
 * The statistics of a simulation as a page the players can read (JFK, 2026-10-26): what each way of playing achieves, how a game
 * unfolds, which cards carry a win and which events break a game. It is generated from the records of `runBatch`, never typed by hand.
 */

const OPPORTUNITY = tuneOpportunityCards(SKETCH_CARDS);
const SET = CASHFLOW_GAME_SETS.find((set) => set.id === 'jfk-stories');

const titles = new Map<string, { title: string; kind: string }>();
for (const card of OPPORTUNITY) {
  titles.set(card.id, { title: card.title.en, kind: `Opportunity · ${card.pile}` });
}
for (const card of HARVEST_CARDS) {
  titles.set(card.id, { title: card.title.en, kind: 'Harvest' });
}
for (const [kind, deck] of [
  ['Emergency', SET?.decks?.emergency],
  ['Life', SET?.decks?.life],
  ['Dream', SET?.decks?.dream],
] as const) {
  for (const card of (deck ?? []) as { id: string; title: { en: string } }[]) {
    titles.set(card.id, { title: card.title.en, kind });
  }
}

const pct = (value: number) => `${Math.round(value * 100)}%`;
const money = (minor: number) => Math.round(minor / 100).toLocaleString('en');
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
}

/** The strategies in words: what each one does, with what it achieved. */
const IDEAS: Record<string, string> = {
  saver:
    'Keeps cash, takes only the safest cards (savings, bonds, a world ETF) and funds the reserve and the dream first.',
  etf: 'Puts the free money into index and dividend ETFs and bonds, little else.',
  property: 'Saves for the Tree pile and buys rental properties with a mortgage.',
  hustler:
    'Starts side hustles and small businesses from the Seed and Sapling piles, one after the other.',
  gambler: 'Goes for crypto, hot tips, collectibles and the hype ladder.',
  expert:
    'Takes every free saving, then whatever pays most for its price from all three piles, plans the reserve and the dream by payment plans and starts the dream only once the passive income carries part of the costs.',
  dividend: 'Builds a snowball of dividend shares from all piles.',
  sapling: 'Builds businesses and hustles from the Sapling pile and never buys property.',
  tree: 'Collects savings and Seed cards until a Tree is affordable, then buys only Trees.',
  dreamer: 'Funds the dreams first, with safe cards on the side.',
  steady: 'Like the informed investor but with three months of cash in hand and no risky cards.',
  passive: 'Takes only the free savings cards and never invests.',
};

export function statsMarkdown(records: DreamGameRecord[], options: StatsDocOptions): string {
  const lines: string[] = [];
  const byPolicy = new Map<string, DreamGameRecord[]>();
  for (const record of records) {
    byPolicy.set(record.policyId, [...(byPolicy.get(record.policyId) ?? []), record]);
  }
  const order = DREAM_POLICIES.map((policy) => policy.id).filter((id) => byPolicy.has(id));
  const wins = records.filter((record) => record.outcome === 'won');

  lines.push(
    `${records.length.toLocaleString('en')} games were played by ${order.length} ways of playing, on the maps ${options.shapes.join(', ')}, up to ${options.maxTurns} rolls of the dice each (about ${Math.round(options.maxTurns / 2.5)} months). The same seeds were used for every strategy, so the differences come from how they play, not from luck of the draw. ${options.profession} starts every game the same way.`,
    '',
    `Overall **${pct(won(records))}** of the games were won and **${pct(bankrupt(records))}** ended in bankruptcy; the rest were not decided after ${options.maxTurns} rolls.`,
    '',
    '### Ways of playing',
    '',
    '| Strategy | What it does | Won | Bankrupt | Month of the win (typical) | Net worth at the end | Passive income at its best |',
    '|---|---|---|---|---|---|---|',
  );
  for (const id of order) {
    const rows = byPolicy.get(id)!;
    const policy = DREAM_POLICIES.find((entry) => entry.id === id)!;
    const winTurns = rows.filter((row) => row.wonTurn !== undefined).map((row) => row.wonTurn!);
    lines.push(
      `| **${policy.name}** | ${IDEAS[id] ?? ''} | ${pct(won(rows))} | ${pct(bankrupt(rows))} | ${monthsText(median(winTurns))} | ${money(median(rows.map((row) => row.netWorthMinor)) ?? 0)} | ${money(median(rows.map((row) => row.peakPassiveMinor)) ?? 0)} |`,
    );
  }

  lines.push(
    '',
    '### How a game unfolds',
    '',
    `The four goals are reached in a typical order. The table shows the month in which the half of the players who got there reached each goal, and how many got there at all.`,
    '',
    '| Strategy | Reserve full | Debts repaid | Life dream lived | Passive income covers the expenses |',
    '|---|---|---|---|---|',
  );
  const goal = (rows: DreamGameRecord[], pick: (row: DreamGameRecord) => number | undefined) => {
    const turns = rows.map(pick).filter((turn): turn is number => turn !== undefined);
    return turns.length
      ? `month ${monthsText(median(turns))} (${pct(turns.length / rows.length)})`
      : '-';
  };
  for (const id of order) {
    const rows = byPolicy.get(id)!;
    const policy = DREAM_POLICIES.find((entry) => entry.id === id)!;
    lines.push(
      `| ${policy.name} | ${goal(rows, (r) => r.reserveFullTurn)} | ${goal(rows, (r) => r.debtsRepaidTurn)} | ${goal(rows, (r) => r.dreamLivedTurn)} | ${goal(rows, (r) => r.independentTurn)} |`,
    );
  }

  // the cards that carry a win
  const cardRows = [...new Set(records.flatMap((record) => Object.keys(record.taken)))]
    .map((id) => {
      const taken = records.filter((record) => record.taken[id]);
      const without = records.filter((record) => !record.taken[id]);
      return {
        id,
        title: titles.get(id)?.title ?? id,
        kind: titles.get(id)?.kind ?? '',
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

  lines.push(
    '',
    '### The cards that carry a win',
    '',
    'Of all won games, the share in which the card was taken (a card in nearly every win is a pillar of the game):',
    '',
    '| Card | Pile | Taken in these wins | Win chance when taken | Win chance without it | Difference in net worth |',
    '|---|---|---|---|---|---|',
  );
  for (const row of [...cardRows].sort((a, b) => b.shareOfWins - a.shareOfWins).slice(0, 18)) {
    lines.push(
      `| ${row.title} (${row.id}) | ${row.kind.replace('Opportunity · ', '')} | ${pct(row.shareOfWins)} | ${pct(row.winWhenTaken)} | ${pct(row.winWithout)} | ${row.lift >= 0 ? '+' : '−'}${money(Math.abs(row.lift))} |`,
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
    '### Cards that tip the balance',
    '',
    '**Very strong** (a win is much more likely when the card is taken - candidates to weaken):',
    '',
    ...(strong.length
      ? strong.map(
          (row) =>
            `- ${row.title} (${row.id}, ${row.kind.replace('Opportunity · ', '')}): ${pct(row.winWhenTaken)} won with it, ${pct(row.winWithout)} without.`,
        )
      : ['- none: no single card decides the game.']),
    '',
    '**Taken often but they hold a player back** (candidates to strengthen):',
    '',
    ...(weak.length
      ? weak.map(
          (row) =>
            `- ${row.title} (${row.id}, ${row.kind.replace('Opportunity · ', '')}): taken in ${pct(row.share)} of the games, ${pct(row.winWhenTaken)} won with it, ${pct(row.winWithout)} without.`,
        )
      : ['- none.']),
  );

  // the events
  const eventRows = [...new Set(records.flatMap((record) => Object.keys(record.drawnEarly ?? {})))]
    .map((id) => {
      // only the first 60 rolls count: a won game stops early, so later cards would make every event look harmless
      const eligible = records.filter(
        (record) => record.turns >= 60 || record.outcome !== 'bankrupt',
      );
      const met = eligible.filter((record) => record.drawnEarly?.[id]);
      const not = eligible.filter((record) => !record.drawnEarly?.[id]);
      return {
        id,
        title: titles.get(id)?.title ?? id,
        kind: titles.get(id)?.kind ?? '',
        perGame: mean(records.map((record) => record.drawnEarly?.[id] ?? 0)),
        games: met.length,
        winMet: won(met),
        winNot: won(not),
        brokeMet: bankrupt(met),
        brokeNot: bankrupt(not),
      };
    })
    .filter((row) => row.games >= Math.max(10, records.length * 0.05) && row.kind !== 'Dream');
  const harsh = [...eventRows]
    .filter((row) => row.kind === 'Emergency' || row.kind === 'Life')
    .sort((a, b) => a.winMet - a.winNot - (b.winMet - b.winNot))
    .slice(0, 12);
  lines.push(
    '',
    '### Events that hit hardest',
    '',
    'Cards from the Emergency and Life stacks that were met in the first 60 rolls (every game gets that far), and how the games went on: the games that met the card against those that did not.',
    '',
    '| Event | Stack | Met in | Win chance after | Win chance otherwise | Bankrupt after |',
    '|---|---|---|---|---|---|',
    ...harsh.map(
      (row) =>
        `| ${row.title} (${row.id}) | ${row.kind} | ${pct(row.games / records.length)} of the games | ${pct(row.winMet)} | ${pct(row.winNot)} | ${pct(row.brokeMet)} |`,
    ),
  );
  const luckyHarvest = [...eventRows]
    .filter((row) => row.kind === 'Harvest')
    .sort((a, b) => b.winMet - b.winNot - (a.winMet - a.winNot));
  lines.push(
    '',
    '### The market cards that help most and hurt most',
    '',
    '| Market card | Win chance after | Win chance otherwise | Bankrupt after |',
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
      const title = titles.get(id)?.title ?? id;
      causes.set(`${title} (${id})`, (causes.get(`${title} (${id})`) ?? 0) + 1);
    }
  }
  lines.push('', '### What came just before a bankruptcy', '');
  if (broke.length === 0) {
    lines.push('No game ended in bankruptcy.');
  } else {
    lines.push(
      `${broke.length} games ended in bankruptcy (${pct(broke.length / records.length)}). The last two cards before it:`,
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
      '### What a won game looks like',
      '',
      `- Typical win: month ${monthsText(median(turns))} (the quickest ${monthsText(Math.min(...turns))}, the slowest ${monthsText(Math.max(...turns))}).`,
      `- Passive income at the end: ${money(median(wins.map((record) => record.passiveMinor)) ?? 0)} a month against expenses of ${money(median(wins.map((record) => record.expensesMinor)) ?? 0)}.`,
      `- Dream points collected: ${Math.round(mean(wins.map((record) => record.dreamPoints)))} on average.`,
      `- Bank loan at its highest: ${money(median(wins.map((record) => record.peakBankLoanMinor)) ?? 0)}.`,
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
