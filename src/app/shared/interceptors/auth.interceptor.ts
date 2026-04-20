import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, switchMap, throwError, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { AppComponent } from '../../app.component';
import { CrypticService } from '../services/cryptic.service';

let isRefreshing = false;

/**
 * HTTP interceptor that:
 * 1. Adds withCredentials to all API requests (sends httpOnly cookies)
 * 2. On 401 with TOKEN_EXPIRED, attempts to refresh the access token
 * 3. On refresh failure, redirects to login
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
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh') && !req.url.includes('/auth/login')) {
        return handleTokenExpiry(credentialReq, next, http, router, cryptic);
      }
      return throwError(() => error);
    })
  );
};

function handleTokenExpiry(req: HttpRequest<unknown>, next: HttpHandlerFn, http: HttpClient, router: Router, cryptic: CrypticService) {
  if (isRefreshing) {
    // Already refreshing — fail this request (avoids infinite loops)
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Refreshing' }));
  }

  isRefreshing = true;
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
      // Retry the original request — new cookie is already set by the refresh response
      return next(req);
    }),
    catchError((refreshError) => {
      isRefreshing = false;
      // Refresh failed — session is gone, clean logout to clear encrypted data
      if (AppComponent.instance) {
        AppComponent.instance.logOut();
      } else {
        localStorage.removeItem('selfhosted_userId');
        router.navigate(['/']);
      }
      return throwError(() => refreshError);
    })
  );
}
