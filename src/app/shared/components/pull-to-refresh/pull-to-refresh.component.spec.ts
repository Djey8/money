import { PullToRefreshComponent } from './pull-to-refresh.component';

/**
 * Pull-to-refresh must NEVER reload on a pinch or any two-finger gesture (JFK, 2026-10-05: "never ever").
 * This protection was lost once already in a merge conflict resolution - these tests keep it from
 * disappearing silently again.
 */
describe('PullToRefreshComponent', () => {
  let component: PullToRefreshComponent;
  let reload: jest.Mock;

  const touch = (x: number, y: number) => ({ clientX: x, clientY: y });
  function fire(type: string, touches: { clientX: number; clientY: number }[], target?: Element) {
    const event: any = new Event(type, { bubbles: true });
    event.touches = touches;
    (target ?? document.body).dispatchEvent(event);
  }

  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    const zone: any = {
      runOutsideAngular: (fn: () => void) => fn(),
      run: (fn: () => void) => fn(),
    };
    component = new PullToRefreshComponent(zone);
    reload = jest.fn();
    (component as any).reload = reload;
    component.ngOnInit();
  });

  afterEach(() => component.ngOnDestroy());

  it('reloads on a deliberate single-finger pull down from the top', () => {
    fire('touchstart', [touch(100, 100)]);
    fire('touchmove', [touch(100, 130)]);
    fire('touchmove', [touch(100, 200)]);
    fire('touchend', []);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads when a gesture starts with two fingers (pinch)', () => {
    fire('touchstart', [touch(100, 100), touch(200, 100)]);
    fire('touchmove', [touch(100, 300), touch(200, 300)]);
    fire('touchend', []);

    expect(reload).not.toHaveBeenCalled();
  });

  it('never reloads when a second finger lands during a pull', () => {
    fire('touchstart', [touch(100, 100)]);
    fire('touchmove', [touch(100, 140)]);
    fire('touchmove', [touch(100, 220), touch(200, 220)]);
    fire('touchmove', [touch(100, 300)]);
    fire('touchend', []);

    expect(reload).not.toHaveBeenCalled();
    expect(component.pulling).toBe(false);
  });

  it('never reloads after a pinch even if one finger keeps moving down', () => {
    fire('touchstart', [touch(100, 100)]);
    fire('touchmove', [touch(100, 120), touch(220, 120)]);
    fire('touchmove', [touch(100, 400)]);
    fire('touchend', []);

    expect(reload).not.toHaveBeenCalled();
  });

  it('never reloads when the gesture starts on an input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    fire('touchstart', [touch(100, 100)], input);
    fire('touchmove', [touch(100, 300)]);
    fire('touchend', []);
    input.remove();

    expect(reload).not.toHaveBeenCalled();
  });

  it('never reloads from a scrolled page, a horizontal swipe or an upward move', () => {
    Object.defineProperty(window, 'scrollY', { value: 50, configurable: true });
    fire('touchstart', [touch(100, 100)]);
    fire('touchmove', [touch(100, 300)]);
    fire('touchend', []);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });

    fire('touchstart', [touch(100, 100)]);
    fire('touchmove', [touch(220, 140)]);
    fire('touchmove', [touch(220, 300)]);
    fire('touchend', []);

    fire('touchstart', [touch(100, 100)]);
    fire('touchmove', [touch(100, 60)]);
    fire('touchmove', [touch(100, 300)]);
    fire('touchend', []);

    expect(reload).not.toHaveBeenCalled();
  });

  it('a cancelled touch leaves nothing behind that a later tap could finish', () => {
    fire('touchstart', [touch(100, 100)]);
    fire('touchmove', [touch(100, 200)]);
    fire('touchcancel', []);
    fire('touchend', []);

    expect(reload).not.toHaveBeenCalled();
    expect(component.pulling).toBe(false);
  });
});
