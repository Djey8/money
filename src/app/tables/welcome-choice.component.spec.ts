import { WelcomeChoiceComponent } from './welcome-choice.component';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TestBed } from '@angular/core/testing';
import { TourService } from '../shared/services/tour.service';

describe('WelcomeChoiceComponent', () => {
  const router = { navigate: jest.fn().mockResolvedValue(true) };
  const tour = { startTour: jest.fn() };
  const translate = { currentLang: 'en', defaultLang: 'en' };

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: TranslateService, useValue: translate },
        { provide: TourService, useValue: tour },
      ],
    });
  });

  it('sends a new game account to the guided Dreamer demo through the lobby', () => {
    const component = TestBed.runInInjectionContext(() => new WelcomeChoiceComponent());
    component.demo();
    expect(router.navigate).toHaveBeenCalledWith(['/tables'], {
      queryParams: { game: 'dreamfund', demo: 'start' },
    });
  });

  it('or starts the normal welcome tour, or lets the person look around', async () => {
    const component = TestBed.runInInjectionContext(() => new WelcomeChoiceComponent());
    jest.useFakeTimers();
    component.tour();
    await Promise.resolve();
    jest.advanceTimersByTime(500);
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(tour.startTour).toHaveBeenCalled();
    jest.useRealTimers();
    component.skip();
    expect(router.navigate).toHaveBeenLastCalledWith(['/home']);
  });

  it('speaks German when the app does', () => {
    translate.currentLang = 'de';
    const component = TestBed.runInInjectionContext(() => new WelcomeChoiceComponent());
    expect(component.t.tour).toBe('Die normale Willkommens-Tour');
    translate.currentLang = 'en';
  });
});
