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
    expect(view.projectTitle).toBeUndefined();
  });

  it('the card becomes a Fire project with its details and nothing paid yet', () => {
    draw('E02');
    const state = AppStateService.instance;
    const before = state.allTransactions.length;
    const callbacks = ok();
    service.createEmergencyProject(callbacks);
    expect(callbacks.onError).not.toHaveBeenCalled();
    const project = state.allFireEmergencies.find((fire) => fire.emergencyCardId === 'E02')!;
    expect(project.buckets).toHaveLength(1);
    expect(project.buckets[0]).toMatchObject({ target: 25, amount: 0 });
    expect(project.actionItems.length).toBeGreaterThan(0);
    expect(project.description).toBeTruthy();
    // paying is the Fire page's work: no transaction, no plan yet
    expect(state.allTransactions).toHaveLength(before);
    expect(project.plannedSubscriptions ?? []).toHaveLength(0);
    expect(service.emergencyView!.projectTitle).toBe(project.title);
    // the project is made once
    const again = ok();
    service.createEmergencyProject(again);
    expect(again.onError).toHaveBeenCalled();
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

  it('a choice card waits for the choice, and the choice is the project', () => {
    draw('E09');
    expect(service.emergencyView!.quote.needsChoice).toBe(true);
    service.chooseEmergencyOption('B', ok());
    expect(service.emergencyView!.quote.payMinor).toBe(30000);
    service.createEmergencyProject(ok());
    const project = AppStateService.instance.allFireEmergencies.find(
      (fire) => fire.emergencyCardId === 'E09',
    )!;
    expect(project.buckets[0].target).toBe(300);
  });

  it('a card with a monthly cost afterwards adds it to the game', () => {
    draw('E20');
    service.rollEmergencyDie('main', ok());
    const state = AppStateService.instance;
    const subscriptions = state.allSubscriptions.length;
    service.createEmergencyProject(ok());
    expect(state.allSubscriptions).toHaveLength(subscriptions + 1);
    expect(state.allSubscriptions[subscriptions]).toMatchObject({ account: 'Daily', amount: -25 });
    expect(state.cashflowGame.gameSubscriptionTitles).toContain(
      state.allSubscriptions[subscriptions].title,
    );
  });

  it('a character with a higher price level pays more for the same card, but not for fees fixed by law', () => {
    const state = AppStateService.instance;
    const profession = service.gameSets
      .find((set) => set.id === 'jfk-stories')!
      .professions.find((candidate) => candidate.id === 'dual-student-informatik')!;
    (profession as { priceFactor?: number }).priceFactor = 2;
    try {
      draw('E02');
      expect(service.emergencyView!.quote.payMinor).toBe(5000);
      state.cashflowGame = {
        ...state.cashflowGame,
        turn: {
          ...state.cashflowGame.turn!,
          pending: { ...state.cashflowGame.turn!.pending!, emergency: undefined },
        },
      };
      draw('E05');
      expect(service.emergencyView!.quote.payMinor).toBe(3500);
    } finally {
      delete (profession as { priceFactor?: number }).priceFactor;
    }
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
