import { DemoGuideHook } from '../../shared/demo-guide-hook';
import { DreamDemoGuideComponent } from './demo-guide.component';
import { DreamDemoService } from './demo-guide.service';

/** Hangs the coach into the app shell (the app draws it on every page while it is on). */
export function registerDemoGuide(demo: DreamDemoService): void {
  DemoGuideHook.component = DreamDemoGuideComponent;
  DemoGuideHook.on = () => demo.active();
}
