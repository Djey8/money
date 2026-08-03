const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Comma-separated allowlist of emails that get moderation/admin privileges
// (deleting other users' community posts/threads). Configure via .env.
function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Middleware to verify JWT tokens.
 * Checks httpOnly cookie first (access_token), then falls back to Authorization header.
 * Sets req.userId, req.userEmail, req.userRole and req.isAdmin on success.
 */
function authenticateToken(req, res, next) {
  // Priority: cookie > Authorization header
  const token = req.cookies?.access_token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role || 'user';
    req.isAdmin = !!decoded.email && getAdminEmails().includes(decoded.email.toLowerCase());
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateToken };
