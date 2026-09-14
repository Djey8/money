import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CreatedPersonalAccessToken,
  PersonalAccessTokenService,
  PersonalAccessTokenSummary,
} from 'src/app/shared/services/personal-access-token.service';
import { CreateTokenComponent } from './create-token/create-token.component';

// Deferred import to break circular chain (same pattern used throughout
// src/app/panels and src/app/main).
let AppComponent: any;
setTimeout(() => import('src/app/app.component').then((m) => (AppComponent = m.AppComponent)));

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
  imports: [CommonModule, CreateTokenComponent],
  templateUrl: './personal-access-tokens.component.html',
  styleUrls: ['./personal-access-tokens.component.css', '../../../app.component.css'],
})
export class PersonalAccessTokensComponent implements OnInit {
  tokens: PersonalAccessTokenSummary[] = [];
  loading = true;
  loadError: string | null = null;

  showCreateForm = false;

  confirmingRevoke: string | null = null;
  revoking: string | null = null;

  confirmingDelete: string | null = null;
  deleting: string | null = null;
  deleteError: string | null = null;

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

  onTokenCreated(_token: CreatedPersonalAccessToken): void {
    this.loadTokens();
  }

  onCreatePanelClosed(): void {
    this.showCreateForm = false;
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

  askDelete(tokenId: string): void {
    this.deleteError = null;
    this.confirmingDelete = tokenId;
  }

  cancelDelete(): void {
    this.confirmingDelete = null;
  }

  confirmDelete(tokenId: string): void {
    this.deleting = tokenId;
    this.tokenService.delete(tokenId).subscribe({
      next: () => {
        this.deleting = null;
        this.confirmingDelete = null;
        this.loadTokens();
      },
      error: (error) => {
        this.deleting = null;
        this.deleteError = error?.error?.detail || error?.message || 'Failed to delete token.';
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
