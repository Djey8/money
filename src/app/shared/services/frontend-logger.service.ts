import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LocalService } from './local.service';
import { CrypticService } from './cryptic.service';

/**
 * Frontend logging service that sends user activity logs to backend/Loki
 * for monitoring and debugging purposes.
 * 
 * Logs important user actions like:
 * - Authentication (login, register, logout)
 * - Data operations (add, update, delete)
 * - Navigation and page views
 * - Errors and warnings
 * 
 * Sensitive data (amounts, accounts, categories, etc.) is encrypted
 * using the same encryption as database storage when encryption is enabled.
 */
@Injectable({
  providedIn: 'root'
})
export class FrontendLoggerService {
  private apiUrl = environment.mode === 'selfhosted' 
    ? environment.selfhosted.apiUrl 
    : '';
  private batchQueue: any[] = [];
  private batchInterval: any;
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_TIMEOUT = 5000; // 5 seconds

  // Fields to encrypt in log details (sensitive data)
  private readonly SENSITIVE_FIELDS = [
    'amount', 'account', 'category', 'title', 'value', 
    'balance', 'income', 'expense', 'savings', 'price',
    'accountFrom', 'accountTo', 'description', 'note',
    'date', 'dateFrom', 'dateTo', 'dueDate'
  ];

  constructor(
    private http: HttpClient,
    private localStorage: LocalService,
    private cryptic: CrypticService
  ) {
    // Start batch processing
    this.startBatchProcessing();
  }

  /**
   * Log user activity with structured data
   * @param action - The action performed (e.g., 'login', 'add_transaction')
   * @param level - Log level: 'info', 'warning', 'error'
   * @param details - Additional context data
   */
  logActivity(action: string, level: 'info' | 'warning' | 'error' = 'info', details?: any): void {
    // Encrypt sensitive fields in details if encryption is enabled
    const encryptedDetails = this.encryptSensitiveFields(details || {});

    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      level,
      userId: this.getUserId(),
      username: this.getUsername(),
      details: encryptedDetails,
      userAgent: navigator.userAgent,
      url: window.location.pathname,
      mode: environment.mode
    };

    // Also log to console for development
    const consoleMsg = `[FrontendLog] ${level.toUpperCase()} - ${action}`;
    if (level === 'error') {
      console.error(consoleMsg, details);
    } else if (level === 'warning') {
      console.warn(consoleMsg, details);
    } else {
      console.log(consoleMsg, details);
    }

    // Add to batch queue
    this.batchQueue.push(logEntry);

    // Send immediately if critical or batch is full
    if (level === 'error' || this.batchQueue.length >= this.BATCH_SIZE) {
      this.flushBatch();
    }
  }

  /**
   * Log authentication events
   */
  logAuth(action: 'login' | 'register' | 'logout', success: boolean, details?: any): void {
    this.logActivity(`auth_${action}`, success ? 'info' : 'warning', {
      success,
      ...details
    });
  }

  /**
   * Log data operations (add, update, delete)
   */
  logDataOperation(
    operation: 'add' | 'update' | 'delete',
    entityType: string,
    entityId?: string,
    details?: any
  ): void {
    this.logActivity(`${operation}_${entityType}`, 'info', {
      entityType,
      entityId,
      ...details
    });
  }

  /**
   * Log navigation events
   */
  logNavigation(page: string, details?: any): void {
    this.logActivity('navigate', 'info', {
      page,
      ...details
    });
  }

  /**
   * Log errors
   */
  logError(error: Error | string, context?: string, details?: any): void {
    const errorDetails = {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      ...details
    };
    this.logActivity('error', 'error', errorDetails);
  }

  /**
   * Log warnings
   */
  logWarning(message: string, details?: any): void {
    this.logActivity('warning', 'warning', {
      message,
      ...details
    });
  }

  /**
   * Flush the batch queue immediately
   */
  flushBatch(): void {
    if (this.batchQueue.length === 0) {
      return;
    }

    const logsToSend = [...this.batchQueue];
    this.batchQueue = [];

    // Send logs to backend
    if (environment.mode === 'selfhosted') {
      this.sendLogsToBackend(logsToSend);
    } else {
      // For Firebase mode, you could send to Firebase Analytics or Cloud Logging
      console.log('[FrontendLogger] Batch logs ready (Firebase mode):', logsToSend.length);
    }
  }

  /**
   * Send logs to backend
   */
  private sendLogsToBackend(logs: any[]): void {
    const token = localStorage.getItem('selfhosted_token');
    if (!token) {
      console.warn('[FrontendLogger] No auth token, skipping log send');
      return;
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    this.http.post(`${this.apiUrl}/logs/frontend`, { logs }, { headers })
      .subscribe({
        next: () => {
          console.log(`[FrontendLogger] Sent ${logs.length} logs to backend`);
        },
        error: (error) => {
          console.error('[FrontendLogger] Failed to send logs:', error);
          // Don't retry to avoid infinite loops
        }
      });
  }

  /**
   * Start batch processing with interval
   */
  private startBatchProcessing(): void {
    this.batchInterval = setInterval(() => {
      this.flushBatch();
    }, this.BATCH_TIMEOUT);

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flushBatch();
    });
  }

  /**
   * Get current user ID
   */
  private getUserId(): string | null {
    if (environment.mode === 'selfhosted') {
      return localStorage.getItem('selfhosted_userId');
    } else {
      return this.localStorage.getData('uid') || null;
    }
  }

  /**
   * Get current username
   */
  private getUsername(): string | null {
    return this.localStorage.getData('username') || null;
  }

  /**
   * Encrypt sensitive fields in the details object
   * Uses the same encryption as database storage (if enabled)
   */
  private encryptSensitiveFields(details: any): any {
    // If database encryption is not enabled, return details as-is
    if (!this.cryptic.getEncryptionDatabaseEnabled()) {
      return details;
    }

    // Deep clone to avoid modifying original
    const clonedDetails = JSON.parse(JSON.stringify(details));

    // Recursively encrypt sensitive fields
    const encryptObject = (obj: any): void => {
      if (!obj || typeof obj !== 'object') {
        return;
      }

      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) {
          continue;
        }

        // Check if this field should be encrypted
        if (this.SENSITIVE_FIELDS.includes(key)) {
          const value = obj[key];
          if (value !== null && value !== undefined && value !== '') {
            // Encrypt the value using database encryption
            obj[key] = this.cryptic.encrypt(value.toString(), 'database');
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          // Recursively process nested objects
          encryptObject(obj[key]);
        }
      }
    };

    encryptObject(clonedDetails);
    return clonedDetails;
  }

  /**
   * Cleanup on service destroy
   */
  ngOnDestroy(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }
    this.flushBatch();
  }
}
