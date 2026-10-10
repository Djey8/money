import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { applyEffectsToBooks, type GameBooks } from './books';
import { fixedClock } from './clock';
import type { BookSubscription } from './effects';
import { pickCashflowProfession } from './engine';
import { executeDeal, planDeal, type DealDeps, type DealInput } from './deals';
import { playBankLoan } from './loan';
import { sellPosition } from './positions';
import { legalActions } from './legal-actions';
import { whyDiceFirst } from './asset-deals';
import {
  FREE_RULES,
  RULE_PRESETS,
  normalizeRules,
  offerIsOpen,
  openOfferFor,
  rulesOf,
  whyCannotAddFreeAmount,
  whyCannotBorrow,
  whyCannotDraw,
  whyCannotNameSalePrice,
  whyCannotBuy,
  whyCannotBuyCard,
  whyCannotReportRoll,
  whyCannotSkipCard,
  whyCannotSell,
  whyCannotUseCard,
} from './rules';
import type { CashflowGameState, CashflowMarketOffer } from './types';

const TODAY = '2026-10-15';
const deps: DealDeps = {
  clock: fixedClock(TODAY, '2026-10-15T09:00:00.000Z'),
  text: (key, params) => (params ? `${key}${JSON.stringify(params)}` : key),
  money: (minor) => `${minor / 100}E`,
  plainMoney: (minor) => `${minor / 100}P`,
};
const placeholderSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'placeholder')!;

function books(
  rules?: Partial<typeof FREE_RULES>,
  mode: 'companion' | 'solo' = 'companion',
): GameBooks {
  const picked = pickCashflowProfession(
    CASHFLOW_GAME_SETS,
    'placeholder',
    placeholderSet.professions[0].id,
    TODAY,
    mode,
    rules ? normalizeRules(rules) : undefined,
  );
  const subscriptions: BookSubscription[] = picked.subscriptions.map((sub, index) => ({
    title: sub.title,
    account: sub.account,
    amountMinor: sub.amountMinor,
    startDate: `2026-09-${index === 0 ? '01' : '03'}`,
    endDate: '',
    category: sub.category ?? '',
    comment: '#cashflow',
    frequency: sub.frequency,
  }));
  return {
    state: picked.state,
    allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
    gameSet: placeholderSet,
    subscriptions,
    transactions: [
      {
        account: 'Daily',
        amountMinor: 5000000,
        date: '2026-10-02',
        time: '',
        category: '',
        comment: '',
      },
    ],
    liabilities: [],
    shares: [],
    investments: [],
    assets: [],
    growProjects: [],
  };
}

const shareInput = {
  kind: 'share',
  title: 'OK4U',
  subtitle: 'OK4U Inc.',
  quantity: 100,
  priceMinor: 1000,
} as DealInput;

/** A game holding 100 OK4U shares. */
function holdingShares(rules?: Partial<typeof FREE_RULES>): GameBooks {
  let b = books(rules);
  b = applyEffectsToBooks(b, planDeal(b, shareInput, deps));
  return executeDeal(b, 'OK4U', 100, deps).steps.reduce(applyEffectsToBooks, b);
}

const withOffer = (b: GameBooks, offer: Partial<CashflowMarketOffer>): GameBooks => ({
  ...b,
  state: {
    ...b.state,
    marketOffers: [{ title: 'OK4U', salePriceMinor: 150000, cardId: 'm1', label: '15E', ...offer }],
  },
});

describe('normalizeRules', () => {
  it('is free by default and knows the three presets', () => {
    expect(normalizeRules(undefined)).toEqual(FREE_RULES);
    expect(normalizeRules({ preset: 'guided' })).toEqual(RULE_PRESETS.guided);
    expect(normalizeRules({ preset: 'strict' })).toEqual(RULE_PRESETS.strict);
  });

  it('turns a preset with a changed setting into a custom set', () => {
    const rules = normalizeRules({ preset: 'strict', sellOfferRolls: 2 });
    expect(rules).toMatchObject({ preset: 'custom', sell: 'with-offer', sellOfferRolls: 2 });
    expect(normalizeRules({ cardChoice: 'offered-once' }).preset).toBe('custom');
  });

  it('refuses values that are not allowed', () => {
    expect(() => normalizeRules({ preset: 'nope' as never })).toThrow(/preset/);
    expect(() => normalizeRules({ sell: 'sometimes' as never })).toThrow(/sell/);
    expect(() => normalizeRules({ sellOfferRolls: -1 })).toThrow(/sellOfferRolls/);
    expect(() => normalizeRules({ sellOfferRolls: 99 })).toThrow(/sellOfferRolls/);
    expect(() => normalizeRules({ maxFreeAmountMinor: 1.5 })).toThrow(/maxFreeAmountMinor/);
    expect(() => normalizeRules({ maxLoanMinor: -5 })).toThrow(/maxLoanMinor/);
    expect(() => normalizeRules({ cardChoice: 'pick' as never })).toThrow(/cardChoice/);
  });

  it('a game without rules is free', () => {
    expect(rulesOf({})).toEqual(FREE_RULES);
  });
});

