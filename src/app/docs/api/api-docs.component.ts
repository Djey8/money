import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

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
  imports: [RouterLink],
  templateUrl: './api-docs.component.html',
  styleUrls: [
    './api-docs.component.css',
    '../docs.component.css',
    '../../landing/landing-page.component.css',
    '../../app.component.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class ApiDocsComponent {
  get appReference() {
    return AppComponent;
  }

  closeNav(): void {
    const toggle = document.getElementById('nav-toggle') as HTMLInputElement;
    if (toggle) {
      toggle.checked = false;
    }
  }
}
