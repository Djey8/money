import { TableCommandError } from '../../table/types';
import { seededRng } from '../../rng';
import { DREAM_POLICIES } from '../../dreamfund-sim/policies';
import { DREAM_BOT_LEVELS, splitDreamBotId, withDreamMistakes } from './bot-levels';
import { DreamBot, type MoneyActor } from '../bot';
import { DreamPlayer } from '../player';
import {
  applyDreamCommand,
  passiveCommands,
  type DreamCommandResult,
  type DreamContext,
} from './reducer';
import type { DreamCommand, DreamEvent, DreamSeat, DreamTable } from './types';

/**
 * The bots of a Dreamfund table (todo/dreamfund-multiplayer.md, slice 3): a seat played by one of the strategies of the simulation.
 * It plays with the very commands a person sends - the same legal moves, the same rules - and decides with the very judgement of the
 * simulation's player (`DreamBot`): the plans and lump sums of a Payday, the answer to a card, which Opportunity to take, when to
 * sell into a Harvest card. Nothing here reads a secret: a bot sees what its own life shows, like a player. Pure: the same table
 * gives the same commands (its own chance is taken from the table's position, never from the table's dice).
 */

export const botPolicy = (policyId: string) =>
  DREAM_POLICIES.find((policy) => policy.id === (splitDreamBotId(policyId)?.base ?? policyId)) ??
  DREAM_POLICIES[0];

/** A bot's own luck: stable for a table in a given position, and it spends none of the table's dice. */
const luckOf = (table: DreamTable, seatId: string) => {
  let hash = (table.rngState ^ (table.version * 2654435761)) >>> 0;
  for (const ch of seatId) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0 || 1;
  return seededRng(hash);
};

function wake(table: DreamTable, seat: DreamSeat): DreamPlayer {
  const player = DreamPlayer.restore(seat.life!, luckOf(table, seat.id), { sharedMarkets: true });
  player.setState({ ...player.state, markets: { ...table.markets } });
  return player;
}

/** What a bot does with the Harvest card's options: sell into the window, take a buyer, ride or cash a hype. */
function harvestCommands(bot: DreamBot, p: DreamPlayer, seat: DreamSeat): DreamCommand[] {
  const open = seat.harvest;
  if (!open) return [];
  const commands: DreamCommand[] = [];
  for (const title of open.sellable) {
    const holding = (p.state.holdings ?? []).find((h) => h.title === title && !h.ended);
    if (!holding?.marketTag) continue;
    if (bot.sellWindow(p, { title, tag: holding.marketTag })) {
      commands.push({ type: 'harvest_sell', holding: title });
    }
  }
  for (const sale of open.sales) {
    if (bot.acceptBuyer(p, sale as never)) {
      commands.push({ type: 'harvest_accept', holding: sale.holding });
    }
  }
  for (const offer of open.ladders) {
    const choice = bot.ladder(p, offer);
    if (choice === 'skip') continue;
    commands.push({
      type: 'harvest_ladder',
      holding: offer.holding,
      action: choice === 'ride' ? 'ride' : 'cash',
    });
  }
  return commands;
}

/** The month's money of a bot: the plans, then the lump sums, as the commands that do it (worked out on a copy of the life). */
function moneyCommands(bot: DreamBot, p: DreamPlayer): DreamCommand[] {
  const commands: DreamCommand[] = [];
  const before = p.plans;
  const plans = bot.replan(p);
  for (const plan of plans) {
    if (plan.kind === 'emergency') continue;
    commands.push({ type: 'set_plan', kind: plan.kind, id: plan.id, perMinor: plan.perMinor });
  }
  for (const plan of before) {
    if (plan.kind === 'emergency') continue;
    if (!plans.some((candidate) => candidate.kind === plan.kind && candidate.id === plan.id)) {
      commands.push({ type: 'set_plan', kind: plan.kind, id: plan.id, perMinor: 0 });
    }
  }
  p.plans = plans;
  const actor: MoneyActor = {
    fundReserve(put) {
      const amount = Math.min(put, p.cash());
      if (amount <= 0) return;
      commands.push({ type: 'fund_reserve', amountMinor: amount });
      p.fundReserve(amount);
    },
    repayBankLoan(repay) {
      if (repay <= 0) return;
      commands.push({ type: 'repay_bank_loan', amountMinor: repay });
      p.repayBankLoan(repay);
    },
    repayDebt(tag) {
      commands.push({ type: 'repay_debt', tag });
      p.repayDebt(tag);
    },
    fundDreams(money) {
      const amount = Math.min(Math.floor(money), p.cash());
      if (amount <= 0) return;
      commands.push({ type: 'fund_dream', amountMinor: amount });
      p.fundDreams(amount);
    },
  };
  bot.extraPayments(p, actor);
  commands.push({ type: 'settle_payday' });
  return commands;
}

