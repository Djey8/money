# Migration Guide: Angular 15 → 19 + Node.js 18 → 22 LTS

> **Prepared:** April 9, 2026  
> **Current Stack:** Angular 15.2 · TypeScript 4.9 · Node 18 (Docker) / 22 (local) · Express 4.18  
> **Target Stack:** Angular 19.2 · TypeScript 5.7 · Node 22 LTS · Express 4.21  
> **Risk Level:** MEDIUM — Incremental path exists, no data-layer changes required

---

## Table of Contents

1. [Current State Audit](#1-current-state-audit)
2. [Target Versions & Rationale](#2-target-versions--rationale)
3. [Is It Safe to Upgrade?](#3-is-it-safe-to-upgrade)
4. [What Can Break](#4-what-can-break)
5. [Pre-Migration Checklist](#5-pre-migration-checklist)
6. [Phase 1: Backend Migration (Node.js + Express)](#phase-1-backend-migration-nodejs--express)
7. [Phase 2: Angular 15 → 16](#phase-2-angular-15--16)
8. [Phase 3: Angular 16 → 17](#phase-3-angular-16--17)
9. [Phase 4: Angular 17 → 18](#phase-4-angular-17--18)
10. [Phase 5: Angular 18 → 19](#phase-5-angular-18--19)
11. [Phase 6: Post-Migration Cleanup](#phase-6-post-migration-cleanup)
12. [Firebase-Specific Considerations](#firebase-specific-considerations)
13. [Self-Hosted / Docker / K8s Considerations](#self-hosted--docker--k8s-considerations)
14. [Testing Strategy](#testing-strategy)
15. [Rollback Plan](#rollback-plan)

---

## 1. Current State Audit

### Frontend (`package.json`)

| Package | Current Version | Notes |
|---------|----------------|-------|
| `@angular/core` | `^15.2.0` | 4 majors behind |
| `@angular/material` | `~15.2.9` | Must match Angular version |
| `@angular/cdk` | `~15.2.9` | Must match Angular version |
| `@angular/fire` | `^7.6.1` | Uses **compat** API (deprecated) |
| `@angular/cli` | `~15.2.7` | Must match Angular version |
| `@angular-devkit/build-angular` | `^15.2.7` | Must match Angular version |
| `@angular-builders/jest` | `^15.0.0` | Must match Angular version |
| `typescript` | `~4.9.4` | Angular 19 needs `>=5.5 <5.9` |
| `zone.js` | `~0.12.0` | Angular 19 needs `~0.15.0` |
| `rxjs` | `~7.8.0` | ✅ Compatible, no change needed |
| `@ngx-translate/core` | `^14.0.0` | Needs update to `^15.0.0` or `^16.0.0` |
| `@ngx-translate/http-loader` | `^7.0.0` | Needs update to `^8.0.0` or `^9.0.0` |
| `jest-preset-angular` | `^13.1.6` | Needs update to `^14.x` |
| `d3` | `^7.8.5` | ✅ No change needed |
| `crypto-js` | `^4.1.1` | ✅ No change needed |
| `tesseract.js` | `^7.0.0` | ✅ No change needed |
| `@capacitor/core` | `^6.0.0` | ✅ Compatible |

### Backend (`backend/package.json`)

| Package | Current Version | Notes |
|---------|----------------|-------|
| `express` | `^4.18.2` | Update to `^4.21.x` (security patches) |
| `helmet` | `^7.0.0` | ✅ Compatible with Node 22 |
| `jsonwebtoken` | `^9.0.2` | ✅ Compatible |
| `nano` (CouchDB) | `^10.1.2` | ✅ Compatible |
| `bcryptjs` | `^2.4.3` | ✅ Pure JS, no native deps |
| `winston` | `^3.11.0` | ✅ Compatible |
| `jest` (backend) | `^30.3.0` | ✅ Already latest |
| `supertest` | `^7.2.2` | ✅ Compatible |

### Architecture Facts

| Aspect | Current State | Impact |
|--------|---------------|--------|
| Bootstrap method | `platformBrowserDynamic().bootstrapModule(AppModule)` | Must migrate to `bootstrapApplication()` |
| `AppComponent` | **NOT standalone** (declared in `AppModule`) | Must make standalone |
| Route components | All use `loadComponent` (standalone) ✅ | Already modern pattern |
| Panel/shared components | Standalone, imported into `AppModule.imports[]` | Remove from module, import where needed |
| `@angular/fire` API | Compat layer (`@angular/fire/compat/*`) | Must migrate to modular API |
| Docker base image | `node:18-alpine` | Update to `node:22-alpine` |
| CouchDB | `3.3` | ✅ No change needed |
| `tsconfig.json` | `target: ES2022`, `module: ES2022` | ✅ Already compatible |
| `useDefineForClassFields` | `false` | Review — Angular 19 defaults to `true` |

---

## 2. Target Versions & Rationale

### Why Angular 19 (not 20 or 21)?

| Factor | Angular 19 | Angular 20/21 |
|--------|-----------|---------------|
| Stability | Mature, 6+ months of patches | 20 is newer, 21 is very new |
| `@angular/fire` support | Compat layer still works (deprecated) | May be removed |
| Migration tooling | `ng update` schematics are battle-tested | Less community migration experience |
| Node.js requirement | `^18.19.1 \|\| ^20.11.1 \|\| ^22.0.0` | `^20.19.0 \|\| ^22.12.0 \|\| ^24.0.0` (drops Node 18) |
| TypeScript | `>=5.5.0 <5.9.0` | `>=5.8.0 <6.0.0` |
| Risk | Lower | Higher |
| Future upgrade to 20 | Incremental, 1 step | — |

**Recommendation:** Migrate to **Angular 19.2.x** now. Upgrade to 20+ later as a small incremental step.

### Why Node 22 LTS (not 24)?

| Factor | Node 22 LTS | Node 24 LTS |
|--------|------------|------------|
| LTS end date | April 2027 | ~April 2028 |
| Angular 19 support | ✅ Yes | ❌ Not listed |
| Express 4.x support | ✅ Fully tested | ✅ Works but less tested |
| npm compatibility | ✅ npm 10.x | npm 11.x (breaking changes possible) |
| Docker `node:22-alpine` | ✅ Mature images | Newer images |
| CouchDB `nano` driver | ✅ Tested | ✅ Should work |

**Recommendation:** Use **Node 22 LTS** for Docker images and CI. Your local dev already runs 22.14.0.

### Target `package.json` Versions Summary

```
@angular/*                  → ^19.2.0
@angular/material           → ^19.2.0
@angular/cdk                → ^19.2.0
@angular/fire               → ^19.0.0 (or ^18.0.0 — check latest)
@angular/cli                → ^19.2.0
@angular-devkit/build-angular → ^19.2.0
@angular-builders/jest      → ^19.0.0
typescript                  → ~5.7.0
zone.js                     → ~0.15.0
@ngx-translate/core         → ^16.0.0
@ngx-translate/http-loader  → ^9.0.0
jest-preset-angular         → ^14.4.0
rxjs                        → ~7.8.0 (no change)
```

---

## 3. Is It Safe to Upgrade?

### ✅ YES — With Conditions

**Safe because:**
1. Your routes already use standalone `loadComponent()` — the hardest migration step is already done
2. Backend is fully independent (CommonJS Node.js) — zero Angular coupling
3. CouchDB and the `nano` driver have no Angular dependency
4. Your data layer (localStorage, Firebase, CouchDB) is abstracted behind services — no direct framework coupling
5. All 656+ tests provide a safety net
6. `ng update` provides automatic schematics for each version step
7. You're already on ES2022 target — no old polyfill dependencies

**Risks that require attention:**
1. `@angular/fire` compat → modular API migration (the biggest single change)
2. `AppModule` → standalone bootstrap (mechanical but touches many files)
3. `zone.js` version bump (0.12 → 0.15, minor behavioral differences)
4. TypeScript 4.9 → 5.7 (stricter type checking may surface hidden type errors)
5. `@angular/material` theme changes between versions

---

## 4. What Can Break

### 🔴 HIGH RISK

| Area | What Breaks | Why | Mitigation |
|------|-------------|-----|------------|
| **`@angular/fire` compat API** | `AngularFireAuth`, `AngularFireDatabase` imports may be removed or broken in `@angular/fire@18+` | Firebase SDK shifted to modular tree-shakeable API | Migrate `auth.service.ts` and `database.service.ts` to modular API |
| **`AppModule` bootstrap** | Angular 19 deprecates `platformBrowserDynamic().bootstrapModule()` | New standard is `bootstrapApplication()` with `app.config.ts` | Refactor `main.ts` + create `app.config.ts` |
| **`AppComponent` not standalone** | Only non-standalone component — blocks standalone bootstrap | Must be declared standalone to use `bootstrapApplication()` | Add `standalone: true`, move imports to component |
| **TypeScript strict mode changes** | TS 5.x may flag errors invisible in 4.9 | Stricter template checking, null safety improvements | Fix incrementally per `ng update` step |

### 🟡 MEDIUM RISK

| Area | What Breaks | Why | Mitigation |
|------|-------------|-----|------------|
| **`@angular/material` theming** | Material 16+ moved to M3 (Material Design 3) theming | CSS custom properties replace `@angular/material/theming` mixins | You use `prebuilt-themes/indigo-pink.css` — check if the theme name changes |
| **`HttpClientModule`** | Deprecated in Angular 18+ in favor of `provideHttpClient()` | Module-based API replaced by functional provider | Move to `provideHttpClient()` in `app.config.ts` |
| **`BrowserModule` / `BrowserAnimationsModule`** | Not needed with standalone bootstrap | Replaced by `provideAnimations()` | Use functional providers |
| **`@angular-builders/jest`** | Major version must match Angular major | Builder API changes between Angular versions | Update to `^19.0.0` |
| **`jest-preset-angular`** | Transform config changes | Angular compiler changes between versions | Update to `^14.x`, adjust `jest.config.js` if needed |
| **`zone.js` 0.12 → 0.15** | Minor patching behavior changes | Some async operations may behave slightly differently | Run full test suite after update |
| **`useDefineForClassFields: false`** | Angular 19 defaults to `true` | Class field initialization order changes | Keep `false` initially, test with `true` later |
| **Deferred component imports (setTimeout pattern)** | Your `app.component.ts` uses `setTimeout(() => import(...))` for lazy panel loading | This pattern works but may interact differently with Angular's new defer blocks | Test all panels open/close after migration |

### 🟢 LOW RISK

| Area | Notes |
|------|-------|
| **`rxjs` 7.8** | Fully compatible with Angular 19 |
| **`d3` 7.x** | No Angular dependency |
| **`crypto-js` 4.x** | Pure JS, no framework coupling |
| **`tesseract.js` 7.x** | WASM-based, no Angular coupling |
| **`@capacitor/core` 6.x** | Independent of Angular version |
| **Backend Express 4.x** | Zero Angular coupling, CommonJS, independent process |
| **CouchDB 3.3** | Database layer, no change needed |
| **Nginx config** | Static file serving, no change |
| **Kubernetes manifests** | Only Docker image tag changes |
| **Playwright E2E tests** | Framework-agnostic, test the browser |

---

## 5. Pre-Migration Checklist

```
[ ] 1. Create a migration branch: git checkout -b migration/angular-19
[ ] 2. Ensure ALL tests pass on current version:
        npm test                    (frontend unit — 656+ tests)
        npm run test:backend:unit   (backend unit)
        npm run test:e2e            (Playwright E2E)
[ ] 3. Commit/stash all uncommitted work
[ ] 4. Back up node_modules (or just delete and reinstall if needed)
[ ] 5. Document current working state:
        ng version                  (Angular CLI version printout)
        node -v && npm -v           (runtime versions)
[ ] 6. Read the Angular Update Guide for each step:
        https://angular.dev/update-guide
[ ] 7. Ensure you have Node 22 LTS installed locally
        (you already have 22.14.0 ✅)
```

---

## Phase 1: Backend Migration (Node.js + Express)

> **Risk: LOW** — Backend is fully independent. CouchDB driver (`nano`) and all dependencies are compatible.  
> **Estimated effort: 1 hour**

The backend uses CommonJS (`require()`), Express 4.x, and has no Angular coupling. This is the safest starting point.

### Step 1.1: Update Docker Base Image

**File: `backend/Dockerfile`**

```dockerfile
# BEFORE
FROM node:18-alpine

# AFTER
FROM node:22-alpine
```

### Step 1.2: Update Frontend Docker Base Image

**File: `Dockerfile`**

```dockerfile
# BEFORE
FROM node:18-alpine as build

# AFTER
FROM node:22-alpine as build
```

### Step 1.3: Update Backend Dependencies

```bash
cd backend
npm update express helmet cors express-rate-limit jsonwebtoken winston nano bcryptjs dotenv
npm update --save-dev jest supertest nodemon
cd ..
```

### Step 1.4: Verify Backend

```bash
cd backend
npm test                          # All unit + integration tests
node -e "require('./server.js')"  # Quick smoke test
cd ..
```

### Step 1.5: Test Docker Build

```bash
docker build -t money-backend-test ./backend
docker build -t money-frontend-test .
```

### Step 1.6: Verify Self-Hosted Stack

```bash
docker-compose up -d
# Test: http://localhost:3000/health → {"status":"ok"}
# Test: http://localhost:80 → Angular app loads
docker-compose down
```

### Backend Compatibility Notes

| Component | Status | Notes |
|-----------|--------|-------|
| `nano` (CouchDB driver) | ✅ | v10.x works on Node 18–24 |
| `express` 4.x | ✅ | Fully supported on Node 22 |
| `bcryptjs` | ✅ | Pure JavaScript, no native bindings |
| `jsonwebtoken` | ✅ | No native deps |
| `winston` | ✅ | v3.x compatible |
| `helmet` | ✅ | v7.x compatible |
| CouchDB 3.3 | ✅ | No change — database is external |
| `require()` / CommonJS | ✅ | Still fully supported in Node 22 |

**No code changes required in the backend.** Only the Docker base image and dependency versions change.

---

## Phase 2: Angular 15 → 16

> **Risk: LOW-MEDIUM**  
> **Key changes:** Standalone APIs promoted, `DestroyRef` introduced, required inputs  
> **Estimated effort: 2–3 hours**

### Step 2.1: Run Angular Update

```bash
# Update Angular CLI globally (if installed globally)
npm install -g @angular/cli@16

# Run the automated migration
ng update @angular/core@16 @angular/cli@16
```

This will:
- Update `@angular/core`, `@angular/compiler`, `@angular/router`, etc. to 16.x
- Update `typescript` to `~5.1.0`
- Run automatic code migration schematics
- Update `angular.json` if needed

### Step 2.2: Update Material & CDK

```bash
ng update @angular/material@16
```

### Step 2.3: Update Supporting Packages

```bash
npm install @angular-builders/jest@16 --save-dev
npm install zone.js@~0.13.0
```

### Step 2.4: Update `@ngx-translate`

```bash
npm install @ngx-translate/core@15 @ngx-translate/http-loader@8
```

Check `app.module.ts` — the `TranslateModule.forRoot()` config should still work unchanged.

### Step 2.5: Update Jest Preset

```bash
npm install jest-preset-angular@14 --save-dev
```

### Step 2.6: Verify — Must Pass Before Proceeding

```bash
npm test                    # Frontend unit tests (all 656+)
npm start                   # Dev server starts without errors
# Manually test: login, add transaction, navigate all routes
```

### Angular 16 Breaking Changes to Watch For

| Change | Impact on This Project |
|--------|----------------------|
| `DestroyRef` introduced | No action needed — `OnDestroy` still works |
| `takeUntilDestroyed()` available | Optional improvement, not required |
| Required inputs (experimental) | Won't affect existing code |
| `esbuild` builder available (opt-in) | Don't switch yet — stay on Webpack |
| Node 16 dropped | You're on Node 22 ✅ |

---

## Phase 3: Angular 16 → 17

> **Risk: MEDIUM** — New control flow syntax, deferrable views  
> **Estimated effort: 2–3 hours**

### Step 3.1: Run Angular Update

```bash
ng update @angular/core@17 @angular/cli@17
ng update @angular/material@17
```

### Step 3.2: Update Supporting Packages

```bash
npm install @angular-builders/jest@17 --save-dev
npm install zone.js@~0.14.0
```

### Step 3.3: TypeScript Update

Angular 17 requires `typescript >=5.2.0 <5.5.0`. The `ng update` schematic will set this automatically.

### Step 3.4: Automatic Migrations

Angular 17 schematics will:
- Suggest migrating `*ngIf` → `@if`, `*ngFor` → `@for` in templates (optional but recommended)
- These are **automatic** — the CLI asks during `ng update`
- **Accept the migrations** — they work reliably

### Step 3.5: Verify

```bash
npm test
npm start
```

### Angular 17 Breaking Changes to Watch For

| Change | Impact on This Project |
|--------|----------------------|
| New control flow (`@if`, `@for`, `@switch`) | Automatic migration available — accept it |
| `@defer` blocks | New feature, does not break existing code |
| Vite/esbuild as default for new projects | Existing projects stay on Webpack unless you opt in |
| `@angular/material` M3 theming | Prebuilt themes still work but names may change |
| Application builder changes | Your `"builder": "@angular-devkit/build-angular:browser"` still works |

### ⚠️ Material Theme Check

After updating `@angular/material@17`, verify the prebuilt theme path in `angular.json`:

```json
// Current:
"styles": ["@angular/material/prebuilt-themes/indigo-pink.css"]

// If broken, may need:
"styles": ["@angular/material/prebuilt-themes/indigo-pink.css"]
// (usually unchanged — but verify the file exists in node_modules)
```

---

## Phase 4: Angular 17 → 18

> **Risk: MEDIUM** — Standalone promoted as default, signal-based features expanded  
> **Estimated effort: 3–4 hours**

### Step 4.1: Run Angular Update

```bash
ng update @angular/core@18 @angular/cli@18
ng update @angular/material@18
```

### Step 4.2: Update Supporting Packages

```bash
npm install @angular-builders/jest@18 --save-dev
npm install zone.js@~0.14.0  # or ~0.15.0 depending on resolution
npm install @ngx-translate/core@16 @ngx-translate/http-loader@9
```

### Step 4.3: `@angular/fire` Update

```bash
npm install @angular/fire@18
```

Angular Fire 18 still includes the compat layer but it is deprecated. The modular API is strongly recommended. **We will handle the full compat → modular migration in Phase 6** (post-migration cleanup) to minimize risk during version upgrades.

### Step 4.4: Verify

```bash
npm test
npm start
```

### Angular 18 Breaking Changes to Watch For

| Change | Impact on This Project |
|--------|----------------------|
| `HttpClientModule` deprecated | Still works — migrate to `provideHttpClient()` in Phase 5 |
| Standalone default for `ng generate` | Existing code unaffected |
| Signal inputs/outputs stable | Optional — existing decorators still work |
| Zoneless change detection (experimental) | Don't enable yet — requires `zone.js` removal |
| `@angular/fire@18` compat deprecation warnings | Expected — plan modular migration for Phase 6 |

---

## Phase 5: Angular 18 → 19

> **Risk: MEDIUM** — This is the final target. Bootstrap must be modernized.  
> **Estimated effort: 4–6 hours (includes bootstrap refactor)**

### Step 5.1: Run Angular Update

```bash
ng update @angular/core@19 @angular/cli@19
ng update @angular/material@19
```

### Step 5.2: Update All Supporting Packages

```bash
npm install @angular-builders/jest@19 --save-dev
npm install zone.js@~0.15.0
npm install typescript@~5.7.0 --save-dev
```

### Step 5.3: CRITICAL — Migrate Bootstrap to Standalone

This is the most significant code change. You must convert from `AppModule`-based bootstrap to standalone `bootstrapApplication()`.

#### Step 5.3.1: Make `AppComponent` standalone

**File: `src/app/app.component.ts`**

Add `standalone: true` and move needed imports into the component:

```typescript
// BEFORE
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

// AFTER
import { RouterOutlet } from '@angular/router';
// ... keep all existing imports ...

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    // Add any other components/directives used in app.component.html
    // These are the standalone components currently in AppModule.imports:
    AddComponent,
    AddSmileComponent,
    AddFireComponent,
    AddAssetComponent,
    AddShareComponent,
    AddInvestmentComponent,
    AddLiabilitieComponent,
    AddSubscriptionComponent,
    AddGrowComponent,
    AddBudgetComponent,
    MenuComponent,
    ChooseComponent,
    ProfileComponent,
    SettingsComponent,
    ImpressumComponent,
    PolicyComponent,
    InstructionsComponent,
    InfoComponent,
    ToastComponent,
    ConfirmDialogComponent,
    BottomNavComponent,
    OnboardingComponent,
    // Add TranslateModule if used in template
    TranslateModule,
    // Add CommonModule/NgIf/NgFor if used in template (or use @if/@for)
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
```

> **Note:** Check `app.component.html` to identify exactly which components/directives are used in the template. Only import those. The deferred `setTimeout(() => import(...))` panel components that are loaded dynamically via code (not template) don't need to be in `imports[]`.

#### Step 5.3.2: Create `app.config.ts`

**File: `src/app/app.config.ts`** (NEW FILE)

```typescript
import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

// Firebase (keep compat layer working for now)
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from '../environments/environment';

// AngularFire compat — import the module for compat services
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';

// Translate
import { TranslateModule, TranslateLoader, MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';

export class FallbackMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams) {
    return params.key;
  }
}

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http);
}

// Register locale data
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
registerLocaleData(localeDe);
registerLocaleData(localeEn);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(),
    
    // Firebase compat providers (until modular migration)
    importProvidersFrom(
      AngularFireModule.initializeApp(environment.firebase),
      AngularFireAuthModule,
      TranslateModule.forRoot({
        defaultLanguage: 'en',
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient]
        },
        missingTranslationHandler: {
          provide: MissingTranslationHandler,
          useClass: FallbackMissingTranslationHandler
        }
      })
    ),
    
    // Firebase modular providers
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    
    // Locale
    {
      provide: LOCALE_ID,
      useFactory: () => {
        const isEuropeanFormat = localStorage.getItem('isEuropeanFormat');
        return isEuropeanFormat === 'false' ? 'en-US' : 'de-DE';
      }
    }
  ]
};
```

> **Important:** Add `import { importProvidersFrom } from '@angular/core';` at the top. The `importProvidersFrom()` function allows using NgModule-based libraries (like `@angular/fire/compat` and `TranslateModule`) inside the standalone provider config.

#### Step 5.3.3: Extract Routes

**File: `src/app/app.routes.ts`** (NEW FILE — extracted from `app-routing.module.ts`)

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'authentication', loadComponent: () => import('./registration/registration.component').then(m => m.RegistrationComponent) },
  { path: 'home', loadComponent: () => import('./main/home/home.component').then(m => m.HomeComponent) },
  { path: 'transactions', loadComponent: () => import('./main/accounting/accounting.component').then(m => m.AccountingComponent) },
  { path: 'daily', loadComponent: () => import('./main/daily/daily.component').then(m => m.DailyComponent) },
  { path: 'splurge', loadComponent: () => import('./main/splurge/splurge.component').then(m => m.SplurgeComponent) },
  { path: 'smile', loadComponent: () => import('./main/smile/smile.component').then(m => m.SmileComponent) },
  { path: 'fire', loadComponent: () => import('./main/fire/fire.component').then(m => m.FireComponent) },
  { path: 'smileprojects', loadComponent: () => import('./main/smile/smile-projects/smile-projects.component').then(m => m.SmileProjectsComponent) },
  { path: 'fireemergencies', loadComponent: () => import('./main/fire/fire-emergencies/fire-emergencies.component').then(m => m.FireEmergenciesComponent) },
  { path: 'cashflow', loadComponent: () => import('./main/cashflow/cashflow.component').then(m => m.CashflowComponent) },
  { path: 'income', loadComponent: () => import('./main/cashflow/income/income.component').then(m => m.IncomeComponent) },
  { path: 'balance', loadComponent: () => import('./main/cashflow/balance/balance.component').then(m => m.BalanceComponent) },
  { path: 'stats', loadComponent: () => import('./stats/stats.component').then(m => m.StatsComponent) },
  { path: 'subscription', loadComponent: () => import('./main/subscription/subscription.component').then(m => m.SubscriptionComponent) },
  { path: 'grow', loadComponent: () => import('./main/grow/grow.component').then(m => m.GrowComponent) },
  { path: 'budget', loadComponent: () => import('./main/budget/budget.component').then(m => m.BudgetComponent) },
  { path: 'plan', loadComponent: () => import('./main/budget/plan/plan.component').then(m => m.PlanComponent) }
];
```

> **Note:** Keep `{ useHash: true }` if you need hash routing. Pass it via `provideRouter(routes, withHashLocation())` in `app.config.ts`. You will need: `import { withHashLocation } from '@angular/router';`

Update `app.config.ts` router line:
```typescript
provideRouter(routes, withHashLocation()),
```

#### Step 5.3.4: Update `main.ts`

**File: `src/main.ts`**

```typescript
// BEFORE
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));

import { defineCustomElements } from '@ionic/pwa-elements/loader';
defineCustomElements(window);

// AFTER
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));

import { defineCustomElements } from '@ionic/pwa-elements/loader';
defineCustomElements(window);
```

#### Step 5.3.5: Delete Old Files

```bash
# Delete after confirming everything works:
# - src/app/app.module.ts        (replaced by app.config.ts)
# - src/app/app-routing.module.ts (replaced by app.routes.ts)
```

### Step 5.4: Update `tsconfig.app.json`

The `files` array currently points to `src/main.ts` — this is fine. No change needed.

### Step 5.5: Update Jest Configuration

**File: `jest.config.js`** — Verify `transformIgnorePatterns` still works:

```javascript
transformIgnorePatterns: [
  'node_modules/(?!(@angular|@ngx-translate|rxjs|d3|d3-.*|internmap|delaunator|robust-predicates|@angular/fire|firebase|@firebase)/)'
]
```

This pattern should still work. If you see transform errors, add any new ESM-only packages to the pattern.

### Step 5.6: Update Test Files

Many test files likely import from `@angular/fire` or use `TestBed.configureTestingModule` with `imports: [AppModule]`. Search and update:

```bash
# Find all test files referencing AppModule
grep -r "AppModule" src/ --include="*.spec.ts"
```

Replace `imports: [AppModule]` with the specific standalone components/providers needed for each test.

### Step 5.7: Full Verification

```bash
npm test                      # All frontend unit tests
npm run test:backend:unit     # Backend unit tests
npm start                     # Dev server
npm run build                 # Production build (Firebase)
npm run build:selfhosted      # Production build (selfhosted)
npm run test:e2e              # Playwright E2E tests
```

---

## Phase 6: Post-Migration Cleanup

> **Optional but recommended improvements after Angular 19 is stable**

### 6.1: Migrate `@angular/fire` from Compat to Modular API

This is the biggest post-migration task. The compat layer works on Angular 19 but is deprecated and may be removed in future `@angular/fire` versions.

**Files to change:**
- `src/app/shared/services/auth.service.ts`
- `src/app/shared/services/database.service.ts`
- `src/app/app.config.ts` (remove compat imports)
- All test files that mock Firebase

**Auth Service Migration:**

```typescript
// BEFORE (compat)
import { AngularFireAuth } from '@angular/fire/compat/auth';
// constructor(private afAuth: AngularFireAuth) {}
// this.afAuth.authState
// this.afAuth.signInWithEmailAndPassword(email, password)

// AFTER (modular)
import { Auth, authState, signInWithEmailAndPassword, User } from '@angular/fire/auth';
import { inject } from '@angular/core';
// private auth = inject(Auth);
// authState(this.auth)
// signInWithEmailAndPassword(this.auth, email, password)
```

**Database Service Migration:**

```typescript
// BEFORE (compat)
import { AngularFireDatabase } from '@angular/fire/compat/database';
// this.db.object(path).set(value)
// this.db.object(path).valueChanges()

// AFTER (modular)
import { Database, ref, set, get, object, objectVal } from '@angular/fire/database';
import { inject } from '@angular/core';
// private db = inject(Database);
// set(ref(this.db, path), value)
// objectVal(ref(this.db, path))
```

**⚠️ Important:** Since your `DatabaseService` branches on `environment.mode` ('firebase' vs 'selfhosted'), the Firebase-specific code only runs in firebase mode. The selfhosted path uses `SelfhostedService` (HTTP calls to Express) — that path needs no Firebase changes at all.

### 6.2: Convert `AppComponent` Constructor DI to `inject()`

Angular 19 promotes the `inject()` function over constructor injection:

```typescript
// BEFORE
constructor(
  public router: Router,
  private localStorage: LocalService,
  private database: DatabaseService,
  public afAuth: AngularFireAuth,
  // ... 10+ services
) { }

// AFTER (optional improvement)
private router = inject(Router);
private localStorage = inject(LocalService);
private database = inject(DatabaseService);
// etc.
```

This is optional but reduces constructor bloat and is the modern Angular pattern.

### 6.3: Enable `useDefineForClassFields: true`

In `tsconfig.json`, the setting is currently `false`. Angular 19 works with `true` (the TC39 standard). Test with `true` to catch any class field initialization order issues:

```json
// tsconfig.json
"useDefineForClassFields": true
```

If anything breaks, revert to `false`. The most common issue is class properties that depend on constructor parameters — with `true`, class fields are initialized *before* the constructor body runs.

### 6.4: Evaluate `esbuild` Application Builder

Angular 19 offers the `application` builder (esbuild-based) as a replacement for the `browser` builder (Webpack-based). It provides significantly faster builds:

```json
// angular.json — OPTIONAL
// BEFORE
"builder": "@angular-devkit/build-angular:browser",

// AFTER (evaluate — may need config adjustments)
"builder": "@angular-devkit/build-angular:application",
```

**Wait until all tests pass** before attempting this switch. The `application` builder has different output structure and options.

---

## Firebase-Specific Considerations

### Firebase Hosting

- `firebase.json` configuration does **not change** — the `dist/money` output path remains the same
- `npm run build` (which runs `ng build --configuration firebase`) will still produce output in `dist/money`
- Firebase CLI (`firebase deploy`) works identically

### Firebase Realtime Database

- No changes to security rules
- No changes to data structure
- The `@angular/fire` compat layer still connects to the same database
- Client-side encryption (CryptoJS) is completely independent of Angular version

### Firebase Authentication

- `AngularFireAuth` (compat) still works on Angular 19
- Token refresh, account state management unchanged
- If migrating to modular API (Phase 6), use `Auth` from `@angular/fire/auth`

### Firebase SDK Version

When updating `@angular/fire` to v18+, the underlying `firebase` SDK will update automatically. This is transparent — the API calls remain the same.

### Firebase Build & Deploy Verification

```bash
npm run build:firebase          # Must produce dist/money/
firebase deploy --only hosting  # Verify deployment works
# Test: https://your-app.web.app → app loads and authenticates
```

---

## Self-Hosted / Docker / K8s Considerations

### Docker Image Changes

Only the Node.js base image version changes:

**`Dockerfile` (frontend build stage):**
```dockerfile
FROM node:22-alpine as build
```

**`backend/Dockerfile`:**
```dockerfile
FROM node:22-alpine
```

Everything else remains identical: nginx config, health checks, exposed ports, user creation.

### Docker Compose

**`docker-compose.yml`** — No changes needed. The services reference local Dockerfiles that will use the updated base images.

CouchDB stays at 3.3 — no upgrade needed.

### Kubernetes (K8s) Manifests

**`k8s/frontend.yaml` and `k8s/backend.yaml`** — If you reference specific image tags, update them after building new images. Otherwise, no changes.

### Build & Verify Self-Hosted Stack

```bash
# 1. Build selfhosted frontend
npm run build:selfhosted

# 2. Test Docker build
docker-compose build

# 3. Test full stack
docker-compose up -d

# 4. Verify health endpoints
curl http://localhost:3000/health    # Backend → {"status":"ok"}
curl http://localhost:80             # Frontend → Angular app HTML

# 5. Test login and data operations
# Open http://localhost in browser, register/login, add transaction

# 6. Verify CouchDB connectivity
curl http://admin:changeme@localhost:5984    # CouchDB → {"couchdb":"Welcome"}

docker-compose down
```

### Raspberry Pi Considerations

Node 22 LTS on ARM64 (Raspberry Pi 4/5):
- `node:22-alpine` images are available for `linux/arm64` ✅
- Build times will be slower on Pi — build on a faster machine and push images
- Memory footprint is similar between Node 18 and Node 22 (~640 MB total stack)

---

## Testing Strategy

### Test Execution Order

Run tests in this order after each migration phase:

```
1. npm test                         → Frontend unit tests (fast, catch regressions)
2. npm run build                    → Production build (confirms compilation)
3. npm run build:selfhosted         → Self-hosted build (different env file)
4. npm run test:backend:unit        → Backend unit tests
5. npm start → manual smoke test   → Dev server + manual navigation
6. npm run test:e2e                 → Playwright E2E (full user flows)
```

### Critical User Flows to Test Manually

After the final migration (Phase 5), manually verify these flows in both Firebase and selfhosted modes:

```
[ ] Register new account
[ ] Login with existing account
[ ] Add a transaction (each account: Daily, Splurge, Smile, Fire)
[ ] Edit a transaction
[ ] Delete a transaction
[ ] View income/cashflow/balance pages
[ ] Create a Smile project with buckets
[ ] Create a Fire emergency with buckets
[ ] Create a Grow project
[ ] Add/view subscriptions (all 5 frequencies)
[ ] Budget creation and plan view
[ ] Export data (CSV + JSON backup)
[ ] Import/restore from backup
[ ] Switch language (EN ↔ DE ↔ ES ↔ FR ↔ ZH)
[ ] Settings: toggle encryption
[ ] Search transactions (AND/OR/NOT operators)
[ ] Statistics/charts render correctly (D3)
[ ] AI Assistant panel opens and generates prompts
[ ] Profile view and edit
[ ] Logout and re-login
```

### Test File Updates

Some test files may need updates if they:
- Import `AppModule` directly → Replace with component-specific test setup
- Mock `AngularFireAuth` → Mock pattern may change with modular API
- Use `FIREBASE_OPTIONS` token → May need `provideFirebaseApp()` in test config

Search for affected tests:

```bash
grep -r "AppModule\|AngularFireModule\|FIREBASE_OPTIONS\|AngularFireAuth\|AngularFireDatabase" src/ --include="*.spec.ts" -l
```

---

## Rollback Plan

### Before Starting

```bash
git checkout -b migration/angular-19
# All work happens on this branch
# main/master remains untouched and deployable
```

### If a Phase Fails

```bash
# Option A: Revert the current phase
git stash
git checkout main
npm ci

# Option B: Reset to last working phase
git reset --hard <commit-hash-of-last-passing-phase>
npm ci
npm test  # Verify rollback works
```

### If Production Breaks Post-Deploy

```bash
# Firebase: instant rollback
firebase hosting:rollback

# Docker/K8s: redeploy previous image
docker-compose down
git checkout main
docker-compose build
docker-compose up -d

# K8s: rollback deployment
kubectl rollout undo deployment/frontend -n money
kubectl rollout undo deployment/backend -n money
```

---

## Summary: Migration Sequence

```
┌─────────────────────────────────────────────────────┐
│ Phase 0: Pre-flight                                 │
│   ✅ All tests passing                              │
│   ✅ Git branch created                             │
│   ✅ Backup verified                                │
├─────────────────────────────────────────────────────┤
│ Phase 1: Backend (Node 18 → 22)                     │
│   📦 Update Dockerfiles                             │
│   📦 npm update backend deps                        │
│   ✅ Backend tests pass                             │
│   ✅ Docker build succeeds                          │
├─────────────────────────────────────────────────────┤
│ Phase 2: Angular 15 → 16                            │
│   📦 ng update @angular/core@16 @angular/cli@16     │
│   📦 Update Material, jest, zone.js, translate      │
│   ✅ Frontend tests pass                            │
├─────────────────────────────────────────────────────┤
│ Phase 3: Angular 16 → 17                            │
│   📦 ng update @angular/core@17 @angular/cli@17     │
│   🔄 Accept control flow migration (@if, @for)      │
│   ✅ Frontend tests pass                            │
├─────────────────────────────────────────────────────┤
│ Phase 4: Angular 17 → 18                            │
│   📦 ng update @angular/core@18 @angular/cli@18     │
│   📦 Update @angular/fire@18                        │
│   ✅ Frontend tests pass                            │
├─────────────────────────────────────────────────────┤
│ Phase 5: Angular 18 → 19 ⭐                         │
│   📦 ng update @angular/core@19 @angular/cli@19     │
│   🔧 Create app.config.ts                           │
│   🔧 Create app.routes.ts                           │
│   🔧 Make AppComponent standalone                   │
│   🔧 Update main.ts → bootstrapApplication()        │
│   🗑️ Delete app.module.ts, app-routing.module.ts    │
│   ✅ ALL tests pass (unit + E2E)                    │
│   ✅ Both builds pass (firebase + selfhosted)        │
│   ✅ Docker stack works                              │
├─────────────────────────────────────────────────────┤
│ Phase 6: Cleanup (post-stabilization)               │
│   🔧 @angular/fire compat → modular (optional)      │
│   🔧 inject() migration (optional)                  │
│   🔧 useDefineForClassFields: true (optional)        │
│   🔧 esbuild application builder (optional)          │
└─────────────────────────────────────────────────────┘
```

### Version Cheat Sheet

| Package | Before | After |
|---------|--------|-------|
| `@angular/*` | 15.2.x | 19.2.x |
| `@angular/material` | 15.2.9 | 19.2.x |
| `@angular/fire` | 7.6.1 | 18.x or 19.x |
| `typescript` | 4.9.4 | 5.7.x |
| `zone.js` | 0.12.0 | 0.15.x |
| `@ngx-translate/core` | 14.0.0 | 16.x |
| `jest-preset-angular` | 13.1.6 | 14.x |
| `@angular-builders/jest` | 15.0.0 | 19.x |
| Node.js (Docker) | 18-alpine | 22-alpine |
| Node.js (local) | 22.14.0 | 22.14.0 (no change) |
| Express | 4.18.2 | 4.21.x |
| CouchDB | 3.3 | 3.3 (no change) |
| nginx | alpine | alpine (no change) |

---

*End of Migration Guide — Angular 15 → 19 + Node.js 18 → 22 LTS*
