import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ChangelogService, ChangelogVersion } from '../shared/services/changelog.service';
import { DemoService } from '../shared/services/demo.service';
import { AppDatePipe } from '../shared/pipes/app-date.pipe';

interface SidebarEntry {
  label: string;       // e.g. "v1.2.1" or "1.2.x"
  isGroup: boolean;    // true for consolidated entries
  versions: ChangelogVersion[];
}

// Deferred import to break circular chain
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));

@Component({
  selector: 'app-changelog',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule, RouterLink, TranslateModule, AppDatePipe],
  templateUrl: './changelog.component.html',
  styleUrls: ['./changelog.component.css', '../landing/landing-page.component.css', '../app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ChangelogComponent implements OnInit {

  versions: ChangelogVersion[] = [];
  loading = true;
  error = false;

  /** Normal view state */
  selectedIndex = 0;

  /** Group view state */
  groupMode = false;
  groupEntries: SidebarEntry[] = [];
  selectedGroupIndex = 0;

  constructor(private changelogService: ChangelogService, private demoService: DemoService, private router: Router) {}

  get appReference() { return AppComponent; }

  closeNav(): void {
    const toggle = document.getElementById('nav-toggle') as HTMLInputElement;
    if (toggle) { toggle.checked = false; }
  }

  launchDemo(): void {
    this.demoService.startDemo();
  }

  navigateToSection(sectionId: string): void {
    this.router.navigateByUrl('/').then(() => {
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
  }

  ngOnInit(): void {
    this.changelogService.getVersions().subscribe({
      next: versions => {
        this.versions = versions;
        this.loading = false;
        this.error = versions.length === 0;
        this.buildGroupEntries();
      },
      error: () => {
        this.loading = false;
        this.error = true;
      }
    });
  }

  /** Build consolidated group entries (only groups with ≥2 versions) */
  private buildGroupEntries(): void {
    const entries: SidebarEntry[] = [];
    const majorMap = new Map<string, ChangelogVersion[]>();
    const minorMap = new Map<string, ChangelogVersion[]>();

    for (const v of this.versions) {
      const [maj, min] = v.version.split('.');
      const majorKey = maj + '.x.x';
      const minorKey = maj + '.' + min + '.x';
      majorMap.set(majorKey, [...(majorMap.get(majorKey) || []), v]);
      minorMap.set(minorKey, [...(minorMap.get(minorKey) || []), v]);
    }

    const sortDesc = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true });

    for (const key of Array.from(majorMap.keys()).sort(sortDesc)) {
      const members = majorMap.get(key)!;
      if (members.length >= 2) {
        entries.push({ label: key, isGroup: true, versions: members });
      }
    }
    for (const key of Array.from(minorMap.keys()).sort(sortDesc)) {
      const members = minorMap.get(key)!;
      if (members.length >= 2) {
        entries.push({ label: key, isGroup: true, versions: members });
      }
    }

    this.groupEntries = entries;
  }

  /** Toggle between normal and group view */
  toggleGroupMode(): void {
    this.groupMode = !this.groupMode;
    if (this.groupMode) {
      this.selectedGroupIndex = 0;
    }
  }

  /** Versions to display in the main area */
  get displayVersions(): ChangelogVersion[] {
    if (this.groupMode) {
      return this.groupEntries[this.selectedGroupIndex]?.versions ?? [];
    }
    return this.selected ? [this.selected] : [];
  }

  get selected(): ChangelogVersion | null {
    return this.versions[this.selectedIndex] ?? null;
  }

  get isLatest(): boolean {
    return this.selectedIndex === 0;
  }

  get isOldest(): boolean {
    return this.selectedIndex === this.versions.length - 1;
  }

  goNewer(): void {
    if (this.selectedIndex > 0) this.selectedIndex--;
  }

  goOlder(): void {
    if (this.selectedIndex < this.versions.length - 1) this.selectedIndex++;
  }

  selectVersion(index: number): void {
    this.selectedIndex = index;
  }

  selectGroup(index: number): void {
    this.selectedGroupIndex = index;
  }

  /** Map section headings to icon CSS classes */
  sectionIcon(heading: string): string {
    const h = heading.toLowerCase();
    if (h.includes('feature')) return 'icon-feature';
    if (h.includes('fix') || h.includes('bug')) return 'icon-fix';
    if (h.includes('break')) return 'icon-breaking';
    if (h.includes('deprecat')) return 'icon-deprecated';
    if (h.includes('remov')) return 'icon-removed';
    if (h.includes('security')) return 'icon-security';
    if (h.includes('perf')) return 'icon-perf';
    return 'icon-change';
  }
}
