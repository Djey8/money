import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddShareComponent } from './add-share.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../../shared/services/database.service';
import { PersistenceService } from '../../../shared/services/persistence.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('AddShareComponent', () => {
  let component: AddShareComponent;
  let fixture: ComponentFixture<AddShareComponent>;
  let mockPersistence: jest.Mocked<Partial<PersistenceService>>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allAssets = [];
    AppStateService.instance.allShares = [];
    AppStateService.instance.allInvestments = [];

    mockPersistence = { writeAndSync: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        AddShareComponent,
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

    fixture = TestBed.createComponent(AddShareComponent);
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
      AppStateService.instance.allShares = [{ tag: 'AAPL', quantity: 10, price: 150 }] as any;
      component.titleTextField = 'AAPL';
      component.addAsset();
      expect(component.color).toBe('red');
    });

    it('should call persistence for valid input', () => {
      component.titleTextField = 'MSFT';
      component.quantityTextField = '5';
      component.priceTextField = '300';
      component.addAsset();
      expect(mockPersistence.writeAndSync).toHaveBeenCalled();
    });
  });

  describe('closeWindow()', () => {
    it('should reset form fields', () => {
      AddShareComponent.isAddShare = true;
      component.titleTextField = 'AAPL';
      component.quantityTextField = '10';
      component.priceTextField = '150';
      component.closeWindow();
      expect(AddShareComponent.isAddShare).toBe(false);
      expect(component.titleTextField).toBe('');
      expect(component.quantityTextField).toBe('');
      expect(component.priceTextField).toBe('');
    });
  });
});
