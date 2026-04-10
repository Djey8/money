import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddGrowComponent } from './add-grow.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../../shared/services/database.service';
import { PersistenceService } from '../../../shared/services/persistence.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('AddGrowComponent', () => {
  let component: AddGrowComponent;
  let fixture: ComponentFixture<AddGrowComponent>;
  let mockPersistence: jest.Mocked<Partial<PersistenceService>>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allGrowProjects = [];

    mockPersistence = {
      writeAndSync: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        AddGrowComponent,
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

    fixture = TestBed.createComponent(AddGrowComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('invalidTitle()', () => {
    it('should return false for unique title', () => {
      expect(component.invalidTitle('Real Estate')).toBe(false);
    });

    it('should return true for duplicate title', () => {
      AppStateService.instance.allGrowProjects = [
        { title: 'Real Estate' } as any
      ];
      expect(component.invalidTitle('Real Estate')).toBe(true);
    });
  });

  describe('toggle methods', () => {
    it('toggleAsset should enable asset and disable share/investment', () => {
      AddGrowComponent.isShare = true;
      AddGrowComponent.isInvestment = true;
      component.toggleAsset();
      expect(AddGrowComponent.isAsset).toBe(true);
      expect(AddGrowComponent.isShare).toBe(false);
      expect(AddGrowComponent.isInvestment).toBe(false);
    });

    it('toggleShare should enable share and disable asset/investment', () => {
      AddGrowComponent.isAsset = true;
      AddGrowComponent.isInvestment = true;
      component.toggleShare();
      expect(AddGrowComponent.isShare).toBe(true);
      expect(AddGrowComponent.isAsset).toBe(false);
      expect(AddGrowComponent.isInvestment).toBe(false);
    });

    it('toggleInvestment should enable investment and disable asset/share', () => {
      AddGrowComponent.isAsset = true;
      AddGrowComponent.isShare = true;
      component.toggleInvestment();
      expect(AddGrowComponent.isInvestment).toBe(true);
      expect(AddGrowComponent.isAsset).toBe(false);
      expect(AddGrowComponent.isShare).toBe(false);
    });
  });

  describe('addGrowProject() validation', () => {
    it('should show error when title is empty', () => {
      component.titleTextField = '';
      component.addGrowProject();
      expect(component.color).toBe('red');
      expect(mockPersistence.writeAndSync).not.toHaveBeenCalled();
    });

    it('should show error for duplicate title', () => {
      AppStateService.instance.allGrowProjects = [{ title: 'Stocks' } as any];
      component.titleTextField = 'Stocks';
      component.addGrowProject();
      expect(component.color).toBe('red');
      expect(mockPersistence.writeAndSync).not.toHaveBeenCalled();
    });
  });

  describe('closeWindow()', () => {
    it('should reset isAddSmile and clear amount', () => {
      AddGrowComponent.isAddSmile = true;
      component.amountTextField = '500';
      component.closeWindow();
      expect(AddGrowComponent.isAddSmile).toBe(false);
      expect(component.amountTextField).toBe('');
    });
  });
});
