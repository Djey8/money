import { InfoFireComponent } from './info-fire.component';
import { AppStateService } from '../../../shared/services/app-state.service';
import { Fire } from '../../../interfaces/fire';

describe('InfoFireComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoFireComponent.index = 1;
    InfoFireComponent.title = 'Driver Licence';
    InfoFireComponent.buckets = [{ id: 'b1', title: 'Main', target: 200.0, amount: 0.0, notes: '', links: [] }];
    InfoFireComponent.phase = 'saving';
    InfoFireComponent.isInfo = false;
  });

  it('setInfoFireComponent should set all static fields from Fire object', () => {
    const fire: Fire = {
      title: 'Emergency Fund',
      sub: 'General savings',
      phase: 'saving',
      description: 'Emergency fund for unexpected expenses',
      buckets: [
        { id: 'b1', title: 'Main', target: 10000, amount: 2500, notes: '', links: [] }
      ],
      links: [],
      actionItems: [],
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetDate: '',
      completionDate: ''
    };

    InfoFireComponent.setInfoFireComponent(3, fire);

    expect(InfoFireComponent.index).toBe(3);
    expect(InfoFireComponent.title).toBe('Emergency Fund');
    expect(InfoFireComponent.sub).toBe('General savings');
    expect(InfoFireComponent.phase).toBe('saving');
    expect(InfoFireComponent.buckets).toHaveLength(1);
    expect(InfoFireComponent.buckets[0].target).toBe(10000);
    expect(InfoFireComponent.buckets[0].amount).toBe(2500);
    expect(InfoFireComponent.isInfo).toBe(true);
  });

  it('setInfoFireComponent should enable isInfo', () => {
    const fire: Fire = {
      title: 'Rainy Day',
      sub: '',
      description: '',
      phase: 'planning',
      buckets: [{ id: 'b1', title: 'Main', target: 500, amount: 100, notes: '', links: [] }],
      links: [],
      actionItems: [],
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetDate: '',
      completionDate: ''
    };
    
    InfoFireComponent.isInfo = false;
    InfoFireComponent.setInfoFireComponent(0, fire);
    expect(InfoFireComponent.isInfo).toBe(true);
  });
});
