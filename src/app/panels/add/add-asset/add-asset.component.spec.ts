import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddAssetComponent } from './add-asset.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../../shared/services/database.service';
import { PersistenceService } from '../../../shared/services/persistence.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('AddAssetComponent', () => {
  let component: AddAssetComponent;
  let fixture: ComponentFixture<AddAssetComponent>;
  let mockPersistence: jest.Mocked<Partial<PersistenceService>>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allAssets = [];
    AppStateService.instance.allShares = [];
    AppStateService.instance.allInvestments = [];

    mockPersistence = { writeAndSync: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        AddAssetComponent,
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

    fixture = TestBed.createComponent(AddAssetComponent);
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

    it('should show error for duplicate title across assets', () => {
      AppStateService.instance.allAssets = [{ tag: 'House', amount: 200000 }] as any;
      component.titleTextField = 'House';
      component.addAsset();
      expect(component.color).toBe('red');
      expect(mockPersistence.writeAndSync).not.toHaveBeenCalled();
    });

    it('should call persistence for valid input', () => {
      component.titleTextField = 'Car';
      component.amountTextField = '15000';
      component.addAsset();
      expect(mockPersistence.writeAndSync).toHaveBeenCalled();
    });
  });

  describe('closeWindow()', () => {
    it('should reset isAddAsset and amount', () => {
      AddAssetComponent.isAddAsset = true;
      component.amountTextField = '999';
      component.closeWindow();
      expect(AddAssetComponent.isAddAsset).toBe(false);
      expect(component.amountTextField).toBe('');
    });
  });
});
