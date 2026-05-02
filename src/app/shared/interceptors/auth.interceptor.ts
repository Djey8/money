import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { AppComponent } from '../../app.component';
import { CrypticService } from '../services/cryptic.service';

// Refresh state shared across all interceptor invocations.
// `null` = no refresh in flight; `true` = last refresh succeeded; `false` = last refresh failed.
let isRefreshing = false;
const refreshGate$ = new BehaviorSubject<boolean | null>(null);

// Hard cap on every API request so a stuck network (offline, backend down, captive portal)
// can't leave callers waiting forever. Reads/writes both fall through to their offline fallback
// path (cached data / outbox) once this fires.
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * HTTP interceptor that:
 * 1. Adds withCredentials to all API requests (sends httpOnly cookies)
 * 2. On 401, attempts to refresh the access token
 * 3. Queues parallel 401s while a refresh is in flight, then retries them once the refresh resolves
 * 4. On refresh failure, performs a clean logout
 */
export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  // Capture injected services HERE (within the injection context).
  // catchError runs async — inject() would fail with NG0203 there.
  const http = inject(HttpClient);
  const router = inject(Router);
  const cryptic = inject(CrypticService);
  const apiUrl = environment.selfhosted?.apiUrl;

  // Only intercept requests to our API
  if (!apiUrl || !req.url.startsWith(apiUrl)) {
    return next(req);
  }

  // Add credentials (cookies) to all API requests
  const credentialReq = req.clone({ withCredentials: true });

  return next(credentialReq).pipe(
    timeout(REQUEST_TIMEOUT_MS),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh') && !req.url.includes('/auth/login')) {
        return handleTokenExpiry(credentialReq, next, http, router, cryptic);
      }
      return throwError(() => error);
    })
  );
};

function handleTokenExpiry(req: HttpRequest<unknown>, next: HttpHandlerFn, http: HttpClient, router: Router, cryptic: CrypticService) {
  // If a refresh is already in flight, wait for it to finish and then retry this request.
  // This prevents parallel cold-start requests from fighting over `isRefreshing` and
  // failing spuriously (which previously caused users to be logged out after a stale tab).
  if (isRefreshing) {
    return refreshGate$.pipe(
      filter(state => state !== null),
      take(1),
      switchMap(success => {
        if (success) {
          return next(req);
        }
        return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Refresh failed' }));
      })
    );
  }

  isRefreshing = true;
  refreshGate$.next(null);
  const apiUrl = environment.selfhosted.apiUrl;

  return http.post(`${apiUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
    tap((response: any) => {
      // Re-apply encryption config from refresh response (key is memory-only)
      if (response?.encryptionConfig) {
        cryptic.loadFromServer(response.encryptionConfig);
      }
    }),
    switchMap(() => {
      isRefreshing = false;
      refreshGate$.next(true);
      // Retry the original request — new cookie is already set by the refresh response
      return next(req);
    }),
    catchError((refreshError: HttpErrorResponse) => {
      isRefreshing = false;
      // Only treat a definitive auth failure (401/403) as a real logout signal.
      // Network errors, 5xx, or status 0 are transient — keep the local session so
      // the user can keep using cached data instead of being booted to the landing page.
      const isAuthFailure = refreshError?.status === 401 || refreshError?.status === 403;
      if (isAuthFailure) {
        refreshGate$.next(false);
        if (AppComponent.instance) {
          AppComponent.instance.logOut();
        } else {
          localStorage.removeItem('selfhosted_userId');
          router.navigate(['/']);
        }
      } else {
        // Transient: do not log out. Allow callers to see the error and retry later.
        // Signal queued requests to fail this attempt; next request will trigger a fresh refresh.
        refreshGate$.next(false);
      }
      return throwError(() => refreshError);
    })
  );
}
