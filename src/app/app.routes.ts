import { Routes } from '@angular/router';
import { baseRoutes } from './app.routes.base';

// Firebase-edition route table — no Pro routes. The selfhosted build swaps
// this whole file out for app.routes.selfhosted.ts via angular.json's
// fileReplacements (same mechanism environment.ts already uses).
//
// A dynamic array-spread on `environment.edition` was tried first and
// confirmed NOT to work: esbuild still emitted the Pro chunk's code into
// the Firebase bundle even though the ternary always resolved to `[]` at
// runtime — dead-code elimination doesn't reach through a conditional
// route-array spread the way it does a whole swapped-out file. See
// docs/adr/0004-edition-separation-mechanism.md.
export const routes: Routes = baseRoutes;
