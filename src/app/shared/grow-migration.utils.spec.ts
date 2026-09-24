import { migrateGrow } from './grow-migration.utils';

describe('migrateGrow', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('keeps the backend-assigned id so the next save does not drop it', () => {
    expect(migrateGrow({ id: 'grow_abc', title: 'SOL' }).id).toBe('grow_abc');
  });

  it('leaves id undefined for a project that was never saved to the backend', () => {
    expect(migrateGrow({ title: 'Local only' }).id).toBeUndefined();
  });
});
