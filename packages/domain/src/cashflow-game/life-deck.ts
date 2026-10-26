import { pickOne, rollDie, systemRng, type Rng } from './rng';
import type { EmergencyDeckState, EmergencyLang, Localized } from './emergency-deck';

/**
 * The Dreamfund Life stack (JFK, 2026-10-26, temp_cards/dreamfund-life-deck.md v0.3): what a life card is, who it can happen to, and
 * what it does to the books. A card never touches the account itself: resolving it gives an outcome (one payment, monthly lines, a new
 * life state, a reward, things that happen at later Paydays) which `applyLifeOutcome` turns into the game's effects.
 */

export type Relationship = 'single' | 'partner' | 'cohabiting' | 'married';
export type PetKind = 'none' | 'cat' | 'dog';
export type HomeKind = 'own_flat' | 'shared_flat' | 'with_parents' | 'with_partner';
export type LocationKind = 'home_city' | 'other_city' | 'abroad_europe' | 'other_continent';
export type EmploymentKind = 'employed' | 'unemployed' | 'short_time';

/** What the game tracks of a player's life: the badges of the profile. */
export interface LifeState {
  relationship: Relationship;
  kids: number;
  pet: PetKind;
  car: boolean;
  home: HomeKind;
  location: LocationKind;
  employment: EmploymentKind;
}

export const INITIAL_LIFE_STATE: LifeState = {
  relationship: 'single',
  kids: 0,
  pet: 'none',
  car: false,
  home: 'own_flat',
  location: 'home_city',
  employment: 'employed',
};

/** The life state a card may ask for: a value, or any of several. */
export type LifeRequirement = {
  [K in keyof LifeState]?: LifeState[K] | LifeState[K][];
};

/** What a card changes of the life state (`kidsDelta`: children added). */
export type LifeStateChange = Partial<Omit<LifeState, 'kids'>> & { kidsDelta?: number };

export interface DiceBand<T> {
  from: number;
  to: number;
  value: T;
}

export interface LifeEffect {
  /** A payment (negative) or a receipt (positive), once. */
  oneTimeMinor?: number;
  /** Once, a share of the monthly net income (negative: a payment). */
  oneTimePercentOfNet?: number;
  /** A monthly cost (positive) or saving (negative), as the cards print it. */
  monthlyMinor?: number;
  /** More income each month. */
  incomeMonthlyMinor?: number;
  /** A change of the net income in percent of it (negative: a cut); children soften a cut. */
  incomePercentOfNet?: number;
  incomePercentWithKids?: number;
  /** A change of all monthly expenses in percent. */
  expensesPercent?: number;
  /** How many Paydays it lasts; absent: for good. */
  durationPaydays?: number;
  /** Lines of one group replace each other (a new move replaces the last one's effects; a move also ends rent changes). */
  group?: 'move' | 'rent' | 'employment';
  setState?: LifeStateChange;
  /** Roll two dice for this many turns. */
  rewardTurns?: number;
  /** Something that happens after some Paydays (a baby). */
  schedule?: { cardId: string; afterPaydays: number };
  /** The child cost is worked out from the profession's living standard, the number of siblings and a birth roll. */
  child?: boolean;
  /** Job loss: each Payday a roll may bring a new job; after the longest time the next offer pays less. */
  jobSearch?: { rollFrom: number; maxPaydays: number; fallbackPercent: number };
  /** A cut of the income that lasts only a while (the parental leave after a birth). */
  temporary?: { incomePercentOfNet: number; durationPaydays: number };
  /** The cost to end a monthly line again (lifestyle creep), once, at a Payday. */
  removeCostMinor?: number;
  /** The line cannot be ended before this many Paydays (a gym contract). */
  minPaydays?: number;
  /** Rolls two dice after every Payday while it lasts (a sponsorship). */
  ongoingReward?: boolean;
  /** Moving away with a partner: a roll may end the relationship (the band that triggers the break-up). */
  partnerRisk?: { upTo: number };
  /** Lent money: at the next Payday a roll brings it back or not. */
  lendReturn?: { from: number; amountMinor: number };
}

