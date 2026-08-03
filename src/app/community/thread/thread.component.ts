import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { NgIf, NgFor, NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CommunityService, CommunityThread, CommunityPost, COMMUNITY_EMOJIS } from '../../shared/services/community.service';
import { GuestIdentityService } from '../../shared/services/guest-identity.service';
import { DemoService } from '../../shared/services/demo.service';

// Deferred import to break circular chain
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));

@Component({
  selector: 'app-community-thread',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, DatePipe, FormsModule, RouterLink, TranslateModule],
  templateUrl: './thread.component.html',
  styleUrls: ['./thread.component.css', '../community.component.css', '../../landing/landing-page.component.css', '../../app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class CommunityThreadComponent implements OnInit {
  readonly emojis = COMMUNITY_EMOJIS;

  threadId!: string;
  thread: CommunityThread | null = null;
  openingPost: CommunityPost | null = null;
  replies: CommunityPost[] = [];

  loading = true;
  notFound = false;

  replyBody = '';
  displayName = '';
  anonymous = false;
  isGuestUser = true;
  submittingReply = false;
  replyError: string | null = null;

  reactingPostId: string | null = null;
  confirmingDeleteId: string | null = null;
  confirmingThreadDelete = false;
  isAdmin = false;

  editingThread = false;
  editThreadTitle = '';
  editThreadBody = '';
  editDisplayName = '';
  editAnonymous = false;
  editingPostId: string | null = null;
  editReplyBody = '';
  editReplyDisplayName = '';
  editReplyAnonymous = false;
  savingEdit = false;
  editError: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private communityService: CommunityService,
    private guestIdentity: GuestIdentityService,
    private demoService: DemoService
  ) {}

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
    this.threadId = this.route.snapshot.paramMap.get('id')!;
    this.displayName = this.guestIdentity.getDisplayName();
    this.anonymous = this.guestIdentity.getAnonymousPreference();
    this.guestIdentity.ensureIdentity()
      .then(() => {
        this.isGuestUser = this.guestIdentity.isGuest();
        return this.guestIdentity.isAdmin();
      })
      .then(isAdmin => { this.isAdmin = isAdmin; })
      .catch(() => {});
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.notFound = false;
    this.communityService.getThread(this.threadId).subscribe({
      next: ({ thread, posts }) => {
        this.thread = thread;
        this.openingPost = posts[0] || null;
        this.replies = posts.slice(1);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notFound = true;
      }
    });
  }

  isMine(post: CommunityPost): boolean {
    const myId = this.guestIdentity.getAuthorId();
    return !!myId && myId === post.authorId;
  }

  canModify(post: CommunityPost): boolean {
    return this.isMine(post) || this.isAdmin;
  }

  myReaction(post: CommunityPost): string | null {
    const myId = this.guestIdentity.getAuthorId();
    if (!myId) return null;
    return this.emojis.find(emoji => post.reactions[emoji]?.includes(myId)) || null;
  }

  reactionCount(post: CommunityPost, emoji: string): number {
    return post.reactions[emoji]?.length || 0;
  }

  async reactWith(post: CommunityPost, emoji: string): Promise<void> {
    if (this.reactingPostId) return;
    this.reactingPostId = post.id;
    try {
      const { reactions } = await this.communityService.toggleReaction(this.threadId, post.id, emoji);
      post.reactions = reactions;
    } catch {
      // Best-effort — silently ignore, the reaction just won't update
    } finally {
      this.reactingPostId = null;
    }
  }

  askDeleteConfirmation(postId: string): void {
    this.confirmingDeleteId = this.confirmingDeleteId === postId ? null : postId;
  }

  async confirmDelete(postId: string): Promise<void> {
    try {
      await this.communityService.deleteReply(this.threadId, postId);
      this.replies = this.replies.filter(p => p.id !== postId);
      if (this.thread) {
        this.thread.replyCount = Math.max(0, this.thread.replyCount - 1);
      }
    } catch {
      // Leave the post in place — user can retry
    } finally {
      this.confirmingDeleteId = null;
    }
  }

  askDeleteThreadConfirmation(): void {
    this.confirmingThreadDelete = !this.confirmingThreadDelete;
  }

  async confirmDeleteThread(): Promise<void> {
    try {
      await this.communityService.deleteThread(this.threadId);
      this.router.navigate(['/community']);
    } catch {
      this.confirmingThreadDelete = false;
    }
  }

  startEditThread(): void {
    if (!this.thread || !this.openingPost) return;
    this.editThreadTitle = this.thread.title;
    this.editThreadBody = this.openingPost.body;
    this.editDisplayName = this.isGuestUser ? this.openingPost.authorName : '';
    this.editAnonymous = this.guestIdentity.isAnonymousLabel(this.openingPost.authorName);
    this.editError = null;
    this.editingThread = true;
  }

  cancelEditThread(): void {
    this.editingThread = false;
  }

  async saveEditThread(): Promise<void> {
    const title = this.editThreadTitle.trim();
    const body = this.editThreadBody.trim();
    if (!title || !body || !this.openingPost) {
      this.editError = 'Community.errors.generic';
      return;
    }

    this.savingEdit = true;
    this.editError = null;
    try {
      const authorName = await this.guestIdentity.resolveAuthorName(this.editDisplayName, this.editAnonymous);
      const [thread, post] = await Promise.all([
        this.communityService.updateThread(this.threadId, title, authorName),
        this.communityService.updatePost(this.threadId, this.openingPost.id, body, authorName)
      ]);
      this.thread = thread;
      this.openingPost = post;
      this.editingThread = false;
    } catch {
      this.editError = 'Community.errors.generic';
    } finally {
      this.savingEdit = false;
    }
  }

  startEditReply(post: CommunityPost): void {
    this.editingPostId = post.id;
    this.editReplyBody = post.body;
    this.editReplyDisplayName = this.isGuestUser ? post.authorName : '';
    this.editReplyAnonymous = this.guestIdentity.isAnonymousLabel(post.authorName);
    this.editError = null;
  }

  cancelEditReply(): void {
    this.editingPostId = null;
  }

  async saveEditReply(postId: string): Promise<void> {
    const body = this.editReplyBody.trim();
    if (!body) {
      this.editError = 'Community.errors.generic';
      return;
    }

    this.savingEdit = true;
    this.editError = null;
    try {
      const authorName = await this.guestIdentity.resolveAuthorName(this.editReplyDisplayName, this.editReplyAnonymous);
      const updated = await this.communityService.updatePost(this.threadId, postId, body, authorName);
      this.replies = this.replies.map(p => p.id === postId ? updated : p);
      this.editingPostId = null;
    } catch {
      this.editError = 'Community.errors.generic';
    } finally {
      this.savingEdit = false;
    }
  }

  async submitReply(): Promise<void> {
    const body = this.replyBody.trim();
    if (!body) {
      this.replyError = 'Community.errors.bodyRequired';
      return;
    }

    this.submittingReply = true;
    this.replyError = null;
    if (this.isGuestUser) {
      this.guestIdentity.setDisplayName(this.displayName);
    } else {
      this.guestIdentity.setAnonymousPreference(this.anonymous);
    }

    try {
      const authorName = await this.guestIdentity.resolveAuthorName(this.displayName, this.anonymous);
      const post = await this.communityService.addReply(this.threadId, body, authorName);
      this.replies = [...this.replies, post];
      if (this.thread) {
        this.thread.replyCount += 1;
        this.thread.lastActivityAt = post.createdAt;
      }
      this.replyBody = '';
    } catch {
      this.replyError = 'Community.errors.generic';
    } finally {
      this.submittingReply = false;
    }
  }
}
