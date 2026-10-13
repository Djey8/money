import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { LocationsComponent } from './locations.component';
import { DatabaseService } from '../../shared/services/database.service';
import { PersistenceService } from '../../shared/services/persistence.service';
import { AppStateService } from '../../shared/services/app-state.service';
import { InfoLocationComponent } from '../../panels/info/info-location/info-location.component';

registerLocaleData(localeDe);

describe('LocationsComponent distribution bar', () => {
  let fixture: ComponentFixture<LocationsComponent>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    jest.spyOn(window, 'scroll').mockImplementation(() => undefined);
    AppStateService.instance.allLocations = [
      { id: 'bank', name: 'N26', subName: 'Main', amount: 300, kind: 'bank' },
      { id: 'cash', name: 'Cash', amount: 100, kind: 'cash' },
      { id: 'empty', name: 'Empty', amount: 0, kind: 'other' },
    ];
    await TestBed.configureTestingModule({
      imports: [
        LocationsComponent,
        TranslateModule.forRoot(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        provideNoopAnimations(),
        { provide: DatabaseService, useValue: {} },
        { provide: PersistenceService, useValue: {} },
        { provide: FIREBASE_OPTIONS, useValue: { projectId: 't', appId: 't', apiKey: 't' } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LocationsComponent);
    fixture.detectChanges();
  });

  it('has one button per location that holds money', () => {
    const segments = fixture.nativeElement.querySelectorAll('button.distribution-segment');
    expect(segments.length).toBe(2);
  });

  it('opens the info of a location when its segment is clicked', () => {
    const spy = jest.spyOn(InfoLocationComponent, 'setInfoLocationComponent');
    fixture.nativeElement.querySelectorAll('button.distribution-segment')[1].click();
    expect(spy).toHaveBeenCalledWith(1, 'Cash', undefined, 100, 'cash');
  });
});