export type LifeCardType = 'fate' | 'choice' | 'dice' | 'giving';

export interface LifeCard {
  id: string;
  copies: number;
  type: LifeCardType;
  title: Localized;
  story: Localized;
  requires?: LifeRequirement;
  /** Fate cards: what happens. */
  effects?: LifeEffect;
  /** Fate cards that depend on the state (a break-up). */
  effectsByState?: Record<string, LifeEffect>;
  /** Choice cards: accepting; declining (nothing, or a roll that may trigger another card). */
  accept?: LifeEffect;
  declineRoll?: { upTo: number; triggers: string };
  /** Choice cards with two ways (the old car: keep it or sell it). */
  options?: { id: string; label: Localized; effect: LifeEffect }[];
  /** Dice cards: what the roll decides. */
  dice?: DiceBand<LifeEffect | null>[];
  /** Dice cards the player may leave. */
  optional?: boolean;
  /** Giving cards: give (with a reward), or lend (another card of the family), or pass. */
  give?: LifeEffect;
  lend?: LifeEffect;
  links: { label: Localized; url: string }[];
}

// ── the stack ──

export interface LifeDraw {
  card: LifeCard;
  deck: EmergencyDeckState;
  /** Cards that could not happen to this player (a break-up while single): put back, the next one is drawn. */
  skipped: string[];
}

export function meetsRequirement(requires: LifeRequirement | undefined, life: LifeState): boolean {
  if (!requires) return true;
  return (Object.keys(requires) as (keyof LifeState)[]).every((key) => {
    const wanted = requires[key];
    const has = life[key];
    return Array.isArray(wanted)
      ? (wanted as unknown[]).includes(has)
      : (wanted as unknown) === has;
  });
}

/** The stack as it is dealt: every card as often as it has copies, each copy a draw of its own. */
function dealt(cards: readonly LifeCard[]): string[] {
  return cards.flatMap((card) => Array.from({ length: card.copies }, (_, i) => `${card.id}#${i}`));
}

/**
 * Draws the next Life card at random. One that cannot happen to this player (a break-up while single) is put back and the next
 * one is drawn: a Life tile always tells a bit of story. The pile is used up copy by copy, then reshuffled.
 */
export function drawLifeCard(
  cards: readonly LifeCard[],
  deck: EmergencyDeckState,
  life: LifeState,
  rng: Rng = systemRng,
): LifeDraw {
  const skipped: string[] = [];
  let seen = deck.seen;
  const open = () => dealt(cards).filter((copy) => !seen.includes(copy));
  let pile = open();
  if (pile.length === 0) {
    seen = [];
    pile = open();
  }
  const byId = new Map(cards.map((card) => [card.id, card]));
  const rest = [...pile];
  let drawn: string | undefined;
  while (rest.length > 0 && !drawn) {
    const copy = rest.splice(Math.floor(rng() * rest.length), 1)[0];
    if (meetsRequirement(byId.get(copy.split('#')[0])?.requires, life)) drawn = copy;
    else skipped.push(copy.split('#')[0]);
  }
  if (!drawn) {
    // nothing left fits: the discards come back
    seen = [];
    const fits = dealt(cards).filter((copy) =>
      meetsRequirement(byId.get(copy.split('#')[0])?.requires, life),
    );
    drawn = pickOne(fits, rng);
  }
  return {
    card: byId.get(drawn.split('#')[0])!,
    deck: { seen: [...seen, drawn], gone: deck.gone },
    skipped,
  };
}

// ── resolving a card ──

/** A monthly line a card leaves behind: signed like a subscription (positive pays you, negative costs you). */
export interface LifeLine {
  id: string;
  cardId: string;
  title: Localized;
  amountMinor: number;
  paydaysLeft?: number;
  group?: string;
  minPaydays?: number;
  removeCostMinor?: number;
  /** Paydays the line has run (for a contract that cannot be left early). */
  age?: number;
}

