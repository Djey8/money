import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay, catchError, of } from 'rxjs';

export interface ChangelogVersion {
  version: string;
  date: string;
  sections: { heading: string; items: string[] }[];
}

@Injectable({ providedIn: 'root' })
export class ChangelogService {

  private readonly apiUrl = 'https://api.github.com/repos/Djey8/money/contents/CHANGELOG.md';
  private cache$: Observable<ChangelogVersion[]> | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Fetches CHANGELOG.md from the GitHub API, decodes the Base64 content,
   * parses it into structured version entries, and caches the result.
   */
  getVersions(): Observable<ChangelogVersion[]> {
    if (!this.cache$) {
      this.cache$ = this.http
        .get<{ content: string; encoding: string }>(this.apiUrl, {
          headers: { Accept: 'application/vnd.github.v3+json' }
        })
        .pipe(
          map(response => {
            const decoded = this.decodeBase64Utf8(response.content);
            return this.parseChangelog(decoded);
          }),
          shareReplay(1),
          catchError(() => of([]))
        );
    }
    return this.cache$;
  }

  /** Decode Base64 content with proper UTF-8 support. */
  private decodeBase64Utf8(base64: string): string {
    const binary = atob(base64.replace(/\n/g, ''));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  /** Invalidate the cached result so the next call re-fetches. */
  clearCache(): void {
    this.cache$ = null;
  }

  /**
   * Parses a Keep-a-Changelog–style markdown string into an array of versions.
   * Each `## [x.y.z] - YYYY-MM-DD` block becomes one ChangelogVersion entry.
   */
  private parseChangelog(md: string): ChangelogVersion[] {
    const versions: ChangelogVersion[] = [];
    const lines = md.split('\n');

    let current: ChangelogVersion | null = null;
    let currentSection: { heading: string; items: string[] } | null = null;

    for (const line of lines) {
      // Match version heading: ## [1.0.0] - 2026-04-10
      const versionMatch = line.match(/^##\s+\[([^\]]+)\]\s*-?\s*([\d-]*)/);
      if (versionMatch) {
        if (current) {
          if (currentSection && currentSection.items.length) current.sections.push(currentSection);
          versions.push(current);
        }
        current = { version: versionMatch[1], date: versionMatch[2] || '', sections: [] };
        currentSection = null;
        continue;
      }

      // Match section heading: ### Features, ### Bug Fixes, etc.
      const sectionMatch = line.match(/^###\s+(.+)/);
      if (sectionMatch && current) {
        if (currentSection && currentSection.items.length) current.sections.push(currentSection);
        currentSection = { heading: sectionMatch[1].trim(), items: [] };
        continue;
      }

      // Match list item: - some change
      const itemMatch = line.match(/^-\s+(.+)/);
      if (itemMatch && current) {
        if (!currentSection) {
          currentSection = { heading: 'Changes', items: [] };
        }
        currentSection.items.push(itemMatch[1].trim());
      }
    }

    // Push the last version
    if (current) {
      if (currentSection && currentSection.items.length) current.sections.push(currentSection);
      versions.push(current);
    }

    return versions;
  }
}
