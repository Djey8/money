import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddFireComponent } from './add-fire.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../../shared/services/database.service';
import { PersistenceService } from '../../../shared/services/persistence.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('AddFireComponent', () => {
  let component: AddFireComponent;
  let fixture: ComponentFixture<AddFireComponent>;
  let mockPersistence: jest.Mocked<Partial<PersistenceService>>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allFireEmergencies = [];

    mockPersistence = {
      writeAndSync: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        AddFireComponent,
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

    fixture = TestBed.createComponent(AddFireComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('invalidTitle()', () => {
    it('should return false for unique title', () => {
      expect(component.invalidTitle('Emergency Fund')).toBe(false);
    });

    it('should return true for duplicate title', () => {
      AppStateService.instance.allFireEmergencies = [
        { 
          title: 'Emergency Fund', 
          phase: 'saving',
          buckets: [{ id: 'b1', title: 'Main', target: 5000, amount: 0, notes: '', links: [] }],
          links: [],
          actionItems: [],
          notes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ] as any;
      expect(component.invalidTitle('Emergency Fund')).toBe(true);
    });
  });

  describe('addFireEmergencie()', () => {
    it('should show error when fields are empty', () => {
      component.titleTextField = '';
      component.targetTextField = '';
      component.addFireEmergencie();
      expect(component.color).toBe('red');
      expect(mockPersistence.writeAndSync).not.toHaveBeenCalled();
    });

    it('should show error for duplicate title', () => {
      AppStateService.instance.allFireEmergencies = [
        { 
          title: 'Car Repair',
          phase: 'saving',
          buckets: [{ id: 'b1', title: 'Main', target: 3000, amount: 0, notes: '', links: [] }],
          links: [],
          actionItems: [],
          notes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ] as any;
      component.titleTextField = 'Car Repair';
      component.targetTextField = '3000';
      component.addFireEmergencie();
      expect(component.color).toBe('red');
      expect(mockPersistence.writeAndSync).not.toHaveBeenCalled();
    });

    it('should create emergency with default bucket when using simple form', () => {
      component.titleTextField = 'Medical';
      component.targetTextField = '2000';
      component.amountTextField = '500';
      component.addFireEmergencie();

      expect(AppStateService.instance.allFireEmergencies.length).toBe(1);
      const fire = AppStateService.instance.allFireEmergencies[0];
      expect(fire.title).toBe('Medical');
      expect(fire.phase).toBe('idea'); // Default phase when creating new Fire (Phase 3 update)
      expect(fire.buckets).toHaveLength(1);
      expect(fire.buckets[0].title).toBe('Medical'); // Default bucket name matches fire emergency name
      expect(fire.buckets[0].target).toBe(2000);
      expect(fire.buckets[0].amount).toBe(500);
      expect(mockPersistence.writeAndSync).toHaveBeenCalledWith(
        expect.objectContaining({ tag: 'fire', localStorageKey: 'fire' })
      );
    });

    it('should default amount to 0 when empty', () => {
      component.titleTextField = 'Roof';
      component.targetTextField = '8000';
      component.amountTextField = '';
      component.addFireEmergencie();
      expect(AppStateService.instance.allFireEmergencies[0].buckets[0].amount).toBe(0);
    });
  });

  describe('closeWindow()', () => {
    it('should reset isAddFire and clear amount', () => {
      AddFireComponent.isAddFire = true;
      component.amountTextField = '500';
      component.closeWindow();
      expect(AddFireComponent.isAddFire).toBe(false);
      expect(component.amountTextField).toBe('');
    });
  });
});
