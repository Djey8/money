import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable, from, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GuestIdentityService } from './guest-identity.service';

/** Curated reaction set — keep in sync with backend/routes/community.js ALLOWED_EMOJIS. */
export const COMMUNITY_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export interface CommunityThread {
  id: string;
  title: string;
  authorName: string;
  authorId: string;
  createdAt: string;
  lastActivityAt: string;
  editedAt: string | null;
  replyCount: number;
}

export interface CommunityPost {
  id: string;
  threadId: string;
  body: string;
  authorName: string;
  authorId: string;
  createdAt: string;
  editedAt: string | null;
  reactions: Record<string, string[]>;
}

/**
 * Community data layer — mirrors the firebase/selfhosted split of
 * DatabaseService, but for shared, public content (threads/posts) instead of
 * the per-user private document. Firebase stores it under the `community/`
 * root (separate from `users/{uid}`); selfhosted talks to the backend's
 * `/api/community` routes (own CouchDB database).
 *
 * Firebase access goes through `db.database` (the native SDK instance), the
 * same low-level path DatabaseService uses — it needs no injection-context
 * wrapping, unlike the `db.object()`/`db.list()` compat helpers.
 *
 * All write operations resolve a guest/user identity via GuestIdentityService
 * first, so anonymous visitors can participate without registering.
 */