describe('free amounts and loans', () => {
  it('forbidden manual transactions refuse every free amount; a cap refuses a big one', () => {
    const strict = { rules: RULE_PRESETS.strict };
    expect(whyCannotAddFreeAmount(strict, 100)).toMatch(/do not allow free-form/);
    const capped = { rules: normalizeRules({ maxFreeAmountMinor: 5000 }) };
    expect(whyCannotAddFreeAmount(capped, -4000)).toBeNull();
    expect(whyCannotAddFreeAmount(capped, -1_000_000_000)).toMatch(/limit a free amount/);
    expect(whyCannotAddFreeAmount({}, 99_999_999_999)).toBeNull();
  });

  it('borrowing can be forbidden or capped, repaying never is', () => {
    const none = { rules: normalizeRules({ bankLoan: 'forbidden' }) };
    expect(whyCannotBorrow(none, 0, 100000)).toMatch(/do not allow a Bank loan/);
    expect(whyCannotBorrow(none, 100000, 50000)).toBeNull();
    const capped = { rules: normalizeRules({ maxLoanMinor: 200000 }) };
    expect(whyCannotBorrow(capped, 100000, 200000)).toBeNull();
    expect(whyCannotBorrow(capped, 100000, 300000)).toMatch(/cap the Bank loan/);
  });

  it('playBankLoan refuses a voluntary loan the rules forbid but takes one a payment forces', () => {
    const b = books({ bankLoan: 'forbidden' });
    expect(() => playBankLoan(b, 100000, deps)).toThrow(/Bank loan/);
    expect(() => playBankLoan(b, 100000, deps, { mandatory: true })).not.toThrow();
    expect(() => playBankLoan(books(), 100000, deps)).not.toThrow();
  });
});

describe('selling under the rules', () => {
  it('free: any time, at any price (as before)', () => {
    const sold = sellPosition(
      holdingShares(),
      { title: 'OK4U', quantity: 10, priceMinor: 5000 },
      deps,
    );
    expect(sold.kind).toBe('share');
  });

  it('never: nothing can be sold', () => {
    expect(() => sellPosition(holdingShares({ sell: 'never' }), { title: 'OK4U' }, deps)).toThrow(
      /do not allow selling/,
    );
  });

  it('with-offer: refused without an open offer, even at a named price', () => {
    const b = holdingShares({ sell: 'with-offer' });
    expect(whyCannotSell(b.state, 'OK4U')).toMatch(/No buyer/);
    expect(() => sellPosition(b, { title: 'OK4U', priceMinor: 1 }, deps)).toThrow(/No buyer/);
  });

  it('with-offer: sells at the price of the offer, and the caller cannot name another', () => {
    const b = withOffer(holdingShares({ sell: 'with-offer' }), { pricePerShareMinor: 1500 });
    expect(() => sellPosition(b, { title: 'OK4U', priceMinor: 99_999_999 }, deps)).toThrow(
      /fix the price/,
    );
    const sold = sellPosition(b, { title: 'OK4U', quantity: 10 }, deps);
    expect(sold.cashMinor).toBe(15000);
  });

  it('an offer stays open for the rolls the rules give it, then it is gone', () => {
    const rules = normalizeRules({ sell: 'with-offer', sellOfferRolls: 2 });
    const state = (count: number, offeredAtRoll: number | undefined): CashflowGameState =>
      ({
        ...books().state,
        rules,
        turn: { phase: 'roll', count },
        marketOffers: [{ title: 'OK4U', salePriceMinor: 1, cardId: 'm', label: '', offeredAtRoll }],
      }) as CashflowGameState;
    expect(openOfferFor(state(5, 5), 'OK4U')).toBeDefined(); // the roll it was played on
    expect(openOfferFor(state(6, 5), 'OK4U')).toBeDefined(); // one roll later
    expect(openOfferFor(state(7, 5), 'OK4U')).toBeUndefined(); // two rolls: closed
    expect(offerIsOpen(state(99, undefined), { offeredAtRoll: undefined })).toBe(true); // legacy offers stay
    expect(offerIsOpen({ ...state(99, 1), rules: RULE_PRESETS.free }, { offeredAtRoll: 1 })).toBe(
      true,
    ); // 0 = until Payday
  });

  it('naming a price is only refused when selling is not free', () => {
    expect(whyCannotNameSalePrice({})).toBeNull();
    expect(whyCannotNameSalePrice({ rules: RULE_PRESETS.guided })).toMatch(/fix the price/);
  });
});

