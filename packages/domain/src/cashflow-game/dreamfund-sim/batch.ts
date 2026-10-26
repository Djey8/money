import { OPPORTUNITY_CARDS } from '../../cashflow-opportunity-cards';
import type { CustomRules } from '../custom-rules';
import type { BoardSetup } from '../dreamfund-board';
import { DREAM_POLICIES } from './policies';
import { simulateDreamGame, type DreamGameRecord } from './world';

/**
 * Many Dreamfund games in a row (JFK, 2026-10-26): the same character on the maps and settings given, played by every strategy, from
 * seeds that count up - so a run can be repeated and two runs compared. The summary answers what the balance needs: how often a
 * strategy wins, how long it takes, how often it goes bankrupt, and which cards were worth taking.
 */

export interface BatchConfig {
  games: number;
  policies?: string[];
  shapes?: BoardSetup['shape'][];
  sizes?: BoardSetup['size'][];
  rules?: Partial<CustomRules>;
  professionId?: string;
  maxTurns?: number;
  firstSeed?: number;
}

export interface BatchRow {
  key: string;
  policyId: string;
  shape: string;
  size: string;
  difficulty: string;
  games: number;
  winRate: number;
  bankruptRate: number;
  timeoutRate: number;
  errorRate: number;
  /** Turns of the games that were won: the quartiles. */
  turnsToWin: { p25: number; median: number; p75: number } | null;
  paydaysToWin: number | null;
  /** The turn each condition was first met, medians over the games that met it, and the share of games that did. */
  reserve: { median: number | null; share: number };
  debts: { median: number | null; share: number };
  dream: { median: number | null; share: number };
  independent: { median: number | null; share: number };
  netWorthMedianMinor: number;
  peakPassiveMedianMinor: number;
  bankLoanPeakMedianMinor: number;
  pointsMean: number;
}

export interface CardRow {
  id: string;
  title: string;
  /** In how many games the card was taken at least once. */
  games: number;
  winRateWhenTaken: number;
  winRateWithout: number;
  netWorthLiftMinor: number;
}

