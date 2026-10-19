import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import type { PayoffPlan } from '@money/domain';
import { CashflowGameService } from './cashflow-game.service';
import { ConfirmService } from './confirm.service';
import { LiabilityPayoffService } from './liability-payoff.service';
import { RemoteGameHook, type RemoteGame } from './remote-game';
import { ToastService } from './toast.service';

const plan = (extra: Partial<PayoffPlan> = {}): PayoffPlan => ({
  tag: 'Car loan',
  amountMinor: 400_000,
  cashMinor: 1_000_000,
  borrowMinor: 0,
  expenseTitle: 'Car loan payment',
  freedMonthlyMinor: 10_000,
  cashflowBeforeMinor: 50_000,
  cashflowAfterMinor: 60_000,
  ok: true,
  ...extra,
});

describe('LiabilityPayoffService', () => {
  let service: LiabilityPayoffService;
  let game: { payoffPlan: jest.Mock; payOffLiability: jest.Mock };
  let confirm: { confirm: jest.Mock };
  let toast: { show: jest.Mock };

  beforeEach(() => {
    game = { payoffPlan: jest.fn(), payOffLiability: jest.fn() };
    confirm = { confirm: jest.fn() };
    toast = { show: jest.fn() };
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        { provide: CashflowGameService, useValue: game },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: toast },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      'CashflowGame.payoffConfirm': 'Pay off {{tag}} {{amount}}: cashflow {{before}} -> {{after}}',
      'CashflowGame.payoffBorrow': 'Borrow {{borrow}} of {{cash}}',
      'CashflowGame.payoffTitle': 'Pay off',
      'CashflowGame.payoffDone': '{{tag}} done',
    });
    translate.use('en');
    service = TestBed.inject(LiabilityPayoffService);
  });

  afterEach(() => {
    RemoteGameHook.current = null;
  });

  it("refuses what would put the player into bankruptcy, with the rule's words, and asks nothing", () => {
    game.payoffPlan.mockReturnValue(plan({ ok: false, reason: 'would put you into bankruptcy' }));
    service.start('Car loan');
    expect(toast.show).toHaveBeenCalledWith('would put you into bankruptcy', 'error');
    expect(confirm.confirm).not.toHaveBeenCalled();
  });

  it('says what it does first, and warns how much has to be borrowed when the cash is short', () => {
    game.payoffPlan.mockReturnValue(plan({ borrowMinor: 300_000, cashMinor: 100_000 }));
    service.start('Car loan');
    const [message] = confirm.confirm.mock.calls[0];
    expect(message).toContain('Pay off Car loan');
    expect(message).toContain('Borrow');
  });

  it('a solo game books it in the service; a table sends the move to the server', async () => {
    game.payoffPlan.mockReturnValue(plan());
    service.start('Car loan');
    confirm.confirm.mock.calls[0][1]();
    expect(game.payOffLiability).toHaveBeenCalledWith('Car loan', expect.any(Object));

    const payLiability = jest.fn().mockResolvedValue({ ok: true, events: [] });
    RemoteGameHook.current = { viewOnly: () => false, payLiability } as unknown as RemoteGame;
    service.start('Car loan');
    confirm.confirm.mock.calls[1][1]();
    expect(payLiability).toHaveBeenCalledWith('Car loan');
    await Promise.resolve();
    expect(toast.show).toHaveBeenCalledWith('Car loan done', 'success');
  });

  it("does nothing while another player's books are looked at", () => {
    RemoteGameHook.current = { viewOnly: () => true } as unknown as RemoteGame;
    service.start('Car loan');
    expect(game.payoffPlan).not.toHaveBeenCalled();
  });

  it("is only for the starting debts of a game: not the Bank loan, not a property's mortgage", () => {
    jest.spyOn(CashflowGameService, 'isCashflowGame').mockReturnValue(true);
    expect(service.canPayOff('Car loan', false)).toBe(true);
    expect(service.canPayOff('Bank loan', false)).toBe(false);
    expect(service.canPayOff('M-EFH', true)).toBe(false);
  });
});
