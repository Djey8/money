const nano = require('nano');

const couchdbUrl = process.env.COUCHDB_URL || 'http://localhost:5984';
const couchdbUser = process.env.COUCHDB_USER || 'admin';
const couchdbPassword = process.env.COUCHDB_PASSWORD;

// Create connection with authentication.
// nano v11 dropped its axios-based `requestDefaults.auth` option (axios itself
// is gone, replaced with native fetch). The replacement is a stateless Basic
// Auth header sent with every request — deliberately not nano's alternative
// `nano.auth()` cookie-session flow, which expires after CouchDB's idle
// timeout and would need re-authentication logic for a long-running service.
const basicAuthHeader =
  'Basic ' + Buffer.from(`${couchdbUser}:${couchdbPassword}`).toString('base64');

const connection = nano({
  url: couchdbUrl,
  headers: {
    Authorization: basicAuthHeader,
  },
});

let usersDb;
let authDb;
let communityDb;

async function initializeDatabase() {
  try {
    console.log('Connecting to CouchDB...');

    // Create users database if it doesn't exist
    try {
      await connection.db.create('users');
      console.log('Created users database');
    } catch (err) {
      if (err.statusCode !== 412) {
        // 412 = database already exists
        throw err;
      }
      console.log('Users database already exists');
    }

    // Create auth database if it doesn't exist
    try {
      await connection.db.create('auth');
      console.log('Created auth database');
    } catch (err) {
      if (err.statusCode !== 412) {
        throw err;
      }
      console.log('Auth database already exists');
    }

    // Create community database if it doesn't exist
    try {
      await connection.db.create('community');
      console.log('Created community database');
    } catch (err) {
      if (err.statusCode !== 412) {
        throw err;
      }
      console.log('Community database already exists');
    }

    usersDb = connection.db.use('users');
    authDb = connection.db.use('auth');
    communityDb = connection.db.use('community');

    // Create indexes
    await createIndexes();

    // Set up database security and validation
    await setupDatabaseSecurity();

    console.log('Database initialized successfully');
    return { usersDb, authDb };
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

async function createIndexes() {
  try {
    // Index for auth database
    await authDb.createIndex({
      index: {
        fields: ['email'],
      },
      name: 'email-index',
    });

    // Index for users database
    await usersDb.createIndex({
      index: {
        fields: ['userId'],
      },
      name: 'userId-index',
    });

    // Index for community database — serves both "list threads" (selector on
    // type only) and "list posts of a thread" (selector on type + threadId)
    // queries as a prefix match on the same compound index.
    await communityDb.createIndex({
      index: {
        fields: ['type', 'threadId', 'createdAt'],
      },
      name: 'community-type-thread-index',
    });

    console.log('Indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
}

async function setupDatabaseSecurity() {
  try {
    console.log('Setting up database security...');

    // Set up validation design document for users database
    // This ensures users can only be created/modified by the backend API
    const validationDoc = {
      _id: '_design/validation',
      validate_doc_update: function (newDoc, oldDoc, userCtx) {
        // Only admin or the backend service can write
        // In production, the backend should use a service account
        if (userCtx.roles.indexOf('_admin') === -1) {
          // For now, allow writes from authenticated users
          // In production, you'd verify the user matches the document ID
          if (!userCtx.name) {
            throw { forbidden: 'Authentication required' };
          }
        }

        // Ensure document has required structure
        if (newDoc._deleted) {
          return; // Allow deletions
        }

        if (!newDoc.data || typeof newDoc.data !== 'object') {
          throw { forbidden: 'Document must have a data object' };
        }

        if (!newDoc.createdAt) {
          throw { forbidden: 'Document must have createdAt timestamp' };
        }

        if (!newDoc.updatedAt) {
          throw { forbidden: 'Document must have updatedAt timestamp' };
        }
      }.toString(),
    };

    try {
      const existingDoc = await usersDb.get('_design/validation');
      validationDoc._rev = existingDoc._rev;
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }

    await usersDb.insert(validationDoc);
    console.log('Validation design document created/updated');

    // Set up database security document
    // This restricts who can read/write to the databases
    const usersSecurity = {
      admins: {
        names: [couchdbUser],
        roles: ['_admin'],
      },
      members: {
        names: [couchdbUser],
        roles: [],
      },
    };

    const authSecurity = {
      admins: {
        names: [couchdbUser],
        roles: ['_admin'],
      },
      members: {
        names: [couchdbUser],
        roles: [],
      },
    };

    // Community data is publicly readable through the backend API, but the
    // database itself is still only directly reachable by the service account.
    const communitySecurity = {
      admins: {
        names: [couchdbUser],
        roles: ['_admin'],
      },
      members: {
        names: [couchdbUser],
        roles: [],
      },
    };

    // Apply security settings
    try {
      await connection.request({
        db: 'users',
        path: '_security',
        method: 'PUT',
        body: usersSecurity,
      });
      console.log('Users database security configured');
    } catch (err) {
      console.error('Error setting users database security:', err.message);
    }

    try {
      await connection.request({
        db: 'auth',
        path: '_security',
        method: 'PUT',
        body: authSecurity,
      });
      console.log('Auth database security configured');
    } catch (err) {
      console.error('Error setting auth database security:', err.message);
    }

    try {
      await connection.request({
        db: 'community',
        path: '_security',
        method: 'PUT',
        body: communitySecurity,
      });
      console.log('Community database security configured');
    } catch (err) {
      console.error('Error setting community database security:', err.message);
    }
  } catch (error) {
    console.error('Error setting up database security:', error);
    // Don't fail initialization if security setup fails
  }
}

function getUsersDb() {
  return usersDb;
}

function getAuthDb() {
  return authDb;
}

function getCommunityDb() {
  return communityDb;
}

module.exports = {
  initializeDatabase,
  getUsersDb,
  getAuthDb,
  getCommunityDb,
};
