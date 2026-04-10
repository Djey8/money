const express = require('express');
const { getUsersDb } = require('../config/db');
const logger = require('../config/logger');
const { logDatabaseOperation, logUserActivity } = require('../middleware/logging');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Helper function to get or create user document
async function getUserDocument(usersDb, userId) {
  try {
    return await usersDb.get(userId);
  } catch (err) {
    if (err.statusCode === 404) {
      // Create new user document
      const newDoc = {
        _id: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: {}
      };
      await usersDb.insert(newDoc);
      return newDoc;
    }
    throw err;
  }
}

// Helper function to set nested property in object
function setNestedProperty(obj, path, value) {
  const keys = path.split('/').filter(k => k); // Remove empty strings
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  
  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;
  return obj;
}

// Helper function to get nested property from object
function getNestedProperty(obj, path) {
  const keys = path.split('/').filter(k => k);
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return null;
    }
    current = current[key];
  }
  
  return current !== undefined ? current : null;
}

// Helper function to delete nested property from object
function deleteNestedProperty(obj, path) {
  const keys = path.split('/').filter(k => k);
  if (keys.length === 0) return false;
  
  let current = obj;
  const parents = [];
  
  // Navigate to parent of target
  for (let i = 0; i < keys.length - 1; i++) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    parents.push({ obj: current, key: keys[i] });
    current = current[keys[i]];
  }
  
  const lastKey = keys[keys.length - 1];
  if (current && typeof current === 'object' && lastKey in current) {
    delete current[lastKey];
    return true;
  }
  
  return false;
}

