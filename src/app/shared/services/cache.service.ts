import { Injectable } from '@angular/core';

/**
 * Cache entry interface
 */
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

/**
 * Service to cache database reads and reduce redundant HTTP requests.
 * 
 * This is used to optimize selfhosted mode by caching frequently accessed data,
 * reducing read requests significantly.
 */
@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private cache = new Map<string, CacheEntry>();
  private DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Clean expired entries every minute
    setInterval(() => this.cleanExpired(), 60000);
  }

  /**
   * Get cached data or null if expired/missing
   * @param key - The cache key
   * @returns The cached data or null
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Store data in cache
   * @param key - The cache key
   * @param data - The data to cache
   * @param ttlMs - Time to live in milliseconds (default: 5 minutes)
   */
  set(key: string, data: any, ttlMs: number = this.DEFAULT_TTL): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs
    };
    this.cache.set(key, entry);
  }

  /**
   * Invalidate cached entry
   * @param key - The cache key to invalidate
   */
  invalidate(key: string): void {
    const deleted = this.cache.delete(key);
    if (deleted) {
    }
  }

  /**
   * Invalidate multiple entries
   * @param keys - Array of cache keys to invalidate
   */
  invalidateMultiple(keys: string[]): void {
    keys.forEach(key => this.invalidate(key));
  }

  /**
   * Invalidate all entries matching a pattern
   * @param pattern - Regex pattern to match keys
   */
  invalidatePattern(pattern: RegExp): void {
    const keysToInvalidate: string[] = [];
    this.cache.forEach((_, key) => {
      if (pattern.test(key)) {
        keysToInvalidate.push(key);
      }
    });
    keysToInvalidate.forEach(key => this.invalidate(key));
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    const size = this.cache.size;
    this.cache.clear();
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
    }
  }

  /**
   * Get cache statistics
   * @returns Object with cache stats
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Check if a key exists in cache and is not expired
   * @param key - The cache key to check
   * @returns true if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}
