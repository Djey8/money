import { TestBed } from '@angular/core/testing';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [OutboxService] });
  });

  function createService(): OutboxService {
    return TestBed.inject(OutboxService);
  }

  it('starts empty after ready()', async () => {
    const svc = createService();
    await svc.ready();
    expect(svc.list()).toEqual([]);
    expect(svc.pendingCount()).toBe(0);
    expect(svc.hasPending()).toBe(false);
  });

  it('enqueue() adds an entry with metadata', async () => {
    const svc = createService();
    await svc.ready();
    const entry = await svc.enqueue('transactions', [{ id: 1 }]);
    expect(entry.id).toBeTruthy();
    expect(entry.tag).toBe('transactions');
    expect(entry.attempts).toBe(0);
    expect(typeof entry.clientUpdatedAt).toBe('string');
    expect(svc.pendingCount()).toBe(1);
  });

  it('enqueue() replaces an older entry for the same tag', async () => {
    const svc = createService();
    await svc.ready();
    const first = await svc.enqueue('transactions', [{ v: 1 }]);
    const second = await svc.enqueue('transactions', [{ v: 2 }]);
    const list = svc.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(second.id);
    expect(list[0].id).not.toBe(first.id);
    expect(list[0].data).toEqual([{ v: 2 }]);
  });

  it('enqueue() keeps separate entries for different tags', async () => {
    const svc = createService();
    await svc.ready();
    await svc.enqueue('transactions', []);
    await svc.enqueue('income/expenses/daily', []);
    expect(svc.pendingCount()).toBe(2);
  });

  it('remove() drops a single entry', async () => {
    const svc = createService();
    await svc.ready();
    const a = await svc.enqueue('a', 1);
    await svc.enqueue('b', 2);
    await svc.remove(a.id);
    expect(svc.pendingCount()).toBe(1);
    expect(svc.list()[0].tag).toBe('b');
  });

  it('clear() empties the queue', async () => {
    const svc = createService();
    await svc.ready();
    await svc.enqueue('a', 1);
    await svc.enqueue('b', 2);
    await svc.clear();
    expect(svc.pendingCount()).toBe(0);
  });

  it('persists entries across service instances (fallback storage)', async () => {
    const svc1 = createService();
    await svc1.ready();
    await svc1.enqueue('transactions', [{ v: 1 }]);

    // Re-create the injector so a fresh OutboxService is constructed.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [OutboxService] });
    const svc2 = TestBed.inject(OutboxService);
    await svc2.ready();
    expect(svc2.pendingCount()).toBe(1);
    expect(svc2.list()[0].tag).toBe('transactions');
    expect(svc2.list()[0].data).toEqual([{ v: 1 }]);
  });

  it('pendingCount$ emits when entries change', async () => {
    const svc = createService();
    await svc.ready();
    const seen: number[] = [];
    const sub = svc.pendingCount$.subscribe(v => seen.push(v));
    await svc.enqueue('a', 1);
    await svc.enqueue('b', 2);
    await svc.remove(svc.list()[0].id);
    sub.unsubscribe();
    // Initial 0, then 1, 2, 1 (and possibly intermediate values from replace logic — assert
    // we observed the key milestones rather than the exact sequence).
    expect(seen[0]).toBe(0);
    expect(seen).toContain(1);
    expect(seen).toContain(2);
    expect(seen[seen.length - 1]).toBe(1);
  });
});
