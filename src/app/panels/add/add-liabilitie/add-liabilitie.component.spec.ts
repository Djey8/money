import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddLiabilitieComponent } from './add-liabilitie.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../../shared/services/database.service';
import { PersistenceService } from '../../../shared/services/persistence.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('AddLiabilitieComponent', () => {
  let component: AddLiabilitieComponent;
  let fixture: ComponentFixture<AddLiabilitieComponent>;
  let mockPersistence: jest.Mocked<Partial<PersistenceService>>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.liabilities = [];

    mockPersistence = { writeAndSync: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        AddLiabilitieComponent,
        TranslateModule.forRoot(),
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: DatabaseService, useValue: {} },
        { provide: PersistenceService, useValue: mockPersistence },
        { provide: FIREBASE_OPTIONS, useValue: { projectId: 'test', appId: 'test', apiKey: 'test' } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddLiabilitieComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('addLiabilitie() validation', () => {
    it('should show error when title is empty', () => {
      component.titleTextField = '';
      component.amountTextField = '1000';
      component.addLiabilitie();
      expect(component.color).toBe('red');
      expect(mockPersistence.writeAndSync).not.toHaveBeenCalled();
    });

    it('should show error when amount is empty', () => {
      component.titleTextField = 'Mortgage';
      component.amountTextField = '';
      component.addLiabilitie();
      expect(component.color).toBe('red');
      expect(mockPersistence.writeAndSync).not.toHaveBeenCalled();
    });

    it('should show error for duplicate title', () => {
      AppStateService.instance.liabilities = [{ tag: 'Car Loan', amount: 5000, credit: 0 }] as any;
      component.titleTextField = 'Car Loan';
      component.amountTextField = '5000';
      component.addLiabilitie();
      expect(component.color).toBe('red');
    });

    it('should call persistence for valid input', () => {
      component.titleTextField = 'Student Loan';
      component.amountTextField = '20000';
      component.addLiabilitie();
      expect(mockPersistence.writeAndSync).toHaveBeenCalled();
    });
  });

  describe('closeWindow()', () => {
    it('should reset form fields', () => {
      AddLiabilitieComponent.isAdd = true;
      component.amountTextField = '5000';
      component.titleTextField = 'Loan';
      component.closeWindow();
      expect(AddLiabilitieComponent.isAdd).toBe(false);
      expect(component.amountTextField).toBe('');
      expect(component.titleTextField).toBe('');
    });
  });
});
