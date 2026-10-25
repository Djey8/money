import { AppStateService } from './app-state.service';
import { CashflowGameService } from './cashflow-game.service';
import { IncomeStatementService } from './income-statement.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

/** The Emergency tile of a Dreamfund game: the card is drawn, rolled, paid now or on a plan, insured or not (JFK, 2026-10-25). */
describe('CashflowGameService: emergencies and insurance', () => {
  let service: CashflowGameService;
  const ok = () => ({ onSuccess: jest.fn(), onError: jest.fn() });

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    localStorage.clear();
    ProfileComponent.mail = 'player@cashflow.example';
    const state = AppStateService.instance;
    state.daily = 60;
    state.splurge = 10;
    state.smile = 10;
    state.fire = 20;
    const persistence = {
      batchWriteAndSync: jest.fn((config) => config.onSuccess()),
      writeAndSync: jest.fn((config) => config.onSuccess()),
    };
    const incomeStatement = new IncomeStatementService({ saveData: jest.fn() } as any);
    const translate = { instant: jest.fn((key: string) => key), currentLang: 'en' };
    service = new CashflowGameService(persistence as any, incomeStatement, translate as any);
    service.pickProfession('jfk-stories', 'dual-student-informatik', ok(), 'solo');
    // the first Payday and some cash to deal with an emergency
    service.payday(ok());
    // the token stands on an Emergency tile
    state.cashflowGame = {
      ...state.cashflowGame,
      turn: {
        phase: 'decide',
        count: 1,
        pending: {
          kind: 'story',
          tile: 'emergency',
          storyCardId: 'emergency-filler',
          spaceIndex: 3,
        },
      },
    };
  });

  const draw = (id: string) => {
    const callbacks = ok();
    service.drawEmergency(callbacks, id);
    expect(callbacks.onError).not.toHaveBeenCalled();
  };

  it('has the stack of the custom edition, and the insurances the profession pays', () => {
    expect(service.emergencyCards).toHaveLength(45);
    const state = AppStateService.instance;
    expect(state.cashflowGame.insurance?.active).toEqual(['liability', 'household']);
    // the premium lines are real subscriptions, paid from the Fire account
    const premium = state.allSubscriptions.find(
      (sub) => sub.title === state.cashflowGame.insurance!.premiums['household'],
    );
    expect(premium).toMatchObject({ account: 'Fire', amount: -15.61 });
  });

  it('a drawn card is kept with the turn and shows what it costs', () => {
    draw('E02');
    const view = service.emergencyView!;
    expect(view.card.id).toBe('E02');
    expect(view.quote.payMinor).toBe(2500);
    expect(view.canPayNow).toBe(true);
  });

  it('paying now: a Fire project of the card with its bucket full, paid from the Fire account', () => {
    draw('E02');
    const before = service.cash;
    const callbacks = ok();
    service.payEmergency({}, callbacks);
    expect(callbacks.onError).not.toHaveBeenCalled();
    const state = AppStateService.instance;
    const project = state.allFireEmergencies.find((fire) => fire.emergencyCardId === 'E02')!;
    expect(project.buckets).toHaveLength(1);
    expect(project.buckets[0].target).toBe(25);
    expect(project.actionItems.length).toBeGreaterThan(0);
    const payment = state.allTransactions.find((tx) => tx.category === `@${project.title}`)!;
    expect(payment).toMatchObject({ account: 'Fire', amount: -25 });
    expect(payment.comment).toContain('#dreamfund');
    expect(service.cash).toBeCloseTo(before - 25, 2);
    expect(service.emergencyView!.projectTitle).toBe(project.title);
  });

  it('a card with a roll waits for the die, and keeps the roll', () => {
    draw('E03');
    expect(service.emergencyView!.quote.ready).toBe(false);
    const roll = service.rollEmergencyDie('main', ok());
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(service.emergencyView!.quote.ready).toBe(true);
    // a die once rolled stays rolled
    expect(service.rollEmergencyDie('main', ok())).toBeNull();
  });

  it('a choice card waits for the choice', () => {
    draw('E09');
    expect(service.emergencyView!.quote.needsChoice).toBe(true);
    service.chooseEmergencyOption('A', ok());
    expect(service.emergencyView!.quote.payMinor).toBe(15000);
  });

  it('a plan: one payment at every Payday with a surcharge bucket, registered with the game', () => {
    draw('E09');
    service.chooseEmergencyOption('B', ok());
    const callbacks = ok();
    service.payEmergency({ months: 6 }, callbacks);
    expect(callbacks.onError).not.toHaveBeenCalled();
    const state = AppStateService.instance;
    const project = state.allFireEmergencies.find((fire) => fire.emergencyCardId === 'E09')!;
    // 300 + 20% = 360 in 6 parts of 60
    expect(project.buckets.reduce((sum, bucket) => sum + bucket.target, 0)).toBeCloseTo(360, 2);
    expect(project.plannedSubscriptions?.[0]).toMatchObject({ status: 'active', amount: 60 });
    const plan = state.allSubscriptions.find((sub) => sub.category === `@${project.title}`)!;
    expect(plan).toMatchObject({ account: 'Fire', amount: -60, frequency: 'monthly' });
    expect(state.cashflowGame.fundingSubscriptionTitles).toContain(plan.title);
    // a plan is not a monthly expense of the game
    expect(state.cashflowGame.gameSubscriptionTitles).not.toContain(plan.title);
  });

  it('a card that cannot be paid at once goes on the shortest plan, as the loan will later', () => {
    const state = AppStateService.instance;
    state.allTransactions = state.allTransactions.filter((tx) => tx.account !== 'Income');
    draw('E26');
    // the burglary costs the uninsured player thousands of a few hundreds of cash
    state.cashflowGame = {
      ...state.cashflowGame,
      insurance: { ...state.cashflowGame.insurance!, active: [] },
    };
    const view = service.emergencyView!;
    expect(view.quote.payMinor).toBeGreaterThan(100000);
    expect(view.forcedPlan).toBe(true);
    // asked to pay at once, it takes the shortest plan: 3 Paydays and 10% on top
    const callbacks = ok();
    service.payEmergency({}, callbacks);
    expect(callbacks.onError).not.toHaveBeenCalled();
    const project = state.allFireEmergencies.find((fire) => fire.emergencyCardId === 'E26')!;
    expect(project.plannedSubscriptions?.[0].endDate).not.toBe(
      project.plannedSubscriptions?.[0].startDate,
    );
    const total = project.buckets.reduce((sum, bucket) => sum + bucket.target, 0);
    expect(total).toBeCloseTo((view.quote.payMinor / 100) * 1.1, 1);
    expect(state.allFireEmergencies.some((fire) => fire.emergencyCardId === 'E26')).toBe(true);
  });

  it('insurance: the burglary costs the insured player 500, the uninsured all of it', () => {
    draw('E26');
    expect(service.emergencyView!.quote.payMinor).toBe(50000);
    expect(service.emergencyView!.quote.insured).toBe(true);
  });

  it('hop out and hop in wait for the next Payday: the premium stops and the cover with it', () => {
    const state = AppStateService.instance;
    const household = state.cashflowGame.insurance!.premiums['household'];
    service.setInsurance('household', false, ok());
    // still covered, still paying until the Payday
    expect(service.insurances.find((i) => i.kind === 'household')).toMatchObject({
      held: true,
      heldNext: false,
    });
    const paydayBefore = state.allTransactions.length;
    service.payday(ok());
    const posted = state.allTransactions.slice(paydayBefore);
    expect(posted.some((tx) => tx.category === `@${household}`)).toBe(false);
    expect(state.cashflowGame.insurance!.active).toEqual(['liability']);
    // an uncovered burglary now costs it all
    state.cashflowGame = {
      ...state.cashflowGame,
      turn: {
        phase: 'decide',
        count: 2,
        pending: {
          kind: 'story',
          tile: 'emergency',
          storyCardId: 'emergency-filler',
          spaceIndex: 3,
        },
      },
    };
    draw('E26');
    expect(service.emergencyView!.quote.insured).toBe(false);
    // hop back in: it starts with the next Payday
    service.setInsurance('household', true, ok());
    service.payday(ok());
    expect(state.cashflowGame.insurance!.active).toContain('household');
  });
});