/** Something that happens at a later Payday. */
export interface ScheduledLife {
  paydaysLeft: number;
  title: Localized;
  /** What happens then; or a roll that decides between outcomes. */
  outcome?: LifeOutcome;
  roll?: { from: number; success: LifeOutcome };
}

export interface LifeOutcome {
  cardId: string;
  /** The monthly costs were scaled down so the card does not end the game (see `softenLines`). */
  softened?: boolean;
  /** What to tell: the card's title for the transaction. */
  title: Localized;
  oneTimeMinor: number;
  lines: LifeLine[];
  removeGroups: string[];
  life: LifeState;
  /** What the card changes of the life state, apart from where the player is now: applied again when it happens later. */
  lifeChange?: LifeStateChange;
  rewardTurns?: number;
  scheduled: ScheduledLife[];
  jobSearch?: { title: Localized; rollFrom: number; paydaysLeft: number; fallbackPercent: number };
  ongoingReward?: boolean;
  /** Dice rolled while resolving (shown to the player). */
  rolls: number[];
  /** Another card that follows from this one (a refused proposal that ends the relationship). */
  triggered?: string;
}

export interface LifeContext {
  life: LifeState;
  /** The net monthly income now: salary less tax and social insurance. */
  netMonthlyMinor: number;
  /** All monthly expenses now (a positive number). */
  expensesMonthlyMinor: number;
  /** The profession's living standard (1 = the Dual Student). */
  livingStandard: number;
  lang: EmergencyLang;
  rng?: Rng;
}

const bandOf = <T>(bands: DiceBand<T>[], roll: number): T | undefined =>
  bands.find((band) => roll >= band.from && roll <= band.to)?.value;

const CHILD_BASE_MINOR = 70000;
const SIBLING_FACTOR = (kidsBefore: number) =>
  kidsBefore === 0 ? 1 : kidsBefore === 1 ? 0.8 : 0.7;
const BIRTH_FACTOR = (roll: number) => (roll <= 2 ? 0.9 : roll <= 4 ? 1.0 : 1.15);

/** Changes the life state as a card asks. */
export function changeLife(life: LifeState, change: LifeStateChange | undefined): LifeState {
  if (!change) return life;
  const { kidsDelta, ...rest } = change;
  return { ...life, ...rest, kids: life.kids + (kidsDelta ?? 0) };
}

/** Two changes of the life state, one after the other. */
export function mergeChange(
  first: LifeStateChange | undefined,
  second: LifeStateChange | undefined,
): LifeStateChange | undefined {
  if (!first) return second;
  if (!second) return first;
  const { kidsDelta: a, ...restA } = first;
  const { kidsDelta: b, ...restB } = second;
  const kidsDelta = (a ?? 0) + (b ?? 0);
  return { ...restA, ...restB, ...(kidsDelta ? { kidsDelta } : {}) };
}

