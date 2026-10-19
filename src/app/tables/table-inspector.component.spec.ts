import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableInspectorComponent } from './table-inspector.component';

const sub = (title: string, amountMinor: number) => ({ title, amountMinor });
const books = (salary: number) => ({
  state: { professionId: 'p', gameSubscriptionTitles: ['Salary', 'Rent'], children: 0 },
  subscriptions: [sub('Salary', salary), sub('Rent', -100000)],
  transactions: [],
  allocation: { daily: 100, splurge: 0, smile: 0, fire: 0 },
  shares: [],
  investments: [],
  assets: [],
  liabilities: [],
});
const view = {
  youSeat: 0,
  players: [
    { seat: 0, name: 'Ann', color: '#e74c3c', books: books(400000) },
    { seat: 1, name: 'Bob', color: '#3498db', books: books(900000) },
  ],
} as never;

describe('TableInspectorComponent', () => {
  let fixture: ComponentFixture<TableInspectorComponent>;
  const text = () => fixture.nativeElement.textContent as string;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableInspectorComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TableInspectorComponent);
    fixture.componentRef.setInput('view', view);
  });

  it('reads my own books first, and any other player on a click', () => {
    fixture.detectChanges();
    expect(text()).toContain('Income statement');
    expect(text()).toMatch(/4[.,]000/);
    const bob = Array.from(fixture.nativeElement.querySelectorAll('.ti-tabs button')).find((b) =>
      (b as HTMLElement).textContent!.includes('Bob'),
    ) as HTMLButtonElement;
    bob.click();
    fixture.detectChanges();
    expect(text()).toMatch(/9[.,]000/);
  });

  it('lists everyone with books in the standings', () => {
    fixture.detectChanges();
    const names = Array.from(fixture.nativeElement.querySelectorAll('.ti-standing .ti-name')).map(
      (n) => (n as HTMLElement).textContent!.trim(),
    );
    expect(names.sort()).toEqual(['Ann', 'Bob']);
  });
});
