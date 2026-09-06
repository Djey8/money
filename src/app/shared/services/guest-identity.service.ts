import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DatabaseService } from './database.service';

const DISPLAY_NAME_KEY = 'community_display_name';
const ANONYMOUS_PREF_KEY = 'community_anonymous_preference';

/**
 * Resolves a lightweight identity for the Community section, whether the
 * visitor is logged into the app or just a guest.
 *
 * - Firebase mode: signs the visitor in anonymously if no session exists yet
 *   (AngularFireAuth treats anonymous and email/password users the same way).
 * - Selfhosted mode: requests a guest JWT from the backend, which is a no-op
 *   if a valid session cookie (guest or full user) already exists.
 *
 * Either way, callers just await ensureIdentity() before posting and then
 * read getAuthorId(). The chosen display name is remembered locally so
 * returning visitors don't have to retype it.
 *
 * Also owns the "post as yourself vs. anonymously" decision: logged-in users
 * default to their real account username (fetched from their private
 * profile data) and can flip a remembered "post anonymously" preference;
 * guests just get a free-text name field that falls back to "Anonymous".
 */
@Injectable({
  providedIn: 'root',
})
export class GuestIdentityService {
  private mode: 'firebase' | 'selfhosted' =
    (environment.mode as 'firebase' | 'selfhosted') || 'firebase';
  private resolvedAuthorId: string | null = null;
  private resolvedIsAdmin: boolean | null = null;
  private resolvedIsGuest: boolean | null = null;
  private resolvedRealUsername: string | null = null;

  constructor(
    private http: HttpClient,
    private afAuth: AngularFireAuth,
    private database: DatabaseService,
    private translate: TranslateService,
  ) {}

  getDisplayName(): string {
    return localStorage.getItem(DISPLAY_NAME_KEY) || '';
  }

  setDisplayName(name: string): void {
    const trimmed = (name || '').trim().slice(0, 40);
    if (trimmed) {
      localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
    } else {
      localStorage.removeItem(DISPLAY_NAME_KEY);
    }
  }

  /** Remembered "post anonymously" preference for logged-in users. Defaults to false. */
  getAnonymousPreference(): boolean {
    return localStorage.getItem(ANONYMOUS_PREF_KEY) === 'true';
  }

  setAnonymousPreference(anonymous: boolean): void {
    localStorage.setItem(ANONYMOUS_PREF_KEY, anonymous ? 'true' : 'false');
  }

  /**
   * Makes sure a usable identity exists and caches its id for this session.
   * Safe to call repeatedly — cheap no-op once resolved.
   */
  async ensureIdentity(): Promise<string> {
    if (this.resolvedAuthorId) {
      return this.resolvedAuthorId;
    }

    if (this.mode === 'firebase') {
      let user = await firstValueFrom(this.afAuth.authState);
      if (!user) {
        const credential = await this.afAuth.signInAnonymously();
        user = credential.user;
      }
      this.resolvedAuthorId = user!.uid;
      this.resolvedIsGuest = user!.isAnonymous;
    } else {
      const response: any = await firstValueFrom(
        this.http.post(
          `${environment.selfhosted.apiUrl}/auth/guest`,
          {},
          { withCredentials: true },
        ),
      );
      this.resolvedAuthorId = response.userId;
      this.resolvedIsGuest = response.role === 'guest';
    }

    return this.resolvedAuthorId;
  }

  /** Cached id from the last ensureIdentity() call, or null if not resolved yet. */
  getAuthorId(): string | null {
    return this.resolvedAuthorId;
  }

  /**
   * Whether the current identity is a guest/anonymous session rather than a
   * real, logged-in account. Resolves conservatively to `true` until
   * ensureIdentity() has actually run.
   */
  isGuest(): boolean {
    return this.resolvedIsGuest ?? true;
  }

  /**
   * Real account username for logged-in (non-guest) identities, read from
   * the user's own private profile data (`info/username`, unencrypted).
   * Returns null for guests, or if no username is set.
   */
  async getRealUsername(): Promise<string | null> {
    await this.ensureIdentity();
    if (this.isGuest()) {
      return null;
    }
    if (this.resolvedRealUsername !== null) {
      return this.resolvedRealUsername;
    }

    try {
      const snapshot: any = await this.database.getData('info/username');
      const value = snapshot?.val ? snapshot.val() : null;
      this.resolvedRealUsername = typeof value === 'string' && value.trim() ? value.trim() : null;
    } catch {
      this.resolvedRealUsername = null;
    }
    return this.resolvedRealUsername;
  }

  /** Whether a stored authorName is the localized "Anonymous" label (used to pre-fill edit forms). */
  isAnonymousLabel(name: string): boolean {
    return name === this.translate.instant('Community.anonymous');
  }

  /**
   * Resolves the display name to store on a new or edited post.
   * - Guests: the typed name, or the localized "Anonymous" label if left empty.
   * - Logged-in users: their real username, or "Anonymous" if posting anonymously.
   */
  async resolveAuthorName(typedName: string, postAnonymously: boolean): Promise<string> {
    await this.ensureIdentity();
    const anonymousLabel = this.translate.instant('Community.anonymous');

    if (this.isGuest()) {
      const trimmed = (typedName || '').trim();
      return trimmed || anonymousLabel;
    }

    if (postAnonymously) {
      return anonymousLabel;
    }
    const real = await this.getRealUsername();
    return real || anonymousLabel;
  }

  /**
   * Whether the current identity has Community moderation privileges
   * (delete any thread/post, not just their own).
   *
   * - Firebase: reads the `admin` custom claim from the ID token.
   * - Selfhosted: asks the backend, which checks the JWT email against
   *   the ADMIN_EMAILS allowlist.
   *
   * Cached after the first resolution; guests always resolve to false.
   */
  async isAdmin(): Promise<boolean> {
    await this.ensureIdentity();

    if (this.resolvedIsAdmin !== null) {
      return this.resolvedIsAdmin;
    }

    if (this.mode === 'firebase') {
      const user = await this.afAuth.currentUser;
      if (!user) {
        this.resolvedIsAdmin = false;
      } else {
        const tokenResult = await user.getIdTokenResult();
        this.resolvedIsAdmin = tokenResult.claims['admin'] === true;
      }
    } else {
      try {
        const response: any = await firstValueFrom(
          this.http.get(`${environment.selfhosted.apiUrl}/auth/verify`, { withCredentials: true }),
        );
        this.resolvedIsAdmin = !!response.isAdmin;
      } catch {
        this.resolvedIsAdmin = false;
      }
    }

    return this.resolvedIsAdmin;
  }
}
