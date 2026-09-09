/**
 * Integration tests for the Community section (threads, posts, reactions).
 *
 * Covers the guest-vs-registered-user split, thread/post CRUD, reaction
 * toggling and the abuse guards (opening post cannot be deleted, only the
 * author can delete their own reply).
 *
 * Requires a running CouchDB instance.
 */
const request = require('supertest');
const { app, checkDb, registerTestUser, guestLogin } = require('./setup');

let dbAvailable = false;
let userToken;
let guestToken;

beforeAll(async () => {
  dbAvailable = await checkDb();
  if (!dbAvailable) return;

  const user = await registerTestUser('_community');
  userToken = user.token;

  const guest = await guestLogin();
  guestToken = guest.token;
});

function authed(method, path, token) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

// NOTE: `dbAvailable` is only known once the async beforeAll() above has run,
// but Jest registers all `it`/`describe` calls synchronously up front — long
// before beforeAll executes. So the availability check must happen *inside*
// the test body (at run time), not as an argument evaluated at registration
// time, or it would always see the initial `false` and skip everything.
const skipIf = (name, fn) =>
  it(name, async () => {
    if (!dbAvailable) return;
    await fn();
  });

describe('Community routes', () => {
  it('should skip all tests if CouchDB is not available', () => {
    if (!dbAvailable) {
      console.warn('⚠ CouchDB not reachable — skipping community-routes tests');
    }
    expect(true).toBe(true);
  });

  skipIf('issues a guest identity without credentials', async () => {
    expect(guestToken).toBeTruthy();
  });

  skipIf('rejects thread creation without any identity', async () => {
    const res = await request(app)
      .post('/api/community/threads')
      .send({ title: 'No auth', body: 'Should fail' });
    expect(res.status).toBe(401);
  });

  skipIf('rejects a thread with an empty title', async () => {
    const res = await authed('post', '/api/community/threads', userToken).send({
      title: '',
      body: 'Body text',
    });
    expect(res.status).toBe(400);
  });

  skipIf('lets a registered user create a thread', async () => {
    const res = await authed('post', '/api/community/threads', userToken).send({
      title: 'ETF Diskussion',
      body: 'Was haltet ihr von thesaurierenden ETFs?',
      authorName: 'Jannis',
    });

    expect(res.status).toBe(201);
    expect(res.body.thread.title).toBe('ETF Diskussion');
    expect(res.body.thread.authorName).toBe('Jannis');
    expect(res.body.thread.replyCount).toBe(0);
    expect(res.body.post.body).toContain('thesaurierenden');
  });

  skipIf('lets a guest create a thread and defaults its display name', async () => {
    const res = await authed('post', '/api/community/threads', guestToken).send({
      title: 'Gastbeitrag',
      body: 'Anonyme Frage zum Notgroschen',
    });

    expect(res.status).toBe(201);
    expect(res.body.thread.authorName).toMatch(/^Gast-/);
  });

  describe('thread listing and detail', () => {
    let threadId;

    beforeAll(async () => {
      if (!dbAvailable) return;
      const res = await authed('post', '/api/community/threads', userToken).send({
        title: 'Listing test thread',
        body: 'Opening post body',
      });
      threadId = res.body.thread.id;
    });

    skipIf('lists threads without requiring authentication', async () => {
      const res = await request(app).get('/api/community/threads');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.threads)).toBe(true);
      expect(res.body.threads.find((t) => t.id === threadId)).toBeTruthy();
    });

    skipIf('returns thread detail with the opening post as posts[0]', async () => {
      const res = await request(app).get(`/api/community/threads/${threadId}`);
      expect(res.status).toBe(200);
      expect(res.body.thread.id).toBe(threadId);
      expect(res.body.posts.length).toBe(1);
      expect(res.body.posts[0].body).toBe('Opening post body');
    });

    skipIf('returns 404 for an unknown thread', async () => {
      const res = await request(app).get('/api/community/threads/does-not-exist');
      expect(res.status).toBe(404);
    });

    skipIf('appends a reply and bumps replyCount + lastActivityAt', async () => {
      const before = await request(app).get(`/api/community/threads/${threadId}`);
      const beforeActivity = before.body.thread.lastActivityAt;

      const replyRes = await authed(
        'post',
        `/api/community/threads/${threadId}/posts`,
        guestToken,
      ).send({ body: 'Danke für den Thread!' });
      expect(replyRes.status).toBe(201);

      const after = await request(app).get(`/api/community/threads/${threadId}`);
      expect(after.body.thread.replyCount).toBe(1);
      expect(after.body.posts.length).toBe(2);
      expect(after.body.thread.lastActivityAt >= beforeActivity).toBe(true);
    });

    skipIf('toggles a reaction on and off, deduped by identity', async () => {
      const detail = await request(app).get(`/api/community/threads/${threadId}`);
      const postId = detail.body.posts[0].id;

      const reacted = await authed('post', `/api/community/posts/${postId}/react`, guestToken).send(
        { emoji: '👍' },
      );
      expect(reacted.status).toBe(200);
      expect(reacted.body.myReaction).toBe('👍');
      expect(reacted.body.reactions['👍'].length).toBe(1);

      const cleared = await authed('post', `/api/community/posts/${postId}/react`, guestToken).send(
        { emoji: '👍' },
      );
      expect(cleared.status).toBe(200);
      expect(cleared.body.myReaction).toBe(null);
      expect(cleared.body.reactions['👍'].length).toBe(0);
    });

    skipIf('switching to a different emoji replaces the previous reaction', async () => {
      const detail = await request(app).get(`/api/community/threads/${threadId}`);
      const postId = detail.body.posts[0].id;

      await authed('post', `/api/community/posts/${postId}/react`, guestToken).send({
        emoji: '👍',
      });
      const switched = await authed(
        'post',
        `/api/community/posts/${postId}/react`,
        guestToken,
      ).send({ emoji: '❤️' });

      expect(switched.status).toBe(200);
      expect(switched.body.myReaction).toBe('❤️');
      expect(switched.body.reactions['👍'].length).toBe(0);
      expect(switched.body.reactions['❤️'].length).toBe(1);

      // cleanup so later assertions on this post start from a clean slate
      await authed('post', `/api/community/posts/${postId}/react`, guestToken).send({
        emoji: '❤️',
      });
    });

    skipIf('rejects a reaction with an unsupported emoji', async () => {
      const detail = await request(app).get(`/api/community/threads/${threadId}`);
      const postId = detail.body.posts[0].id;

      const res = await authed('post', `/api/community/posts/${postId}/react`, guestToken).send({
        emoji: '🐍',
      });
      expect(res.status).toBe(400);
    });

    skipIf('lets the author edit their own thread title', async () => {
      const res = await authed('put', `/api/community/threads/${threadId}`, userToken).send({
        title: 'Updated title',
      });
      expect(res.status).toBe(200);
      expect(res.body.thread.title).toBe('Updated title');
      expect(res.body.thread.editedAt).toBeTruthy();
    });

    skipIf("refuses to edit another author's thread", async () => {
      const res = await authed('put', `/api/community/threads/${threadId}`, guestToken).send({
        title: 'Hijacked title',
      });
      expect(res.status).toBe(403);
    });

    skipIf('lets the author edit their own opening post body', async () => {
      const detail = await request(app).get(`/api/community/threads/${threadId}`);
      const openingPostId = detail.body.posts[0].id;

      const res = await authed('put', `/api/community/posts/${openingPostId}`, userToken).send({
        body: 'Updated opening post body',
      });
      expect(res.status).toBe(200);
      expect(res.body.post.body).toBe('Updated opening post body');
      expect(res.body.post.editedAt).toBeTruthy();
    });

    skipIf('lets the author switch their post to anonymous retroactively', async () => {
      const detail = await request(app).get(`/api/community/threads/${threadId}`);
      const openingPostId = detail.body.posts[0].id;

      const res = await authed('put', `/api/community/posts/${openingPostId}`, userToken).send({
        body: 'Still the same body',
        authorName: 'Anonymous',
      });
      expect(res.status).toBe(200);
      expect(res.body.post.authorName).toBe('Anonymous');
    });

    skipIf('refuses to delete the opening post', async () => {
      const detail = await request(app).get(`/api/community/threads/${threadId}`);
      const openingPostId = detail.body.posts[0].id;

      const res = await authed('delete', `/api/community/posts/${openingPostId}`, userToken);
      expect(res.status).toBe(400);
    });

    skipIf("refuses to delete another author's reply", async () => {
      const detail = await request(app).get(`/api/community/threads/${threadId}`);
      const reply = detail.body.posts.find((p) => p.id !== detail.body.posts[0].id);

      const res = await authed('delete', `/api/community/posts/${reply.id}`, userToken);
      expect(res.status).toBe(403);
    });

    skipIf('lets the author delete their own reply', async () => {
      const detail = await request(app).get(`/api/community/threads/${threadId}`);
      const reply = detail.body.posts.find((p) => p.id !== detail.body.posts[0].id);

      const res = await authed('delete', `/api/community/posts/${reply.id}`, guestToken);
      expect(res.status).toBe(200);

      const after = await request(app).get(`/api/community/threads/${threadId}`);
      expect(after.body.posts.length).toBe(1);
      expect(after.body.thread.replyCount).toBe(0);
    });
  });

  describe('admin moderation', () => {
    let adminToken, threadId, replyId;
    let originalAdminEmails;

    beforeAll(async () => {
      if (!dbAvailable) return;
      originalAdminEmails = process.env.ADMIN_EMAILS;

      const admin = await registerTestUser('_admin');
      adminToken = admin.token;
      process.env.ADMIN_EMAILS = admin.email;

      const threadRes = await authed('post', '/api/community/threads', guestToken).send({
        title: 'Spam thread',
        body: 'Spammy opening post',
      });
      threadId = threadRes.body.thread.id;

      const replyRes = await authed(
        'post',
        `/api/community/threads/${threadId}/posts`,
        guestToken,
      ).send({ body: 'Spammy reply' });
      replyId = replyRes.body.post.id;
    });

    afterAll(() => {
      process.env.ADMIN_EMAILS = originalAdminEmails;
    });

    skipIf("lets an admin edit another author's post", async () => {
      const res = await authed('put', `/api/community/posts/${replyId}`, adminToken).send({
        body: 'Edited by moderation',
      });
      expect(res.status).toBe(200);
      expect(res.body.post.body).toBe('Edited by moderation');
    });

    skipIf("lets an admin delete another author's reply", async () => {
      const res = await authed('delete', `/api/community/posts/${replyId}`, adminToken);
      expect(res.status).toBe(200);
    });

    skipIf('refuses thread deletion for non-admins', async () => {
      const res = await authed('delete', `/api/community/threads/${threadId}`, guestToken);
      expect(res.status).toBe(403);
    });

    skipIf('lets an admin delete an entire thread including the opening post', async () => {
      const res = await authed('delete', `/api/community/threads/${threadId}`, adminToken);
      expect(res.status).toBe(200);
      expect(res.body.postsRemoved).toBe(1);

      const check = await request(app).get(`/api/community/threads/${threadId}`);
      expect(check.status).toBe(404);
    });
  });
});
