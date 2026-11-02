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
    holdings: [{ title: 'Dividend ETF', cardId: 'S01', monthlyMinor: 1200, paidMinor: 5000 }],
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

  it('settles the month when a Payday waits, and offers no moves out of turn', () => {
    render({ canAct: true, paydayDue: true });
    click('Done with the month');
    expect(moves).toEqual([{ type: 'settle_payday' }]);
    render({ canAct: false });
    expect(fixture.nativeElement.querySelector('details')).toBeNull();
  });

  it('offers a holding to the others for a price (the money moves live in the app pages)', () => {
    render({ canAct: true, allowed: ['offer_trade'] });
    const price = fixture.nativeElement.querySelector('input.dm-amount') as HTMLInputElement;
    price.value = '30';
    price.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    click('Offer');
    expect(moves).toEqual([{ type: 'offer_trade', holding: 'Dividend ETF', priceMinor: 3000 }]);
    expect(fixture.nativeElement.textContent).not.toContain('Into the reserve');
  });

  it('answers an offer of somebody else, off turn, and lets the seller take a counter offer', () => {
    const trade = {
      sellerSeat: 1,
      holding: 'Dividend ETF',
      cardId: 'S01',
      toSeat: null,
      priceMinor: 5000,
      counters: [],
      declinedSeats: [],
    };
    render({ canAct: false, trade, youSeat: 0, allowed: ['accept_trade', 'decline_trade'] });
    click('Accept');
    click('Decline');
    expect(moves).toEqual([{ type: 'accept_trade' }, { type: 'decline_trade' }]);
    render({
      canAct: false,
      trade: { ...trade, sellerSeat: 0, counters: [{ seat: 1, priceMinor: 4000 }] },
      youSeat: 0,
      names: ['Ann', 'Ben'],
    });
    click('Ben');
    expect(moves).toEqual([{ type: 'accept_trade', fromSeat: 1 }]);
  });
});
