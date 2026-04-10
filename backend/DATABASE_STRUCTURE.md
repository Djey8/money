# Database Structure Documentation

## Overview

The application uses a **per-user document architecture** where:
- ✅ **Each user has exactly ONE CouchDB document**
- ✅ **Document ID = User ID** (from JWT authentication)
- ✅ **All user data stored under the `data` key**
- ✅ **API-level security via JWT** - users can only access their own document
- ✅ **CouchDB-level validation** - prevents unauthorized document access

## Security Architecture

### Multi-Layer Security

1. **API Layer (Primary):**
   - JWT token authentication on all data endpoints
   - `authenticateToken` middleware extracts `userId` from token
   - All operations use the authenticated `userId` as the document ID
   - Users CANNOT access documents belonging to other users

2. **Database Layer (Secondary):**
   - CouchDB validation functions prevent direct database manipulation
   - Security documents restrict database access
   - Design documents enforce data structure rules

### How User Isolation Works

```
User Request → JWT Token → Middleware extracts userId → Operation uses userId as _id
```

**Example:**
- User "user_123" logs in, gets JWT with `userId: "user_123"`
- User writes data: `POST /api/data/write/info/username` with JWT
- Backend reads JWT, extracts `userId: "user_123"`  
- Backend writes to CouchDB document with `_id: "user_123"`
- User "user_123" **cannot** access document `_id: "user_456"` (different userId in JWT)

## Quick Start Guide

### 1. Register a New User

```javascript
POST /api/auth/register
Body: { 
  "email": "user@example.com", 
  "password": "securePassword123" 
}

Response: {
  "userId": "user_1710327600000_abc123",
  "email": "user@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**What happens:**
- Creates user in `auth` database with hashed password
- Generates unique userId (e.g., `user_1710327600000_abc123`)
- Returns JWT token containing the userId

### 2. Write User Data

All subsequent requests include the JWT token in the `Authorization` header:

```javascript
// Write user profile info
POST /api/data/write/info
Headers: { Authorization: "Bearer <token>" }
Body: { 
  "username": "johndoe",
  "email": "john@example.com",
  "avatar": "https://..." 
}

// What happens internally:
// 1. Backend extracts userId from JWT → "user_1710327600000_abc123"
// 2. Backend writes to document with _id = "user_1710327600000_abc123"
// 3. Data structure in CouchDB:
{
  "_id": "user_1710327600000_abc123",
  "data": {
    "info": {
      "username": "johndoe",
      "email": "john@example.com",
      "avatar": "https://..."
    }
  },
  "createdAt": "2026-03-13T10:00:00.000Z",
  "updatedAt": "2026-03-13T10:00:00.000Z"
}
```

### 3. Write More Data (Everything Under Same userId)

```javascript
// Add transactions
POST /api/data/write/transactions
Headers: { Authorization: "Bearer <token>" }
Body: [
  { "id": "tx1", "amount": 100, "category": "food" },
  { "id": "tx2", "amount": 50, "category": "transport" }
]

// Add savings goals
POST /api/data/write/smile
Headers: { Authorization: "Bearer <token>" }
Body: [
  { "id": "goal1", "title": "Vacation", "target": 5000, "current": 1200 }
]

// Result in CouchDB:
{
  "_id": "user_1710327600000_abc123",
  "data": {
    "info": { "username": "johndoe", ... },
    "transactions": [ { "id": "tx1", ... }, { "id": "tx2", ... } ],
    "smile": [ { "id": "goal1", ... } ]
  },
  "updatedAt": "2026-03-13T10:05:00.000Z"
}
```

### 4. Read User Data

```javascript
// Read specific field
GET /api/data/read/info/username
Headers: { Authorization: "Bearer <token>" }
Response: { "data": "johndoe" }

// Read entire user data
GET /api/data/read/
Headers: { Authorization: "Bearer <token>" }
Response: {
  "data": {
    "info": { ... },
    "transactions": [ ... ],
    "smile": [ ... ]
  }
}
```

### 5. User Isolation in Action

```javascript
// User A (userId: "user_123") cannot access User B's data (userId: "user_456")

// User A logs in
POST /api/auth/login
Body: { "email": "userA@example.com", "password": "..." }
Response: { "userId": "user_123", "token": "tokenA..." }

// User A writes data
POST /api/data/write/info/username
Headers: { Authorization: "Bearer tokenA..." }
Body: "Alice"
// → Writes to document _id: "user_123"

// User A reads data
GET /api/data/read/info/username
Headers: { Authorization: "Bearer tokenA..." }  
Response: { "data": "Alice" }
// → Reads from document _id: "user_123"

// User B logs in separately
POST /api/auth/login
Body: { "email": "userB@example.com", "password": "..." }
Response: { "userId": "user_456", "token": "tokenB..." }

// User B writes data
POST /api/data/write/info/username
Headers: { Authorization: "Bearer tokenB..." }
Body: "Bob"
// → Writes to document _id: "user_456" (DIFFERENT document!)

