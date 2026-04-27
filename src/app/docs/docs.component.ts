import { Component, ViewEncapsulation } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DemoService } from '../shared/services/demo.service';

// Deferred import to break circular chain
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));

export interface DocTopic {
  id: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [NgFor, RouterLink, TranslateModule],
  templateUrl: './docs.component.html',
  styleUrls: ['./docs.component.css', '../landing/landing-page.component.css', '../app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class DocsComponent {

  topics: DocTopic[] = [
    { id: 'selfhosted', icon: '🖥️', route: '/docs/selfhosted' }
  ];

  constructor(private demoService: DemoService, private translate: TranslateService, private router: Router) {
    const saved = localStorage.getItem('landingLang');
    if (saved) { this.translate.use(saved); }
  }

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
}