@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private mode: 'firebase' | 'selfhosted' =
    (environment.mode as 'firebase' | 'selfhosted') || 'firebase';
  private apiUrl = environment.selfhosted.apiUrl;

  constructor(
    private db: AngularFireDatabase,
    private http: HttpClient,
    private guestIdentity: GuestIdentityService,
  ) {}

  listThreads(limit = 20): Observable<CommunityThread[]> {
    if (this.mode === 'firebase') {
      return from(this.listThreadsFirebase(limit));
    }
    return this.http
      .get<{ threads: CommunityThread[] }>(`${this.apiUrl}/community/threads?limit=${limit}`)
      .pipe(map((res) => res.threads));
  }

  getThread(threadId: string): Observable<{ thread: CommunityThread; posts: CommunityPost[] }> {
    if (this.mode === 'firebase') {
      return from(this.getThreadFirebase(threadId));
    }
    return this.http.get<{ thread: CommunityThread; posts: CommunityPost[] }>(
      `${this.apiUrl}/community/threads/${threadId}`,
    );
  }

  private async listThreadsFirebase(limit: number): Promise<CommunityThread[]> {
    const snap = await this.db.database
      .ref('community/threads')
      .orderByChild('lastActivityAt')
      .limitToLast(limit)
      .once('value');

    const threads: CommunityThread[] = [];
    snap.forEach((child) => {
      threads.push(this.fromFirebaseThread(child.key!, child.val()));
      return false;
    });
    return threads.reverse();
  }

  private async getThreadFirebase(
    threadId: string,
  ): Promise<{ thread: CommunityThread; posts: CommunityPost[] }> {
    const threadSnap = await this.db.database.ref(`community/threads/${threadId}`).once('value');
    if (!threadSnap.exists()) {
      throw new Error('Thread not found');
    }

    const postsSnap = await this.db.database
      .ref(`community/posts/${threadId}`)
      .orderByChild('createdAt')
      .once('value');

    const posts: CommunityPost[] = [];
    postsSnap.forEach((child) => {
      posts.push(this.fromFirebasePost(child.key!, threadId, child.val()));
      return false;
    });

    return { thread: this.fromFirebaseThread(threadId, threadSnap.val()), posts };
  }

  private fromFirebaseThread(id: string, val: any): CommunityThread {
    return {
      id,
      title: val.title,
      authorName: val.authorName,
      authorId: val.authorId,
      createdAt: val.createdAt,
      lastActivityAt: val.lastActivityAt,
      editedAt: val.editedAt || null,
      replyCount: val.replyCount || 0,
    };
  }

  private fromFirebasePost(id: string, threadId: string, val: any): CommunityPost {
    const reactions: Record<string, string[]> = {};
    for (const emoji of COMMUNITY_EMOJIS) {
      reactions[emoji] = val.reactions?.[emoji] ? Object.keys(val.reactions[emoji]) : [];
    }
    return {
      id,
      threadId,
      body: val.body,
      authorName: val.authorName,
      authorId: val.authorId,
      createdAt: val.createdAt,
      editedAt: val.editedAt || null,
      reactions,
    };
  }

  async createThread(
    title: string,
    body: string,
    authorName: string,
  ): Promise<{ thread: CommunityThread; post: CommunityPost }> {
    const authorId = await this.guestIdentity.ensureIdentity();
    const now = new Date().toISOString();

    if (this.mode === 'firebase') {
      this.db.database.goOnline();

      const threadRef = this.db.database.ref('community/threads').push();
      const threadId = threadRef.key!;
      const threadData = {
        title,
        authorName,
        authorId,
        createdAt: now,
        lastActivityAt: now,
        replyCount: 0,
      };
      await threadRef.set(threadData);

      const postRef = this.db.database.ref(`community/posts/${threadId}`).push();
      const postData = { body, authorName, authorId, createdAt: now, reactions: {} };
      await postRef.set(postData);

      const thread: CommunityThread = { id: threadId, ...threadData, editedAt: null };
      const post: CommunityPost = this.fromFirebasePost(postRef.key!, threadId, postData);
      return { thread, post };
    }

    return await this.postJson<{ thread: CommunityThread; post: CommunityPost }>(
      `${this.apiUrl}/community/threads`,
      { title, body, authorName },
    );
  }

  async addReply(threadId: string, body: string, authorName: string): Promise<CommunityPost> {
    const authorId = await this.guestIdentity.ensureIdentity();
    const now = new Date().toISOString();

    if (this.mode === 'firebase') {
      this.db.database.goOnline();

      const postRef = this.db.database.ref(`community/posts/${threadId}`).push();
      const postData = { body, authorName, authorId, createdAt: now, reactions: {} };
      await postRef.set(postData);

      const threadRef = this.db.database.ref(`community/threads/${threadId}`);
      const current = (await threadRef.once('value')).val();
      await threadRef.update({ lastActivityAt: now, replyCount: (current?.replyCount || 0) + 1 });

      return this.fromFirebasePost(postRef.key!, threadId, postData);
    }

    const res = await this.postJson<{ post: CommunityPost }>(
      `${this.apiUrl}/community/threads/${threadId}/posts`,
      { body, authorName },
    );
    return res.post;
  }

  async updateThread(
    threadId: string,
    title: string,
    authorName?: string,
  ): Promise<CommunityThread> {
    if (this.mode === 'firebase') {
      this.db.database.goOnline();
      const now = new Date().toISOString();
      const threadRef = this.db.database.ref(`community/threads/${threadId}`);
      const updates: any = { title, editedAt: now };
      if (authorName !== undefined) updates.authorName = authorName;
      await threadRef.update(updates);
      const snap = await threadRef.once('value');
      return this.fromFirebaseThread(threadId, snap.val());
    }

    const res = await this.putJson<{ thread: CommunityThread }>(
      `${this.apiUrl}/community/threads/${threadId}`,
      { title, authorName },
    );
    return res.thread;
  }

  async updatePost(
    threadId: string,
    postId: string,
    body: string,
    authorName?: string,
  ): Promise<CommunityPost> {
    if (this.mode === 'firebase') {
      this.db.database.goOnline();
      const now = new Date().toISOString();
      const postRef = this.db.database.ref(`community/posts/${threadId}/${postId}`);
      const updates: any = { body, editedAt: now };
      if (authorName !== undefined) updates.authorName = authorName;
      await postRef.update(updates);
      const snap = await postRef.once('value');
      return this.fromFirebasePost(postId, threadId, snap.val());
    }

    const res = await this.putJson<{ post: CommunityPost }>(
      `${this.apiUrl}/community/posts/${postId}`,
      { body, authorName },
    );
    return res.post;
  }

  /**
   * Toggles a reaction — one emoji per identity per post. Picking a different
   * emoji than the current one replaces it; picking the same one clears it.
   */
  async toggleReaction(
    threadId: string,
    postId: string,
    emoji: string,
  ): Promise<{ myReaction: string | null; reactions: Record<string, string[]> }> {
    const authorId = await this.guestIdentity.ensureIdentity();

    if (this.mode === 'firebase') {
      this.db.database.goOnline();

      const postRef = this.db.database.ref(`community/posts/${threadId}/${postId}`);
      const reactionsVal = (await postRef.child('reactions').once('value')).val() || {};

      let previousEmoji: string | null = null;
      for (const key of Object.keys(reactionsVal)) {
        if (reactionsVal[key]?.[authorId]) {
          previousEmoji = key;
          break;
        }
      }

      if (previousEmoji) {
        await postRef.child(`reactions/${previousEmoji}/${authorId}`).remove();
      }

      const myReaction = previousEmoji === emoji ? null : emoji;
      if (myReaction) {
        await postRef.child(`reactions/${emoji}/${authorId}`).set(true);
      }

      const postSnap = await postRef.once('value');
      const post = this.fromFirebasePost(postId, threadId, postSnap.val());
      return { myReaction, reactions: post.reactions };
    }

    return this.postJson<{ myReaction: string | null; reactions: Record<string, string[]> }>(
      `${this.apiUrl}/community/posts/${postId}/react`,
      { emoji },
    );
  }

  async deleteReply(threadId: string, postId: string): Promise<void> {
    if (this.mode === 'firebase') {
      this.db.database.goOnline();

      await this.db.database.ref(`community/posts/${threadId}/${postId}`).remove();

      const threadRef = this.db.database.ref(`community/threads/${threadId}`);
      const current = (await threadRef.once('value')).val();
      await threadRef.update({ replyCount: Math.max(0, (current?.replyCount || 1) - 1) });
      return;
    }

    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/community/posts/${postId}`, { withCredentials: true }),
    );
  }

  /** Admin-only moderation: removes an entire thread, including its opening post. */
  async deleteThread(threadId: string): Promise<void> {
    if (this.mode === 'firebase') {
      this.db.database.goOnline();
      await this.db.database.ref(`community/threads/${threadId}`).remove();
      await this.db.database.ref(`community/posts/${threadId}`).remove();
      return;
    }

    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/community/threads/${threadId}`, { withCredentials: true }),
    );
  }

  private async postJson<T>(url: string, body: any): Promise<T> {
    return firstValueFrom(this.http.post<T>(url, body, { withCredentials: true }));
  }

  private async putJson<T>(url: string, body: any): Promise<T> {
    return firstValueFrom(this.http.put<T>(url, body, { withCredentials: true }));
  }
}
