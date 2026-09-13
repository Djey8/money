import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PersonalAccessTokenSummary {
  tokenId: string;
  name: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
}

export interface CreatedPersonalAccessToken extends PersonalAccessTokenSummary {
  token: string;
  userId: string;
}

/**
 * Personal access token management (Pro API, docs/adr/0006) — deliberately
 * its OWN service file, not a few extra methods on the shared
 * SelfhostedService. That service is always bundled in both editions;
 * this one is only ever imported by PersonalAccessTokensComponent, which is
 * only reachable via the selfhosted-only route in app.routes.selfhosted.ts
 * (docs/adr/0004) — so this file, and the token-management client code in
 * it, never ends up in the Firebase build at all. (Confirmed the hard way:
 * an earlier version of this put these methods directly on
 * SelfhostedService and `ng build --configuration firebase` still shipped
 * them, since that service is imported everywhere regardless of edition.)
 *
 * Session-only — requireSession on the backend refuses these routes to a
 * PAT-authenticated caller, matching ADR-0006's anti-escalation rule (a PAT
 * can never manage tokens). Note the /v1 prefix: these are the versioned
 * Pro API (backend/routes/api.js), not the plain /api/auth/* routes.
 */
@Injectable({
  providedIn: 'root',
})
export class PersonalAccessTokenService {
  private apiUrl = `${environment.selfhosted.apiUrl}/v1`;

  constructor(private http: HttpClient) {}

  list(): Observable<{ tokens: PersonalAccessTokenSummary[] }> {
    return this.http.get<{ tokens: PersonalAccessTokenSummary[] }>(`${this.apiUrl}/auth/tokens`);
  }

  create(
    name: string,
    scopes: string[],
    expiresInDays?: number,
  ): Observable<CreatedPersonalAccessToken> {
    const body: { name: string; scopes: string[]; expiresInDays?: number } = { name, scopes };
    if (expiresInDays) body.expiresInDays = expiresInDays;
    return this.http.post<CreatedPersonalAccessToken>(`${this.apiUrl}/auth/tokens`, body);
  }

  revoke(tokenId: string): Observable<{ tokenId: string; revoked: boolean }> {
    return this.http.delete<{ tokenId: string; revoked: boolean }>(
      `${this.apiUrl}/auth/tokens/${tokenId}`,
    );
  }
}