// Batch read endpoint - read multiple paths in a single CouchDB document fetch
// IMPORTANT: Must be defined BEFORE /read/*? route to prevent wildcard matching
// This reduces 19 HTTP requests + 19 CouchDB reads to 1 request + 1 read
// Payload: { paths: ["transactions", "subscriptions", "income/revenue/revenues", ...] }
// Response: { data: { "transactions": [...], ... }, updatedAt: "..." }
router.post('/read/batch', authenticateToken, async (req, res) => {
  try {
    const paths = req.body.paths;
    const userId = req.userId;
    const usersDb = getUsersDb();

    if (!Array.isArray(paths)) {
      return res.status(400).json({ error: 'paths must be an array' });
    }

    if (paths.length === 0) {
      return res.status(400).json({ error: 'paths array cannot be empty' });
    }

    // Limit paths to prevent abuse
    if (paths.length > 50) {
      return res.status(400).json({ error: 'Too many paths requested (max 50)' });
    }

    try {
      // Single CouchDB read — the key performance win
      const userDoc = await usersDb.get(userId);

      // ETag support: use CouchDB _rev to skip response if data unchanged
      const etag = `"${userDoc._rev}"`;
      res.set('ETag', etag);
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag && clientEtag === etag) {
        return res.status(304).end();
      }

      const result = {};

      for (const path of paths) {
        if (typeof path !== 'string') continue;
        // Use the path as the key in the result, extract from nested data
        const value = getNestedProperty(userDoc.data, path);
        result[path] = value;
      }

      logDatabaseOperation('batch_read', userId, {
        paths: paths.length,
        operation: 'batch_read'
      });

      res.json({
        data: result,
        updatedAt: userDoc.updatedAt || null
      });
    } catch (err) {
      if (err.statusCode === 404) {
        // No user document yet — return nulls for all paths
        const result = {};
        for (const path of paths) {
          if (typeof path !== 'string') continue;
          result[path] = null;
        }
        res.json({ data: result, updatedAt: null });
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Batch read error:', error);
    res.status(500).json({ error: 'Failed to batch read data' });
  }
});

// Batch write endpoint - write multiple objects in a single transaction
// IMPORTANT: Must be defined BEFORE /write/*? route to prevent wildcard matching
// This significantly reduces HTTP overhead and improves performance for selfhosted mode
// Payload: { writes: [{path: string, data: any}, ...] }
router.post('/write/batch', authenticateToken, async (req, res) => {
  try {
    const writes = req.body.writes;
    const userId = req.userId;
    const usersDb = getUsersDb();

    if (!Array.isArray(writes)) {
      return res.status(400).json({ error: 'writes must be an array' });
    }

    if (writes.length === 0) {
      return res.status(400).json({ error: 'writes array cannot be empty' });
    }

    const MAX_RETRIES = 10;
    const RETRY_DELAY_MS = 50;
    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_RETRIES) {
      try {
        // Get latest user document
        let userDoc = await getUserDocument(usersDb, userId);
        
        if (!userDoc.data) {
          userDoc.data = {};
        }

        // Apply all writes to the document
        for (const write of writes) {
          const { path, data } = write;
          
          if (!path) {
            return res.status(400).json({ error: 'Each write must have a path' });
          }

          if (path === '' || path === '/') {
            // Root level write - replace entire data object
            userDoc.data = data || {};
          } else {
            // Nested write
            setNestedProperty(userDoc.data, path, data);
          }
        }

        userDoc.updatedAt = new Date().toISOString();
        
        const response = await usersDb.insert(userDoc);
        
        logDatabaseOperation('batch_write', userId, {
          operations: writes.length,
          attempt: attempt + 1,
          paths: writes.map(w => w.path).join(', ')
        });
        
        logUserActivity(userId, 'batch_write', {
          operations: writes.length,
          paths: writes.map(w => w.path)
        });
        
        res.json({ 
          success: true, 
          id: response.id, 
          rev: response.rev, 
          writesProcessed: writes.length,
          operations: writes.length 
        });
        return;
      } catch (error) {
        lastError = error;
        
        if (error.statusCode === 409) {
          // Conflict - retry with exponential backoff
          attempt++;
          if (attempt < MAX_RETRIES) {
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 20;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          // Non-conflict error - fail immediately
          throw error;
        }
      }
    }

    // Max retries exceeded
    console.error(`Batch write failed after ${MAX_RETRIES} attempts:`, lastError);
    res.status(503).json({ 
      error: 'Batch write failed due to conflicts. Please try again.',
      details: lastError.message,
      operations: writes.length 
    });
  } catch (error) {
    console.error('Batch write error:', error);
    res.status(500).json({ 
      error: 'Batch write failed', 
      details: error.message 
    });
  }
});

// Write data (supports nested paths like /write/info/username)
// If path is empty, replaces entire data object
// Includes automatic retry logic for CouchDB conflicts
router.post('/write/*?', authenticateToken, async (req, res) => {
  const MAX_RETRIES = 10;
  const RETRY_DELAY_MS = 50;
  
  try {
    const path = req.params[0] || '';
    let data = req.body;
    const userId = req.userId;
    const usersDb = getUsersDb();

    // Handle case where body is empty or invalid
    if (data === undefined || data === null || data === '') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    // If body was sent as raw text (for primitive values), use it directly
    // This happens when sending encrypted string values
    if (req.bodyIsRawString && typeof data === 'string') {
      // Data is already the encrypted string value we want to store
      logger.debug('Write request (raw string)', {
        userId,
        path: path || '(root)',
        dataLength: data.length,
        requestType: 'data_write'
      });
    } else {
      logger.debug('Write request (JSON)', {
        userId,
        path: path || '(root)',
        dataType: typeof data,
        requestType: 'data_write'
      });
    }

    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_RETRIES) {
      try {
        // Get or create user document with latest revision
        let userDoc = await getUserDocument(usersDb, userId);

        if (!path || path === '') {
          // Replace entire data object
          userDoc.data = data;
        } else {
          // Update nested property
          if (!userDoc.data) {
            userDoc.data = {};
          }
          setNestedProperty(userDoc.data, path, data);
        }

        userDoc.updatedAt = new Date().toISOString();
        
        const response = await usersDb.insert(userDoc);
        logDatabaseOperation('write', userId, {
          path: path || '(root)',
          attempt: attempt + 1,
          dataType: typeof data,
          dataSize: JSON.stringify(data).length
        });
        logUserActivity(userId, 'data_written', {
          path: path || '(root)',
          operation: 'write',
          success: true
        });
        res.json({ success: true, id: response.id, rev: response.rev });
        return;
      } catch (error) {
        lastError = error;
        
        // Check if it's a CouchDB conflict error (409)
        if (error.statusCode === 409 || error.error === 'conflict') {
          attempt++;
          logger.warn('Database conflict detected, retrying', {
            userId,
            path: path || '(root)',
            attempt,
            maxRetries: MAX_RETRIES,
            errorType: 'database_conflict'
          });
          
          if (attempt < MAX_RETRIES) {
            // Exponential backoff with jitter
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 20;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          // Not a conflict error, fail immediately
          throw error;
        }
      }
    }
    
    // Max retries exceeded
    console.error(`Write failed after ${MAX_RETRIES} attempts:`, lastError);
    res.status(409).json({ 
      error: 'Failed to write data due to conflicts. Please try again.',
      details: lastError.message 
    });
  } catch (error) {
    console.error('Write error:', error);
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// Lightweight updatedAt check — used by frontend to skip full reload if unchanged
// Returns only the timestamp, no data. One small CouchDB read.
router.get('/updatedAt', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const usersDb = getUsersDb();

    try {
      const userDoc = await usersDb.get(userId);

      // ETag support: skip response body if document hasn't changed
      const etag = `"${userDoc._rev}"`;
      res.set('ETag', etag);
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag && clientEtag === etag) {
        return res.status(304).end();
      }

      res.json({ updatedAt: userDoc.updatedAt || null });
    } catch (err) {
      if (err.statusCode === 404) {
        res.json({ updatedAt: null });
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('UpdatedAt error:', error);
    res.status(500).json({ error: 'Failed to get updatedAt' });
  }
});

// Read data (supports nested paths like /read/info/username)
// If path is empty, returns entire data object
router.get('/read/*?', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0] || '';
    const userId = req.userId;
    const usersDb = getUsersDb();

    try {
      const userDoc = await usersDb.get(userId);
      
      if (!path || path === '') {
        // Return entire data object
        logDatabaseOperation('read', userId, { path: '(root)', operation: 'read_all' });
        logUserActivity(userId, 'data_read', { path: '(root)', operation: 'read' });
        res.json({ data: userDoc.data || null });
      } else {
        // Return nested property
        const data = getNestedProperty(userDoc.data, path);
        logDatabaseOperation('read', userId, { path, operation: 'read_nested', found: data !== null });
        logUserActivity(userId, 'data_read', { path, operation: 'read', found: data !== null });
        res.json({ data });
      }
    } catch (err) {
      if (err.statusCode === 404) {
        res.json({ data: null });
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Read error:', error);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// Get entire user document (for debugging or full export)
router.get('/document', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const usersDb = getUsersDb();

    try {
      const userDoc = await usersDb.get(userId);
      // Remove CouchDB internal fields for cleaner response
      const { _id, _rev, ...cleanDoc } = userDoc;
      logDatabaseOperation('read', userId, { operation: 'read_document' });
      logUserActivity(userId, 'document_accessed', { operation: 'read_full_document' });
      res.json(cleanDoc);
    } catch (err) {
      if (err.statusCode === 404) {
        res.json({ data: {}, createdAt: null, updatedAt: null });
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

// Delete data (supports nested paths like /delete/info/username)
// If path is empty, clears entire data object
router.delete('/delete/*?', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0] || '';
    const userId = req.userId;
    const usersDb = getUsersDb();

    try {
      let userDoc = await usersDb.get(userId);
      
      if (!path || path === '') {
        // Clear entire data object
        userDoc.data = {};
      } else {
        // Delete nested property
        const success = deleteNestedProperty(userDoc.data, path);
        if (!success) {
          return res.status(404).json({ error: 'Path not found' });
        }
      }

      userDoc.updatedAt = new Date().toISOString();
      await usersDb.insert(userDoc);
      
      logDatabaseOperation('delete', userId, { path: path || '(root)', operation: 'delete' });
      logUserActivity(userId, 'data_deleted', { path: path || '(root)', operation: 'delete' });
      
      res.json({ success: true });
    } catch (err) {
      if (err.statusCode === 404) {
        res.status(404).json({ error: 'User document not found' });
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete data' });
  }
});

module.exports = router;
