import { NgModule } from '@angular/core';
import { RouterModule, Routes, PreloadAllModules } from '@angular/router';


















const routes: Routes = [
  { path: '', loadComponent: () => import('./landing/landing-page.component').then(m => m.LandingPageComponent) },
  { path: 'about', loadComponent: () => import('./landing/landing-page.component').then(m => m.LandingPageComponent) },
  { path: 'docs', loadComponent: () => import('./docs/docs.component').then(m => m.DocsComponent) },
  { path: 'docs/selfhosted', loadComponent: () => import('./docs/selfhosted/selfhosted-docs.component').then(m => m.SelfhostedDocsComponent) },
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
  { path: 'grow', loadComponent: () => import('./main/grow/grow.component').then(m => m.GrowComponent)},
  { path: 'budget', loadComponent: () => import('./main/budget/budget.component').then(m => m.BudgetComponent)},
  { path: 'plan', loadComponent: () => import('./main/budget/plan/plan.component').then(m => m.PlanComponent)}
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true, preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
