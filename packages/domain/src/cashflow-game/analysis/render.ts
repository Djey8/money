import type { GameReview, MoveLabel, ReviewedMove } from './review';

/**
 * A review in words (todo/cashflow-game-analysis.md, E6): the figures of `reviewGame` as a short report an agent or a
 * person can read - what the game was, the move that cost the most, the moves that helped, and how it compares with what
 * the strategy lab measured for the profession. Plain English with markdown; the agent turns it into advice in the
 * language of the player.
 */

export interface ReviewBenchmark {
  professionTitle: string;
  strategyLabel: string;
  escapeRate: number;
  /** Rolls to escape of the games that escaped, for the best strategy the lab measured. */
  rolls: { p10: number; median: number; p90: number } | null;
  games: number;
  /** Where the player's escape would rank among those games, 0 (the slowest) to 1 (the fastest); null when not escaped. */
  placement: number | null;
}

const LABEL_WORD: Record<MoveLabel, string> = {
  best: 'a very good move',
  good: 'a good move',
  neutral: 'about neutral',
  inaccuracy: 'a small inaccuracy',
  mistake: 'a mistake',
  blunder: 'a blunder',
};

const pct = (value: number) => `${Math.round(value * 100)}%`;
const points = (delta: number) => `${delta >= 0 ? '+' : ''}${Math.round(delta * 100)} points`;

/** Where `value` falls among a spread known by its 10th, 50th and 90th percentile (0 = the lowest, 1 = the highest). */
export function placeInSpread(
  value: number,
  spread: { p10: number; median: number; p90: number },
): number {
  if (value <= spread.p10) return 0.1 * Math.max(0, value / Math.max(spread.p10, 1));
  if (value <= spread.median)
    return 0.1 + 0.4 * ((value - spread.p10) / Math.max(spread.median - spread.p10, 1));
  if (value <= spread.p90)
    return 0.5 + 0.4 * ((value - spread.median) / Math.max(spread.p90 - spread.median, 1));
  return Math.min(1, 0.9 + 0.1 * ((value - spread.p90) / Math.max(spread.p90, 1)));
}

function describeMove(move: ReviewedMove, money: (minor: number) => string): string {
  const { facts } = move;
  const bits: string[] = [];
  if (facts.depositMinor !== undefined) bits.push(`deposit ${money(facts.depositMinor)}`);
  if (facts.cashflowMinor !== undefined) {
    const rate = facts.returnPerMonth
      ? ` (${(facts.returnPerMonth * 100).toFixed(1)}% a month on the deposit)`
      : '';
    bits.push(`cashflow +${money(facts.cashflowMinor)} a month${rate}`);
  }
  bits.push(`cash after ${money(facts.cashAfterMinor)}`);
  if (facts.bankLoanAfterMinor > 0) bits.push(`bank loan after ${money(facts.bankLoanAfterMinor)}`);
  bits.push(`monthly cashflow after ${money(facts.monthlyCashflowAfterMinor)}`);
  const kindWord: Record<ReviewedMove['kind'], string> = {
    purchase: 'Bought',
    'passed-card': 'Passed on',
    'unseen-card': 'Passed without looking at',
    'kept-offer': 'Kept it when a buyer offered:',
    sale: 'Sold',
    loan: 'Took the',
    repayment: 'Repaid the',
  };
  return (
    `**Step ${move.number}, month ${move.round}: ${kindWord[move.kind]} ${move.title}** - ${LABEL_WORD[move.label]}. ` +
    `Chance to escape ${pct(move.escapeChance.taken)} afterwards, against ${pct(move.escapeChance.other)} with ${move.alternative} ` +
    `(${points(move.escapeChance.delta)}). ${bits.join('; ')}.`
  );
}

export function describeReview(
  review: GameReview,
  options: { money: (minor: number) => string; benchmark?: ReviewBenchmark | null },
): string {
  const { money, benchmark } = options;
  const { final } = review;
  const lines: string[] = [];
  const result =
    final.outcome === 'escaped'
      ? `escaped the rat race after ${final.rolls} rolls (${final.round} months)`
      : final.outcome === 'bankrupt'
        ? `went bankrupt after ${final.rolls} rolls (${final.round} months)`
        : `was still running at roll ${final.rolls} (month ${final.round})`;
  lines.push(`## Game review`);
  lines.push('');
  lines.push(
    `The game ${result}. Passive income ${money(final.passiveIncomeMinor)} against expenses ${money(final.expensesMinor)}; monthly cashflow ${money(final.monthlyCashflowMinor)}; cash ${money(final.cashMinor)}; ${final.children} ${final.children === 1 ? 'child' : 'children'}.`,
  );
  lines.push(
    `${review.judged} of ${review.steps} steps were decisions that could be judged (purchases, sales, loans, cards planned and then left); each was judged over ${
      review.rolloutsUsed && review.rolloutsUsed.min !== review.rolloutsUsed.max
        ? `${review.rolloutsUsed.min} to ${review.rolloutsUsed.max}`
        : (review.rolloutsUsed?.max ?? review.rollouts)
    } simulated continuations per alternative, with the same dice for both.`,
  );
  if (review.truncated) {
    lines.push(
      `**The review is incomplete:** the time ran out with ${review.unjudged} ${review.unjudged === 1 ? 'decision' : 'decisions'} still to judge. Ask again with more time (or fewer rollouts) to judge them all.`,
    );
  }
  if (review.skipped > 0) {
    lines.push(
      `${review.skipped} further ${review.skipped === 1 ? 'decision' : 'decisions'} could not be played on from and ${review.skipped === 1 ? 'is' : 'are'} not judged.`,
    );
  }

  if (benchmark) {
    lines.push('');
    lines.push(
      `**Against the strategy lab** (${benchmark.professionTitle}, best measured strategy "${benchmark.strategyLabel}": ${pct(benchmark.escapeRate)} of ${benchmark.games} games escape${benchmark.rolls ? `, typically after ${benchmark.rolls.median} rolls (fast games ${benchmark.rolls.p10}, slow games ${benchmark.rolls.p90})` : ''}).` +
        (final.outcome === 'escaped' && benchmark.placement !== null
          ? ` Your ${final.rolls} rolls are faster than about ${pct(1 - benchmark.placement)} of those games.`
          : ''),
    );
  }

  if (review.turningPoint) {
    lines.push('');
    lines.push('### Where the game turned');
    lines.push(describeMove(review.turningPoint, money));
  }
  if (review.bestMove && review.bestMove !== review.turningPoint) {
    lines.push('');
    lines.push('### The move that helped most');
    lines.push(describeMove(review.bestMove, money));
  }

  const notable = review.moves.filter(
    (move) => move.label === 'mistake' || move.label === 'blunder' || move.label === 'inaccuracy',
  );
  if (notable.length > 0) {
    lines.push('');
    lines.push('### Moves to do differently');
    for (const move of notable) lines.push(`- ${describeMove(move, money)}`);
  }
  const good = review.moves.filter((move) => move.label === 'best' || move.label === 'good');
  if (good.length > 0) {
    lines.push('');
    lines.push('### Moves that worked');
    for (const move of good) lines.push(`- ${describeMove(move, money)}`);
  }
  if (review.judged === 0) {
    lines.push('');
    lines.push(
      'No decision could be judged: this game has no step history (a compact save keeps only the log), or nothing was bought, sold or borrowed.',
    );
  }
  return lines.join('\n') + '\n';
}
