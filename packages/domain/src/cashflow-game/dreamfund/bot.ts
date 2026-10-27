import type { HarvestLadderOffer, HarvestSale } from '../harvest';
import { indexOf } from '../harvest';
import type { LifeCard, LifeDecision } from '../life-deck';
import type { OpportunityCard, OpportunityPile } from '../opportunity-deck';
import type { OpportunityChoice } from '../opportunity';
import type { DreamCard } from '../dream-deck';
import type { Rng } from '../rng';
import { salaryLinkedMinor } from '../saved-games';
import { expectedMonthlyMinor, type DreamPolicy, type DreamView } from '../dreamfund-sim/policies';
import type { DreamPlan, DreamPlayer } from './player';

/**
 * The decisions of a bot (JFK, 2026-10-27): what the simulation's player does with its money and its cards, as functions of a life -
 * taken out of the simulation so that the bots at a table decide exactly the same way. A bot's strategy is a `DreamPolicy`; this class
 * is the judgement around it (the plans of a Payday, the lump sums, the answer to a life card, how to pay an emergency).
 * Nothing here changes a life by itself: it reads one and tells what to do, or does it through the `MoneyActor` it is given.
 */

/** What a bot does with its money: a life's own methods in the simulation, a recorder of commands at a table. */
export interface MoneyActor {
  fundReserve(putMinor: number): void;
  repayBankLoan(repayMinor: number): void;
  repayDebt(tag: string): void;
  fundDreams(money: number): void;
}

export class DreamBot {
  constructor(readonly policy: DreamPolicy) {}

  /** What a policy may look at when it decides. */
  view(p: DreamPlayer): DreamView {
    const finances = p.finances();
    const expenses = p.monthlyExpenses();
    const cash = p.cash();
    return {
      cashMinor: cash,
      monthlyExpensesMinor: expenses,
      passiveMinor: finances.passiveIncomeMinor,
      reserveMinor: p.reserveMinor,
      reserveTargetMinor: expenses * 3,
      round: p.state.round,
      debtsMinor: p.debtsMinor(),
      dreamFundedMinor: p.dreamSavedMinor,
      dreamTargetMinor: p.dreamTargetMinor,
      spendableMinor: Math.max(0, cash - this.policy.bufferMonths * expenses),
      markets: p.state.markets ?? {},
      holdingsCount: (p.state.holdings ?? []).filter((holding) => !holding.ended).length,
      difficulty: p.rules.difficulty,
    };
  }

  // ── a Payday ──

  /**
   * The plans of the reserve and of the dreams, set to what the month can carry: a share of what is left of the monthly cashflow
   * after the plans already running (an emergency plan is paid first), in the order of the strategy. Returns the new list of plans.
   */
  replan(p: DreamPlayer): DreamPlan[] {
    const policy = this.policy;
    const finances = p.finances();
    let plans = p.plans.map((plan) => ({ ...plan }));
    const committed = plans
      .filter((plan) => plan.kind === 'emergency')
      .reduce((sum, plan) => sum + plan.perMinor, 0);
    let room = Math.max(
      0,
      Math.floor((finances.monthlyCashflowMinor - committed) * policy.planShare),
    );
    const months = Math.max(3, policy.planMonths);
    const set = (kind: DreamPlan['kind'], id: string, left: number) => {
      plans = plans.filter((plan) => !(plan.kind === kind && plan.id === id));
      if (left <= 0 || room <= 0) return;
      const per = Math.min(room, Math.ceil(left / months));
      plans.push({ kind, id, perMinor: per, leftMinor: left });
      room -= per;
    };
    for (const priority of policy.priorities) {
      if (priority === 'reserve') {
        set('mojo', 'mojo', Math.max(0, p.monthlyExpenses() * 3 - p.reserveMinor));
      } else if (priority === 'dream') {
        const wait = policy.dreamAfterPassiveShare;
        const living = finances.expensesMinor - salaryLinkedMinor(p.state, p.books.subscriptions);
        if (wait !== undefined && finances.passiveIncomeMinor < living * wait) continue;
        if (!p.dreamLived && p.dreamTargetMinor > 0) {
          set('life', 'life', p.dreamTargetMinor - p.dreamSavedMinor);
        }
        for (const dream of p.smile) {
          set('smile', dream.cardId, dream.totalMinor - dream.savedMinor);
        }
      }
    }
    return plans;
  }

  /** What is left over a buffer after the plans: lump sums into the reserve, the debts and the dreams, as the strategy ranks them. */
  extraPayments(p: DreamPlayer, actor: MoneyActor): void {
    const policy = this.policy;
    const expenses = p.monthlyExpenses();
    const buffer = policy.bufferMonths * expenses;
    const free = () => Math.max(0, p.cash() - buffer);
    for (const priority of policy.priorities) {
      if (priority === 'reserve') {
        actor.fundReserve(Math.min(free(), Math.max(0, expenses * 3 - p.reserveMinor)));
      } else if (priority === 'debt') {
        for (const liability of [...p.books.liabilities]) {
          if (liability.amountMinor <= 0) continue;
          const isBank = liability.tag === 'Bank loan';
          if (!isBank && !p.debtTags.includes(liability.tag)) continue;
          if (isBank) {
            const step = p.books.gameSet?.loanRule.incrementMinor ?? 100000;
            actor.repayBankLoan(Math.min(liability.amountMinor, Math.floor(free() / step) * step));
          } else if (free() >= liability.amountMinor) {
            actor.repayDebt(liability.tag);
          }
        }
      } else if (priority === 'dream') {
        actor.fundDreams(free() * policy.dreamShare);
      }
    }
    p.checkDreams();
  }