/** What a bot decides about the card it has to answer. */
function pendingCommand(
  bot: DreamBot,
  p: DreamPlayer,
  seat: DreamSeat,
  luck: () => number,
): DreamCommand {
  const pending = seat.pending!;
  switch (pending.kind) {
    case 'emergency': {
      const card = p.emergencyCard(pending.cardId);
      const pay = card ? p.autoEmergencySelection(card, p.emergencyContext()) : null;
      if (!card || pay === null) return { type: 'pay_emergency', pay: 'now' };
      const how = bot.emergencyPay(p, card.payment === 'pay_now', pay);
      return { type: 'pay_emergency', pay: how.pay };
    }
    case 'life': {
      const card = p.lifeCard(pending.cardId);
      if (!card) return { type: 'answer_life', decision: 'pass' };
      const decision = bot.lifeDecision(p, card, luck);
      if (decision.kind === 'option')
        return { type: 'answer_life', decision: { option: decision.id } };
      if (decision.kind === 'fate') return { type: 'answer_life', decision: 'pass' };
      return { type: 'answer_life', decision: decision.kind };
    }
    case 'career_branch':
      return { type: 'choose_career_branch', index: 0 };
    case 'dream': {
      const offers = pending.offers.flatMap((id) => p.dreamCard(id) ?? []);
      const pick = bot.dream(p, offers, p.state.dreams?.open.length ?? 0);
      return pick ? { type: 'take_dream', cardId: pick.id } : { type: 'skip' };
    }
    case 'opportunity_pile': {
      const pile = bot.pile(p, luck);
      return pile ? { type: 'choose_pile', pile } : { type: 'skip' };
    }
    case 'opportunity': {
      const offers = pending.offers.flatMap((id) => p.opportunityCard(id) ?? []);
      const pick = bot.opportunity(p, offers, bot.view(p));
      return pick
        ? { type: 'take_opportunity', cardId: pick.card.id, choice: pick.choice }
        : { type: 'skip' };
    }
  }
}

/**
 * What a bot would do next, as the commands that do it (one logical step: a decision, a month's money, a Harvest card's options, a
 * roll or the end of the turn). Empty when it has nothing to do now - it is not its turn and no Harvest card waits for it.
 */
export function dreamBotCommands(table: DreamTable, botId: string): DreamCommand[] {
  const seat = table.players.find((p) => p.id === botId);
  if (!seat?.bot || table.phase !== 'playing' || !seat.life) return [];
  if (seat.status !== 'active' || table.finishers.some((f) => f.playerId === botId)) return [];
  const luck = luckOf(table, botId);
  const level = splitDreamBotId(seat.bot.policyId)?.level ?? 'master';
  // a bot of a lower level slips now and then (its own luck decides, never the table's dice)
  const bot = new DreamBot(
    withDreamMistakes(
      botPolicy(seat.bot.policyId),
      DREAM_BOT_LEVELS[level],
      luckOf(table, `${botId}:slip`),
    ),
  );
  const p = wake(table, seat);
  const harvest = harvestCommands(bot, p, seat);
  if (harvest.length > 0) return harvest;
  const answer = answerOffer(table, bot, p, botId);
  if (answer.length > 0) return answer;
  if (table.activePlayerId !== botId) return [];
  if (seat.paydayDue) return moneyCommands(bot, p);
  if (seat.pending) return [pendingCommand(bot, p, seat, luck)];
  if (!table.turnRolled) return [{ type: 'roll' }];
  // the turn is played: a card offered to the others stays until the bots have answered (people have the seconds the pace gives them)
  if (table.trade?.sellerId === botId) {
    return awaitedBuyers(table, botId).length > 0 ? [] : [{ type: 'end_turn' }];
  }
  const offer = offerCommand(table, bot, p, botId);
  return offer ? [offer] : [{ type: 'end_turn' }];
}

/** Bots that have not answered an offer yet. */
function awaitedBuyers(table: DreamTable, sellerId: string): DreamSeat[] {
  const offer = table.trade;
  if (!offer) return [];
  return table.players.filter(
    (s) =>
      s.bot &&
      s.id !== sellerId &&
      s.status === 'active' &&
      s.life &&
      !table.finishers.some((f) => f.playerId === s.id) &&
      (offer.to === null || offer.to === s.id) &&
      !offer.declined.includes(s.id),
  );
}

