const winston = require('winston');

// Custom format for structured logging (flat JSON, no metadata wrapper)
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    return msg;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'money-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Write all logs to stdout (for Loki/Promtail to collect)
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
    })
  ]
});

// Helper function to log user activity
logger.logUserActivity = (userId, action, details = {}) => {
  logger.info('User activity', {
    userId,
    action,
    activityType: 'user_behavior',
    ...details
  });
};

// Helper function to log API requests
logger.logRequest = (req, responseTime, statusCode) => {
  logger.info('API request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.userId || req.user?.userId,
    statusCode,
    responseTime: `${responseTime}ms`,
    requestType: 'api_call'
  });
};

// Helper function to log errors with context
logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    errorType: 'application_error',
    ...context
  });
};

// Helper function to log security events
logger.logSecurity = (event, details = {}) => {
  logger.warn('Security event', {
    event,
    securityType: 'security_event',
    ...details
  });
};

module.exports = logger;
