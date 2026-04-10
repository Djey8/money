import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddInvestmentComponent } from './add-investment.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../../shared/services/database.service';
import { PersistenceService } from '../../../shared/services/persistence.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('AddInvestmentComponent', () => {
  let component: AddInvestmentComponent;
  let fixture: ComponentFixture<AddInvestmentComponent>;
  let mockPersistence: jest.Mocked<Partial<PersistenceService>>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allAssets = [];
    AppStateService.instance.allShares = [];
    AppStateService.instance.allInvestments = [];

    mockPersistence = { writeAndSync: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        AddInvestmentComponent,
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

    fixture = TestBed.createComponent(AddInvestmentComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('addAsset() validation', () => {
    it('should show error when title is empty', () => {
      component.titleTextField = '';
      component.addAsset();
      expect(component.color).toBe('red');
      expect(mockPersistence.writeAndSync).not.toHaveBeenCalled();
    });

    it('should show error for duplicate title', () => {
      AppStateService.instance.allInvestments = [{ tag: 'Fund A', amount: 10000, deposit: 500 }] as any;
      component.titleTextField = 'Fund A';
      component.addAsset();
      expect(component.color).toBe('red');
    });

    it('should call persistence for valid input', () => {
      component.titleTextField = 'Fund B';
      component.amountTextField = '5000';
      component.depositTextField = '100';
      component.addAsset();
      expect(mockPersistence.writeAndSync).toHaveBeenCalled();
    });
  });

  describe('closeWindow()', () => {
    it('should reset form fields', () => {
      AddInvestmentComponent.isAddInvestment = true;
      component.titleTextField = 'Fund';
      component.amountTextField = '5000';
      component.depositTextField = '100';
      component.closeWindow();
      expect(AddInvestmentComponent.isAddInvestment).toBe(false);
      expect(component.titleTextField).toBe('');
      expect(component.amountTextField).toBe('');
      expect(component.depositTextField).toBe('');
    });
  });
});
