import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { TranslateModule } from '@ngx-translate/core';
import { PaymentPlannerDialogComponent } from './payment-planner-dialog.component';

registerLocaleData(localeDe); // the app registers it at startup (app.config.ts)

const buckets = [
  { id: 'a', title: 'Equipment', target: 3000, amount: 0 },
  { id: 'b', title: 'Courses', target: 1000, amount: 0 },
];

describe('PaymentPlannerDialogComponent in a game (Paydays)', () => {
  let fixture: ComponentFixture<PaymentPlannerDialogComponent>;
  let dialog: PaymentPlannerDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentPlannerDialogComponent, TranslateModule.forRoot()],
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentPlannerDialogComponent);
    dialog = fixture.componentInstance;
    fixture.componentRef.setInput('projectTitle', 'Mountain guide');
    fixture.componentRef.setInput('buckets', buckets);
    fixture.componentRef.setInput('gameDate', '2026-11-15');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('asks for Paydays, not for dates, and starts at the next Payday', () => {
    expect(dialog.gameMode).toBe(true);
    expect(fixture.nativeElement.querySelector('#paydays')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#targetDate')).toBeNull();
    expect(dialog.startDate).toBe('2026-11-15');
  });

  it('shows what filling the buckets in N Paydays costs each Payday and what the plan costs in all', () => {
    dialog.paydays = 20;
    dialog.recalculate();
    expect(dialog.totalMissing).toBe(4000);
    expect(dialog.calculatedAmount).toBe(200);
    expect(dialog.planCost).toBe(4000);
  });

  it('shows how many Paydays a chosen payment needs, and what N Paydays of it cost', () => {
    dialog.paydays = 10;
    dialog.manualAmount = 150;
    dialog.recalculate();
    expect(dialog.paydaysNeeded).toBe(27);
    expect(dialog.planCost).toBe(1500);
  });

  it('a plan for N Paydays ends on its Nth Payday', () => {
    let made: { startDate: string; endDate: string; frequency: string; amount: number } | null =
      null;
    dialog.planCreated.subscribe((plan) => (made = plan));
    dialog.paydays = 10;
    dialog.manualAmount = 150;
    dialog.recalculate();
    dialog.savePlan();
    expect(made).toMatchObject({
      startDate: '2026-11-15',
      endDate: '2027-08-15', // ten Paydays: November to August
      frequency: 'monthly',
      amount: 150,
    });
  });

  it('keeps the end of a short month on its last day', () => {
    fixture.componentRef.setInput('gameDate', '2026-01-31');
    dialog.paydays = 2;
    dialog.recalculate();
    let made: { endDate: string } | null = null;
    dialog.planCreated.subscribe((plan) => (made = plan));
    dialog.savePlan();
    expect(made!.endDate).toBe('2026-02-28');
  });
});
