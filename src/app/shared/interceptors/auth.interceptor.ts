import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

let isRefreshing = false;

/**
 * HTTP interceptor that:
 * 1. Adds withCredentials to all API requests (sends httpOnly cookies)
 * 2. On 401 with TOKEN_EXPIRED, attempts to refresh the access token
 * 3. On refresh failure, redirects to login
 */
export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
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
        return handleTokenExpiry(credentialReq, next);
      }
      return throwError(() => error);
    })
  );
};

function handleTokenExpiry(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  if (isRefreshing) {
    // Already refreshing — fail this request (avoids infinite loops)
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Refreshing' }));
  }

  isRefreshing = true;
  const http = inject(HttpClient);
  const router = inject(Router);
  const apiUrl = environment.selfhosted.apiUrl;

  return http.post(`${apiUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
    switchMap(() => {
      isRefreshing = false;
      // Retry the original request — new cookie is already set by the refresh response
      return next(req);
    }),
    catchError((refreshError) => {
      isRefreshing = false;
      // Refresh failed — session is gone, redirect to login
      localStorage.removeItem('selfhosted_userId');
      router.navigate(['/authentication']);
      return throwError(() => refreshError);
    })
  );
}
