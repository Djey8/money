const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getAuthDb, getUsersDb } = require('../config/db');
const logger = require('../config/logger');
const { logAuthEvent, logUserActivity, logSecurityEvent } = require('../middleware/logging');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

// Account lockout configuration
const LOCKOUT_THRESHOLD = 10; // Lock after 10 consecutive failures
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15-minute lockout
const FAILED_ATTEMPT_WINDOW_MS = 30 * 60 * 1000; // Reset counter after 30 min of no attempts

// In-memory store for failed login attempts (keyed by email)
const failedAttempts = new Map();

function getFailedAttempts(email) {
  const record = failedAttempts.get(email);
  if (!record) return null;
  // Expire stale records
  if (Date.now() - record.lastAttempt > FAILED_ATTEMPT_WINDOW_MS) {
    failedAttempts.delete(email);
    return null;
  }
  return record;
}

function recordFailedAttempt(email) {
  const record = failedAttempts.get(email) || { count: 0, lastAttempt: 0, lockedUntil: 0 };
  record.count += 1;
  record.lastAttempt = Date.now();
  if (record.count >= LOCKOUT_THRESHOLD) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  failedAttempts.set(email, record);
  return record;
}

function clearFailedAttempts(email) {
  failedAttempts.delete(email);
}

function isAccountLocked(email) {
  const record = getFailedAttempts(email);
  if (!record) return false;
  if (record.lockedUntil > Date.now()) return true;
  // Lockout expired — reset
  if (record.lockedUntil > 0 && record.lockedUntil <= Date.now()) {
    failedAttempts.delete(email);
    return false;
  }
  return false;
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password policy: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain uppercase, lowercase, and a number' });
    }

    const authDb = getAuthDb();
    const usersDb = getUsersDb();

    // Check if user exists
    try {
      const result = await authDb.find({
        selector: { email },
        limit: 1
      });

      if (result.docs.length > 0) {
        return res.status(409).json({ error: 'Registration failed' });
      }
    } catch (err) {
      console.error('Error checking user:', err);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in auth database (for authentication)
    const userId = `user_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;
    const user = {
      _id: userId,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    await authDb.insert(user);

    // Create user document in users database (for data storage)
    // Populate with initial user info from registration
    const userDataDoc = {
      _id: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        info: {
          email: email,
          username: username || email.split('@')[0] // Use provided username or email prefix as default
        }
      }
    };

    try {
      await usersDb.insert(userDataDoc);
      logger.logUserActivity(userId, 'user_registered', {
        username: username || email.split('@')[0],
        hasCustomUsername: !!username
      });
    } catch (err) {
      logger.logError(err, { context: 'user_data_document_creation', userId });
      // Don't fail registration if user data doc creation fails
      // It will be created on first write
    }

    // Log successful registration
    logAuthEvent('register', userId, true, { email, username: username || email.split('@')[0] });
    logUserActivity(userId, 'account_created', { email, registrationMethod: 'email' });

    // Generate JWT
    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      userId,
      email,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if account is locked
    if (isAccountLocked(email)) {
      const record = getFailedAttempts(email);
      const retryAfter = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      logSecurityEvent('account_locked', { email, attempts: record.count });
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Account temporarily locked due to too many failed attempts. Try again later.' });
    }

    const authDb = getAuthDb();

    // Find user
    const result = await authDb.find({
      selector: { email },
      limit: 1
    });

    if (result.docs.length === 0) {
      recordFailedAttempt(email);
      logAuthEvent('login', email, false, { reason: 'user_not_found' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.docs[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const record = recordFailedAttempt(email);
      logAuthEvent('login', user._id, false, { email, reason: 'invalid_password', failedAttempts: record.count });
      if (record.count >= LOCKOUT_THRESHOLD) {
        logSecurityEvent('account_locked', { email, userId: user._id, attempts: record.count });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Successful login — clear failed attempts
    clearFailedAttempts(email);

    // Log successful login
    logAuthEvent('login', user._id, true, { email });
    logUserActivity(user._id, 'user_login', { email, loginMethod: 'password' });

    // Generate JWT
    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      userId: user._id,
      email: user.email,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token (for frontend to check if token is still valid)
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    logUserActivity(decoded.userId, 'token_verified', { email: decoded.email });
    res.json({ valid: true, userId: decoded.userId, email: decoded.email });
  } catch (error) {
    logSecurityEvent('token_verification_failed', 'low', { error: error.message });
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

// Verify password (for sensitive operations like accessing encryption settings)
router.post('/verify-password', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.userId;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const authDb = getAuthDb();
    
    // Get user from auth database
    let userDoc;
    try {
      userDoc = await authDb.get(userId);
    } catch (err) {
      logger.logSecurity('password_verification_failed', { 
        userId, 
        reason: 'user_not_found' 
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userDoc.password);
    
    if (!isValidPassword) {
      logSecurityEvent('password_verification_failed', 'medium', { 
        userId, 
        reason: 'incorrect_password' 
      });
      return res.status(401).json({ error: 'Invalid password' });
    }

    logger.logUserActivity(userId, 'password_verified', { 
      reason: 'sensitive_operation_access' 
    });
    
    res.json({ valid: true });
  } catch (error) {
    logger.logError(error, { context: 'password_verification', userId: req.userId });
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Update email (for selfhosted mode - requires authentication)
router.put('/update-email', authenticateToken, async (req, res) => {
  try {
    const { newEmail } = req.body;
    const userId = req.userId;

    if (!newEmail) {
      return res.status(400).json({ error: 'New email is required' });
    }

    // Validate email format (basic validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const authDb = getAuthDb();

    // Check if new email is already taken by another user
    try {
      const result = await authDb.find({
        selector: { email: newEmail },
        limit: 1
      });

      if (result.docs.length > 0 && result.docs[0]._id !== userId) {
        return res.status(409).json({ error: 'Email already in use by another account' });
      }
    } catch (err) {
      console.error('Error checking email availability:', err);
    }

    // Get current user document from auth database
    let userDoc;
    try {
      userDoc = await authDb.get(userId);
    } catch (err) {
      if (err.statusCode === 404) {
        return res.status(404).json({ error: 'User not found' });
      }
      throw err;
    }

    // Update email in auth database
    userDoc.email = newEmail;
    userDoc.updatedAt = new Date().toISOString();

    await authDb.insert(userDoc);

    // Generate new JWT with updated email
    const token = jwt.sign({ userId, email: newEmail }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    logger.logUserActivity(userId, 'email_updated', {
      previousEmail: req.userEmail,
      newEmail: newEmail
    });

    res.json({
      success: true,
      email: newEmail,
      token // Return new token with updated email
    });
  } catch (error) {
    logger.logError(error, { context: 'email_update', userId: req.userId });
    res.status(500).json({ error: 'Failed to update email' });
  }
});

// Delete account — removes user from both auth and users databases
router.delete('/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const authDb = getAuthDb();
    const usersDb = getUsersDb();

    // Delete from users database (user data)
    try {
      const userDoc = await usersDb.get(userId);
      await usersDb.destroy(userDoc._id, userDoc._rev);
    } catch (err) {
      if (err.statusCode !== 404) {
        logger.logError(err, { context: 'delete_account_users_db', userId });
      }
      // 404 is fine — doc may not exist
    }

    // Delete from auth database (credentials)
    try {
      const authDoc = await authDb.get(userId);
      await authDb.destroy(authDoc._id, authDoc._rev);
    } catch (err) {
      if (err.statusCode !== 404) {
        logger.logError(err, { context: 'delete_account_auth_db', userId });
      }
    }

    logUserActivity(userId, 'account_deleted', { email: req.userEmail });

    res.json({ success: true });
  } catch (error) {
    logger.logError(error, { context: 'delete_account', userId: req.userId });
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken; // Re-export for backward compat
