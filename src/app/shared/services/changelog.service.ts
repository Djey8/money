import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay, catchError, of, forkJoin, switchMap } from 'rxjs';

export interface ChangelogItem {
  text: string;
  author?: string;
  authorUrl?: string;
  avatarUrl?: string;
}

export interface ChangelogVersion {
  version: string;
  date: string;
  sections: { heading: string; items: ChangelogItem[] }[];
  authors?: { login: string; avatarUrl: string; url: string }[];
  prNumber?: number;
  prUrl?: string;
}

interface GitHubTag {
  name: string;
  commit: { sha: string };
}

interface GitHubCommit {
  sha: string;
  commit: { message: string };
  author: { login: string; avatar_url: string; html_url: string } | null;
}

interface GitHubCompare {
  commits: GitHubCommit[];
}

@Injectable({ providedIn: 'root' })
export class ChangelogService {

  private readonly repoApiUrl = 'https://api.github.com/repos/Djey8/money';
  private readonly repoUrl = 'https://github.com/Djey8/money';
  private readonly apiHeaders = { Accept: 'application/vnd.github.v3+json' };
  private cache$: Observable<ChangelogVersion[]> | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Fetches CHANGELOG.md from the GitHub API, decodes the Base64 content,
   * parses it into structured version entries, and caches the result.
   */
  getVersions(): Observable<ChangelogVersion[]> {
    if (!this.cache$) {
      this.cache$ = this.http
        .get<{ content: string; encoding: string }>(`${this.repoApiUrl}/contents/CHANGELOG.md`, {
          headers: this.apiHeaders
        })
        .pipe(
          map(response => {
            const decoded = this.decodeBase64Utf8(response.content);
            return this.parseChangelog(decoded);
          }),
          switchMap(versions => this.enrichVersions(versions)),
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

  /** Fetch tags, compare consecutive ones for authors and PR per version. */
  private enrichVersions(versions: ChangelogVersion[]): Observable<ChangelogVersion[]> {
    return this.http.get<GitHubTag[]>(`${this.repoApiUrl}/tags?per_page=100`, { headers: this.apiHeaders }).pipe(
      switchMap(tags => {
        const tagMap = new Map<string, { name: string; sha: string }>();
        for (const t of tags) {
          tagMap.set(t.name.replace(/^v/, ''), { name: t.name, sha: t.commit.sha });
        }

        const enriched$: Observable<ChangelogVersion>[] = versions.map((version, i) => {
          const currentTag = tagMap.get(version.version);
          const prevVersion = versions[i + 1];
          const prevTag = prevVersion ? tagMap.get(prevVersion.version) : null;

          if (!currentTag || !prevTag) return of(version);

          return this.http.get<GitHubCompare>(
            `${this.repoApiUrl}/compare/${prevTag.name}...${currentTag.name}`,
            { headers: this.apiHeaders }
          ).pipe(
            map(compare => this.matchCommitsToVersion(version, compare.commits)),
            catchError(() => of(version))
          );
        });

        return forkJoin(enriched$);
      }),
      catchError(() => of(versions))
    );
  }

  /** Match commits to changelog items for authors, and find the version's PR from merge commit. */
  private matchCommitsToVersion(version: ChangelogVersion, commits: GitHubCommit[]): ChangelogVersion {
    const authorMap = new Map<string, { login: string; avatarUrl: string; url: string }>();

    for (const section of version.sections) {
      for (const item of section.items) {
        const normalize = (s: string) => s.replace(/\s*\(#\d+\)\s*$/, '').trim().toLowerCase();
        const itemNorm = normalize(item.text);

        const match = commits.find(c => {
          const firstLine = c.commit.message.split('\n')[0];
          return normalize(firstLine) === itemNorm || normalize(firstLine).includes(itemNorm) || itemNorm.includes(normalize(firstLine));
        });

        if (match?.author) {
          item.author = match.author.login;
          item.authorUrl = match.author.html_url;
          item.avatarUrl = match.author.avatar_url;
          authorMap.set(match.author.login, {
            login: match.author.login,
            avatarUrl: match.author.avatar_url,
            url: match.author.html_url
          });
        }
      }
    }

    version.authors = Array.from(authorMap.values());

    // Find the version PR — look for "Merge pull request #N" first, then any (#N) in commit messages
    for (const c of [...commits].reverse()) {
      const mergeMatch = c.commit.message.match(/Merge pull request #(\d+)/);
      if (mergeMatch) {
        version.prNumber = parseInt(mergeMatch[1], 10);
        version.prUrl = `${this.repoUrl}/pull/${version.prNumber}`;
        return version;
      }
    }
    for (const c of [...commits].reverse()) {
      const prMatch = c.commit.message.match(/\(#(\d+)\)/);
      if (prMatch) {
        version.prNumber = parseInt(prMatch[1], 10);
        version.prUrl = `${this.repoUrl}/pull/${version.prNumber}`;
        return version;
      }
    }

    return version;
  }

  /**
   * Parses a Keep-a-Changelog–style markdown string into an array of versions.
   * Each `## [x.y.z] - YYYY-MM-DD` block becomes one ChangelogVersion entry.
   */
  private parseChangelog(md: string): ChangelogVersion[] {
    const versions: ChangelogVersion[] = [];
    const lines = md.split('\n');

    let current: ChangelogVersion | null = null;
    let currentSection: { heading: string; items: ChangelogItem[] } | null = null;

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
        currentSection.items.push({ text: itemMatch[1].trim() });
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
