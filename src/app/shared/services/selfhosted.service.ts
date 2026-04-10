import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
/**
 * HTTP client for the selfhosted CouchDB backend API.
 * Handles authentication (JWT tokens), user CRUD, and document read/write operations.
 */
export class SelfhostedService {
  private apiUrl = environment.selfhosted.apiUrl;
  private token: string | null = null;
  /** Stores the last ETag per endpoint key so we can send If-None-Match */
  private etagCache: Record<string, string> = {};

  constructor(private http: HttpClient) {
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('selfhosted_token');
  }

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (this.token) {
      headers = headers.set('Authorization', `Bearer ${this.token}`);
    }
    
    return headers;
  }

  // Authentication methods
  register(email: string, password: string, username?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, { email, password, username })
      .pipe(
        map((response: any) => {
          if (response.token) {
            this.token = response.token;
            localStorage.setItem('selfhosted_token', response.token);
            localStorage.setItem('selfhosted_userId', response.userId);
          }
          return response;
        })
      );
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, { email, password })
      .pipe(
        map((response: any) => {
          if (response.token) {
            this.token = response.token;
            localStorage.setItem('selfhosted_token', response.token);
            localStorage.setItem('selfhosted_userId', response.userId);
          }
          return response;
        })
      );
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('selfhosted_token');
    localStorage.removeItem('selfhosted_userId');
  }

  verifyToken(): Observable<boolean> {
    if (!this.token) {
      return of(false);
    }

    return this.http.get(`${this.apiUrl}/auth/verify`, { headers: this.getHeaders() })
      .pipe(
        map((response: any) => response.valid),
        catchError(() => of(false))
      );
  }

  updateEmail(newEmail: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/auth/update-email`, { newEmail }, { headers: this.getHeaders() })
      .pipe(
        map((response: any) => {
          if (response.token) {
            // Update token with new email in JWT
            this.token = response.token;
            localStorage.setItem('selfhosted_token', response.token);
          }
          return response;
        })
      );
  }

  verifyPassword(password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/verify-password`, { password }, { headers: this.getHeaders() });
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  getUserId(): string | null {
    return localStorage.getItem('selfhosted_userId');
  }

  // Data methods
  writeObject(tag: string, data: any): Observable<any> {
    // Write data directly to the specified path
    // The backend will handle nested JSON structure
    
    // Determine content type and body based on data type
    let headers = this.getHeaders();
    let body = data;
    
    // For primitive types (string, number, boolean), send as text/plain
    // This avoids JSON serialization issues with standalone primitive values
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      headers = headers.set('Content-Type', 'text/plain');
      body = String(data);
    }
    // For objects and arrays, keep application/json (already set in getHeaders)
    
    return this.http.post(`${this.apiUrl}/data/write/${tag}`, body, { 
      headers: headers
    });
  }

  /**
   * Batch write multiple objects in a single request (optimization for selfhosted)
   * @param writes - Array of write operations { path, data }
   * @returns Observable of batch write result
   */
  writeBatch(writes: {path: string, data: any}[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/data/write/batch`, 
      { writes }, 
      { headers: this.getHeaders() }
    ).pipe(
      tap({
        error: (error) => console.error('[SelfhostedService] Batch write failed:', error)
      })
    );
  }

  getData(tag: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/data/read/${tag}`, { headers: this.getHeaders() })
      .pipe(
        map((response: any) => response.data)
      );
  }

  getFullDocument(): Observable<any> {
    return this.http.get(`${this.apiUrl}/data/document`, { headers: this.getHeaders() });
  }

  deleteData(tag: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/data/delete/${tag}`, { headers: this.getHeaders() });
  }

  readBatch(paths: string[]): Observable<{data: Record<string, any>, updatedAt: string | null} | null> {
    let headers = this.getHeaders();
    const cacheKey = 'batch:' + paths.sort().join(',');
    const etag = this.etagCache[cacheKey];
    if (etag) {
      headers = headers.set('If-None-Match', etag);
    }
    return this.http.post<{data: Record<string, any>, updatedAt: string | null}>(
      `${this.apiUrl}/data/read/batch`,
      { paths },
      { headers, observe: 'response' }
    ).pipe(
      map((resp: HttpResponse<{data: Record<string, any>, updatedAt: string | null}>) => {
        const serverEtag = resp.headers.get('ETag');
        if (serverEtag) this.etagCache[cacheKey] = serverEtag;
        return resp.body;
      }),
      catchError(err => {
        if (err.status === 304) return of(null);  // not modified
        throw err;
      })
    );
  }

  getUpdatedAt(): Observable<{updatedAt: string | null} | null> {
    let headers = this.getHeaders();
    const cacheKey = 'updatedAt';
    const etag = this.etagCache[cacheKey];
    if (etag) {
      headers = headers.set('If-None-Match', etag);
    }
    return this.http.get<{updatedAt: string | null}>(
      `${this.apiUrl}/data/updatedAt`,
      { headers, observe: 'response' }
    ).pipe(
      map((resp: HttpResponse<{updatedAt: string | null}>) => {
        const serverEtag = resp.headers.get('ETag');
        if (serverEtag) this.etagCache[cacheKey] = serverEtag;
        return resp.body;
      }),
      catchError(err => {
        if (err.status === 304) return of(null);  // not modified
        throw err;
      })
    );
  }

  /** Clear cached ETags (call after writes so next read fetches fresh data) */
  clearEtagCache(): void {
    this.etagCache = {};
  }

  /** Delete the current user's account (auth + data) from the backend */
  deleteAccount(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/auth/delete-account`, { headers: this.getHeaders() });
  }
}
