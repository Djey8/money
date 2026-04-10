import { SmileProjectsComponent } from './smile-projects.component';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('SmileProjectsComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    SmileProjectsComponent.isSearched = false;
    SmileProjectsComponent.allSearchedSmileProjects = [];
  });

  it('allSmileProjects should delegate getter/setter to AppStateService', () => {
    AppStateService.instance.allSmileProjects = [{
      title: 'Vacation',
      sub: '',
      phase: 'saving',
      description: '',
      buckets: [{ id: 'bucket_1', title: 'Vacation', target: 5000, amount: 1200, notes: '', links: [] }],
      links: [],
      actionItems: [],
      notes: [],
      createdAt: '',
      updatedAt: '',
      targetDate: '',
      completionDate: ''
    }];
    expect(SmileProjectsComponent.allSmileProjects).toHaveLength(1);
    expect(SmileProjectsComponent.allSmileProjects[0].title).toBe('Vacation');

    SmileProjectsComponent.allSmileProjects = [];
    expect(AppStateService.instance.allSmileProjects).toHaveLength(0);
  });

  it('search should filter smile projects by title', () => {
    AppStateService.instance.allSmileProjects = [
      {
        title: 'Vacation',
        sub: '',
        phase: 'saving',
        description: '',
        buckets: [{ id: 'bucket_1', title: 'Vacation', target: 5000, amount: 1200, notes: '', links: [] }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '',
        updatedAt: '',
        targetDate: '',
        completionDate: ''
      },
      {
        title: 'Car',
        sub: '',
        phase: 'planning',
        description: '',
        buckets: [{ id: 'bucket_1', title: 'Car', target: 15000, amount: 3000, notes: '', links: [] }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '',
        updatedAt: '',
        targetDate: '',
        completionDate: ''
      },
      {
        title: 'Laptop',
        sub: '',
        phase: 'planning',
        description: '',
        buckets: [{ id: 'bucket_1', title: 'Laptop', target: 2000, amount: 500, notes: '', links: [] }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '',
        updatedAt: '',
        targetDate: '',
        completionDate: ''
      },
    ];

    const comp = Object.create(SmileProjectsComponent.prototype);
    comp.searchTextField = 'vac';
    comp.search();

    expect(SmileProjectsComponent.isSearched).toBe(true);
    expect(SmileProjectsComponent.allSearchedSmileProjects).toHaveLength(3);
    expect((SmileProjectsComponent.allSearchedSmileProjects[0] as any).isFiltered).toBe(true);
    expect((SmileProjectsComponent.allSearchedSmileProjects[1] as any).isFiltered).toBe(false);
    expect((SmileProjectsComponent.allSearchedSmileProjects[2] as any).isFiltered).toBe(false);
  });

  it('search should filter by amount and target strings', () => {
    AppStateService.instance.allSmileProjects = [
      {
        title: 'A',
        sub: '',
        phase: 'saving',
        description: '',
        buckets: [{ id: 'bucket_1', title: 'A', target: 5000, amount: 1200, notes: '', links: [] }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '',
        updatedAt: '',
        targetDate: '',
        completionDate: ''
      },
      {
        title: 'B',
        sub: '',
        phase: 'planning',
        description: '',
        buckets: [{ id: 'bucket_1', title: 'B', target: 200, amount: 50, notes: '', links: [] }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '',
        updatedAt: '',
        targetDate: '',
        completionDate: ''
      },
    ];

    const comp = Object.create(SmileProjectsComponent.prototype);
    comp.searchTextField = '5000';
    comp.search();

    expect((SmileProjectsComponent.allSearchedSmileProjects[0] as any).isFiltered).toBe(true);
    expect((SmileProjectsComponent.allSearchedSmileProjects[1] as any).isFiltered).toBe(false);
  });

  it('search should support comma-separated terms', () => {
    AppStateService.instance.allSmileProjects = [
      {
        title: 'Vacation',
        sub: '',
        phase: 'saving',
        description: '',
        buckets: [{ id: 'bucket_1', title: 'Vacation', target: 5000, amount: 1200, notes: '', links: [] }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '',
        updatedAt: '',
        targetDate: '',
        completionDate: ''
      },
      {
        title: 'Car',
        sub: '',
        phase: 'planning',
        description: '',
        buckets: [{ id: 'bucket_1', title: 'Car', target: 15000, amount: 3000, notes: '', links: [] }],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '',
        updatedAt: '',
        targetDate: '',
        completionDate: ''
      },
    ];

    const comp = Object.create(SmileProjectsComponent.prototype);
    comp.searchTextField = 'vac,car';
    comp.search();

    expect((SmileProjectsComponent.allSearchedSmileProjects[0] as any).isFiltered).toBe(true);
    expect((SmileProjectsComponent.allSearchedSmileProjects[1] as any).isFiltered).toBe(true);
  });

  it('clearSearch should reset isSearched and searchTextField', () => {
    SmileProjectsComponent.isSearched = true;
    const comp = Object.create(SmileProjectsComponent.prototype);
    comp.searchTextField = 'test';
    comp.clearSearch();
    expect(comp.searchTextField).toBe('');
    expect(SmileProjectsComponent.isSearched).toBe(false);
  });
});
