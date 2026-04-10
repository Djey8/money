import { InfoSmileComponent } from './info-smile.component';
import { AppStateService } from '../../../shared/services/app-state.service';
import { Smile } from '../../../interfaces/smile';

describe('InfoSmileComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoSmileComponent.index = 1;
    InfoSmileComponent.title = 'Driver Licence';
    InfoSmileComponent.isInfo = false;
  });

  it('setInfoSmileComponent should set all static fields', () => {
    const testProject: Smile = {
      title: 'Vacation',
      sub: '',
      phase: 'planning',
      description: '',
      buckets: [
        { id: 'bucket_1', title: 'Vacation', target: 5000, amount: 1200, notes: '', links: [] }
      ],
      links: [],
      actionItems: [],
      notes: [],
      createdAt: '',
      updatedAt: '',
      targetDate: '',
      completionDate: ''
    };
    
    InfoSmileComponent.setInfoSmileComponent(2, testProject);

    expect(InfoSmileComponent.index).toBe(2);
    expect(InfoSmileComponent.title).toBe('Vacation');
    expect(InfoSmileComponent.buckets.length).toBe(1);
    expect(InfoSmileComponent.buckets[0].target).toBe(5000);
    expect(InfoSmileComponent.buckets[0].amount).toBe(1200);
    expect(InfoSmileComponent.isInfo).toBe(true);
  });

  it('setInfoSmileComponent should enable isInfo', () => {
    const testProject: Smile = {
      title: 'Test',
      sub: '',
      phase: 'planning',
      description: '',
      buckets: [
        { id: 'bucket_1', title: 'Test', target: 100, amount: 50, notes: '', links: [] }
      ],
      links: [],
      actionItems: [],
      notes: [],
      createdAt: '',
      updatedAt: '',
      targetDate: '',
      completionDate: ''
    };
    
    InfoSmileComponent.isInfo = false;
    InfoSmileComponent.setInfoSmileComponent(0, testProject);
    expect(InfoSmileComponent.isInfo).toBe(true);
  });
});