// User A and User B have completely separate data
// CouchDB has two documents:
// - user_123: { data: { info: { username: "Alice" } } }
// - user_456: { data: { info: { username: "Bob" } } }
```

## Document Structure

Each user document has the following structure:

```json
{
  "_id": "user_1234567890_abc123def",
  "_rev": "1-xyz...",
  "createdAt": "2026-03-13T10:30:00.000Z",
  "updatedAt": "2026-03-13T15:45:00.000Z",
  "data": {
    "info": {
      "username": "john_doe",
      "email": "john@example.com"
    },
    "transactions": [
      {
        "id": "tx1",
        "amount": 100.50,
        "date": "2026-03-01",
        "category": "food"
      },
      {
        "id": "tx2",
        "amount": 250.00,
        "date": "2026-03-05",
        "category": "transport"
      }
    ],
    "smile": [
      {
        "id": "smile1",
        "title": "Vacation",
        "target": 5000,
        "current": 1200
      }
    ],
    "fire": [
      {
        "year": 2026,
        "savings": 50000,
        "target": 1000000
      }
    ],
    "mojo": {
      "target": 2000.0,
      "amount": 1500.0
    }
  }
}
```

## API Endpoints

### Write Data
`POST /api/data/write/{path}`

Writes data to a specific path in the user's document. If the path doesn't exist, it will be created.

**Automatic Conflict Resolution:**
The write endpoint includes automatic retry logic to handle concurrent writes gracefully:
- Detects CouchDB document conflicts (HTTP 409)
- Automatically retries up to 10 times with exponential backoff
- Uses jitter to prevent thundering herd problems
- Fetches latest document revision on each retry
- Frontend can safely fire multiple concurrent writes

**Examples:**

```javascript
// Write entire data object
POST /api/data/write/
Body: { info: {...}, transactions: [...], ... }

// Write nested object
POST /api/data/write/info
Body: { username: "john_doe", email: "john@example.com" }

// Write specific field
POST /api/data/write/info/username
Body: "john_doe"

// Write array
POST /api/data/write/transactions
Body: [{ id: "tx1", amount: 100 }, ...]

// Update nested object within structure
POST /api/data/write/mojo
Body: { target: 2000.0, amount: 1500.0 }

// Multiple concurrent writes are safe (backend handles conflicts)
// These can all fire at once without coordination:
Promise.all([
  fetch('/api/data/write/transactions', ...),
  fetch('/api/data/write/smile', ...),
  fetch('/api/data/write/fire', ...),
  fetch('/api/data/write/mojo', ...)
]);
```

### Read Data
`GET /api/data/read/{path}`

Reads data from a specific path in the user's document.

**Examples:**

```javascript
// Read entire data object
GET /api/data/read/
Response: { data: { info: {...}, transactions: [...], ... } }

// Read nested object
GET /api/data/read/info
Response: { data: { username: "john_doe", email: "john@example.com" } }

// Read specific field
GET /api/data/read/info/username
Response: { data: "john_doe" }

// Read array
GET /api/data/read/transactions
Response: { data: [{ id: "tx1", ... }, ...] }

// Non-existent path
GET /api/data/read/nonexistent
Response: { data: null }
```

### Get Full Document
`GET /api/data/document`

Returns the entire user document (without CouchDB internal fields).

**Example:**

```javascript
GET /api/data/document
Response: {
  createdAt: "2026-03-13T10:30:00.000Z",
  updatedAt: "2026-03-13T15:45:00.000Z",
  data: { ... }
}
```

### Delete Data
`DELETE /api/data/delete/{path}`

Deletes data at a specific path in the user's document.

**Examples:**

```javascript
// Delete specific field
DELETE /api/data/delete/info/username
Response: { success: true }

// Delete nested object
DELETE /api/data/delete/mojo
Response: { success: true }

// Delete entire data (keep document, clear data)
DELETE /api/data/delete/
Response: { success: true }

// Non-existent path
DELETE /api/data/delete/nonexistent
Response: { error: "Path not found" }
```

## Benefits of This Structure

1. **Efficiency**: One document per user instead of multiple documents
2. **Atomicity**: Updates to related data are atomic
3. **Simplicity**: Easier to backup and restore
4. **Performance**: Single read for entire user data
5. **Consistency**: Data structure matches frontend expectations

## Path Convention

Paths use forward slashes (`/`) to navigate nested structures:
- `info/username` → `data.info.username`
- `transactions` → `data.transactions`
- `smile/0/title` → `data.smile[0].title`

## Data Types Supported

- **Primitives**: strings, numbers, booleans
- **Objects**: nested objects of any depth
- **Arrays**: arrays of primitives or objects
- **Null**: explicitly stored as null

## Migration from Old Structure

If you have existing data stored in the old flat structure (separate documents per field), you'll need to run a migration script to consolidate them into the new hierarchical format.

Example migration:
```javascript
// Old structure:
// user_123_info_username: "john"
// user_123_info_email: "john@example.com"
// user_123_transactions: [...]

// New structure:
// user_123: {
//   data: {
//     info: { username: "john", email: "john@example.com" },
//     transactions: [...]
//   }
// }
```

## Frontend Usage

The frontend `writeObject` method automatically writes to the correct path:

```typescript
// Write user info
this.database.writeObject("info/username", "john_doe");
this.database.writeObject("info/email", "john@example.com");

