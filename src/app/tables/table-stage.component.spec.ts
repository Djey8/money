import { TestBed } from '@angular/core/testing';
import { TableModeService } from './table-mode.service';
import { TableStageComponent } from './table-stage.component';

describe('TableStageComponent', () => {
  it('tells what another player does, and closes with its x', () => {
    TestBed.configureTestingModule({});
    const mode = TestBed.inject(TableModeService);
    mode.presenter.stage.set({
      seat: 1,
      who: 'Bea',
      color: '#c0392b',
      headline: 'rolled a 4',
      dice: [4],
    } as never);
    const fixture = TestBed.createComponent(TableStageComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Bea');
    expect(text).toContain('rolled a 4');
    (fixture.nativeElement.querySelector('.ts-x') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(mode.presenter.stage()).toBeNull();
    expect(fixture.nativeElement.querySelector('.ts-stage')).toBeNull();
  });

  it('shows nothing while the messages are switched off', () => {
    TestBed.configureTestingModule({});
    const mode = TestBed.inject(TableModeService);
    mode.presenter.setMessages(false);
    mode.presenter.stage.set({ seat: 0, who: 'Ann', color: '#000', headline: 'x' } as never);
    const fixture = TestBed.createComponent(TableStageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ts-stage')).toBeNull();
    mode.presenter.setMessages(true);
  });
});
