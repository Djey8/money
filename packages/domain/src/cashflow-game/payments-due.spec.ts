import { emptyEffects } from './effects';
import {
  GAME_PAY_MARK,
  bookOneTime,
  paymentDueComment,
  paymentDueIdOf,
  withPaymentDue,
  withPaymentSettled,
} from './payments-due';
import { gameTradeStep, tradePurchase } from './trades';
import type { CashflowGameState } from './types';

const state = { paymentsDue: [] } as unknown as CashflowGameState;

describe('payments due', () => {
  it('a cost waits on the list, money that comes is booked at once', () => {
    const effects = emptyEffects(state, null);
    const paying = bookOneTime(
      state,
      effects,
      { en: 'Wedding', de: 'Hochzeit' },
      -30000,
      '2026-01-01',
      'en',
    );
    expect(effects.appendedTransactions).toHaveLength(0);
    expect(paying.paymentsDue).toEqual([
      {
        id: 'due-wedding',
        title: 'Wedding',
        costMinor: 30000,
        account: 'Daily',
        category: 'Wedding',
      },
    ]);
    const gift = emptyEffects(state, null);
    bookOneTime(state, gift, { en: 'Gift', de: 'Geschenk' }, 5000, '2026-01-01', 'en');
    expect(gift.appendedTransactions[0]).toMatchObject({ account: 'Income', amountMinor: 5000 });
  });

  it('the same card twice gets an id of its own, and the comment settles the right one', () => {
    let next = withPaymentDue(state, {
      title: 'Fee',
      costMinor: 100,
      account: 'Daily',
      category: 'Fee',
    });
    next = withPaymentDue(next, {
      title: 'Fee',
      costMinor: 200,
      account: 'Daily',
      category: 'Fee',
    });
    const [first, second] = next.paymentsDue!;
    expect(first.id).not.toBe(second.id);
    const comment = paymentDueComment(second);
    expect(GAME_PAY_MARK.test(comment)).toBe(true);
    expect(paymentDueIdOf(comment)).toBe(second.id);
    expect(withPaymentSettled(next, comment, '@Fee').paymentsDue).toEqual([first]);
  });

  it('the payment is a step of its own and counts as a purchase for the automatic loan', () => {
    const comment = '\n\n#gamepay #due:x';
    expect(gameTradeStep(comment, '@Wedding')).toEqual({ kind: 'cardPayment', detail: 'Wedding' });
    expect(tradePurchase(comment, 300)).toEqual({ title: '', costMinor: 300 });
  });
});