/** What one effect does to this player: the payment, the lines, the new life state. Dice are rolled here. */
export function resolveLifeEffect(
  card: Pick<LifeCard, 'id' | 'title'>,
  effect: LifeEffect | undefined,
  context: LifeContext,
  base?: LifeOutcome,
): LifeOutcome {
  const rng = context.rng ?? systemRng;
  const out: LifeOutcome = base ?? {
    cardId: card.id,
    title: card.title,
    oneTimeMinor: 0,
    lines: [],
    removeGroups: [],
    life: context.life,
    scheduled: [],
    rolls: [],
  };
  if (!effect) return out;
  const net = context.netMonthlyMinor;
  const withKids = context.life.kids > 0;
  const lineId = (suffix: string) => `${card.id}:${suffix}`;
  const line = (suffix: string, amountMinor: number, extra: Partial<LifeLine> = {}): LifeLine => ({
    id: lineId(suffix),
    cardId: card.id,
    title: card.title,
    amountMinor,
    ...(effect.durationPaydays ? { paydaysLeft: effect.durationPaydays } : {}),
    ...(effect.group ? { group: effect.group } : {}),
    ...(effect.minPaydays ? { minPaydays: effect.minPaydays, age: 0 } : {}),
    ...(effect.removeCostMinor !== undefined ? { removeCostMinor: effect.removeCostMinor } : {}),
    ...extra,
  });

  let oneTime = out.oneTimeMinor + (effect.oneTimeMinor ?? 0);
  if (effect.oneTimePercentOfNet) {
    oneTime += Math.round((net * effect.oneTimePercentOfNet) / 100);
  }
  const lines = [...out.lines];
  // a move ends the earlier move and the rent changes
  const removeGroups = [...out.removeGroups, ...(effect.group === 'move' ? ['move', 'rent'] : [])];

  if (effect.monthlyMinor) lines.push(line('monthly', -effect.monthlyMinor));
  if (effect.incomeMonthlyMinor) lines.push(line('income', effect.incomeMonthlyMinor));
  if (effect.incomePercentOfNet !== undefined) {
    const percent =
      withKids && effect.incomePercentWithKids !== undefined
        ? effect.incomePercentWithKids
        : effect.incomePercentOfNet;
    lines.push(line('incomePercent', Math.round((net * percent) / 100)));
  }
  if (effect.temporary) {
    lines.push(
      line('leave', Math.round((net * effect.temporary.incomePercentOfNet) / 100), {
        paydaysLeft: effect.temporary.durationPaydays,
      }),
    );
  }
  if (effect.expensesPercent) {
    // a rise in expenses is a cost, a fall a saving
    lines.push(
      line(
        'expensesPercent',
        -Math.round((context.expensesMonthlyMinor * effect.expensesPercent) / 100),
      ),
    );
  }

  const life = changeLife(out.life, effect.setState);
  const lifeChange = mergeChange(out.lifeChange, effect.setState);
  const rolls = [...out.rolls];
  if (effect.child) {
    const birth = rollDie(rng);
    rolls.push(birth);
    const monthly = Math.round(
      CHILD_BASE_MINOR *
        context.livingStandard *
        SIBLING_FACTOR(context.life.kids) *
        BIRTH_FACTOR(birth),
    );
    lines.push(line('child', -monthly, { title: { en: 'Child', de: 'Kind' } }));
  }
  const scheduled = [...out.scheduled];
  const rewardTurns = Math.max(out.rewardTurns ?? 0, effect.rewardTurns ?? 0) || undefined;
  return {
    ...out,
    oneTimeMinor: oneTime,
    lines,
    removeGroups,
    life,
    lifeChange,
    scheduled,
    rolls,
    ...(rewardTurns ? { rewardTurns } : {}),
    ...(effect.ongoingReward ? { ongoingReward: true } : {}),
    ...(effect.jobSearch
      ? {
          jobSearch: {
            title: card.title,
            rollFrom: effect.jobSearch.rollFrom,
            paydaysLeft: effect.jobSearch.maxPaydays,
            fallbackPercent: effect.jobSearch.fallbackPercent,
          },
        }
      : {}),
  };
}

/** The effect that follows the player's decision on a card, resolved. The kind of decision depends on the card. */
export type LifeDecision =
  | { kind: 'fate' }
  | { kind: 'accept' }
  | { kind: 'decline' }
  | { kind: 'option'; id: string }
  | { kind: 'roll' }
  | { kind: 'give' }
  | { kind: 'lend' }
  | { kind: 'pass' };

export const LEND_RETURN_BANDS = { from: 4 };

/**
 * Resolves a decision on a card. `byId` finds a card another card triggers (a refused proposal may trigger the break-up).
 */
