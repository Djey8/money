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
    expect(onError.mock.calls[0][0]).toMatch(/do not allow passing a payment/);
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
    expect(CashflowGameService.buyRefusalFor('EFH', 'property')).toMatch(/already own/);
    expect(CashflowGameService.buyRefusalFor('EFH-II', 'property')).toBeNull();
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

  it('a bought property is recognised after a reload, before the balance sheet has loaded', () => {
    startGame();
    AppStateService.instance.allInvestments = [];
    AppStateService.instance.allGrowProjects = [
      { title: 'EFH', phase: 'execute', investment: { tag: 'EFH' } },
      { title: 'DUPLEX', phase: 'plan', investment: { tag: 'DUPLEX' } },
      { title: 'OLD', phase: 'completed', investment: { tag: 'OLD' } },
    ] as never;
    expect(CashflowGameService.buyRefusalFor('EFH', 'property')).toMatch(/already own/);
    expect(CashflowGameService.buyRefusalFor('DUPLEX', 'property')).toBeNull(); // only planned
    expect(CashflowGameService.buyRefusalFor('OLD', 'property')).toBeNull(); // sold since
  });

  it('guided and strict buy only with the card in hand: no card, no Buy', () => {
    startGame(RULE_PRESETS.guided);
    expect(CashflowGameService.buyRefusalFor('DUPLEX', 'property')).toMatch(/only allow buying/);
    AppStateService.instance.cashflowGame.turn = {
      phase: 'decide',
      count: 2,
      pending: {
        kind: 'deal',
        spaceIndex: 2,
        offered: { deck: 'dealBig', cardId: 'db-1', title: 'DUPLEX' },
      },
    };
    expect(CashflowGameService.buyRefusalFor('DUPLEX', 'property')).toBeNull();
    // the space is settled: the chance is over
    AppStateService.instance.cashflowGame.turn = { phase: 'roll', count: 2 };
    expect(CashflowGameService.buyRefusalFor('DUPLEX', 'property')).toMatch(/only allow buying/);
  });

  it('a card is planned once; the card in hand is matched on the project it became', () => {
    startGame({ ...RULE_PRESETS.guided, cardChoice: 'free', preset: 'custom' });
    AppStateService.instance.cashflowGame.turn = {
      phase: 'decide',
      count: 3,
      pending: {
        kind: 'deal',
        spaceIndex: 2,
        offered: { deck: 'dealBig', cardId: 'db-1', title: 'EFH' },
      },
    };
    expect(service.cardRefusal('db-1')).toBeNull();
    // planning took the label EFH-II: the Buy rule now looks for that title
    AppStateService.instance.allGrowProjects = [{ title: 'EFH-II', phase: 'plan' }] as never;
    (service as any).markCardPlayed();
    (service as any).holdProject('EFH-II');
    expect(CashflowGameService.buyRefusalFor('EFH-II', 'property')).toBeNull();
    expect(CashflowGameService.buyRefusalFor('EFH', 'property')).toMatch(/only allow buying/);
    // the same card cannot be played again, another one (free card choice) is not blocked by this
    expect(service.cardRefusal('db-1')).toMatch(/played already/);
    expect(service.cardRefusal('db-2')).toBeNull();
  });

  it('a Multi-Level-Marketing card is never sold, under any rules', () => {
    for (const rules of [undefined, RULE_PRESETS.guided, RULE_PRESETS.strict]) {
      startGame(rules);
      AppStateService.instance.cashflowGame.assetDeals = [
        { title: 'MLM-II', coins: 1, costMinor: 1, stage: 'owned', recurring: true },
        { title: 'GOLD', coins: 2, costMinor: 1, stage: 'owned' },
      ] as never;
      expect(CashflowGameService.sellRefusalFor('MLM-II')).toMatch(
        /Multi-Level-Marketing card is kept/,
      );
      // gold is sold the usual way (under free rules: any time)
      if (!rules || rules.sell === 'always')
        expect(CashflowGameService.sellRefusalFor('GOLD')).toBeNull();
    }
  });

  it('a card buys once: after a property or an asset was bought there is no second Buy; GOLD-II is the held GOLD', () => {
    startGame(RULE_PRESETS.guided);
    AppStateService.instance.cashflowGame.turn = {
      phase: 'decide',
      count: 3,
      pending: {
        kind: 'deal',
        spaceIndex: 2,
        offered: { deck: 'dealSmall', cardId: 'ds-9', title: 'GOLD' },
      },
    };
    expect(CashflowGameService.buyRefusalFor('GOLD-II', 'asset')).toBeNull();
    (service as any).markPurchased();
    expect(CashflowGameService.buyRefusalFor('GOLD-II', 'asset')).toMatch(
      /only allow buying|buys once|already/,
    );
    expect(
      service.addDialogRefusal('Buy Asset GOLD-II 1 x 1000;', '@GOLD-II', 100000),
    ).toBeTruthy();
    // shares keep their own quantity logic: not blocked by a bought property
    expect(CashflowGameService.buyRefusalFor('OK4U', 'share')).toMatch(/only allow buying/);
  });

  it('a planned card is only read while its project exists; delete the project and its buttons are back', () => {
    startGame({ ...RULE_PRESETS.guided, cardChoice: 'free', preset: 'custom' });
    AppStateService.instance.cashflowGame.turn = {
      phase: 'decide',
      count: 3,
      pending: {
        kind: 'deal',
        spaceIndex: 2,
        played: true,
        offered: { deck: 'dealBig', cardId: 'db-1', title: 'APT-IV' },
      },
    };
    AppStateService.instance.allGrowProjects = [{ title: 'APT-IV', phase: 'plan' }] as never;
    expect(CashflowGameService.heldProjectFor('db-1')?.title).toBe('APT-IV');
    expect(CashflowGameService.heldProjectFor('db-2')).toBeNull();
    expect(service.cardRefusal('db-1')).toMatch(/played already/);
    expect(
      CashflowGameService.effectiveGame(AppStateService.instance.cashflowGame).turn?.pending
        ?.played,
    ).toBe(true);

    AppStateService.instance.allGrowProjects = [];
    expect(CashflowGameService.heldProjectFor('db-1')).toBeNull();
    expect(service.cardRefusal('db-1')).toBeNull(); // planned, sold to a friend or declined again
    expect(
      CashflowGameService.effectiveGame(AppStateService.instance.cashflowGame).turn?.pending
        ?.played,
    ).toBe(false);
  });

  it('every card that was played is only read afterwards: a Market card or a Doodad too, a Deal while its project exists', () => {
    startGame();
    const pending = (kind: 'deal' | 'market' | 'doodad', title?: string) => ({
      phase: 'decide' as const,
      count: 3,
      pending: {
        kind,
        spaceIndex: 2,
        played: true,
        offered: { deck: kind === 'deal' ? ('dealBig' as const) : kind, cardId: 'c-1', title },
      },
    });
    AppStateService.instance.cashflowGame.turn = pending('market');
    expect(CashflowGameService.isPlayedCard('c-1')).toBe(true);
    expect(CashflowGameService.isPlayedCard('c-2')).toBe(false); // another card is not
    AppStateService.instance.cashflowGame.turn = pending('doodad');
    expect(CashflowGameService.isPlayedCard('c-1')).toBe(true);
    AppStateService.instance.cashflowGame.turn = pending('deal', 'EFH-II');
    AppStateService.instance.allGrowProjects = [{ title: 'EFH-II', phase: 'plan' }] as never;
    expect(CashflowGameService.isPlayedCard('c-1')).toBe(true);
    AppStateService.instance.allGrowProjects = []; // the project was deleted: the card can be used again
    expect(CashflowGameService.isPlayedCard('c-1')).toBe(false);
    // a card that was only looked at (not played) keeps its buttons
    AppStateService.instance.cashflowGame.turn = {
      ...pending('market'),
      pending: { kind: 'market', spaceIndex: 2, offered: { deck: 'market', cardId: 'c-1' } },
    };
    expect(CashflowGameService.isPlayedCard('c-1')).toBe(false);
  });

  it('the payment of a Market cost card is allowed while the game waits for it, and settles the space', () => {
    startGame(RULE_PRESETS.strict);
    AppStateService.instance.cashflowGame.turn = {
      phase: 'decide',
      count: 3,
      pending: { kind: 'market', spaceIndex: 8, paymentDue: true },
    };
    // the Add dialog books it with the #market tag; anything else is refused while the payment waits
    expect(service.addDialogRefusal('Broken pipe #market', '@EFH', 50000)).toBeNull();
    expect(service.addDialogRefusal('Buy Share OK4U 10 x 10;', '@OK4U', 10000)).toMatch(
      /Spiel|game waits|waits for the payment/,
    );
    (service as any).gameBooks = () => ({ subscriptions: [] });
    (service as any).settleDoodadByPayment('marketCost');
    expect(AppStateService.instance.cashflowGame.turn?.phase).toBe('roll');
  });

  it('a card sold to a friend or declined is used up: only read afterwards, whether or not it became a project', () => {
    startGame();
    AppStateService.instance.allGrowProjects = [];
    AppStateService.instance.cashflowGame.turn = {
      phase: 'decide',
      count: 3,
      pending: {
        kind: 'deal',
        spaceIndex: 2,
        offered: { deck: 'dealBig', cardId: 'db-1', title: 'EFH' },
      },
    };
    expect(CashflowGameService.isPlayedCard('db-1')).toBe(false);
    (service as any).markCardClosed();
    expect(CashflowGameService.isPlayedCard('db-1')).toBe(true); // no Grow project, and still only read
    expect(
      CashflowGameService.effectiveGame(AppStateService.instance.cashflowGame).turn?.pending
        ?.played,
    ).toBe(true);
    // it cannot be played again
    expect(service.cardRefusal('db-1')).toMatch(/played already/);
  });
});
