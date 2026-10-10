import { RULE_PRESETS, initialCashflowGameState, type GameRules } from '@money/domain';
import { CashflowGameService } from './cashflow-game.service';
import { AppStateService } from './app-state.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

function startGame(rules?: GameRules, marketOffers: unknown[] = []) {
  AppStateService.instance.cashflowGame = {
    ...initialCashflowGameState(),
    professionId: 'p',
    gameSetId: 'cashflow',
    mode: 'solo',
    turn: { phase: 'roll', count: 4 },
    ...(rules ? { rules } : {}),
    marketOffers: marketOffers as never,
  };
}

describe('the game rules in the app', () => {
  let service: CashflowGameService;

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    ProfileComponent.mail = 'player@cashflow.example';
    service = Object.create(CashflowGameService.prototype);
  });

  afterEach(() => {
    ProfileComponent.mail = '';
  });

  it('a game without rules never refuses a sale or a free amount', () => {
    startGame();
    expect(CashflowGameService.sellRefusalFor('OK4U')).toBeNull();
    expect(service.addDialogRefusal('', '@Gift', 1_000_000_000)).toBeNull();
  });

  it('a normal account is never limited', () => {
    ProfileComponent.mail = 'jfk@example.com';
    startGame(RULE_PRESETS.strict);
    expect(CashflowGameService.sellRefusalFor('OK4U')).toBeNull();
  });

  it('selling needs an open offer where the rules ask for one', () => {
    startGame(RULE_PRESETS.guided);
    expect(CashflowGameService.sellRefusalFor('OK4U')).toMatch(/No buyer for OK4U/);
    startGame(RULE_PRESETS.guided, [
      { title: 'OK4U', salePriceMinor: 1, cardId: 'm', label: '', offeredAtRoll: 4 },
    ]);
    expect(CashflowGameService.sellRefusalFor('OK4U')).toBeNull();
    // the offer was played at roll 4 and stays for 3 rolls: gone at roll 7
    AppStateService.instance.cashflowGame.turn = { phase: 'roll', count: 7 };
    expect(CashflowGameService.sellRefusalFor('OK4U')).toMatch(/No buyer/);
  });

  it('a plain transaction in the Add dialog is a free amount: forbidden, or capped', () => {
    startGame(RULE_PRESETS.strict);
    expect(service.addDialogRefusal('', '@Gift', 100)).toMatch(/do not allow free-form/);
    startGame({ ...RULE_PRESETS.guided, maxFreeAmountMinor: 5000 });
    expect(service.addDialogRefusal('', '@Gift', 4000)).toBeNull();
    expect(service.addDialogRefusal('', '@Gift', 1_000_000)).toMatch(/limit a free amount/);
  });

  it('a trade the game knows is judged as that trade, not as a free amount', () => {
    startGame(RULE_PRESETS.strict);
    AppStateService.instance.cashflowGame.turn = {
      phase: 'decide',
      count: 4,
      pending: {
        kind: 'deal',
        spaceIndex: 2,
        offered: { deck: 'dealSmall', cardId: 'ds-1', title: 'OK4U' },
      },
    };
    expect(service.addDialogRefusal('Buy Share OK4U 100 x 10;', '@OK4U', 100000)).toBeNull();
    expect(service.addDialogRefusal('Buy Share EFH 1 x 10;', '@EFH', 100000)).toMatch(
      /only allow buying EFH/,
    );
    expect(service.addDialogRefusal('Sell Share OK4U 100 x 10;', '@OK4U', 100000)).toMatch(
      /No buyer for OK4U/,
    );
    expect(service.addDialogRefusal('x\n#doodad', '@Phone', 20000)).toBeNull();
  });

  it('a Doodad under strict cannot be passed or ticked off; paying it settles the space', () => {
    startGame(RULE_PRESETS.strict);
    AppStateService.instance.cashflowGame.turn = {
      phase: 'decide',
      count: 4,
      pending: { kind: 'doodad', spaceIndex: 4 },
    };
    const onError = jest.fn();
    (service as any).settleSoloDecision('passed', { onSuccess: jest.fn(), onError });
    (service as any).settleSoloDecision('done', { onSuccess: jest.fn(), onError });
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0][0]).toMatch(/do not allow passing a Doodad/);
    expect(AppStateService.instance.cashflowGame.turn?.phase).toBe('decide');

    (service as any).gameBooks = () => ({ subscriptions: [] });
    (service as any).settleDoodadByPayment('doodad');
    expect(AppStateService.instance.cashflowGame.turn?.phase).toBe('roll');
  });

  it('a Doodad may be passed where the rules allow it', () => {
    startGame(RULE_PRESETS.guided);
    AppStateService.instance.cashflowGame.turn = {
      phase: 'decide',
      count: 4,
      pending: { kind: 'doodad', spaceIndex: 4 },
    };
    (service as any).settleDoodadByPayment('doodad');
    expect(AppStateService.instance.cashflowGame.turn?.phase).toBe('decide'); // not auto-settled
  });

  it('a property that is owned is not bought a second time, whatever the rules', () => {
    startGame();
    AppStateService.instance.allInvestments = [{ tag: 'EFH', amount: 1, deposit: 1 }] as never;
    expect(CashflowGameService.buyRefusalFor('EFH', true)).toMatch(/already own/);
    expect(CashflowGameService.buyRefusalFor('EFH-II', true)).toBeNull();
    expect(service.addDialogRefusal('Buy Investment EFH 1 1;', '@EFH', 100)).toMatch(/already own/);
  });

  it('a card that was played cannot be passed, only ticked off', () => {
    startGame();
    AppStateService.instance.cashflowGame.turn = {
      phase: 'decide',
      count: 4,
      pending: { kind: 'deal', spaceIndex: 2, played: true },
    };
    const onError = jest.fn();
    (service as any).gameBooks = () => ({ subscriptions: [] });
    (service as any).persistAll = jest.fn();
    (service as any).settleSoloDecision('passed', { onSuccess: jest.fn(), onError });
    expect(onError.mock.calls[0][0]).toMatch(/cannot be passed/);
    (service as any).settleSoloDecision('done', { onSuccess: jest.fn(), onError });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('a claimed roll is refused where only the roll of the app counts', () => {
    startGame(RULE_PRESETS.strict);
    const onError = jest.fn();
    (service as any).resolveGamble('MLM', { won: true }, { onSuccess: jest.fn(), onError });
    expect(onError.mock.calls[0][0]).toMatch(/roll of the app/);
  });

  it('under dice-first no card can be played while a dice decision is open', () => {
    startGame(RULE_PRESETS.strict);
    AppStateService.instance.cashflowGame.assetDeals = [
      { title: 'MLM', coins: 1, costMinor: 1, stage: 'owned', recurring: true, rollDue: true },
    ] as never;
    expect(service.cardRefusal('any')).toMatch(/Roll the dice of your open card first/);
    startGame(RULE_PRESETS.free);
    expect(service.cardRefusal('any')).toBeNull();
  });
});
