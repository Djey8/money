import type { EmergencyLang, Localized } from './emergency-deck';
import type { GameEffects } from './effects';
import type { CashflowGameState, CashflowTransactionRecord } from './types';

/**
 * A payment a card asks for (JFK, 2026-10-26: "whenever something has to be paid, the Add-transaction dialog opens and the player pays
 * it themselves"). The rules do not book such a cost: they put it on the game's list of payments due, and the game page opens the Add
 * dialog filled in with it. The transaction the dialog books carries `#gamepay #due:<id>`, which settles the entry; a short balance is
 * covered by a Bank loan first, like every other purchase.
 */
export interface PaymentDue {
  id: string;
  /** What it is for, in the game's language. */
  title: string;
  /** What it costs, above zero. */
  costMinor: number;
  /** The account it is suggested to come out of. */
  account: string;
  /** The spending category, without the `@`. */
  category: string;
}

/** The tag of a payment made for a card. */
export const GAME_PAY_MARK = /#gamepay\b/;

const DUE_ID = /#due:([^\s]+)/;

/** The comment the Add dialog is filled in with for a payment due. */
export function paymentDueComment(due: Pick<PaymentDue, 'id' | 'title'>): string {
  return `${due.title}\n\n#gamepay #due:${due.id}`;
}

/** The id of the payment due a comment pays, or undefined. */
export function paymentDueIdOf(comment: string | undefined | null): string | undefined {
  return DUE_ID.exec(comment ?? '')?.[1];
}

export function paymentsDueOf(state: Pick<CashflowGameState, 'paymentsDue'>): PaymentDue[] {
  return state.paymentsDue ?? [];
}

/** The payment due that is next to be paid, or null. */
export function firstPaymentDue(state: Pick<CashflowGameState, 'paymentsDue'>): PaymentDue | null {
  return paymentsDueOf(state)[0] ?? null;
}

/** The state with the payment put on the list (an id of its own, also when the same card comes twice). */
export function withPaymentDue(
  state: CashflowGameState,
  due: Omit<PaymentDue, 'id'> & { id?: string },
): CashflowGameState {
  const list = paymentsDueOf(state);
  const taken = new Set(list.map((item) => item.id));
  const base = due.id ?? `due-${due.category.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}`;
  let id = base;
  let n = 1;
  while (taken.has(id)) id = `${base}~${(n += 1)}`;
  return { ...state, paymentsDue: [...list, { ...due, id }] };
}

/** The state without the payment the comment pays (the first of the same category when it names none). */
export function withPaymentSettled(
  state: CashflowGameState,
  comment: string,
  category: string,
): CashflowGameState {
  const list = paymentsDueOf(state);
  if (list.length === 0) return state;
  const id = paymentDueIdOf(comment);
  const wanted = category.replace(/^@/, '').toLowerCase();
  const at = id
    ? list.findIndex((item) => item.id === id)
    : list.findIndex((item) => item.category.toLowerCase() === wanted);
  if (at < 0) return state;
  return { ...state, paymentsDue: list.filter((_, index) => index !== at) };
}

/**
 * A one-time amount of a card: money coming in is booked at once; a cost becomes a payment due, which the player pays in the Add
 * dialog. Returns the state with the payment on its list (or unchanged).
 */
export function bookOneTime(
  state: CashflowGameState,
  effects: GameEffects,
  title: Localized,
  amountMinor: number,
  date: string,
  lang: EmergencyLang,
): CashflowGameState {
  if (amountMinor === 0) return state;
  if (amountMinor < 0) {
    return withPaymentDue(state, {
      title: title[lang],
      costMinor: -amountMinor,
      account: 'Daily',
      category: title[lang],
    });
  }
  const record: CashflowTransactionRecord = {
    account: 'Income',
    amountMinor,
    date,
    time: '',
    category: `@${title[lang]}`,
    comment: `${title[lang]}\n#dreamfund`,
  };
  effects.appendedTransactions.push(record);
  return state;
}
