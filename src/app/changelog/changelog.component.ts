import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ChangelogService, ChangelogVersion } from '../shared/services/changelog.service';
import { DemoService } from '../shared/services/demo.service';

// Deferred import to break circular chain
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));

@Component({
  selector: 'app-changelog',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, RouterLink, TranslateModule],
  templateUrl: './changelog.component.html',
  styleUrls: ['./changelog.component.css', '../landing/landing-page.component.css', '../app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ChangelogComponent implements OnInit {

  versions: ChangelogVersion[] = [];
  selectedIndex = 0;
  loading = true;
  error = false;

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
      },
      error: () => {
        this.loading = false;
        this.error = true;
      }
    });
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