export function resolveLifeCard(
  card: LifeCard,
  decision: LifeDecision,
  context: LifeContext,
  byId: (id: string) => LifeCard | undefined,
): LifeOutcome {
  const rng = context.rng ?? systemRng;
  const effectFor = (effect: LifeEffect | undefined) => resolveLifeEffect(card, effect, context);
  switch (decision.kind) {
    case 'fate': {
      const effect = card.effects ?? card.effectsByState?.[context.life.relationship] ?? undefined;
      return withExtras(card, effect, effectFor(effect), context, byId);
    }
    case 'accept':
      return withExtras(card, card.accept, effectFor(card.accept), context, byId);
    case 'decline': {
      const out = effectFor(undefined);
      if (card.declineRoll) {
        const roll = rollDie(rng);
        out.rolls.push(roll);
        if (roll <= card.declineRoll.upTo) {
          const triggered = byId(card.declineRoll.triggers);
          if (triggered) {
            const inner = resolveLifeCard(triggered, { kind: 'fate' }, context, byId);
            return { ...inner, rolls: [roll, ...inner.rolls], triggered: triggered.id };
          }
        }
      }
      return out;
    }
    case 'option': {
      const option = card.options?.find((candidate) => candidate.id === decision.id);
      return withExtras(card, option?.effect, effectFor(option?.effect), context, byId);
    }
    case 'roll': {
      const roll = rollDie(rng);
      const effect = card.dice ? (bandOf(card.dice, roll) ?? undefined) : undefined;
      const out = resolveLifeEffect(card, effect, context);
      out.rolls.push(roll);
      if (effect?.schedule) {
        const due = byId(effect.schedule.cardId);
        if (due) {
          const inner = resolveLifeCard(due, { kind: 'fate' }, context, byId);
          out.scheduled.push({
            paydaysLeft: effect.schedule.afterPaydays,
            title: due.title,
            outcome: inner,
          });
        }
      }
      return out;
    }
    case 'give':
      return withExtras(card, card.give, effectFor(card.give), context, byId);
    case 'lend': {
      const out = effectFor(card.lend);
      const lend = card.lend?.lendReturn;
      if (lend) {
        out.scheduled.push({
          paydaysLeft: 1,
          title: card.title,
          roll: {
            from: lend.from,
            success: {
              cardId: card.id,
              title: card.title,
              oneTimeMinor: lend.amountMinor,
              lines: [],
              removeGroups: [],
              life: context.life,
              scheduled: [],
              rolls: [],
            },
          },
        });
      }
      return out;
    }
    case 'pass':
      return effectFor(undefined);
  }
}

/** The parts of an effect that need the card or other cards: a scheduled baby, a partner who may leave. */
function withExtras(
  card: LifeCard,
  effect: LifeEffect | undefined,
  out: LifeOutcome,
  context: LifeContext,
  byId: (id: string) => LifeCard | undefined,
): LifeOutcome {
  const rng = context.rng ?? systemRng;
  if (effect?.partnerRisk && context.life.relationship === 'partner') {
    const roll = rollDie(rng);
    out.rolls.push(roll);
    if (roll <= effect.partnerRisk.upTo) {
      const breakUp = byId('L04');
      if (breakUp) {
        const inner = resolveLifeCard(
          breakUp,
          { kind: 'fate' },
          { ...context, life: out.life },
          byId,
        );
        return {
          ...out,
          oneTimeMinor: out.oneTimeMinor + inner.oneTimeMinor,
          lines: [...out.lines, ...inner.lines],
          life: inner.life,
          lifeChange: mergeChange(out.lifeChange, inner.lifeChange),
          triggered: 'L04',
        };
      }
    }
  }
  return out;
}

// ── the books ──

/** The ids of lines the player can end themselves (and what that costs): lifestyle creep and the like. */
export function endableLines(lines: readonly LifeLine[]): LifeLine[] {
  return lines.filter(
    (line) => line.removeCostMinor !== undefined || line.minPaydays !== undefined,
  );
}

export function canEndLine(line: LifeLine): boolean {
  return line.minPaydays === undefined || (line.age ?? 0) >= line.minPaydays;
}
