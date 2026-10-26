import { CUSTOM_RULE_PRESETS } from '@money/domain';
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

  it('a payment of a Life card is a transaction', () => {
    landOn('life');
    service.drawLife(ok(), 'L08');
    const before = state().allTransactions.length;
    service.decideLife({ kind: 'fate' }, ok());
    expect(state().allTransactions.length).toBe(before + 1);
    expect(state().allTransactions[before]).toMatchObject({ amount: -400, account: 'Daily' });
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
