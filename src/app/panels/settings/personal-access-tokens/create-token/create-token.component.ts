import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CreatedPersonalAccessToken,
  PersonalAccessTokenService,
} from 'src/app/shared/services/personal-access-token.service';

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
 * Own component so the create form is only in the DOM while the user
 * actually wants to create a token — opened from the "+" toolbar button on
 * PersonalAccessTokensComponent, matching the add-panel pattern used
 * elsewhere in the app, and closable without navigating away.
 */
@Component({
  selector: 'app-create-token',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-token.component.html',
  styleUrls: ['../personal-access-tokens.component.css', './create-token.component.css'],
})
export class CreateTokenComponent {
  @Output() created = new EventEmitter<CreatedPersonalAccessToken>();
  @Output() closed = new EventEmitter<void>();

  resources = SCOPE_RESOURCES;

  scopeSelections: Record<string, ScopeLevel> = Object.fromEntries(
    SCOPE_RESOURCES.map((r) => [r.key, 'none' as ScopeLevel]),
  );
  nameField = '';
  expiresInDaysField: number | null = null;
  creating = false;
  createError: string | null = null;
  newlyCreatedToken: CreatedPersonalAccessToken | null = null;
  copied = false;

  constructor(private tokenService: PersonalAccessTokenService) {}

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
        next: (createdToken) => {
          this.newlyCreatedToken = createdToken;
          this.creating = false;
          this.nameField = '';
          this.expiresInDaysField = null;
          this.clearScopes();
          this.created.emit(createdToken);
        },
        error: (error) => {
          this.createError = error?.error?.detail || error?.message || 'Failed to create token.';
          this.creating = false;
        },
      });
  }

  copyToken(token: string): void {
    navigator.clipboard.writeText(token).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }

  close(): void {
    this.newlyCreatedToken = null;
    this.copied = false;
    this.closed.emit();
  }
}
