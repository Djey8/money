import { CUSTOM_RULE_PRESETS, paymentDueComment } from '@money/domain';
import { AppStateService } from './app-state.service';
import { CashflowGameService } from './cashflow-game.service';
import { IncomeStatementService } from './income-statement.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

/** The Life, Career and Dream tiles of a Dreamfund game, played through the service (JFK, 2026-10-26). */
describe('CashflowGameService: life, career and dreams', () => {
  let service: CashflowGameService;
  const ok = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
  const state = () => AppStateService.instance;

  const landOn = (tile: string, count = 1) => {
    state().cashflowGame = {
      ...state().cashflowGame,
      turn: {
        phase: 'decide',
        count,
        pending: {
          kind: 'story',
          tile: tile as 'life',
          storyCardId: `${tile}-filler`,
          spaceIndex: 3,
        },
      },
    };
  };

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    localStorage.clear();
    ProfileComponent.mail = 'player@cashflow.example';
    const s = state();
    s.daily = 60;
    s.splurge = 10;
    s.smile = 10;
    s.fire = 20;
    const persistence = {
      batchWriteAndSync: jest.fn((config) => config.onSuccess()),
      writeAndSync: jest.fn((config) => config.onSuccess()),
    };
    const incomeStatement = new IncomeStatementService({ saveData: jest.fn() } as any);
    const translate = { instant: jest.fn((key: string) => key), currentLang: 'en' };
    service = new CashflowGameService(persistence as any, incomeStatement, translate as any);
    service.pickProfession('jfk-stories', 'dual-student-informatik', ok(), 'solo');
    service.payday(ok());
  });

  const cashflow = () => service.monthlyCashflow;

  it('a character of the custom edition starts with a life, a career and no dreams', () => {
    const game = state().cashflowGame;
    expect(game.life).toMatchObject({ relationship: 'single', kids: 0, car: false });
    expect(game.career).toMatchObject({ stage: 'C1' });
    expect(game.dreams).toEqual({ open: [], lived: [], bonusPoints: 0 });
    expect(game.lineTitles?.['incomeTax']).toBeTruthy();
    expect(service.lifeCards).toHaveLength(27);
    expect(service.dreamCards).toHaveLength(48);
  });

  it('a Life card is drawn, decided, and its lines become subscriptions of the game', () => {
    landOn('life');
    const before = cashflow();
    const subscriptions = state().allSubscriptions.length;
    service.drawLife(ok(), 'L01');
    expect(service.lifeView!.card.id).toBe('L01');
    const callbacks = ok();
    service.decideLife({ kind: 'fate' }, callbacks);
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(state().cashflowGame.life!.relationship).toBe('partner');
    expect(state().allSubscriptions).toHaveLength(subscriptions + 1);
    expect(cashflow()).toBeCloseTo(before - 60, 2);
    expect(service.lifeView!.outcome).toBeTruthy();
    // decided once
    const again = ok();
    service.decideLife({ kind: 'fate' }, again);
    expect(again.onError).toHaveBeenCalled();
  });

  it('a random Life draw never gives a card that cannot happen', () => {
    for (let i = 0; i < 12; i += 1) {
      landOn('life');
      service.drawLife(ok());
      const card = service.lifeView!.card;
      expect(['L03', 'L04']).not.toContain(card.id);
    }
  });

  it('a payment of a Life card waits for the Add dialog: nothing is booked, the roll is blocked until it is paid', () => {
    landOn('life');
    service.drawLife(ok(), 'L08');
    const before = state().allTransactions.length;
    service.decideLife({ kind: 'fate' }, ok());
    expect(state().allTransactions.length).toBe(before);
    const [due] = service.paymentsDue;
    expect(due).toMatchObject({ costMinor: 40000, account: 'Daily' });
    // the card is dealt with: the next roll waits for the payment
    state().cashflowGame = {
      ...state().cashflowGame,
      turn: { phase: 'roll', count: 1 },
    };
    expect(service.cannotRollBecause).toBe(
      service.customRules?.mode === 'free' ? null : 'PAYMENT_DUE',
    );
    // the Add dialog books it with the tag; the due payment is settled and the step is in the History
    state().tier3BalanceLoaded = true;
    state().tier3GrowLoaded = true;
    service.beforeGrowTrade(paymentDueComment(due), 0, undefined, `@${due.category}`, 400);
    expect(service.paymentsDue).toHaveLength(0);
  });

  it('every move of a card is a step of the History, with the card to read again, and can be undone', () => {
    landOn('life');
    service.drawLife(ok(), 'L08');
    service.decideLife({ kind: 'fate' }, ok());
    const kinds = service.historySteps().map((step) => step.kind);
    expect(kinds.slice(0, 2)).toEqual(['lifeDecision', 'tileCard']);
    const drawn = service.historySteps()[1];
    expect(drawn).toMatchObject({ cardId: 'L08', deck: 'life' });
    // undoing the decision brings the card back undecided
    service.undoLastAction(ok());
    expect(service.lifeView!.outcome).toBeUndefined();
    expect(service.paymentsDue).toHaveLength(0);
  });

  it('what a player pays in a custom game is covered by a Bank loan first; it never goes below zero', () => {
    state().tier3BalanceLoaded = true;
    state().tier3GrowLoaded = true;
    const cash = service.cash;
    const trade = service.beforeGrowTrade('Something', 0, undefined, '@Food', cash + 500);
    expect(trade.borrowed).toBeGreaterThan(0);
  });

  it('money paid into a project of the game or the reserve is not a forbidden free amount', () => {
    state().cashflowGame = {
      ...state().cashflowGame,
      rules: { ...state().cashflowGame.rules!, manualTransactions: 'forbidden' },
    };
    state().allFireEmergencies = [{ title: 'Phone', buckets: [] } as any];
    expect(service.addDialogRefusal('Phone', '@Phone', -30000)).toBeNull();
    expect(service.addDialogRefusal('x', '@Mojo', -30000)).toBeNull();
    expect(service.addDialogRefusal('x', '@Pizza', -3000)).toMatch(/do not allow/);
  });

  it('under strict rules money only goes into a project or the Mojo, and a loan is worked out from what is really paid', () => {
    state().cashflowGame = {
      ...state().cashflowGame,
      customRules: { ...CUSTOM_RULE_PRESETS.strict },
    };
    state().allFireEmergencies = [
      { title: 'Phone', buckets: [{ id: 'a', title: 'A', target: 300, amount: 100 }] } as any,
    ];
    // a positive amount takes money out of the Mojo: refused
    expect(service.addDialogRefusal('x', '@Mojo', 999999, 9999.99)).toBe(
      'CashflowGame.pay.onlyPay',
    );
    expect(service.addDialogRefusal('x', '@Mojo', 30000, -300)).toBeNull();
    // 50,000 typed for a project that misses 200: only 200 is taken
    expect(service.paidIntoProject('@Phone', 'x', 50000)).toBe(200);
    state().mojo = { ...state().mojo, target: 1000, amount: 400 } as any;
    expect(service.paidIntoProject('@Mojo', 'x', 50000)).toBe(600);
    expect(service.paidIntoProject('@Pizza', 'x', 50)).toBe(50);
  });

  it('an Opportunity card: a pile is chosen, a free savings card is applied at once, a paid share card becomes a Grow project once it is paid', () => {
    state().tier3BalanceLoaded = true;
    state().tier3GrowLoaded = true;
    const offer = (ids: string[]) => {
      landOn('opportunity');
      state().cashflowGame = {
        ...state().cashflowGame,
        turn: {
          ...state().cashflowGame.turn!,
          pending: {
            ...state().cashflowGame.turn!.pending!,
            opportunity: { pile: 'seed', offers: ids },
          },
        },
      };
    };
    // a pile gives cards of its own
    landOn('opportunity');
    service.drawOpportunity('seed', ok());
    const first = service.opportunityView!;
    expect(first.pile).toBe('seed');
    expect(first.offers.length).toBeGreaterThanOrEqual(1);
    expect(first.offers.every((entry) => entry.card.pile === 'seed')).toBe(true);

    // a saving costs nothing: the project and the cut of the expense are there at once
    offer(['S02']);
    const utilities = state().allSubscriptions.find(
      (sub) => sub.title === state().cashflowGame.lineTitles?.['utilities'],
    )!;
    const before = utilities.amount;
    service.takeOpportunity('S02', {}, ok());
    expect(utilities.amount).toBeCloseTo(before + 7, 2);
    const saving = state().allGrowProjects.find((project) =>
      project.title.includes('Electricity'),
    )!;
    expect(saving).toMatchObject({ phase: 'execute', type: 'budget-optimization' });
    expect(saving.monthlySavings).toBe(7);
    expect(service.opportunityView!.projectTitle).toBe(saving.title);

    // a share is planned in Grow first: a project in plan with a note of cash and loan, nothing is bought yet
    offer(['S10']);
    service.takeOpportunity('S10', {}, ok());
    expect(service.paymentsDue).toHaveLength(0);
    const plan = state().allGrowProjects.find((project) => project.title === 'WORLD')!;
    expect(plan).toMatchObject({ phase: 'plan', status: 'planned' });
    // priced by the market of now (an index a little above 1.00 after the first Payday)
    expect(plan.share?.tag).toBe('WORLD');
    expect(plan.share?.price).toBeGreaterThanOrEqual(100);
    expect(plan.notes.some((note) => note.text.includes('🏦'))).toBe(true);
    expect(service.opportunityView).toMatchObject({ planned: true, projectTitle: 'WORLD' });
    expect(
      state().cashflowGame.holdings?.some((holding) => holding.title === 'WORLD') ?? false,
    ).toBe(false);
    // the player sets the units in Grow (there is no limit on the card) and buys: the Add dialog books the share, the card does the rest
    service.beforeGrowTrade('Buy Share WORLD 40 x 100;', 0, undefined, '@WORLD', 4000);
    const holding = state().cashflowGame.holdings!.find((entry) => entry.title === 'WORLD')!;
    expect(holding.units).toBe(40);
    // 40 units x 1.35 a month (the dividends are tuned up for the balance)
    expect(
      state().allSubscriptions.find((sub) => sub.title === 'WORLD Cashflow')?.amount,
    ).toBeCloseTo(54, 2);
    // a sale booked in Grow brings the holding down
    service.beforeGrowTrade('Sell Share WORLD 15 x 100;', 0, undefined, '@WORLD', 0);
    expect(state().cashflowGame.holdings!.find((entry) => entry.title === 'WORLD')!.units).toBe(25);

    // the turn is settled: the chance to buy more is over (1 turn by default), the project goes on as what it is
    expect(CashflowGameService.buyRefusalFor('WORLD')).toBeNull();
    service.settleSoloDecision('done', ok());
    expect(state().cashflowGame.opportunityPlans ?? []).toEqual([]);
    expect(CashflowGameService.buyRefusalFor('WORLD')).not.toBeNull();
    expect(
      state()
        .allGrowProjects.find((project) => project.title === 'WORLD')
        ?.notes.at(-1)?.text,
    ).toContain('Chance missed');
  });

  it('a Harvest card moves the market, prices what the player owns, and sells in its window; the Payday drifts the indices', () => {
    state().tier3BalanceLoaded = true;
    state().tier3GrowLoaded = true;
    // own 4 units of the world ETF
    landOn('opportunity');
    state().cashflowGame = {
      ...state().cashflowGame,
      turn: {
        ...state().cashflowGame.turn!,
        pending: {
          ...state().cashflowGame.turn!.pending!,
          opportunity: { pile: 'seed', offers: ['S10'] },
        },
      },
    };
    service.takeOpportunity('S10', {}, ok());
    service.beforeGrowTrade('Buy Share WORLD 4 x 100;', 0, undefined, '@WORLD', 400);
    expect(state().cashflowGame.holdings![0].units).toBe(4);

    // the market card: a bull market (+7% for the world) with a window to sell
    landOn('harvest');
    service.rng = (() => {
      // draw H05 (the first copy of the cards that is a bull market) whatever the order of the pile
      return 0;
    }) as typeof service.rng;
    service.drawHarvest(ok());
    const view = service.harvestView!;
    expect(view.card).toBeTruthy();
    expect(state().cashflowGame.markets).toBeTruthy();
    // whatever the card was, the share is priced by the index of its market
    const index = state().cashflowGame.markets!['WORLD'];
    expect(state().allShares.find((share) => share.tag === 'WORLD')?.price).toBeCloseTo(
      100 * index,
      1,
    );
    // a sale in a window (when this card opened one) pays the player and ends the unit count
    if (view.window.some((w) => w.holding === 'WORLD')) {
      const cash = service.cash;
      service.sellInWindow('WORLD', 2, ok());
      expect(service.cash).toBeGreaterThan(cash);
      expect(state().cashflowGame.holdings![0].units).toBe(2);
    }
    // a Payday moves the indices again
    const before = state().cashflowGame.markets!['WORLD'];
    service.payday(ok());
    expect(state().cashflowGame.markets!['WORLD']).not.toBe(before);
  });

  it('the interest of the Bank loan is a setting of the game', () => {
    state().cashflowGame = {
      ...state().cashflowGame,
      customRules: { ...CUSTOM_RULE_PRESETS.guided, bankInterestPercent: 12 },
    };
    expect((service as any).currentGameSet().loanRule.monthlyInterestPercent).toBe(12);
  });

  it('the Career tile: too early nothing, then a roll; a promotion changes the salary and shows the comparison', () => {
    landOn('career');
    service.rollCareerTile(ok());
    expect(service.careerView!.result.kind).toBe('waiting');
    // three Paydays in the stage and a roll that promotes
    state().cashflowGame = { ...state().cashflowGame, career: { stage: 'C1', paydaysInStage: 3 } };
    landOn('career', 2);
    service.rng = () => 0.99;
    const before = cashflow();
    service.rollCareerTile(ok());
    const view = service.careerView!;
    expect(view.result.kind).toBe('promoted');
    expect(view.reached!.id).toBe('C2');
    expect(view.before!.salaryMinor).toBeLessThan(view.after!.salaryMinor);
    expect(cashflow()).toBeGreaterThan(before);
    expect(state().cashflowGame.career).toMatchObject({ stage: 'C2', paydaysInStage: 0 });
    expect(state().cashflowGame.livingStandard).toBe(1.1);
    expect(service.careerStatus!.stageNumber).toBe(2);
  });

  it('a Dream landing offers dreams; taking one makes a Smile project with its buckets and the dream is open', () => {
    landOn('dream');
    service.drawDream(ok(), { cardId: 'D16' });
    expect(service.dreamView!.offers.map((o) => o.id)).toEqual(['D16']);
    const callbacks = ok();
    service.takeDream('D16', callbacks);
    expect(callbacks.onError).not.toHaveBeenCalled();
    const project = state().allSmileProjects.find((p) => p.dreamCardId === 'D16')!;
    expect(project.buckets.length).toBeGreaterThan(1);
    expect(project.buckets.reduce((sum, b) => sum + b.target, 0)).toBe(4000);
    expect(project.actionItems.length).toBeGreaterThan(0);
    expect(service.dreamLog.open).toHaveLength(1);
    expect(service.dreamView!.taken).toBe(project.title);
  });

  it('only as many dreams can be open as the setting allows', () => {
    state().cashflowGame = {
      ...state().cashflowGame,
      customRules: { ...CUSTOM_RULE_PRESETS.free, maxOpenDreams: 1 },
    };
    landOn('dream');
    service.drawDream(ok(), { cardId: 'D16' });
    service.takeDream('D16', ok());
    landOn('dream', 2);
    service.drawDream(ok(), { cardId: 'D17' });
    const callbacks = ok();
    service.takeDream('D17', callbacks);
    expect(callbacks.onError).toHaveBeenCalled();
  });

  it('a dream whose buckets are full is lived: points, running costs, a car', () => {
    landOn('dream');
    service.drawDream(ok(), { cardId: 'D29' });
    service.takeDream('D29', ok());
    const project = state().allSmileProjects.find((p) => p.dreamCardId === 'D29')!;
    // not yet
    const early = ok();
    service.liveDream(project.title, early);
    expect(early.onError).toHaveBeenCalled();
    for (const bucket of project.buckets) bucket.amount = bucket.target;
    const before = cashflow();
    const callbacks = ok();
    service.liveDream(project.title, callbacks);
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(project.phase).toBe('completed');
    expect(state().cashflowGame.life!.car).toBe(true);
    expect(state().cashflowGame.possessions).toContain('car');
    expect(service.dreamLog.lived).toHaveLength(1);
    expect(service.dreamPoints.lived).toBe(7);
    // the running costs of a motorbike
    expect(cashflow()).toBeCloseTo(before - 60, 2);
    expect(service.dreamLog.open).toHaveLength(0);
  });

  it('a dream moment: an early-bird discount lowers what is still missing', () => {
    landOn('dream');
    service.drawDream(ok(), { cardId: 'D18' });
    service.takeDream('D18', ok());
    const project = state().allSmileProjects.find((p) => p.dreamCardId === 'D18')!;
    project.buckets[0].amount = project.buckets[0].target;
    const total = project.buckets.reduce((sum, b) => sum + b.target, 0);
    state().cashflowGame = {
      ...state().cashflowGame,
      turn: {
        phase: 'decide',
        count: 3,
        pending: {
          kind: 'story',
          tile: 'dream',
          storyCardId: 'dream-filler',
          spaceIndex: 3,
          dream: { moment: 'M01' },
        },
      },
    };
    service.applyDreamMoment('M01', { projectTitle: project.title }, ok());
    const after = project.buckets.reduce((sum, b) => sum + b.target, 0);
    expect(after).toBeLessThan(total);
    expect(service.dreamView!.applied).toBeTruthy();
  });

  it('the payday of a game brings a baby that was scheduled', () => {
    landOn('life');
    service.drawLife(ok(), 'L01');
    service.decideLife({ kind: 'fate' }, ok());
    landOn('life', 2);
    service.drawLife(ok(), 'L05');
    // a roll of 1 or 2 brings the baby
    service.rng = () => 0;
    service.decideLife({ kind: 'roll' }, ok());
    expect(state().cashflowGame.lifeScheduled).toHaveLength(1);
    for (let i = 0; i < 3; i += 1) service.payday(ok());
    expect(state().cashflowGame.life!.kids).toBe(1);
    expect(service.consumeLifeNews().some((news) => news.kind === 'arrived')).toBe(true);
  });

  it('the emergency reserve is three months of the expenses of now, and what is paid from the Mojo takes the character away from it', () => {
    const status = () => service.reserveStatus!;
    expect(status().target).toBe(6999);
    expect(status().held).toBe(0);
    expect(status().ok).toBe(false);
    // a life line makes the expenses grow: the target follows at the next save
    landOn('life');
    service.drawLife(ok(), 'L12');
    service.decideLife({ kind: 'fate' }, ok());
    expect(status().target).toBe(Math.round((2333 + 60) * 3 * 100) / 100);
    const project = state().allFireEmergencies.find((fire) => fire.reserve)!;
    expect(project.buckets.every((b) => b.target === 2393)).toBe(true);
    expect(state().mojo.target).toBe(7179);
    // the Mojo account holds money: it counts; paying from it takes it away again
    const mojo = (amount: number) =>
      state().allTransactions.push({
        account: 'Fire',
        amount,
        date: '2026-12-01',
        time: '',
        category: '@Mojo',
        comment: '',
      });
    mojo(-7179);
    service.drawLife(ok(), 'L12');
    landOn('life', 3);
    service.drawLife(ok(), 'L08');
    service.decideLife({ kind: 'fate' }, ok());
    expect(status().held).toBeGreaterThanOrEqual(7179);
    // paying something from the Mojo (the Add dialog takes it out of the fund)
    state().mojo.amount = Number(state().mojo.amount) - 500;
    expect(status().held).toBeLessThan(status().target);
    expect(status().ok).toBe(false);
  });

  it('under strict rules an emergency has to be paid or planned before the game goes on, and own projects are locked', () => {
    state().cashflowGame = {
      ...state().cashflowGame,
      customRules: { ...CUSTOM_RULE_PRESETS.strict },
    };
    expect(CashflowGameService.ownProjectsAllowed()).toBe(false);
    expect(service.lifeCanDecline).toBe(false);
    expect(service.cardChoiceFree).toBe(false);
    expect(service.cannotRollBecause).toBeNull();
    // a card that allows a plan (a cracked screen)
    landOn('emergency');
    service.drawEmergency(ok(), 'E09');
    service.chooseEmergencyOption('A', ok());
    service.createEmergencyProject(ok());
    const onRoll = () => {
      state().cashflowGame = { ...state().cashflowGame, turn: { phase: 'roll', count: 9 } };
    };
    onRoll();
    expect(service.unsettledEmergencies).toHaveLength(1);
    expect(service.cannotRollBecause).toBe('EMERGENCY_UNSETTLED');
    // a plan is enough where the card allows it
    const project = state().allFireEmergencies.find((fire) => fire.emergencyCardId === 'E09')!;
    project.plannedSubscriptions = [{ status: 'active' } as never];
    expect(service.unsettledEmergencies).toHaveLength(0);
    expect(service.cannotRollBecause).toBeNull();
    // a fine cannot be planned: it has to be paid
    landOn('emergency', 10);
    service.drawEmergency(ok(), 'E05');
    service.createEmergencyProject(ok());
    onRoll();
    const fine = state().allFireEmergencies.find((fire) => fire.emergencyCardId === 'E05')!;
    expect(fine.emergencyPayNow).toBe(true);
    fine.plannedSubscriptions = [{ status: 'active' } as never];
    expect(service.unsettledEmergencies.map((e) => e.payNow)).toEqual([true]);
    for (const bucket of fine.buckets) bucket.amount = bucket.target;
    expect(service.unsettledEmergencies).toHaveLength(0);
  });

  it('under guided rules only what cannot wait blocks the game; under free rules nothing does', () => {
    state().cashflowGame = {
      ...state().cashflowGame,
      customRules: { ...CUSTOM_RULE_PRESETS.guided },
    };
    landOn('emergency');
    service.drawEmergency(ok(), 'E09');
    service.chooseEmergencyOption('A', ok());
    service.createEmergencyProject(ok());
    // a cracked screen can be planned or left, it is not a fine: guided rules do not wait for it
    expect(service.unsettledEmergencies).toHaveLength(0);
    // a fine does wait
    landOn('emergency', 2);
    service.drawEmergency(ok(), 'E05');
    service.createEmergencyProject(ok());
    expect(service.unsettledEmergencies.map((e) => e.payNow)).toEqual([true]);
    state().cashflowGame = {
      ...state().cashflowGame,
      customRules: { ...CUSTOM_RULE_PRESETS.free },
      turn: { phase: 'roll', count: 9 },
    };
    expect(service.cannotRollBecause).toBeNull();
  });

  it('the insurances chosen for the start are the ones held; the others cost nothing', () => {
    (AppStateService as any)._instance = undefined;
    const fresh = state();
    fresh.daily = 60;
    fresh.splurge = 10;
    fresh.smile = 10;
    fresh.fire = 20;
    service.pickProfession(
      'jfk-stories',
      'dual-student-informatik',
      ok(),
      'solo',
      undefined,
      undefined,
      undefined,
      ['liability'],
    );
    expect(state().cashflowGame.insurance!.active).toEqual(['liability']);
    // its premium is not part of the month
    expect(service.monthlyCashflow).toBeCloseTo(500 + 15.61, 2);
  });

  it('the emergency reserve is the Mojo: what is booked into @Mojo fills it, and its project follows', () => {
    const project = () => state().allFireEmergencies.find((fire) => fire.reserve)!;
    expect(project().buckets.every((b) => b.amount === 0)).toBe(true);
    // 3,000 into the Mojo fills the first month and most of the second
    state().allTransactions.push({
      account: 'Daily',
      amount: -3000,
      date: '2026-12-01',
      time: '',
      category: '@Mojo',
      comment: '',
    });
    landOn('life');
    service.drawLife(ok(), 'L08');
    service.decideLife({ kind: 'fate' }, ok());
    expect(state().mojo.amount).toBe(3000);
    expect(project().buckets.map((b) => b.amount)).toEqual([2333, 667, 0]);
    expect(service.reserveStatus!.held).toBe(3000);
  });
});
