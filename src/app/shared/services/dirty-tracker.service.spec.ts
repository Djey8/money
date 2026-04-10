import { DirtyTrackerService } from './dirty-tracker.service';

describe('DirtyTrackerService', () => {
  let service: DirtyTrackerService;

  beforeEach(() => {
    service = new DirtyTrackerService();
  });

  // --- dirty tags ---------------------------------------------------------

  describe('markDirty() / isDirty() / markClean()', () => {
    it('reports tag as not dirty initially', () => {
      expect(service.isDirty('transactions')).toBe(false);
    });

    it('marks tag as dirty', () => {
      service.markDirty('transactions');
      expect(service.isDirty('transactions')).toBe(true);
    });

    it('marks tag as clean', () => {
      service.markDirty('budget');
      service.markClean('budget');
      expect(service.isDirty('budget')).toBe(false);
    });

    it('does not affect other tags', () => {
      service.markDirty('a');
      service.markDirty('b');
      service.markClean('a');
      expect(service.isDirty('a')).toBe(false);
      expect(service.isDirty('b')).toBe(true);
    });
  });

  describe('getDirtyTags()', () => {
    it('returns empty array initially', () => {
      expect(service.getDirtyTags()).toEqual([]);
    });

    it('returns all dirty tags', () => {
      service.markDirty('a');
      service.markDirty('b');
      expect(service.getDirtyTags().sort()).toEqual(['a', 'b']);
    });
  });

  describe('clearAll()', () => {
    it('removes all dirty flags', () => {
      service.markDirty('a');
      service.markDirty('b');
      service.clearAll();
      expect(service.getDirtyTags()).toEqual([]);
    });
  });

  // --- snapshots ----------------------------------------------------------

  describe('takeSnapshot() / hasChanged()', () => {
    it('returns true when no snapshot exists', () => {
      expect(service.hasChanged('x', { a: 1 })).toBe(true);
    });

    it('returns false when data matches snapshot', () => {
      const data = { a: 1, b: [2, 3] };
      service.takeSnapshot('x', data);
      expect(service.hasChanged('x', { a: 1, b: [2, 3] })).toBe(false);
    });

    it('returns true when data differs from snapshot', () => {
      service.takeSnapshot('x', { a: 1 });
      expect(service.hasChanged('x', { a: 2 })).toBe(true);
    });

    it('detects array changes', () => {
      service.takeSnapshot('arr', [1, 2, 3]);
      expect(service.hasChanged('arr', [1, 2, 3])).toBe(false);
      expect(service.hasChanged('arr', [1, 2, 4])).toBe(true);
    });
  });

  describe('clearSnapshot()', () => {
    it('causes hasChanged to return true after clearing', () => {
      service.takeSnapshot('x', 'data');
      service.clearSnapshot('x');
      expect(service.hasChanged('x', 'data')).toBe(true);
    });
  });
});
