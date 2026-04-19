const logger = require('../config/logger');
const jwt = require('jsonwebtoken');
const https = require('https');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET;
const SECURITY_ALERT_WEBHOOK_URL = process.env.SECURITY_ALERT_WEBHOOK_URL;

// High-severity events that should trigger immediate alerts
const HIGH_SEVERITY_EVENTS = [
  'account_locked',
  'refresh_token_reuse_detected',
  'brute_force_detected',
  'unauthorized_access',
  'data_breach_attempt'
];

/**
 * Send a security alert to the configured webhook endpoint.
 * Fires asynchronously — failures are logged but never block the caller.
 */
function sendSecurityAlert(event, severity, details) {
  if (!SECURITY_ALERT_WEBHOOK_URL) return;

  const payload = JSON.stringify({
    text: `[${severity.toUpperCase()}] Security event: ${event}`,
    event,
    severity,
    timestamp: new Date().toISOString(),
    service: 'money-backend',
    details
  });

  const url = new URL(SECURITY_ALERT_WEBHOOK_URL);
  const transport = url.protocol === 'https:' ? https : http;
  const req = transport.request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    timeout: 5000
  }, (res) => {
    if (res.statusCode >= 400) {
      logger.warn('Security alert webhook returned error', { statusCode: res.statusCode, event });
    }
    res.resume();
  });

  req.on('error', (err) => {
    logger.warn('Security alert webhook failed', { error: err.message, event });
  });
  req.on('timeout', () => { req.destroy(); });
  req.write(payload);
  req.end();
}

/**
 * Extract userId from JWT token in Authorization header
 */
function extractUserIdFromToken(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return 'anonymous';
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId || 'anonymous';
  } catch (error) {
    // Token invalid or expired - that's okay, just log as anonymous
    return 'anonymous';
  }
}

/**
 * Enhanced logging middleware for comprehensive request/response tracking
 */
function requestLoggingMiddleware(req, res, next) {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Attach request ID to request object
  req.requestId = requestId;
  
  // Extract userId from JWT token or use from auth middleware or default to anonymous
  const userId = req.userId || extractUserIdFromToken(req);
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userId,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    requestType: 'incoming_request',
    context_source: 'api'
  });
  
  // Capture response
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    res.send = originalSend;
    const responseTime = Date.now() - startTime;
    
    logResponse(req, res, responseTime, requestId, data);
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    res.json = originalJson;
    const responseTime = Date.now() - startTime;
    
    logResponse(req, res, responseTime, requestId, data);
    return originalJson.call(this, data);
  };
  
  next();
}

/**
 * Log response details
 */
function logResponse(req, res, responseTime, requestId, responseData) {
  // Extract userId from JWT or use from auth middleware
  const userId = req.userId || extractUserIdFromToken(req);
  
  const logData = {
    requestId,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    responseTimeMs: responseTime,
    ip: req.ip,
    userId,
    userAgent: req.headers['user-agent'],
    requestType: 'api_call',
    context_source: 'api'
  };
  
  // Add performance warning for slow requests
  if (responseTime > 1000) {
    logData.performanceWarning = 'slow_request';
    logData.warningType = 'performance';
  }
  
  // Log based on status code
  if (res.statusCode >= 500) {
    logger.error('Server error response', {
      ...logData,
      errorType: 'server_error',
      responseBody: responseData
    });
  } else if (res.statusCode >= 400) {
    logger.warn('Client error response', {
      ...logData,
      errorType: 'client_error',
      responseBody: responseData
    });
  } else {
    logger.info('Successful response', logData);
  }
}

/**
 * Error handling middleware
 */
function errorLoggingMiddleware(err, req, res, next) {
  const requestId = req.requestId || 'unknown';
  
  logger.error('Unhandled error', {
    requestId,
    method: req.method,
    path: req.path,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    errorType: 'unhandled_exception',
    statusCode: err.statusCode || 500,
    userId: req.userId || req.user?.userId,
    context_source: 'api'
  });
  
  // Send error response
  res.status(err.statusCode || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    requestId
  });
}

/**
 * Log database operations
 */
function logDatabaseOperation(operation, userId, details = {}) {
  logger.info('Database operation', {
    operation,
    userId,
    activityType: 'data_operation',
    requestType: 'database',
    context_source: 'database',
    ...details
  });
}

/**
 * Log authentication events
 */
function logAuthEvent(event, userId, success, details = {}) {
  const logData = {
    event,
    userId,
    success,
    activityType: 'authentication',
    securityType: success ? 'auth_success' : 'auth_failure',
    context_source: 'auth',
    ...details
  };
  
  if (success) {
    logger.info('Authentication event', logData);
  } else {
    logger.warn('Authentication failure', {
      ...logData,
      warningType: 'security'
    });
  }
}

/**
 * Log user activity
 */
function logUserActivity(userId, action, details = {}) {
  logger.info('User activity', {
    userId,
    action,
    activityType: 'user_behavior',
    requestType: 'user_action',
    context_source: 'user',
    timestamp: new Date().toISOString(),
    ...details
  });
}

/**
 * Log security events
 */
function logSecurityEvent(event, severity = 'medium', details = {}) {
  const logLevel = severity === 'high' ? 'error' : 'warn';
  
  logger[logLevel]('Security event', {
    event,
    severity,
    securityType: 'security_event',
    activityType: 'security',
    context_source: 'security',
    ...details
  });

  // Fire webhook alert for high-severity events or explicit high severity
  if (severity === 'high' || HIGH_SEVERITY_EVENTS.includes(event)) {
    sendSecurityAlert(event, severity, details);
  }
}

module.exports = {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  logDatabaseOperation,
  logAuthEvent,
  logUserActivity,
  logSecurityEvent
};
