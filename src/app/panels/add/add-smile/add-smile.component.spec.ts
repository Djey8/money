import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddSmileComponent } from './add-smile.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../../shared/services/database.service';
import { PersistenceService } from '../../../shared/services/persistence.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('AddSmileComponent', () => {
  let component: AddSmileComponent;
  let fixture: ComponentFixture<AddSmileComponent>;
  let mockPersistence: jest.Mocked<Partial<PersistenceService>>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allSmileProjects = [];

    mockPersistence = {
      writeAndSync: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        AddSmileComponent,
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

    fixture = TestBed.createComponent(AddSmileComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('constructor', () => {
    it('should initialize isAddSmile to false', () => {
      expect(AddSmileComponent.isAddSmile).toBe(false);
    });

    it('should initialize isError to false', () => {
      expect(AddSmileComponent.isError).toBe(false);
    });
  });

  describe('invalidTitle()', () => {
    it('should return false for unique title', () => {
      AppStateService.instance.allSmileProjects = [
        {
          title: 'Vacation',
          sub: '',
          phase: 'planning',
          description: '',
          buckets: [{ id: 'bucket_1', title: 'Vacation', target: 1000, amount: 0, notes: '', links: [] }],
          links: [],
          actionItems: [],
          notes: [],
          createdAt: '',
          updatedAt: '',
          targetDate: '',
          completionDate: ''
        }
      ];
      expect(component.invalidTitle('New Car')).toBe(false);
    });

    it('should return true for duplicate title', () => {
      AppStateService.instance.allSmileProjects = [
        {
          title: 'Vacation',
          sub: '',
          phase: 'planning',
          description: '',
          buckets: [{ id: 'bucket_1', title: 'Vacation', target: 1000, amount: 0, notes: '', links: [] }],
          links: [],
          actionItems: [],
          notes: [],
          createdAt: '',
          updatedAt: '',
          targetDate: '',
          completionDate: ''
        }
      ];
      expect(component.invalidTitle('Vacation')).toBe(true);
    });
  });

  describe('addSmileProject()', () => {
    it('should show error when title is empty', () => {
      component.titleTextField = '';
      component.targetTextField = '1000';
      component.addSmileProject();
      expect(component.color).toBe('red');
      expect(AddSmileComponent.isError).toBe(true);
      expect(mockPersistence.writeAndSync).not.toHaveBeenCalled();
    });

    it('should show error when target is empty', () => {
      component.titleTextField = 'Vacation';
      component.targetTextField = '';
      component.addSmileProject();
      expect(component.color).toBe('red');
      expect(mockPersistence.writeAndSync).not.toHaveBeenCalled();
    });

    it('should show error for duplicate title', () => {
      AppStateService.instance.allSmileProjects = [
        {
          title: 'Vacation',
          sub: '',
          phase: 'planning',
          description: '',
          buckets: [{ id: 'bucket_1', title: 'Vacation', target: 1000, amount: 0, notes: '', links: [] }],
          links: [],
          actionItems: [],
          notes: [],
          createdAt: '',
          updatedAt: '',
          targetDate: '',
          completionDate: ''
        }
      ];
      component.titleTextField = 'Vacation';
      component.targetTextField = '2000';
      component.addSmileProject();
      expect(component.color).toBe('red');
      expect(mockPersistence.writeAndSync).not.toHaveBeenCalled();
    });

    it('should push new project and call persistence for valid input', () => {
      component.titleTextField = 'New Car';
      component.targetTextField = '5000';
      component.amountTextField = '100';
      component.addSmileProject();

      expect(AppStateService.instance.allSmileProjects.length).toBe(1);
      const project = AppStateService.instance.allSmileProjects[0];
      expect(project.title).toBe('New Car');
      expect(project.buckets.length).toBe(1);
      expect(project.buckets[0].target).toBe(5000);
      expect(project.buckets[0].amount).toBe(100);
      expect(mockPersistence.writeAndSync).toHaveBeenCalledWith(
        expect.objectContaining({ tag: 'smile', localStorageKey: 'smile' })
      );
    });

    it('should default amount to 0 when amountTextField is empty', () => {
      component.titleTextField = 'Trip';
      component.targetTextField = '2000';
      component.amountTextField = '';
      component.addSmileProject();

      // Should create a default bucket with amount 0
      expect(AppStateService.instance.allSmileProjects[0].buckets[0].amount).toBe(0);
    });

    it('should trim the title before validation', () => {
      component.titleTextField = '  Trip  ';
      component.targetTextField = '2000';
      component.addSmileProject();

      expect(AppStateService.instance.allSmileProjects[0].title).toBe('Trip');
    });
  });

  describe('closeWindow()', () => {
    it('should reset isAddSmile and clear amount', () => {
      AddSmileComponent.isAddSmile = true;
      component.amountTextField = '500';
      component.closeWindow();
      expect(AddSmileComponent.isAddSmile).toBe(false);
      expect(component.amountTextField).toBe('');
    });
  });
});
