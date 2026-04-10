import { Injectable } from '@angular/core';

const ERROR_MAP: Record<string, string> = {
  // Firebase Auth errors
  'auth/email-already-in-use': 'This email is already registered. Please log in or use a different email.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/user-not-found': 'No account found with this email. Please register first.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Invalid email or password. Please try again.',
  'auth/too-many-requests': 'Too many failed attempts. Please wait a moment and try again.',
  'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/requires-recent-login': 'Please log in again to perform this action.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
  // HTTP / selfhosted errors
  'ECONNREFUSED': 'Cannot connect to server. Please check that the server is running.',
  'ETIMEDOUT': 'Connection timed out. Please try again.',
  '401': 'Invalid credentials. Please check your email and password.',
  '403': 'Access denied. You do not have permission for this action.',
  '404': 'Service not found. Please check your server configuration.',
  '500': 'Server error. Please try again later.',
};

@Injectable({ providedIn: 'root' })
export class ErrorMapperService {

  /** Maps a raw error to a user-friendly message. */
  toUserMessage(error: any, fallback = 'Something went wrong. Please try again.'): string {
    if (!error) return fallback;

    // Firebase errors have a code property
    const code = error.code || error.status?.toString();
    if (code && ERROR_MAP[code]) {
      return ERROR_MAP[code];
    }

    // Check if the message itself contains a known pattern
    const msg = error.message || error.error?.error || (typeof error === 'string' ? error : '');
    for (const [key, friendly] of Object.entries(ERROR_MAP)) {
      if (msg.includes(key)) {
        return friendly;
      }
    }

    return fallback;
  }
}
