import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DemoService } from '../../shared/services/demo.service';

// Deferred import to break circular chain
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));

export interface DocSection {
  id: string;
  number: string;
  level: number;
}

/** Branching navigation map — keys are section ids */
interface NavLink { id: string; }
interface NavRoute {
  prev?: NavLink[];   // one or two previous options
  next?: NavLink[];   // one or two next options
}

@Component({
  selector: 'app-selfhosted-docs',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, RouterLink, TranslateModule],
  templateUrl: './selfhosted-docs.component.html',
  styleUrls: ['./selfhosted-docs.component.css', '../../landing/landing-page.component.css', '../../app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class SelfhostedDocsComponent implements OnInit {

  sections: DocSection[] = [
    { id: 'overview',    number: '1',     level: 0 },
    { id: 'techstack',   number: '2',     level: 0 },
    { id: 'prereqs',     number: '3',     level: 0 },
    { id: 'deployment',  number: '4',     level: 0 },
    { id: 'docker',      number: '4.1',   level: 1 },
    { id: 'k3s',         number: '4.2',   level: 1 },
    { id: 'deploy',      number: '4.2.1', level: 2 },
    { id: 'domain',      number: '5',     level: 0 },
    { id: 'monitoring',  number: '6',     level: 0 },
    { id: 'backups',     number: '7',     level: 0 },
    { id: 'raspi',       number: '8',     level: 0 },
    { id: 'config',      number: '9',     level: 0 },
    { id: 'migration',   number: '10',    level: 0 }
  ];

  selectedIndex = 0;
  copiedSnippet: string | null = null;
  private copyTimeout: any;

  /**
   * Branching navigation: after Deployment the user chooses a path
   * (Podman or K3s). Both paths converge back at Custom Domain.
   *
   * Deployment ──┬── Podman Compose ───────────── Custom Domain ── …
   *              └── K3s ── Deploy Script ──────┘
   */
  private navMap: Record<string, NavRoute> = {
    overview:   { next: [{ id: 'techstack' }] },
    techstack:  { prev: [{ id: 'overview' }],   next: [{ id: 'prereqs' }] },
    prereqs:    { prev: [{ id: 'techstack' }],  next: [{ id: 'deployment' }] },
    deployment: { prev: [{ id: 'prereqs' }],    next: [{ id: 'docker' }, { id: 'k3s' }] },
    docker:     { prev: [{ id: 'deployment' }], next: [{ id: 'domain' }] },
    k3s:        { prev: [{ id: 'deployment' }], next: [{ id: 'deploy' }] },
    deploy:     { prev: [{ id: 'k3s' }],        next: [{ id: 'domain' }] },
    domain:     { prev: [{ id: 'docker' }, { id: 'deploy' }], next: [{ id: 'monitoring' }] },
    monitoring: { prev: [{ id: 'domain' }],     next: [{ id: 'backups' }] },
    backups:    { prev: [{ id: 'monitoring' }],  next: [{ id: 'raspi' }] },
    raspi:      { prev: [{ id: 'backups' }],     next: [{ id: 'config' }] },
    config:     { prev: [{ id: 'raspi' }],       next: [{ id: 'migration' }] },
    migration:  { prev: [{ id: 'config' }] }
  };

  /** Resolve NavLink[] for current section */
  getNavPrev(): NavLink[] { return this.navMap[this.selected.id]?.prev ?? []; }
  getNavNext(): NavLink[] { return this.navMap[this.selected.id]?.next ?? []; }

  sectionByIndex(id: string): number {
    return this.sections.findIndex(s => s.id === id);
  }
  sectionById(id: string): DocSection | undefined {
    return this.sections.find(s => s.id === id);
  }

  constructor(
    private demoService: DemoService,
    private translate: TranslateService,
    private router: Router
  ) {
    const saved = localStorage.getItem('landingLang');
    if (saved) { this.translate.use(saved); }
  }

  get appReference() { return AppComponent; }

  ngOnInit(): void {
    window.scrollTo({ top: 0 });
    // Check for fragment in URL to jump to section
    const hash = window.location.hash;
    const match = hash.match(/section=(\w+)/);
    if (match) {
      const idx = this.sections.findIndex(s => s.id === match[1]);
      if (idx >= 0) this.selectedIndex = idx;
    }
  }

  get selected(): DocSection {
    return this.sections[this.selectedIndex];
  }

  selectSection(index: number): void {
    this.selectedIndex = index;
    // Scroll main content to top
    document.querySelector('.selfhosted-detail')?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goNext(): void {
    const links = this.getNavNext();
    if (links.length === 1) this.navigateTo(links[0].id);
  }

  goPrev(): void {
    const links = this.getNavPrev();
    if (links.length === 1) this.navigateTo(links[0].id);
  }

  navigateTo(id: string): void {
    const idx = this.sectionByIndex(id);
    if (idx >= 0) this.selectSection(idx);
  }

  copyToClipboard(text: string, id: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copiedSnippet = id;
      clearTimeout(this.copyTimeout);
      this.copyTimeout = setTimeout(() => this.copiedSnippet = null, 2000);
    });
  }

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
}