describe('cards under the rules', () => {
  const soloState = (rules: Partial<typeof FREE_RULES>, offered?: boolean): CashflowGameState => ({
    ...books(rules, 'solo').state,
    turn: {
      phase: 'decide',
      count: 1,
      pending: {
        kind: 'deal',
        spaceIndex: 3,
        ...(offered ? { offered: { deck: 'dealSmall', cardId: 'ds-1' } } : {}),
      },
    },
  });

  it('free: any card, drawn any number of times', () => {
    const state = soloState({ cardChoice: 'free' });
    expect(whyCannotDraw(state)).toBeNull();
    expect(whyCannotUseCard(state, 'anything')).toBeNull();
  });

  it('offered-once: one draw per space, and only that card can be played', () => {
    const before = soloState({ cardChoice: 'offered-once' });
    expect(whyCannotDraw(before)).toBeNull();
    expect(whyCannotUseCard(before, 'ds-9')).toMatch(/draw it first/);
    const after = soloState({ cardChoice: 'offered-once' }, true);
    expect(whyCannotDraw(after)).toMatch(/already offered/);
    expect(whyCannotUseCard(after, 'ds-1')).toBeNull();
    expect(whyCannotUseCard(after, 'ds-2')).toMatch(/only allow the card that was offered/);
  });

  it('offered-once does not apply to a companion game (a physical deck) and needs a space to draw for', () => {
    expect(whyCannotUseCard(books({ cardChoice: 'offered-once' }).state, 'x')).toBeNull();
    const noSpace = {
      ...soloState({ cardChoice: 'offered-once' }),
      turn: { phase: 'roll', count: 1 },
    } as CashflowGameState;
    expect(whyCannotDraw(noSpace)).toMatch(/only deal a card for the space/);
  });
});

describe('passing a Doodad', () => {
  const onDoodad = (rules: Partial<typeof FREE_RULES>): CashflowGameState => ({
    ...books(rules, 'solo').state,
    turn: { phase: 'decide', count: 1, pending: { kind: 'doodad', spaceIndex: 4 } },
  });

  it('is allowed unless the rules forbid it, and only a Doodad is held', () => {
    expect(whyCannotSkipCard(onDoodad({}))).toBeNull();
    expect(whyCannotSkipCard(onDoodad({ passDoodads: 'forbidden' }))).toMatch(/pay it/);
    const onDeal: CashflowGameState = {
      ...onDoodad({ passDoodads: 'forbidden' }),
      turn: { phase: 'decide', count: 1, pending: { kind: 'deal', spaceIndex: 2 } },
    };
    expect(whyCannotSkipCard(onDeal)).toBeNull();
  });

  it('strict forbids it, guided and free allow it; an old game without the setting allows it', () => {
    expect(RULE_PRESETS.strict.passDoodads).toBe('forbidden');
    expect(RULE_PRESETS.guided.passDoodads).toBe('allowed');
    expect(
      rulesOf({ rules: { ...RULE_PRESETS.strict, passDoodads: undefined as never } }).passDoodads,
    ).toBe('allowed');
    expect(() => normalizeRules({ passDoodads: 'maybe' as never })).toThrow(/passDoodads/);
  });

  it('the pass action is not offered on a Doodad space that has to be paid', () => {
    const ids = (state: CashflowGameState) => legalActions(state).map((a) => a.action);
    expect(ids(onDoodad({ passDoodads: 'forbidden' }))).not.toContain('pass_card');
    expect(ids(onDoodad({ passDoodads: 'forbidden' }))).toContain('pay_doodad');
    expect(ids(onDoodad({}))).toContain('pass_card');
  });
});

