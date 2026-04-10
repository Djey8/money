import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LocalService } from './local.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: any;
}

@Injectable({
  providedIn: 'root'
})
/**
 * Backend logging service for selfhosted mode.
 * Batches log entries and flushes them periodically to the backend API.
 * Also captures global unhandled errors and unhandled promise rejections.
 */
export class LoggingService {
  private apiUrl = environment.mode === 'selfhosted' && environment.selfhosted?.apiUrl 
    ? environment.selfhosted.apiUrl 
    : 'http://localhost:3000/api';
  private logQueue: LogEntry[] = [];
  private isProcessing = false;
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds

  constructor(
    private http: HttpClient,
    private localStorage: LocalService
  ) {
    // Only enable backend logging in selfhosted mode
    if (environment.mode === 'selfhosted') {
      this.startPeriodicFlush();
      this.setupGlobalErrorHandler();
    }
  }

  /**
   * Log debug information
   */
  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log general information
   */
  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warnings
   */
  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log errors
   */
  error(message: string, error?: any, context?: any): void {
    const errorContext = {
      ...context,
      error: this.serializeError(error)
    };
    this.log(LogLevel.ERROR, message, errorContext);
  }

  /**
   * Log user activity (page views, clicks, actions)
   */
  logUserActivity(action: string, details?: any): void {
    this.info(`User activity: ${action}`, {
      activityType: 'user_behavior',
      action,
      ...details,
      timestamp: new Date().toISOString(),
      page: window.location.pathname
    });
  }

  /**
   * Log API requests
   */
  logApiRequest(method: string, url: string, duration: number, status: number, error?: any): void {
    const message = `API ${method} ${url} - ${status}`;
    const context = {
      requestType: 'api_call',
      method,
      url,
      duration: `${duration}ms`,
      status
    };

    if (error) {
      this.error(message, error, context);
    } else if (status >= 400) {
      this.warn(message, context);
    } else {
      this.debug(message, context);
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: any): void {
    // Always log to console
    this.logToConsole(level, message, context);

    // Only send to backend in selfhosted mode
    if (environment.mode === 'selfhosted') {
      const userId = this.localStorage.getData('uid') || 'anonymous';
      
      this.logQueue.push({
        level,
        message,
        context: {
          ...context,
          userId,
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      });

      // Flush immediately for errors
      if (level === LogLevel.ERROR) {
        this.flush();
      }
    }
  }

  /**
   * Log to browser console
   */
  private logToConsole(level: LogLevel, message: string, context?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, context || '');
        break;
      case LogLevel.INFO:
        console.info(prefix, message, context || '');
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, context || '');
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, context || '');
        break;
    }
  }

  /**
   * Serialize error objects for logging
   */
  private serializeError(error: any): any {
    if (!error) return null;

    if (error instanceof HttpErrorResponse) {
      return {
        type: 'HttpErrorResponse',
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        url: error.url
      };
    }

    if (error instanceof Error) {
      return {
        type: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    return error;
  }

  /**
   * Send logs to backend
   */
  private flush(): void {
    if (this.isProcessing || this.logQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const logsToSend = this.logQueue.splice(0, this.batchSize);

    // Send each log entry (backend expects one log per request)
    logsToSend.forEach(log => {
      this.http.post(`${this.apiUrl}/api/logs`, log)
        .pipe(
          catchError(err => {
            // Silently fail - don't create infinite logging loop
            console.error('Failed to send log to backend:', err);
            return of(null);
          })
        )
        .subscribe();
    });

    this.isProcessing = false;
  }

  /**
   * Periodically flush logs to backend
   */
  private startPeriodicFlush(): void {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Setup global error handler
   */
  private setupGlobalErrorHandler(): void {
    window.addEventListener('error', (event) => {
      this.error('Uncaught error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        errorType: 'uncaught_error'
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', event.reason, {
        errorType: 'unhandled_rejection'
      });
    });
  }
}
