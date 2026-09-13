import { Routes } from '@angular/router';
import { baseRoutes } from './app.routes.base';

// Selfhosted-edition route table: the shared base routes plus Pro-only
// routes. Swapped in for app.routes.ts via angular.json's fileReplacements
// on the `selfhosted`/`e2e` build configurations — the same mechanism
// environment.ts already uses — so the Pro route (and everything it lazily
// imports) is only ever compiled into the selfhosted bundle in the first
// place, rather than relying on a runtime/ternary check to keep it out of
// the Firebase build after the fact. See
// docs/adr/0004-edition-separation-mechanism.md.
export const routes: Routes = [
  ...baseRoutes,
  {
    path: 'docs/api',
    loadComponent: () => import('./docs/api/api-docs.component').then((m) => m.ApiDocsComponent),
  },
  {
    path: 'settings/tokens',
    loadComponent: () =>
      import('./panels/settings/personal-access-tokens/personal-access-tokens.component').then(
        (m) => m.PersonalAccessTokensComponent,
      ),
  },
];