describe('legal actions follow the rules', () => {
  const ids = (state: CashflowGameState) => legalActions(state).map((a) => a.action);

  it('no loan and no selling are not offered', () => {
    const state = books({ bankLoan: 'forbidden', sell: 'never' }).state;
    expect(ids(state)).not.toContain('bank_loan');
    expect(ids(state)).not.toContain('sell_position');
  });

  it('selling under with-offer is offered only while an offer is open', () => {
    const state = books({ sell: 'with-offer' }).state;
    expect(ids(state)).not.toContain('sell_position');
    expect(
      ids({ ...state, marketOffers: [{ title: 'X', salePriceMinor: 1, cardId: 'c', label: '' }] }),
    ).toContain('sell_position');
  });

  it('a free game offers everything as before', () => {
    expect(ids(books().state)).toEqual(expect.arrayContaining(['bank_loan', 'sell_position']));
  });
});

describe('buying under the rules', () => {
  const strictState = (extra: Partial<CashflowGameState> = {}): CashflowGameState =>
    ({
      ...books({ buy: 'with-card' }, 'solo').state,
      turn: {
        phase: 'decide',
        count: 3,
        pending: { kind: 'deal', spaceIndex: 2, offered: { deck: 'dealSmall', cardId: 'ds-1' } },
      },
      ...extra,
    }) as CashflowGameState;

  it('always: nothing is limited', () => {
    expect(whyCannotBuy(books().state, 'OK4U', undefined)).toBeNull();
    expect(whyCannotBuyCard(books().state, 'x')).toBeNull();
  });

  it('with-card: only the card in hand, while the space is open', () => {
    expect(whyCannotBuy(strictState(), 'OK4U', 'OK4U')).toBeNull();
    expect(whyCannotBuy(strictState(), 'EFH', 'OK4U')).toMatch(/only allow buying EFH/);
    const settled = { ...strictState(), turn: { phase: 'roll', count: 3 } } as CashflowGameState;
    expect(whyCannotBuy(settled, 'OK4U', 'OK4U')).toMatch(/only allow buying/); // the chance is over
  });

  it('with-card: a price card of the share is another chance, while its offer is open', () => {
    const state = strictState({
      turn: { phase: 'roll', count: 4 },
      marketOffers: [
        {
          title: 'OK4U',
          salePriceMinor: 1,
          cardId: 'm',
          label: '',
          pricePerShareMinor: 900,
          offeredAtRoll: 4,
        },
      ],
    });
    expect(whyCannotBuy(state, 'OK4U', undefined)).toBeNull();
    expect(whyCannotBuy(state, 'EFH', undefined)).toMatch(/only allow buying/);
  });

  it('with-card: the engine buys only the picked card', () => {
    expect(whyCannotBuyCard(strictState(), 'ds-1')).toBeNull();
    expect(whyCannotBuyCard(strictState(), 'ds-2')).toMatch(/card in hand/);
  });

  it('a property is not bought twice', () => {
    let b = books();
    const property = {
      kind: 'investment',
      title: 'EFH',
      subtitle: 'House',
      depositMinor: 300000,
      mortgageMinor: 4700000,
      cashflowMinor: 20000,
    } as DealInput;
    b = applyEffectsToBooks(b, planDeal(b, property, deps));
    const bought = executeDeal(b, 'EFH', undefined, deps).steps.reduce(applyEffectsToBooks, b);
    expect(() => executeDeal(bought, 'EFH', undefined, deps)).toThrow(/already own EFH/);
  });
});

describe('passing a played card, and reporting a roll', () => {
  it('a played card cannot be passed, only ticked off', () => {
    const state = {
      ...books().state,
      turn: { phase: 'decide', count: 1, pending: { kind: 'deal', spaceIndex: 2, played: true } },
    } as CashflowGameState;
    expect(whyCannotSkipCard(state, 'passed')).toMatch(/cannot be passed/);
    expect(whyCannotSkipCard(state, 'done')).toBeNull();
  });

  it('strict allows only the roll of the app', () => {
    expect(whyCannotReportRoll({ rules: RULE_PRESETS.strict })).toMatch(/roll of the app/);
    expect(whyCannotReportRoll({ rules: RULE_PRESETS.guided })).toBeNull();
    expect(whyCannotReportRoll({})).toBeNull();
  });
});

describe('the order of a turn', () => {
  it('under dice-first an open dice decision comes before any card', () => {
    const dice = [
      { title: 'MLM', coins: 1, costMinor: 1, stage: 'owned', recurring: true, rollDue: true },
    ] as never;
    const strict = {
      ...books({ diceFirst: 'first' }, 'solo').state,
      assetDeals: dice,
    } as CashflowGameState;
    expect(whyDiceFirst(strict)).toMatch(/Roll the dice of your open card first/);
    expect(whyDiceFirst({ ...strict, assetDeals: [] })).toBeNull();
    expect(whyDiceFirst({ ...strict, rules: RULE_PRESETS.free })).toBeNull();
  });
});
