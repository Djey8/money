import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CreatedPersonalAccessToken,
  PersonalAccessTokenService,
  PersonalAccessTokenSummary,
} from 'src/app/shared/services/personal-access-token.service';

// Deferred import to break circular chain (same pattern used throughout
// src/app/panels and src/app/main).
let AppComponent: any;
setTimeout(() => import('src/app/app.component').then((m) => (AppComponent = m.AppComponent)));

type ScopeLevel = 'none' | 'r' | 'w' | 'rw' | 'bulk';

interface ScopeResource {
  key: string;
  label: string;
  /** Mirrors backend/cli/commands/token.js's validateScope: most resources
   * allow r/w/rw, `income`/`reports` are read-only, `data` is bulk-only. */
  levels: ScopeLevel[];
}

/** Same resource list/constraints as backend/cli/commands/token.js's SCOPE_RESOURCES —
 * kept in sync by hand since there's no shared package these two share yet. */
const SCOPE_RESOURCES: ScopeResource[] = [
  { key: 'transactions', label: 'Transactions', levels: ['none', 'r', 'w', 'rw', 'bulk'] },
  { key: 'subscriptions', label: 'Subscriptions', levels: ['none', 'r', 'w', 'rw', 'bulk'] },
  { key: 'smile', label: 'Smile', levels: ['none', 'r', 'w', 'rw'] },
  { key: 'fire', label: 'Fire', levels: ['none', 'r', 'w', 'rw'] },
  { key: 'mojo', label: 'Mojo', levels: ['none', 'r', 'w', 'rw'] },
  { key: 'grow', label: 'Grow', levels: ['none', 'r', 'w', 'rw'] },
  {
    key: 'balance',
    label: 'Balance (assets/shares/investments/liabilities)',
    levels: ['none', 'r', 'w', 'rw'],
  },
  { key: 'budget', label: 'Budget', levels: ['none', 'r', 'w', 'rw'] },
  { key: 'income', label: 'Income (revenue/interest/property)', levels: ['none', 'r'] },
  { key: 'reports', label: 'Reports', levels: ['none', 'r'] },
  { key: 'account', label: 'Account (email/profile)', levels: ['none', 'r', 'w', 'rw'] },
  { key: 'settings', label: 'Settings', levels: ['none', 'r', 'w', 'rw'] },
  { key: 'encryption', label: 'Encryption config', levels: ['none', 'r', 'w', 'rw'] },
  { key: 'data', label: 'Full data export/import', levels: ['none', 'bulk'] },
];

/** The "AI Assistant" scope bundle documented on the Pro API docs page — every normal
 * day-to-day action, nothing touching settings/account/encryption. */
const AI_ASSISTANT_PRESET: Record<string, ScopeLevel> = {
  transactions: 'rw',
  subscriptions: 'rw',
  smile: 'rw',
  fire: 'rw',
  mojo: 'rw',
  grow: 'rw',
  balance: 'rw',
  budget: 'rw',
  income: 'r',
  reports: 'r',
};

/**
 * Pro-only page: manage personal access tokens from the app itself instead
 * of curling POST /auth/tokens by hand. Self-hosted only — reachable only
 * via a route registered in app.routes.selfhosted.ts (docs/adr/0004), and
 * linked to from Settings behind an environment.mode guard (a plain nav
 * link, not Pro code — the actual feature lives entirely in this
 * lazy-loaded, edition-gated component).
 */
@Component({
  selector: 'app-personal-access-tokens',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personal-access-tokens.component.html',
  styleUrls: ['./personal-access-tokens.component.css', '../../../app.component.css'],
})
export class PersonalAccessTokensComponent implements OnInit {
  resources = SCOPE_RESOURCES;

  tokens: PersonalAccessTokenSummary[] = [];
  loading = true;
  loadError: string | null = null;

  scopeSelections: Record<string, ScopeLevel> = Object.fromEntries(
    SCOPE_RESOURCES.map((r) => [r.key, 'none' as ScopeLevel]),
  );
  nameField = '';
  expiresInDaysField: number | null = null;
  creating = false;
  createError: string | null = null;
  newlyCreatedToken: CreatedPersonalAccessToken | null = null;
  copied = false;

  confirmingRevoke: string | null = null;
  revoking: string | null = null;

  constructor(private tokenService: PersonalAccessTokenService) {}

  get appReference() {
    return AppComponent;
  }

  ngOnInit(): void {
    this.loadTokens();
  }

  loadTokens(): void {
    this.loading = true;
    this.loadError = null;
    this.tokenService.list().subscribe({
      next: (response) => {
        this.tokens = response.tokens;
        this.loading = false;
      },
      error: (error) => {
        this.loadError = error?.error?.detail || error?.message || 'Failed to load tokens.';
        this.loading = false;
      },
    });
  }

  applyPreset(): void {
    for (const resource of this.resources) {
      this.scopeSelections[resource.key] = AI_ASSISTANT_PRESET[resource.key] ?? 'none';
    }
  }

  clearScopes(): void {
    for (const resource of this.resources) {
      this.scopeSelections[resource.key] = 'none';
    }
  }

  get selectedScopeCount(): number {
    return Object.values(this.scopeSelections).filter((level) => level !== 'none').length;
  }

  createToken(): void {
    const scopes = this.resources
      .filter((r) => this.scopeSelections[r.key] !== 'none')
      .map((r) => `${r.key}:${this.scopeSelections[r.key]}`);

    if (!this.nameField.trim()) {
      this.createError = 'Name is required.';
      return;
    }
    if (scopes.length === 0) {
      this.createError = 'Select at least one scope.';
      return;
    }

    this.creating = true;
    this.createError = null;
    this.tokenService
      .create(this.nameField.trim(), scopes, this.expiresInDaysField || undefined)
      .subscribe({
        next: (created) => {
          this.newlyCreatedToken = created;
          this.creating = false;
          this.nameField = '';
          this.expiresInDaysField = null;
          this.clearScopes();
          this.loadTokens();
        },
        error: (error) => {
          this.createError = error?.error?.detail || error?.message || 'Failed to create token.';
          this.creating = false;
        },
      });
  }

  dismissNewToken(): void {
    this.newlyCreatedToken = null;
    this.copied = false;
  }

  copyToken(token: string): void {
    navigator.clipboard.writeText(token).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }

  askRevoke(tokenId: string): void {
    this.confirmingRevoke = tokenId;
  }

  cancelRevoke(): void {
    this.confirmingRevoke = null;
  }

  confirmRevoke(tokenId: string): void {
    this.revoking = tokenId;
    this.tokenService.revoke(tokenId).subscribe({
      next: () => {
        this.revoking = null;
        this.confirmingRevoke = null;
        this.loadTokens();
      },
      error: () => {
        this.revoking = null;
      },
    });
  }

  formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