/** A bot that is short of cash offers a card it holds to the table at a fair price (a little over a standing sale). */
function offerCommand(
  table: DreamTable,
  bot: DreamBot,
  p: DreamPlayer,
  botId: string,
): DreamCommand | null {
  void bot;
  if (table.trade || p.cash() >= p.monthlyExpenses()) return null;
  const others = table.players.filter(
    (s) =>
      s.id !== botId &&
      s.status === 'active' &&
      s.life &&
      !table.finishers.some((f) => f.playerId === s.id),
  );
  if (others.length === 0) return null;
  for (const holding of p.state.holdings ?? []) {
    if (holding.ended) continue;
    const found = p.sellable(holding.title);
    if (!found || found.standing.grossMinor <= 0) continue;
    return {
      type: 'offer_trade',
      holding: holding.title,
      priceMinor: Math.max(1, Math.round(found.standing.grossMinor * 1.15)),
    };
  }
  return null;
}

/** What a bot answers to a card offered at the table: it buys what its strategy would take, at a price that is no more than the card costs. */
function answerOffer(
  table: DreamTable,
  bot: DreamBot,
  p: DreamPlayer,
  botId: string,
): DreamCommand[] {
  const offer = table.trade;
  if (!offer || offer.sellerId === botId) return [];
  if (offer.declined.includes(botId) || (offer.to !== null && offer.to !== botId)) return [];
  const card = p.opportunityCard(offer.cardId);
  const holding = (
    table.players.find((s) => s.id === offer.sellerId)?.life?.books.state.holdings ?? []
  ).find((h) => h.title === offer.holding && !h.ended);
  if (!card || !holding) return [{ type: 'decline_trade' }];
  const choice = holding.units ? { units: holding.units } : {};
  const quote = p.quoteOpportunity(card, choice);
  if (!quote.ok) return [{ type: 'decline_trade' }];
  const held = new Map<string, number>();
  for (const h of p.state.holdings ?? []) if (!h.ended) held.set(h.cardId, h.units ?? 1);
  const wanted = bot.policy.take([card], bot.view(p), held) !== null;
  const affordable = offer.priceMinor <= p.cash() + p.reserveMinor;
  if (wanted && affordable && offer.priceMinor <= quote.costMinor)
    return [{ type: 'accept_trade' }];
  return [{ type: 'decline_trade' }];
}

/** The next bot that has something to do: the one on the move first, then any bot with a Harvest card's options. */
export function nextBotStep(
  table: DreamTable,
): { playerId: string; commands: DreamCommand[] } | null {
  if (table.phase !== 'playing') return null;
  const order = [
    table.activePlayerId,
    ...table.players.map((p) => p.id).filter((id) => id !== table.activePlayerId),
  ];
  for (const id of order) {
    if (!id) continue;
    const commands = dreamBotCommands(table, id);
    if (commands.length > 0) return { playerId: id, commands };
  }
  return null;
}

/** Applies one step of a bot; a command the table refuses is replaced by the most passive legal one. */
export function playBotStep(
  table: DreamTable,
  step: { playerId: string; commands: DreamCommand[] },
  ctx: DreamContext,
): DreamCommandResult {
  let current = table;
  const events: DreamEvent[] = [];
  for (const command of step.commands) {
    try {
      const result = applyDreamCommand(current, step.playerId, command, ctx);
      current = result.table;
      events.push(...result.events);
    } catch (error) {
      if (!(error instanceof TableCommandError)) throw error;
      // not possible after all (the table's dice differed from the bot's guess): the most passive way on
      for (const passive of passiveCommands(current, step.playerId)) {
        try {
          const result = applyDreamCommand(current, step.playerId, passive, ctx);
          current = result.table;
          events.push(...result.events);
          break;
        } catch (inner) {
          if (!(inner instanceof TableCommandError)) throw inner;
        }
      }
      break;
    }
  }
  return { table: current, events };
}

/** The bots play until it is a person's turn (or the game is over, or `maxSteps` commands were played). */
export function runDreamBots(
  table: DreamTable,
  ctx: DreamContext,
  maxSteps = 5000,
): DreamCommandResult {
  let current = table;
  const events: DreamEvent[] = [];
  for (let i = 0; i < maxSteps; i += 1) {
    const step = nextBotStep(current);
    if (!step) break;
    const before = current.version;
    const result = playBotStep(current, step, ctx);
    current = result.table;
    events.push(...result.events);
    if (current.version === before) break;
  }
  return { table: current, events };
}
