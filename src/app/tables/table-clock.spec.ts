import { bankSeconds, clockReading, formatClock } from './table-clock';
import { TurnAlert } from './table-turn-alert';

const view = (over: Record<string, unknown> = {}, clock: Record<string, unknown> = {}) =>
  ({
    activeSeat: 0,
    settings: { clock: { mode: 'per-move', secondsPerMove: 60 } },
    clock: { deadlineAt: null, pausedAt: null, banksMs: [], timeouts: [], ...clock },
    ...over,
  }) as never;

describe('formatClock', () => {
  it('shows minutes and seconds, hours when long', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

describe('clockReading', () => {
  it('counts down to the server deadline and fills a bar by the per-move allowance', () => {
    const r = clockReading(view({}, { deadlineAt: 1_030_000 }), 1_000_000);
    expect(r).toEqual({ secondsLeft: 30, fraction: 0.5, low: false });
  });

  it('is low in the last ten seconds and never below zero', () => {
    expect(clockReading(view({}, { deadlineAt: 1_005_000 }), 1_000_000).low).toBe(true);
    expect(clockReading(view({}, { deadlineAt: 1_000_000 }), 1_002_000).secondsLeft).toBe(0);
  });

  it('shows nothing without a deadline (no clock, paused, nobody on the move)', () => {
    expect(clockReading(view(), 0)).toEqual({ secondsLeft: null, fraction: null, low: false });
  });

  it('a daily clock has a bar too, over hours', () => {
    const v = view(
      { settings: { clock: { mode: 'daily', hoursPerMove: 24 } } },
      { deadlineAt: 43_200_000 },
    );
    expect(clockReading(v, 0).fraction).toBe(0.5);
  });
});

describe('bankSeconds', () => {
  const bank = view(
    { settings: { clock: { mode: 'bank', bankSeconds: 600, incrementSeconds: 0 } } },
    { deadlineAt: 1_090_000, banksMs: [120_000, 300_000] },
  );

  it('the player on the move is running down their bank; the others show what is stored', () => {
    expect(bankSeconds(bank, 0, 1_000_000)).toBe(90);
    expect(bankSeconds(bank, 1, 1_000_000)).toBe(300);
  });

  it('is nothing at the other clocks', () => {
    expect(bankSeconds(view(), 0, 0)).toBeNull();
  });
});

describe('TurnAlert', () => {
  class FakeNotification {
    static permission: NotificationPermission = 'granted';
    static made: FakeNotification[] = [];
    closed = false;
    constructor(
      public title: string,
      public options?: { body?: string },
    ) {
      FakeNotification.made.push(this);
    }
    close() {
      this.closed = true;
    }
    static requestPermission() {
      return Promise.resolve('granted' as NotificationPermission);
    }
  }
  const make = (hidden: boolean) => {
    const document = { title: 'Money', hidden };
    FakeNotification.made = [];
    return { document, alert: new TurnAlert({ document, Notification: FakeNotification }) };
  };

  it('marks the tab title on my turn and restores it afterwards', () => {
    const { document, alert } = make(false);
    alert.turnStarted('Your turn', 'Friday');
    expect(document.title).toBe('● Your turn - Money');
    alert.turnStarted('Your turn', 'Friday');
    expect(document.title).toBe('● Your turn - Money'); // not stacked
    alert.turnEnded();
    expect(document.title).toBe('Money');
  });

  it('notifies only when allowed and the page is hidden', () => {
    const hidden = make(true);
    hidden.alert.turnStarted('Your turn', 'Friday');
    expect(FakeNotification.made).toHaveLength(1);
    hidden.alert.turnEnded();
    expect(FakeNotification.made[0].closed).toBe(true);

    const visible = make(false);
    visible.alert.turnStarted('Your turn', 'Friday');
    expect(FakeNotification.made).toHaveLength(0);

    FakeNotification.permission = 'denied';
    const denied = make(true);
    denied.alert.turnStarted('Your turn', 'Friday');
    expect(FakeNotification.made).toHaveLength(0);
    FakeNotification.permission = 'granted';
  });

  it('asks only when the player has not answered, and only on request', async () => {
    FakeNotification.permission = 'default';
    const { alert } = make(false);
    expect(alert.canAsk).toBe(true);
    expect(await alert.ask()).toBe(true);
    FakeNotification.permission = 'granted';
    expect(alert.canAsk).toBe(false);
  });

  it('works in a browser without notifications', () => {
    const document = { title: 'Money', hidden: true };
    const alert = new TurnAlert({ document });
    expect(alert.canAsk).toBe(false);
    alert.turnStarted('Your turn', 'x');
    alert.turnEnded();
    expect(document.title).toBe('Money');
  });
});
