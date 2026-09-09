const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { getCommunityDb } = require('../config/db');
const logger = require('../config/logger');
const { logDatabaseOperation, logUserActivity } = require('../middleware/logging');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 5000;
const MAX_NAME_LENGTH = 40;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 50;

// Curated reaction set (kept small and fixed server-side so we never store
// arbitrary/spam strings as reaction keys). One reaction per user per post —
// picking a different emoji replaces the previous one.
const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

// Community writes are easy to abuse (guests need no credentials), so they get
// their own, stricter limiter on top of the generous global one in server.js.
const communityWriteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20, // 20 posts/replies/reactions per IP per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.SKIP_RATE_LIMIT === 'true',
});

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;
}

function sanitizeName(name, fallbackId, isGuest) {
  const trimmed = (name || '').toString().trim().slice(0, MAX_NAME_LENGTH);
  if (trimmed) return trimmed;
  return isGuest ? `Gast-${fallbackId.slice(-4)}` : `Nutzer-${fallbackId.slice(-4)}`;
}

function isValidText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function clampPageSize(rawLimit) {
  const parsed = parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function toPublicReactions(reactions) {
  const result = {};
  for (const emoji of ALLOWED_EMOJIS) {
    result[emoji] = reactions && Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
  }
  return result;
}

function toPublicPost(doc) {
  return {
    id: doc._id,
    threadId: doc.threadId,
    body: doc.body,
    authorName: doc.authorName,
    authorId: doc.authorId,
    createdAt: doc.createdAt,
    editedAt: doc.editedAt || null,
    reactions: toPublicReactions(doc.reactions),
  };
}

function toPublicThread(doc) {
  return {
    id: doc._id,
    title: doc.title,
    authorName: doc.authorName,
    authorId: doc.authorId,
    createdAt: doc.createdAt,
    lastActivityAt: doc.lastActivityAt,
    editedAt: doc.editedAt || null,
    replyCount: doc.replyCount || 0,
  };
}

// List threads, most recently active first
router.get('/threads', async (req, res) => {
  try {
    const communityDb = getCommunityDb();
    const limit = clampPageSize(req.query.limit);
    const skip = parseInt(req.query.skip, 10) || 0;

    const result = await communityDb.find({
      selector: { type: 'thread' },
      limit: 200, // fetch a bounded working set, then sort+page in memory
    });

    const sorted = result.docs.sort((a, b) =>
      (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''),
    );
    const page = sorted.slice(skip, skip + limit);

    res.json({
      threads: page.map(toPublicThread),
      total: sorted.length,
    });
  } catch (error) {
    logger.logError(error, { context: 'community_list_threads' });
    res.status(500).json({ error: 'Failed to load threads' });
  }
});

// Create a thread (opening post is created together with it)
router.post('/threads', authenticateToken, communityWriteLimiter, async (req, res) => {
  try {
    const { title, body, authorName } = req.body || {};

    if (!isValidText(title, MAX_TITLE_LENGTH)) {
      return res
        .status(400)
        .json({ error: `Title is required (max ${MAX_TITLE_LENGTH} characters)` });
    }
    if (!isValidText(body, MAX_BODY_LENGTH)) {
      return res
        .status(400)
        .json({ error: `Body is required (max ${MAX_BODY_LENGTH} characters)` });
    }

    const communityDb = getCommunityDb();
    const authorId = req.userId;
    const isGuest = req.userRole === 'guest';
    const resolvedName = sanitizeName(authorName, authorId, isGuest);
    const now = new Date().toISOString();

    const threadDoc = {
      _id: makeId('thread'),
      type: 'thread',
      title: title.trim(),
      authorId,
      authorName: resolvedName,
      createdAt: now,
      lastActivityAt: now,
      replyCount: 0,
    };

    const postDoc = {
      _id: makeId('post'),
      type: 'post',
      threadId: threadDoc._id,
      body: body.trim(),
      authorId,
      authorName: resolvedName,
      createdAt: now,
      reactions: {},
    };

    await communityDb.insert(threadDoc);
    await communityDb.insert(postDoc);

    logDatabaseOperation('community_thread_created', authorId, { threadId: threadDoc._id });
    logUserActivity(authorId, 'community_thread_created', { threadId: threadDoc._id, isGuest });

    res.status(201).json({ thread: toPublicThread(threadDoc), post: toPublicPost(postDoc) });
  } catch (error) {
    logger.logError(error, { context: 'community_create_thread', userId: req.userId });
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

// Thread detail: metadata + its posts (posts[0] is the opening post)
router.get('/threads/:id', async (req, res) => {
  try {
    const communityDb = getCommunityDb();
    const threadId = req.params.id;

    let threadDoc;
    try {
      threadDoc = await communityDb.get(threadId);
    } catch (err) {
      if (err.statusCode === 404) {
        return res.status(404).json({ error: 'Thread not found' });
      }
      throw err;
    }

    if (threadDoc.type !== 'thread') {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const result = await communityDb.find({
      selector: { type: 'post', threadId },
      limit: MAX_PAGE_SIZE * 10,
    });

    const posts = result.docs.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    res.json({
      thread: toPublicThread(threadDoc),
      posts: posts.map(toPublicPost),
    });
  } catch (error) {
    logger.logError(error, { context: 'community_get_thread', threadId: req.params.id });
    res.status(500).json({ error: 'Failed to load thread' });
  }
});

// Reply to a thread
router.post('/threads/:id/posts', authenticateToken, communityWriteLimiter, async (req, res) => {
  try {
    const { body, authorName } = req.body || {};
    const threadId = req.params.id;

    if (!isValidText(body, MAX_BODY_LENGTH)) {
      return res
        .status(400)
        .json({ error: `Body is required (max ${MAX_BODY_LENGTH} characters)` });
    }

    const communityDb = getCommunityDb();

    let threadDoc;
    try {
      threadDoc = await communityDb.get(threadId);
    } catch (err) {
      if (err.statusCode === 404) {
        return res.status(404).json({ error: 'Thread not found' });
      }
      throw err;
    }
    if (threadDoc.type !== 'thread') {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const authorId = req.userId;
    const isGuest = req.userRole === 'guest';
    const resolvedName = sanitizeName(authorName, authorId, isGuest);
    const now = new Date().toISOString();

    const postDoc = {
      _id: makeId('post'),
      type: 'post',
      threadId,
      body: body.trim(),
      authorId,
      authorName: resolvedName,
      createdAt: now,
      reactions: {},
    };
    await communityDb.insert(postDoc);

    // Bump the thread's activity timestamp/reply count, retrying on conflicts
    let attempt = 0;
    let lastError = null;
    while (attempt < MAX_RETRIES) {
      try {
        const latestThread = await communityDb.get(threadId);
        latestThread.replyCount = (latestThread.replyCount || 0) + 1;
        latestThread.lastActivityAt = now;
        await communityDb.insert(latestThread);
        break;
      } catch (err) {
        lastError = err;
        if (err.statusCode === 409) {
          attempt++;
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 20),
          );
          continue;
        }
        throw err;
      }
    }
    if (attempt >= MAX_RETRIES) {
      logger.logError(lastError, { context: 'community_thread_activity_bump_failed', threadId });
    }

    logDatabaseOperation('community_post_created', authorId, { threadId, postId: postDoc._id });
    logUserActivity(authorId, 'community_post_created', { threadId, isGuest });

    res.status(201).json({ post: toPublicPost(postDoc) });
  } catch (error) {
    logger.logError(error, {
      context: 'community_create_post',
      userId: req.userId,
      threadId: req.params.id,
    });
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Toggle a reaction on a post (one emoji per author per post — picking a
// different emoji replaces the previous one; picking the same one clears it).
router.post('/posts/:id/react', authenticateToken, communityWriteLimiter, async (req, res) => {
  try {
    const postId = req.params.id;
    const emoji = req.body?.emoji;
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return res.status(400).json({ error: `emoji must be one of: ${ALLOWED_EMOJIS.join(' ')}` });
    }

    const communityDb = getCommunityDb();
    const authorId = req.userId;

    let attempt = 0;
    let lastError = null;
    while (attempt < MAX_RETRIES) {
      try {
        const postDoc = await communityDb.get(postId);
        if (postDoc.type !== 'post') {
          return res.status(404).json({ error: 'Post not found' });
        }
        if (!postDoc.reactions) postDoc.reactions = {};

        const hadThisEmoji =
          Array.isArray(postDoc.reactions[emoji]) && postDoc.reactions[emoji].includes(authorId);

        // Remove this author from every emoji bucket (only one reaction per person)
        for (const key of ALLOWED_EMOJIS) {
          if (Array.isArray(postDoc.reactions[key])) {
            postDoc.reactions[key] = postDoc.reactions[key].filter((id) => id !== authorId);
          }
        }
        // Re-add under the requested emoji, unless they just cleared that same one
        if (!hadThisEmoji) {
          postDoc.reactions[emoji] = [...(postDoc.reactions[emoji] || []), authorId];
        }

        await communityDb.insert(postDoc);

        return res.json({
          reactions: toPublicReactions(postDoc.reactions),
          myReaction: hadThisEmoji ? null : emoji,
        });
      } catch (err) {
        if (err.statusCode === 404) {
          return res.status(404).json({ error: 'Post not found' });
        }
        if (err.statusCode === 409) {
          lastError = err;
          attempt++;
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 20),
          );
          continue;
        }
        throw err;
      }
    }

    logger.logError(lastError, { context: 'community_react_conflict', postId });
    res
      .status(409)
      .json({ error: 'Failed to update reaction due to conflicts. Please try again.' });
  } catch (error) {
    logger.logError(error, {
      context: 'community_react',
      userId: req.userId,
      postId: req.params.id,
    });
    res.status(500).json({ error: 'Failed to update reaction' });
  }
});

// Edit a thread's title — the author can edit their own, admins can edit any.
router.put('/threads/:id', authenticateToken, communityWriteLimiter, async (req, res) => {
  try {
    const { title, authorName } = req.body || {};
    if (!isValidText(title, MAX_TITLE_LENGTH)) {
      return res
        .status(400)
        .json({ error: `Title is required (max ${MAX_TITLE_LENGTH} characters)` });
    }
    if (authorName !== undefined && !isValidText(authorName, MAX_NAME_LENGTH)) {
      return res.status(400).json({ error: `authorName must be 1-${MAX_NAME_LENGTH} characters` });
    }

    const communityDb = getCommunityDb();
    const threadId = req.params.id;

    let attempt = 0;
    let lastError = null;
    while (attempt < MAX_RETRIES) {
      try {
        const threadDoc = await communityDb.get(threadId);
        if (threadDoc.type !== 'thread') {
          return res.status(404).json({ error: 'Thread not found' });
        }
        if (threadDoc.authorId !== req.userId && !req.isAdmin) {
          return res.status(403).json({ error: 'You can only edit your own threads' });
        }

        threadDoc.title = title.trim();
        if (authorName !== undefined) threadDoc.authorName = authorName.trim();
        threadDoc.editedAt = new Date().toISOString();
        await communityDb.insert(threadDoc);

        logUserActivity(req.userId, 'community_thread_edited', {
          threadId,
          byAdmin: req.isAdmin && threadDoc.authorId !== req.userId,
        });
        return res.json({ thread: toPublicThread(threadDoc) });
      } catch (err) {
        if (err.statusCode === 404) {
          return res.status(404).json({ error: 'Thread not found' });
        }
        if (err.statusCode === 409) {
          lastError = err;
          attempt++;
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 20),
          );
          continue;
        }
        throw err;
      }
    }

    logger.logError(lastError, { context: 'community_edit_thread_conflict', threadId });
    res.status(409).json({ error: 'Failed to save changes due to conflicts. Please try again.' });
  } catch (error) {
    logger.logError(error, {
      context: 'community_edit_thread',
      userId: req.userId,
      threadId: req.params.id,
    });
    res.status(500).json({ error: 'Failed to edit thread' });
  }
});

// Edit a post's body (opening post or reply) — the author can edit their own,
// admins can edit any.
router.put('/posts/:id', authenticateToken, communityWriteLimiter, async (req, res) => {
  try {
    const { body, authorName } = req.body || {};
    if (!isValidText(body, MAX_BODY_LENGTH)) {
      return res
        .status(400)
        .json({ error: `Body is required (max ${MAX_BODY_LENGTH} characters)` });
    }
    if (authorName !== undefined && !isValidText(authorName, MAX_NAME_LENGTH)) {
      return res.status(400).json({ error: `authorName must be 1-${MAX_NAME_LENGTH} characters` });
    }

    const communityDb = getCommunityDb();
    const postId = req.params.id;

    let attempt = 0;
    let lastError = null;
    while (attempt < MAX_RETRIES) {
      try {
        const postDoc = await communityDb.get(postId);
        if (postDoc.type !== 'post') {
          return res.status(404).json({ error: 'Post not found' });
        }
        if (postDoc.authorId !== req.userId && !req.isAdmin) {
          return res.status(403).json({ error: 'You can only edit your own posts' });
        }

        postDoc.body = body.trim();
        if (authorName !== undefined) postDoc.authorName = authorName.trim();
        postDoc.editedAt = new Date().toISOString();
        await communityDb.insert(postDoc);

        logUserActivity(req.userId, 'community_post_edited', {
          postId,
          threadId: postDoc.threadId,
          byAdmin: req.isAdmin && postDoc.authorId !== req.userId,
        });
        return res.json({ post: toPublicPost(postDoc) });
      } catch (err) {
        if (err.statusCode === 404) {
          return res.status(404).json({ error: 'Post not found' });
        }
        if (err.statusCode === 409) {
          lastError = err;
          attempt++;
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 20),
          );
          continue;
        }
        throw err;
      }
    }

    logger.logError(lastError, { context: 'community_edit_post_conflict', postId });
    res.status(409).json({ error: 'Failed to save changes due to conflicts. Please try again.' });
  } catch (error) {
    logger.logError(error, {
      context: 'community_edit_post',
      userId: req.userId,
      postId: req.params.id,
    });
    res.status(500).json({ error: 'Failed to edit post' });
  }
});

// Delete a reply — the author can delete their own, admins can delete anyone's.
// The opening post can't be deleted standalone (it would orphan the thread);
// admins deleting it get redirected to the cascading thread-delete below.
router.delete('/posts/:id', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const communityDb = getCommunityDb();

    let postDoc;
    try {
      postDoc = await communityDb.get(postId);
    } catch (err) {
      if (err.statusCode === 404) {
        return res.status(404).json({ error: 'Post not found' });
      }
      throw err;
    }

    if (postDoc.type !== 'post') {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (postDoc.authorId !== req.userId && !req.isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    const threadResult = await communityDb.find({
      selector: { type: 'post', threadId: postDoc.threadId },
      limit: MAX_PAGE_SIZE * 10,
    });
    const isOpeningPost =
      threadResult.docs.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))[0]
        ?._id === postDoc._id;
    if (isOpeningPost) {
      return res
        .status(400)
        .json({ error: 'Cannot delete the opening post of a thread — delete the thread instead' });
    }

    await communityDb.destroy(postDoc._id, postDoc._rev);

    // Best-effort reply count decrement
    try {
      const threadDoc = await communityDb.get(postDoc.threadId);
      threadDoc.replyCount = Math.max(0, (threadDoc.replyCount || 1) - 1);
      await communityDb.insert(threadDoc);
    } catch (err) {
      logger.logError(err, {
        context: 'community_delete_reply_count_decrement',
        threadId: postDoc.threadId,
      });
    }

    logUserActivity(req.userId, 'community_post_deleted', {
      postId,
      threadId: postDoc.threadId,
      byAdmin: req.isAdmin && postDoc.authorId !== req.userId,
    });
    res.json({ success: true });
  } catch (error) {
    logger.logError(error, {
      context: 'community_delete_post',
      userId: req.userId,
      postId: req.params.id,
    });
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Delete an entire thread (admin-only moderation): removes the thread doc and
// every post under it, including the opening post.
router.delete('/threads/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    const threadId = req.params.id;
    const communityDb = getCommunityDb();

    let threadDoc;
    try {
      threadDoc = await communityDb.get(threadId);
    } catch (err) {
      if (err.statusCode === 404) {
        return res.status(404).json({ error: 'Thread not found' });
      }
      throw err;
    }
    if (threadDoc.type !== 'thread') {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const postsResult = await communityDb.find({
      selector: { type: 'post', threadId },
      limit: MAX_PAGE_SIZE * 10,
    });

    const docsToDelete = [
      { ...threadDoc, _deleted: true },
      ...postsResult.docs.map((doc) => ({ ...doc, _deleted: true })),
    ];
    await communityDb.bulk({ docs: docsToDelete });

    logUserActivity(req.userId, 'community_thread_deleted', {
      threadId,
      postsRemoved: postsResult.docs.length,
      byAdmin: true,
    });
    res.json({ success: true, postsRemoved: postsResult.docs.length });
  } catch (error) {
    logger.logError(error, {
      context: 'community_delete_thread',
      userId: req.userId,
      threadId: req.params.id,
    });
    res.status(500).json({ error: 'Failed to delete thread' });
  }
});

module.exports = router;
