import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DreamMoneyComponent } from './dream-money.component';
import type { DreamLifeSummary } from './dream-session.service';

const summary = (over: Partial<DreamLifeSummary> = {}): DreamLifeSummary =>
  ({
    months: 3,
    cashMinor: 150000,
    reserveMinor: 20000,
    reserveTargetMinor: 700000,
    passiveMinor: 0,
    expensesMinor: 233300,
    livingMinor: 150000,
    cashflowMinor: 50000,
    netWorthMinor: 90000,
    bankLoanMinor: 0,
    dreamTargetMinor: 2450000,
    dreamSavedMinor: 0,
    dreamPoints: 0,
    goals: { reserve: 0, debts: 0, dream: 0, independence: 0 },
    debts: [{ tag: 'Student loan', amountMinor: 150000 }],
    holdings: [],
    plans: [{ kind: 'mojo', id: 'mojo', perMinor: 30000, leftMinor: 680000 }],
    smile: [],
    career: null,
    ...over,
  }) as DreamLifeSummary;

describe('DreamMoneyComponent', () => {
  let fixture: ComponentFixture<DreamMoneyComponent>;
  let moves: Record<string, unknown>[];

  const render = (inputs: Partial<DreamMoneyComponent>) => {
    fixture = TestBed.createComponent(DreamMoneyComponent);
    Object.assign(fixture.componentInstance, { summary: summary(), ...inputs });
    moves = [];
    fixture.componentInstance.move.subscribe((m) => moves.push(m));
    fixture.detectChanges();
  };
  const click = (text: string) => {
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLElement>,
    ).find((b) => b.textContent!.includes(text));
    expect(button).toBeTruthy();
    button!.click();
  };

  beforeEach(() => TestBed.configureTestingModule({ imports: [DreamMoneyComponent] }));

  it('puts the typed amount into the reserve or the dream, in minor units', () => {
    render({ canAct: true });
    const input = fixture.nativeElement.querySelector('input.dm-amount') as HTMLInputElement;
    input.value = '12.5';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    click('Into the reserve');
    click('Into the dream');
    expect(moves).toEqual([
      { type: 'fund_reserve', amountMinor: 1250 },
      { type: 'fund_dream', amountMinor: 1250 },
    ]);
  });

  it('repays a debt and sets a plan, which the table keeps for every Payday', () => {
    render({ canAct: true });
    click('Student loan');
    fixture.componentInstance.plans['life'] = 40;
    fixture.componentInstance.setPlan(
      fixture.componentInstance.goals().find((g) => g.key === 'life')!,
    );
    expect(moves[0]).toEqual({ type: 'repay_debt', tag: 'Student loan' });
    expect(moves[1]).toEqual({ type: 'set_plan', kind: 'life', id: 'life', perMinor: 4000 });
  });

  it('settles the month when a Payday waits, and offers no moves out of turn', () => {
    render({ canAct: true, paydayDue: true });
    click('Done with the month');
    expect(moves).toEqual([{ type: 'settle_payday' }]);
    render({ canAct: false });
    expect(fixture.nativeElement.textContent).not.toContain('Student loan');
  });
});
