import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TileCardComponent } from './tile-card.component';
import { CashflowGameService } from '../../shared/services/cashflow-game.service';
import { ToastService } from '../../shared/services/toast.service';
import { AppStateService } from '../../shared/services/app-state.service';

registerLocaleData(localeDe); // the app registers it at startup

/** The body of a tile with a stack of cards: open it, find or shuffle the card, deal with it, see the dice (JFK, 2026-10-26). */
describe('TileCardComponent', () => {
  let fixture: ComponentFixture<TileCardComponent>;
  let service: Record<string, any>;

  const offer = (id: string) => ({
    id,
    title: { en: `Dream ${id}`, de: `Traum ${id}` },
    story: { en: 'Story', de: 'Geschichte' },
    tier: 'big',
    points: 4,
    totalMinor: 100000,
    category: 'travel',
    buckets: [{ id: 'b1', title: { en: 'Flights', de: 'Flüge' }, amountMinor: 100000 }],
  });

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    service = {
      cardChoiceFree: true,
      emergencyCards: [],
      lifeCards: [
        { id: 'L01', type: 'fate', title: { en: 'Falling in Love', de: 'Verliebt' } },
        { id: 'L02', type: 'choice', title: { en: 'Moving In', de: 'Zusammenziehen' } },
      ],
      dreamCards: [offer('D01'), offer('D02')],
      lifeCanDecline: true,
      emergencyView: null,
      lifeView: null,
      dreamView: null,
      careerView: null,
      careerStatus: null,
      careerNext: null,
      dreamSettings: { offersPerLanding: 2, maxOpenDreams: 3 },
      openDreams: [],
      drawLife: jest.fn(),
      drawDream: jest.fn(),
      drawEmergency: jest.fn(),
      declineDreams: jest.fn(),
      decideLife: jest.fn(),
      takeDream: jest.fn(),
      rollCareerTile: jest.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [TileCardComponent, TranslateModule.forRoot()],
      providers: [
        { provide: CashflowGameService, useValue: service },
        { provide: ToastService, useValue: { show: jest.fn() } },
      ],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      'CashflowGame.tile.all': 'All',
      'CashflowGame.life.accept': 'Accept',
      'CashflowGame.life.decline': 'Decline',
      'CashflowGame.career.promoted': 'You were promoted!',
      'CashflowGame.career.tooEarly': '{{count}} more Paydays in this stage.',
    });
    translate.use('en');
  });

  const render = (tile: string) => {
    fixture = TestBed.createComponent(TileCardComponent);
    fixture.componentRef.setInput('tile', tile);
    fixture.componentRef.setInput('currency', 'DT');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const click = (element: HTMLElement, selector: string) => {
    (element.querySelector(selector) as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  it('a Life card is opened first: the only choice is to open it', () => {
    const element = render('life');
    const buttons = element.querySelectorAll('.tc-btn');
    expect(buttons).toHaveLength(1);
    expect(service['drawLife']).not.toHaveBeenCalled();
  });

  it('under the free rules the card is found in a grid with quick filters, or shuffled', () => {
    const element = render('life');
    click(element, '.tc-btn--primary');
    expect(element.querySelectorAll('.tc-grid-item')).toHaveLength(2);
    // quick filters: by the kind of card
    const chips = Array.from(element.querySelectorAll('.tc-chip'));
    expect(chips.map((chip) => chip.textContent!.trim())).toEqual(expect.arrayContaining(['All']));
    (chips[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.tc-grid-item')).toHaveLength(1);
    click(element, '.tc-grid-item');
    expect(service['drawLife']).toHaveBeenCalledWith(expect.anything(), 'L01');
  });

  it('shuffling draws a card at random', () => {
    const element = render('life');
    click(element, '.tc-btn--primary');
    click(element, '.tc-picker .tc-actions .tc-btn--primary');
    expect(service['drawLife']).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it('under the other rules the card is drawn the moment it is opened', () => {
    service['cardChoiceFree'] = false;
    const element = render('life');
    click(element, '.tc-btn--primary');
    expect(service['drawLife']).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.tc-grid')).toBeNull();
  });

  it('a dream can be declined before the card is opened; nobody has to take one', () => {
    const element = render('dream');
    expect(element.querySelectorAll('.tc-btn')).toHaveLength(2);
    click(element, '.tc-actions .tc-btn:not(.tc-btn--primary)');
    expect(service['declineDreams']).toHaveBeenCalled();
  });

  it('the two dream offers stand side by side and choosing one takes the other away', () => {
    service['dreamView'] = {
      offers: [offer('D01'), offer('D02')],
      declined: false,
      canTake: true,
    };
    const element = render('dream');
    expect(element.querySelectorAll('.tc-offer')).toHaveLength(2);
    click(element, '.tc-offer .tc-btn--primary');
    expect(element.querySelectorAll('.tc-offer')).toHaveLength(1);
    // the choice is confirmed, or taken back
    click(element, '.tc-actions .tc-btn--primary');
    expect(service['takeDream']).toHaveBeenCalledWith('D01', expect.anything());
  });

  it('a life choice cannot be declined when the game says so', () => {
    service['lifeView'] = {
      card: { id: 'L02', type: 'choice', title: { en: 'x', de: 'x' }, story: { en: 'y', de: 'y' } },
      skipped: [],
    };
    let element = render('life');
    expect(element.textContent).toContain('Decline');
    service['lifeCanDecline'] = false;
    element = render('life');
    expect(element.textContent).not.toContain('Decline');
    expect(element.textContent).toContain('Accept');
  });

  it('a career roll is seen: the die tumbles first, then the result is told', async () => {
    {
      service['careerStatus'] = { title: 'Dual Student', stageNumber: 1, branch: undefined };
      service['careerNext'] = {
        stages: [{ id: 'C2', title: 'Junior', grossYear: 56000 }],
        minPaydays: 3,
        paydaysIn: 3,
        rollFrom: 3,
        eligible: true,
      };
      service['rollCareerTile'] = jest.fn(() => {
        service['careerView'] = {
          result: { kind: 'promoted', to: 'C2', roll: 5 },
          done: true,
          options: [],
        };
      });
      const element = render('career');
      click(element, '.tc-btn--gold');
      // while it rolls: a die, and no verdict yet
      expect(element.querySelector('.tc-die--tumbling')).not.toBeNull();
      expect(element.querySelector('.tc-result')).toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 1150));
      fixture.detectChanges();
      expect(element.querySelector('.tc-die--tumbling')).toBeNull();
      expect(element.querySelectorAll('.tc-die')).toHaveLength(1);
      expect(element.querySelector('.tc-result')!.textContent).toContain('promoted');
    }
  });

  it('a career that is not due yet does not offer the roll', () => {
    service['careerStatus'] = { title: 'Dual Student', stageNumber: 1, branch: undefined };
    service['careerNext'] = {
      stages: [{ id: 'C2', title: 'Junior', grossYear: 56000 }],
      minPaydays: 3,
      paydaysIn: 1,
      rollFrom: 3,
      eligible: false,
    };
    const element = render('career');
    expect(element.querySelector('.tc-btn--gold')).toBeNull();
    expect(element.textContent).toContain('2');
  });
});
