require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const logsRoutes = require('./routes/logs');
const { initializeDatabase } = require('./config/db');
const logger = require('./config/logger');
const { requestLoggingMiddleware, errorLoggingMiddleware } = require('./middleware/logging');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - only trust 1 hop (k8s ingress/nginx)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS || 'http://localhost:4200';
app.use(cors({
  origin: corsOrigins.split(','),
  credentials: true
}));

// Rate limiting - with proper trust proxy configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting by IP in local development or when behind proxy
  skip: (req) => {
    // In Kubernetes, we trust the ingress/service mesh for rate limiting
    return process.env.SKIP_RATE_LIMIT === 'true';
  }
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '2mb' }));
app.use(express.text({ limit: '2mb', type: 'text/plain' }));

// Enhanced request logging middleware
app.use(requestLoggingMiddleware);

// Debug middleware for data write endpoint
if (process.env.DEBUG_REQUESTS === 'true') {
  app.use('/api/data/write', (req, res, next) => {
    logger.debug('Write request debug', {
      contentType: req.headers['content-type'],
      bodyType: typeof req.body,
      body: req.body,
      debugType: 'write_request'
    });
    next();
  });
}

// Middleware to handle text bodies as JSON strings for data write endpoint
app.use('/api/data/write', (req, res, next) => {
  // If body is a string (from text/plain), try to use it as the value
  if (typeof req.body === 'string' && req.headers['content-type']?.includes('text/plain')) {
    // The body is already the string value we want to write
    req.bodyIsRawString = true;
  }
  next();
});

// Initialize database (only when run directly — tests handle their own init)
if (require.main === module) {
  initializeDatabase().catch(err => {
    logger.logError(err, { context: 'database_initialization' });
    process.exit(1);
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/logs', logsRoutes);

// Enhanced error handler
app.use(errorLoggingMiddleware);

// Export app for testing (supertest)
module.exports = app;

// Start server only when run directly (not when imported by tests)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info('Backend server started', {
      port: PORT,
      environment: process.env.NODE_ENV,
      logLevel: logger.level,
      startupType: 'server_start'
    });
  });
}
