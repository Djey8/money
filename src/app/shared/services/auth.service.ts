import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

/**
 * Centralized authentication service that handles both Firebase and selfhosted authentication
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private mode: 'firebase' | 'selfhosted' = environment.mode as 'firebase' | 'selfhosted';

  constructor(private afAuth: AngularFireAuth, private http: HttpClient) {}

  /**
   * Check if user is authenticated (works for both Firebase and Selfhosted modes)
   * @returns Promise<{authenticated: boolean, error?: string}>
   */
  async checkAuthentication(): Promise<{authenticated: boolean, error?: string}> {
    // Demo mode: always authenticated
    if (sessionStorage.getItem('demo_mode') === 'true') {
      return { authenticated: true };
    }

    if (this.mode === 'firebase') {
      // Firebase authentication check - wait for auth state to initialize
      try {
        const user = await firstValueFrom(this.afAuth.authState);
        if (!user) {
          return { authenticated: false, error: 'Session expired. Please log in again.' };
        }
        
        try {
          // Refresh token to ensure it's still valid
          await user.getIdToken(true);
          return { authenticated: true };
        } catch (err) {
          return { authenticated: false, error: 'Session expired. Please log in again.' };
        }
      } catch (error) {
        console.error('Error checking Firebase auth state:', error);
        return { authenticated: false, error: 'Authentication error occurred.' };
      }
    } else {
      // Selfhosted mode - check if userId exists (cookie is validated server-side)
      const userId = localStorage.getItem('selfhosted_userId');
      
      if (!userId) {
        return { authenticated: false, error: 'Session expired. Please log in again.' };
      }
      
      return { authenticated: true };
    }
  }

  /**
   * Quick synchronous check if authentication tokens exist
   * Note: This doesn't verify token validity, just existence
   * @returns boolean
   */
  hasAuthTokens(): boolean {
    if (this.mode === 'firebase') {
      // For Firebase, we need to do async check, so this is just a quick check
      return true; // Requires async check via checkAuthentication()
    } else {
      const userId = localStorage.getItem('selfhosted_userId');
      return !!userId;
    }
  }

  /**
   * Get the current authentication mode
   * @returns 'firebase' | 'selfhosted'
   */
  getMode(): 'firebase' | 'selfhosted' {
    return this.mode;
  }

  /**
   * Sign out based on current mode
   * @returns Promise<void>
   */
  async signOut(): Promise<void> {
    if (this.mode === 'firebase') {
      await this.afAuth.signOut();
    } else {
      // Selfhosted mode - call logout endpoint to revoke refresh token + clear cookies
      localStorage.removeItem('selfhosted_userId');
      try {
        await firstValueFrom(
          this.http.post(`${environment.selfhosted.apiUrl}/auth/logout`, {}, { withCredentials: true })
        );
      } catch {
        // Logout should succeed even if the request fails
      }
    }
  }
}
