import { Component, ViewEncapsulation } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DemoService } from '../../shared/services/demo.service';

// Deferred import to break circular chain
let AppComponent: any;
setTimeout(() => import('src/app/app.component').then((m) => (AppComponent = m.AppComponent)));

/**
 * Pro-only page: how to use the self-hosted Pro API and connect an AI
 * assistant (Claude) to it via MCP. Self-hosted only — excluded from the
 * Firebase build at the route-registration level (docs/adr/0004), not by a
 * runtime check, since the Firebase edition ships no Pro code at all.
 */
@Component({
  selector: 'app-api-docs',
  standalone: true,
  imports: [RouterLink, TranslateModule, NgClass],
  templateUrl: './api-docs.component.html',
  styleUrls: [
    './api-docs.component.css',
    '../docs.component.css',
    '../selfhosted/selfhosted-docs.component.css',
    '../../landing/landing-page.component.css',
    '../../app.component.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class ApiDocsComponent {
  copiedSnippet: string | null = null;
  private copyTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private demoService: DemoService,
    private translate: TranslateService,
    private router: Router,
  ) {
    const saved = localStorage.getItem('landingLang');
    if (saved) {
      this.translate.use(saved);
    }
  }

  get appReference() {
    return AppComponent;
  }

  closeNav(): void {
    const toggle = document.getElementById('nav-toggle') as HTMLInputElement;
    if (toggle) {
      toggle.checked = false;
    }
  }

  launchDemo(): void {
    this.demoService.startDemo();
  }

  navigateToSection(sectionId: string): void {
    this.router.navigateByUrl('/').then(() => {
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
  }

  copyToClipboard(text: string, id: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copiedSnippet = id;
      clearTimeout(this.copyTimeout);
      this.copyTimeout = setTimeout(() => (this.copiedSnippet = null), 2000);
    });
  }
}
