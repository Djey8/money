import { DreamDemoService } from './demo-guide.service';

describe('DreamDemoService', () => {
  beforeEach(() => sessionStorage.clear());

  it('starts at the first step and remembers where it is across a reload', () => {
    const demo = new DreamDemoService();
    expect(demo.active()).toBe(false);
    demo.start();
    demo.goTo(4);
    const again = new DreamDemoService();
    expect(again.active()).toBe(true);
    expect(again.index()).toBe(4);
  });

  it('takes up a table that is the demo, and forgets everything on stop', () => {
    const demo = new DreamDemoService();
    demo.adopt('room-1');
    expect(demo.active()).toBe(true);
    expect(demo.roomId()).toBe('room-1');
    demo.stop();
    expect(demo.active()).toBe(false);
    expect(new DreamDemoService().active()).toBe(false);
  });
});