export interface BatchResult {
  config: BatchConfig;
  records: DreamGameRecord[];
  rows: BatchRow[];
  cards: CardRow[];
  errors: string[];
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const quantile = (values: number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

function condition(
  records: DreamGameRecord[],
  pick: (record: DreamGameRecord) => number | undefined,
) {
  const turns = records.map(pick).filter((turn): turn is number => turn !== undefined);
  return { median: median(turns), share: records.length ? turns.length / records.length : 0 };
}

export function summarize(records: DreamGameRecord[]): BatchRow[] {
  const groups = new Map<string, DreamGameRecord[]>();
  for (const record of records) {
    const key = [record.policyId, record.shape, record.size, record.difficulty].join('|');
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].map(([key, rows]) => {
    const [policyId, shape, size, difficulty] = key.split('|');
    const won = rows.filter((record) => record.outcome === 'won');
    const rate = (outcome: string) =>
      rows.filter((record) => record.outcome === outcome).length / rows.length;
    return {
      key,
      policyId,
      shape,
      size,
      difficulty,
      games: rows.length,
      winRate: rate('won'),
      bankruptRate: rate('bankrupt'),
      timeoutRate: rate('timeout'),
      errorRate: rate('error'),
      turnsToWin: won.length
        ? {
            p25: quantile(
              won.map((r) => r.wonTurn!),
              0.25,
            ),
            median: median(won.map((r) => r.wonTurn!))!,
            p75: quantile(
              won.map((r) => r.wonTurn!),
              0.75,
            ),
          }
        : null,
      paydaysToWin: won.length ? median(won.map((r) => r.paydays)) : null,
      reserve: condition(rows, (r) => r.reserveFullTurn),
      debts: condition(rows, (r) => r.debtsRepaidTurn),
      dream: condition(rows, (r) => r.dreamLivedTurn),
      independent: condition(rows, (r) => r.independentTurn),
      netWorthMedianMinor: median(rows.map((r) => r.netWorthMinor)) ?? 0,
      peakPassiveMedianMinor: median(rows.map((r) => r.peakPassiveMinor)) ?? 0,
      bankLoanPeakMedianMinor: median(rows.map((r) => r.peakBankLoanMinor)) ?? 0,
      pointsMean: mean(rows.map((r) => r.dreamPoints)),
    };
  });
}

/** What each Opportunity card is worth: the games it was taken in against the ones it was not. */
export function cardStatistics(records: DreamGameRecord[]): CardRow[] {
  const ids = new Set(records.flatMap((record) => Object.keys(record.taken)));
  const overallNet = mean(records.map((record) => record.netWorthMinor));
  void overallNet;
  return [...ids]
    .map((id) => {
      const taken = records.filter((record) => record.taken[id]);
      const without = records.filter((record) => !record.taken[id]);
      const win = (rows: DreamGameRecord[]) =>
        rows.length ? rows.filter((r) => r.outcome === 'won').length / rows.length : 0;
      return {
        id,
        title: OPPORTUNITY_CARDS.find((card) => card.id === id)?.title.en ?? id,
        games: taken.length,
        winRateWhenTaken: win(taken),
        winRateWithout: win(without),
        netWorthLiftMinor: Math.round(
          mean(taken.map((r) => r.netWorthMinor)) - mean(without.map((r) => r.netWorthMinor)),
        ),
      };
    })
    .sort((a, b) => b.netWorthLiftMinor - a.netWorthLiftMinor);
}

export function runBatch(config: BatchConfig): BatchResult {
  const policies = (
    config.policies?.length ? config.policies : DREAM_POLICIES.map((p) => p.id)
  ).map((id) => {
    const found = DREAM_POLICIES.find((policy) => policy.id === id);
    if (!found) throw new Error(`Unknown policy ${id}`);
    return found;
  });
  const records: DreamGameRecord[] = [];
  const first = config.firstSeed ?? 1;
  for (const shape of config.shapes ?? ['ring']) {
    for (const size of config.sizes ?? ['medium']) {
      for (const policy of policies) {
        for (let i = 0; i < config.games; i += 1) {
          records.push(
            simulateDreamGame({
              seed: first + i,
              policy,
              shape,
              size,
              rules: config.rules,
              professionId: config.professionId,
              maxTurns: config.maxTurns,
            }),
          );
        }
      }
    }
  }
  const errors = [...new Set(records.filter((r) => r.error).map((r) => r.error!))].slice(0, 20);
  return { config, records, rows: summarize(records), cards: cardStatistics(records), errors };
}

const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
const tt = (minor: number) => `${Math.round(minor / 100).toLocaleString('en')}`;

/** The batch as a report: one table of strategies and one of the cards. */
export function reportMarkdown(result: BatchResult): string {
  const lines: string[] = [];
  lines.push(`# Dreamfund simulation`);
  lines.push('');
  lines.push(
    `${result.records.length} games - ${JSON.stringify({ ...result.config, rules: result.config.rules ?? {} })}`,
  );
  lines.push('');
  lines.push(
    '| strategy | map | level | games | won | bankrupt | timeout | error | turns to win (p25 / median / p75) | reserve | debts | dream | independent | net worth | peak passive | bank loan peak | points |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const row of result.rows) {
    const cond = (c: { median: number | null; share: number }) =>
      c.median === null ? '-' : `${c.median} (${pct(c.share)})`;
    lines.push(
      `| ${row.policyId} | ${row.shape} ${row.size} | ${row.difficulty} | ${row.games} | ${pct(row.winRate)} | ${pct(row.bankruptRate)} | ${pct(row.timeoutRate)} | ${pct(row.errorRate)} | ` +
        `${row.turnsToWin ? `${row.turnsToWin.p25} / ${row.turnsToWin.median} / ${row.turnsToWin.p75}` : '-'} | ` +
        `${cond(row.reserve)} | ${cond(row.debts)} | ${cond(row.dream)} | ${cond(row.independent)} | ` +
        `${tt(row.netWorthMedianMinor)} | ${tt(row.peakPassiveMedianMinor)} | ${tt(row.bankLoanPeakMedianMinor)} | ${row.pointsMean.toFixed(1)} |`,
    );
  }
  lines.push('');
  lines.push('## Cards (what they were worth to the games they were taken in)');
  lines.push('');
  lines.push('| card | title | games | won when taken | won without | net worth lift |');
  lines.push('|---|---|---|---|---|---|');
  for (const card of result.cards.slice(0, 30)) {
    lines.push(
      `| ${card.id} | ${card.title} | ${card.games} | ${pct(card.winRateWhenTaken)} | ${pct(card.winRateWithout)} | ${tt(card.netWorthLiftMinor)} |`,
    );
  }
  const broke = result.records.filter((record) => record.outcome === 'bankrupt');
  if (broke.length > 0) {
    const causes = new Map<string, number>();
    for (const record of broke) {
      for (const event of record.lastEvents.slice(-3)) {
        const key = event.replace(/^\d+:/, '');
        causes.set(key, (causes.get(key) ?? 0) + 1);
      }
    }
    lines.push(
      '',
      '## What came just before a bankruptcy',
      '',
      '(the last three cards of each bankrupt game)',
      '',
    );
    for (const [event, count] of [...causes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      lines.push(`- ${event}: ${count}`);
    }
  }
  if (result.errors.length > 0) {
    lines.push(
      '',
      '## Errors',
      '',
      ...result.errors.map((error) => `- ${error.replace(/\n/g, ' ')}`),
    );
  }
  return lines.join('\n');
}
