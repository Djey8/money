import { FireEmergenciesComponent } from './fire-emergencies.component';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('FireEmergenciesComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    FireEmergenciesComponent.isSearched = false;
    FireEmergenciesComponent.allSearchedFireEmergencies = [];
  });

  it('allFireEmergencies should delegate getter/setter to AppStateService', () => {
    AppStateService.instance.allFireEmergencies = [{
      title: 'Emergency Fund',
      phase: 'saving',
      buckets: [{ id: 'b1', title: 'Main', target: 10000, amount: 2500, notes: '', links: [] }],
      links: [],
      actionItems: [],
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetDate: '',
      completionDate: ''
    }] as any;
    
    expect(FireEmergenciesComponent.allFireEmergencies).toHaveLength(1);
    expect(FireEmergenciesComponent.allFireEmergencies[0].title).toBe('Emergency Fund');

    FireEmergenciesComponent.allFireEmergencies = [];
    expect(AppStateService.instance.allFireEmergencies).toHaveLength(0);
  });

  it('search should filter fire emergencies by title', () => {
    AppStateService.instance.allFireEmergencies = [
      {
        title: 'Emergency Fund',
        phase: 'saving',
        buckets: [{ id: 'b1', title: 'Main', target: 10000, amount: 2500, notes: '', links: [] }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetDate: '',
        completionDate: ''
      },
      {
        title: 'Medical',
        phase: 'planning',
        buckets: [{ id: 'b2', title: 'Main', target: 5000, amount: 1000, notes: '', links: [] }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetDate: '',
        completionDate: ''
      }
    ] as any;

    const comp = Object.create(FireEmergenciesComponent.prototype);
    comp.searchTextField = 'emer';
    comp.search();

    expect(FireEmergenciesComponent.isSearched).toBe(true);
    expect(FireEmergenciesComponent.allSearchedFireEmergencies[0].isFiltered).toBe(true);
    expect(FireEmergenciesComponent.allSearchedFireEmergencies[1].isFiltered).toBe(false);
  });

  it('search should support comma-separated terms', () => {
    AppStateService.instance.allFireEmergencies = [
      {
        title: 'Emergency Fund',
        phase: 'saving',
        buckets: [{ id: 'b1', title: 'Main', target: 10000, amount: 2500, notes: '', links: [] }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetDate: '',
        completionDate: ''
      },
      {
        title: 'Medical',
        phase: 'planning',  
        buckets: [{ id: 'b2', title: 'Main', target: 5000, amount: 1000, notes: '', links: [] }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetDate: '',
        completionDate: ''
      }
    ] as any;

    const comp = Object.create(FireEmergenciesComponent.prototype);
    comp.searchTextField = 'emer,med';
    comp.search();

    expect(FireEmergenciesComponent.allSearchedFireEmergencies[0].isFiltered).toBe(true);
    expect(FireEmergenciesComponent.allSearchedFireEmergencies[1].isFiltered).toBe(true);
  });

  it('clearSearch should reset isSearched and searchTextField', () => {
    FireEmergenciesComponent.isSearched = true;
    const comp = Object.create(FireEmergenciesComponent.prototype);
    comp.searchTextField = 'test';
    comp.clearSearch();
    expect(comp.searchTextField).toBe('');
    expect(FireEmergenciesComponent.isSearched).toBe(false);
  });
});