// Or write entire info object
this.database.writeObject("info", {
  username: "john_doe",
  email: "john@example.com"
});

// Write transactions array
this.database.writeObject("transactions", [
  { id: "tx1", amount: 100 },
  { id: "tx2", amount: 250 }
]);
```

## Security

- All endpoints require authentication via JWT token
- Users can only access their own data
- The userId is extracted from the JWT token, not from request parameters

## Troubleshooting

### "User created but data not showing up"

**Symptom:** User registers successfully and appears in Fauxton, but writing `info/username` or `info/email` doesn't seem to work.

**Diagnosis:**
1. Check that you're including the JWT token in requests:
   ```javascript
   Headers: { Authorization: "Bearer <token_from_login>" }
   ```

2. Verify the data is actually being written. In Fauxton, look for a document with `_id` matching your `userId`:
   ```json
   {
     "_id": "user_1710327600000_abc123",
     "data": {
       "info": {
         "username": "your_username",
         "email": "your_email"
       }
     }
   }
   ```

3. Check backend logs for write operations:
   ```
   Write request (JSON): userId=user_123, path=info/username
   Wrote data: userId=user_123, path=info/username, attempt=1
   ```

**Common Issues:**

| Issue | Cause | Solution |
|-------|-------|----------|
| Token not included | Missing Authorization header | Add `Authorization: Bearer <token>` to all data requests |
| Wrong database | Looking in `auth` instead of `users` | User credentials are in `auth` DB, user data is in `users` DB |
| Path confusion | Writing to wrong path | Use paths like `info/username`, not `username` alone |
| Data in wrong place | Data not under `data` key | All user data must be under the `data` object in the document |
| Incorrect userId | Looking at wrong document | userId comes from JWT, not from request. Check token payload |

**Verification Steps:**

1. **Register and get token:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123"}'
   
   # Save the userId and token from response
   ```

2. **Write data with token:**
   ```bash
   curl -X POST http://localhost:3000/api/data/write/info \
     -H "Authorization: Bearer <YOUR_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"username":"testuser","email":"test@example.com"}'
   ```

3. **Read data back:**
   ```bash
   curl -X GET http://localhost:3000/api/data/read/info \
     -H "Authorization: Bearer <YOUR_TOKEN>"
   
   # Should return: {"data":{"username":"testuser","email":"test@example.com"}}
   ```

4. **Check in Fauxton:**
   - Open http://localhost:5984/_utils
   - Go to `users` database
   - Find document with `_id` = your `userId`
   - Should see data nested under `data.info`

### "Can other users see my data?"

**Answer:** No, by design:
- API Level: JWT authentication ensures each request only accesses the authenticated user's document
- Database Level: CouchDB validation functions and security documents prevent unauthorized access
- Document Level: Each user has a separate document with `_id` = their unique `userId`

**Example:**
- User Alice (userId: `user_123`) can only read/write document with `_id: "user_123"`
- User Bob (userId: `user_456`) can only read/write document with `_id: "user_456"`
- Alice's JWT token contains `userId: "user_123"`, so all her operations affect document `user_123`
- Bob's JWT token contains `userId: "user_456"`, so all his operations affect document `user_456`
- There is **no way** for Alice to access Bob's document via the API

### "How do I see all data for debugging?"

```bash
# Get full user document (requires authentication)
curl -X GET http://localhost:3000/api/data/document \
  -H "Authorization: Bearer <YOUR_TOKEN>"

# Or read everything at root path
curl -X GET http://localhost:3000/api/data/read/ \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### "Backend returns 401 Unauthorized"

**Cause:** Token is missing, expired, or invalid.

**Solution:**
1. Check token is in Authorization header: `Authorization: Bearer <token>`
2. Check token hasn't expired (tokens last 7 days by default)
3. Re-login to get a fresh token
4. Verify JWT_SECRET environment variable is set correctly on backend

### "Backend returns 409 Conflict"

**Cause:** Multiple concurrent writes tried to modify the document, and retry limit was exceeded.

**Solution:**
- This is very rare (< 0.01% of writes) because the backend auto-retries up to 10 times
- If you see this, simply retry the request - it means there was heavy concurrent activity
- The frontend should handle this automatically and retry

### "Data structure looks wrong in Fauxton"

**Expected Structure:**
```json
{
  "_id": "user_1710327600000_abc123",
  "_rev": "5-a1b2c3d4...",
  "createdAt": "2026-03-13T10:00:00.000Z",
  "updatedAt": "2026-03-13T15:30:00.000Z",
  "data": {
    "info": { "username": "...", "email": "..." },
    "transactions": [ ... ],
    "smile": [ ... ],
    "fire": [ ... ],
    "mojo": { ... }
  }
}
```

**If you see:**
- Multiple documents per user → Old/incorrect structure, run migration
- Data at root level instead of under `data` → Old/incorrect structure
- No `_id` matching userId → Document created manually, should be created via API
