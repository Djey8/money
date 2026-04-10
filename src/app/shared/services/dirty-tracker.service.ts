import { Injectable } from '@angular/core';

/**
 * Service to track which data objects have been modified (dirty)
 * and need to be written to the database.
 * 
 * This is used to optimize selfhosted mode by only writing changed data,
 * reducing HTTP requests from 14+ per update to 1-3.
 */
@Injectable({
  providedIn: 'root'
})
export class DirtyTrackerService {
  private dirtyTags: Set<string> = new Set();
  private lastSnapshots: Map<string, string> = new Map();

  constructor() {
  }

  /**
   * Mark a data tag as dirty (needs saving)
   * @param tag - The tag to mark as dirty (e.g., 'transactions', 'budget')
   */
  markDirty(tag: string): void {
    this.dirtyTags.add(tag);
  }

  /**
   * Check if a tag is dirty
   * @param tag - The tag to check
   * @returns true if the tag is marked dirty
   */
  isDirty(tag: string): boolean {
    return this.dirtyTags.has(tag);
  }

  /**
   * Mark a tag as clean (just saved)
   * @param tag - The tag to mark as clean
   */
  markClean(tag: string): void {
    this.dirtyTags.delete(tag);
  }

  /**
   * Get all dirty tags
   * @returns Array of dirty tags
   */
  getDirtyTags(): string[] {
    return Array.from(this.dirtyTags);
  }

  /**
   * Clear all dirty flags
   */
  clearAll(): void {
    this.dirtyTags.clear();
  }

  /**
   * Take a snapshot of data for comparison
   * @param tag - The tag to snapshot
   * @param data - The data to snapshot
   */
  takeSnapshot(tag: string, data: any): void {
    try {
      this.lastSnapshots.set(tag, JSON.stringify(data));
    } catch (error) {
      console.error(`[DirtyTracker] Failed to snapshot ${tag}:`, error);
    }
  }

  /**
   * Check if data has changed since last snapshot
   * @param tag - The tag to check
   * @param data - The current data
   * @returns true if data has changed or no snapshot exists
   */
  hasChanged(tag: string, data: any): boolean {
    const snapshot = this.lastSnapshots.get(tag);
    if (!snapshot) {
      return true; // No snapshot = assume changed
    }
    
    try {
      const current = JSON.stringify(data);
      const changed = snapshot !== current;
      return changed;
    } catch (error) {
      console.error(`[DirtyTracker] Failed to compare ${tag}:`, error);
      return true; // On error, assume changed to be safe
    }
  }

  /**
   * Clear snapshot for a specific tag
   * @param tag - The tag to clear snapshot for
   */
  clearSnapshot(tag: string): void {
    this.lastSnapshots.delete(tag);
  }

  /**
   * Clear all snapshots
   */
  clearAllSnapshots(): void {
    this.lastSnapshots.clear();
  }

  /**
   * Get statistics about dirty tracking
   * @returns Object with dirty tracking stats
   */
  getStats(): { dirtyCount: number; snapshotCount: number; dirtyTags: string[] } {
    return {
      dirtyCount: this.dirtyTags.size,
      snapshotCount: this.lastSnapshots.size,
      dirtyTags: this.getDirtyTags()
    };
  }
}
