import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CommunityService, CommunityThread } from '../shared/services/community.service';
import { GuestIdentityService } from '../shared/services/guest-identity.service';
import { DemoService } from '../shared/services/demo.service';

// Deferred import to break circular chain
let AppComponent: any;
setTimeout(() => import('src/app/app.component').then((m) => (AppComponent = m.AppComponent)));

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, FormsModule, RouterLink, TranslateModule],
  templateUrl: './community.component.html',
  styleUrls: [
    './community.component.css',
    '../landing/landing-page.component.css',
    '../app.component.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class CommunityComponent implements OnInit {
  threads: CommunityThread[] = [];
  loading = true;
  error = false;

  showComposer = false;
  submitting = false;
  formError: string | null = null;

  newTitle = '';
  newBody = '';
  displayName = '';
  isGuestUser = true;
  anonymous = false;

  constructor(
    private communityService: CommunityService,
    private guestIdentity: GuestIdentityService,
    private demoService: DemoService,
    private router: Router,
  ) {}

  get appReference() {
    return AppComponent;
  }

  closeNav(): void {
    const toggle = document.getElementById('nav-toggle') as HTMLInputElement;
    if (toggle) {
      toggle.checked = false;
    }
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
    this.displayName = this.guestIdentity.getDisplayName();
    this.anonymous = this.guestIdentity.getAnonymousPreference();
    // Establish an identity eagerly so composing/reacting has no first-click delay.
    this.guestIdentity
      .ensureIdentity()
      .then(() => {
        this.isGuestUser = this.guestIdentity.isGuest();
      })
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentionally swallow identity-setup errors; not critical to page load
      .catch(() => {});
    this.loadThreads();
  }

  private loadThreads(): void {
    this.loading = true;
    this.error = false;
    this.communityService.listThreads().subscribe({
      next: (threads) => {
        this.threads = threads;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = true;
      },
    });
  }

  toggleComposer(): void {
    this.showComposer = !this.showComposer;
    this.formError = null;
  }

  async submitThread(): Promise<void> {
    const title = this.newTitle.trim();
    const body = this.newBody.trim();

    if (!title) {
      this.formError = 'Community.errors.titleRequired';
      return;
    }
    if (!body) {
      this.formError = 'Community.errors.bodyRequired';
      return;
    }

    this.submitting = true;
    this.formError = null;
    if (this.isGuestUser) {
      this.guestIdentity.setDisplayName(this.displayName);
    } else {
      this.guestIdentity.setAnonymousPreference(this.anonymous);
    }

    try {
      const authorName = await this.guestIdentity.resolveAuthorName(
        this.displayName,
        this.anonymous,
      );
      const { thread } = await this.communityService.createThread(title, body, authorName);
      this.newTitle = '';
      this.newBody = '';
      this.showComposer = false;
      this.router.navigate(['/community', thread.id]);
    } catch {
      this.formError = 'Community.errors.generic';
    } finally {
      this.submitting = false;
    }
  }
}
