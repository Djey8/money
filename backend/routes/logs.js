const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * Frontend logging endpoint
 * Receives batched logs from frontend and logs them to Loki with proper structure
 */
router.post('/frontend', authenticateToken, (req, res) => {
  try {
    const { logs } = req.body;

    if (!Array.isArray(logs)) {
      return res.status(400).json({ error: 'logs must be an array' });
    }

    const userId = req.userId;
    const userEmail = req.userEmail;

    // Process each log entry
    logs.forEach(log => {
      const {
        timestamp,
        action,
        level,
        username,
        details,
        userAgent,
        url,
        mode
      } = log;

      // Create structured log entry
      const logEntry = {
        timestamp,
        userId: userId || log.userId,
        userEmail,
        username: username || 'unknown',
        action,
        level: level || 'info',
        source: 'frontend',
        url,
        userAgent,
        mode: mode || 'unknown',
        details: details || {}
      };

      // Log to Loki with appropriate level
      switch (level) {
        case 'error':
          logger.error('Frontend activity', logEntry);
          break;
        case 'warning':
          logger.warn('Frontend activity', logEntry);
          break;
        default:
          logger.info('Frontend activity', logEntry);
      }
    });

    // Log batch receipt
    logger.info('Frontend logs received', {
      userId,
      userEmail,
      logCount: logs.length,
      source: 'frontend',
      endpoint: '/logs/frontend'
    });

    res.json({ 
      success: true, 
      received: logs.length,
      message: 'Logs processed successfully'
    });

  } catch (error) {
    logger.error('Frontend log processing error', {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      source: 'frontend'
    });
    res.status(500).json({ error: 'Failed to process logs' });
  }
});

/**
 * Health check for logging endpoint
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    endpoint: 'logs',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