  // ── the tiles ──

  /** How an emergency is paid: at once, or on a plan of 3, 6 or 12 Paydays that the month can carry. */
  emergencyPay(
    p: DreamPlayer,
    mustPayNow: boolean,
    payMinor: number,
  ): { pay: 'now' } | { pay: 3 | 6 | 12; total: number; per: number } {
    const buffer = this.policy.bufferMonths * p.monthlyExpenses();
    if (mustPayNow || p.cash() - payMinor >= buffer || p.reserveMinor >= payMinor) {
      return { pay: 'now' };
    }
    const room = p.planRoomMinor();
    const choices = p.emergencyPlanOptions(payMinor);
    const fits = choices.find((choice) => choice.per <= room) ?? choices[2];
    return { pay: fits.months as 3 | 6 | 12, total: fits.total, per: fits.per };
  }

  /** The answer to a Life card. */
  lifeDecision(p: DreamPlayer, card: LifeCard, rng: Rng): LifeDecision {
    if (card.type === 'fate') return { kind: 'fate' };
    if (card.type === 'dice') {
      // a wish for a baby, a risk worth taking only with a full reserve and a month that can carry it
      const finances = p.finances();
      const safe =
        p.reserveMinor >= p.monthlyExpenses() * 3 &&
        finances.monthlyCashflowMinor >= finances.expensesMinor * 0.3;
      return card.optional && !safe ? { kind: 'pass' } : { kind: 'roll' };
    }
    if (card.type === 'giving') return { kind: 'pass' };
    if (card.options?.length) return { kind: 'option', id: card.options[0].id };
    return this.lifeChoice(p, card, rng);
  }

  /**
   * A choice of life: a sensible player takes what they can afford - a new monthly cost that leaves a good part of the month, and a
   * payment that cash and reserve can carry - and the strategy's appetite decides the rest.
   */
  private lifeChoice(p: DreamPlayer, card: LifeCard, rng: Rng): LifeDecision {
    const probe = p.probeLife(card);
    const cashflow = p.finances().monthlyCashflowMinor;
    const affordable = probe.payNow <= p.cash() + p.reserveMinor;
    const keeps = probe.impact >= 0 || cashflow + probe.impact >= cashflow * 0.4;
    if (!affordable || !keeps) return { kind: 'decline' };
    return probe.impact >= 0 || rng() < this.policy.lifeAcceptChance
      ? { kind: 'accept' }
      : { kind: 'decline' };
  }

  /** The pile to draw Opportunity cards from (or none). */
  pile(p: DreamPlayer, rng: Rng): OpportunityPile | null {
    return this.policy.pile(this.view(p), rng);
  }

  /** The card to take among the offers, with its choice - giving up the weakest hustle only for a card that is clearly better. */
  opportunity(
    p: DreamPlayer,
    offers: readonly OpportunityCard[],
    view: DreamView,
  ): { card: OpportunityCard; choice: OpportunityChoice; costMinor: number } | null {
    const held = new Map<string, number>();
    for (const holding of p.state.holdings ?? []) {
      if (!holding.ended) held.set(holding.cardId, holding.units ?? 1);
    }
    const pick = this.policy.take(offers, view, held);
    if (!pick) return null;
    let choice = pick.choice;
    let quote = p.quoteOpportunity(pick.card, choice);
    if (quote.needsSwap && quote.sideHustles.length > 0) {
      const weakest = [...quote.sideHustles].sort(
        (x, y) => (x.lineMinor ?? x.cashflowMinor) - (y.lineMinor ?? y.cashflowMinor),
      )[0];
      const weakestMonthly = Math.max(weakest.lineMinor ?? 0, weakest.cashflowMinor);
      if (expectedMonthlyMinor(pick.card) < weakestMonthly * 1.3) return null;
      choice = { ...choice, swapOut: weakest.cardId };
      quote = p.quoteOpportunity(pick.card, choice);
    }
    if (!quote.ok) return null;
    return { card: pick.card, choice, costMinor: quote.costMinor };
  }

  /** The dream to take among the offers (or none). */
  dream(p: DreamPlayer, offers: readonly DreamCard[], openCount: number): DreamCard | null {
    return this.policy.dream(offers, this.view(p), openCount);
  }

  /** Sell this holding into an open market now? */
  sellWindow(p: DreamPlayer, holding: { title: string; tag: string }): boolean {
    return this.policy.sellWindow(this.view(p), holding, indexOf(p.state, holding.tag));
  }

  acceptBuyer(p: DreamPlayer, sale: HarvestSale): boolean {
    return this.policy.acceptBuyer(this.view(p), sale);
  }

  ladder(p: DreamPlayer, offer: HarvestLadderOffer): 'skip' | 'ride' | 'cash' {
    return this.policy.ladder(this.view(p), offer);
  }
}
