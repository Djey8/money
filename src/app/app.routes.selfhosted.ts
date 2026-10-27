import { Routes } from '@angular/router';
import { baseRoutes } from './app.routes.base';
import { tablesTexts } from './tables/tables.texts';
import { leaderboardTexts } from './tables/leaderboard.texts';

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
    // The Cashflow game manual: the game itself is self-hosted only (its printed content is not in the
    // Firebase build), so its manual is too.
    path: 'docs/cashflow',
    loadComponent: () =>
      import('./docs/cashflow/cashflow-docs.component').then((m) => m.CashflowDocsComponent),
  },
  {
    // The Dreamfund (Traumtopf) guide, with the statistics of the characters: self-hosted only like the game.
    path: 'docs/dreamfund',
    loadComponent: () =>
      import('./docs/dreamfund/dreamfund-docs.component').then((m) => m.DreamfundDocsComponent),
  },
  {
    path: 'settings/tokens',
    loadComponent: () =>
      import('./panels/settings/personal-access-tokens/personal-access-tokens.component').then(
        (m) => m.PersonalAccessTokensComponent,
      ),
  },
  {
    // Multiplayer Cashflow tables (game accounts only; the backend refuses any other account).
    path: 'tables',
    // The menu of a game account lists this (panels/menu gameMenuEntries); the words are the tables' own, not i18n JSON.
    data: { gameMenu: { icon: '👥', label: (lang: string) => tablesTexts(lang).title } },
    loadComponent: () =>
      import('./tables/tables-lobby.component').then((m) => m.TablesLobbyComponent),
  },
  {
    // The leaderboard: a page of its own (todo/cashflow-leaderboard.md); also in the menu of a game account.
    path: 'leaderboard',
    data: { gameMenu: { icon: '🏆', label: (lang: string) => leaderboardTexts(lang).title } },
    loadComponent: () =>
      import('./tables/tables-leaderboard-page.component').then(
        (m) => m.TablesLeaderboardPageComponent,
      ),
  },
  {
    path: 'tables/:id',
    loadComponent: () =>
      import('./tables/table-room-switch.component').then((m) => m.TableRoomSwitchComponent),
  },
];
