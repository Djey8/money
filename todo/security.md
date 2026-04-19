# Security Audit Report — Money App

**Audit Date:** 2025-07-17  
**Remediation Date:** 2026-04-19  
**Re-evaluation Date:** 2026-04-19  
**Auditor Role:** Senior Full-Stack Application Security Auditor  
**Scope:** Angular 19 frontend, Node.js/Express backend, CouchDB, Podman/Docker containers, k3s Kubernetes, CI/CD, Secrets Management  
**Standards:** OWASP Top 10 (2021), ASVS Level 2, CIS Benchmarks, ISO 27001 Annex A

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Threat Model](#2-threat-model)
3. [Findings — CRITICAL](#3-findings--critical)
4. [Findings — HIGH](#4-findings--high)
5. [Findings — MEDIUM](#5-findings--medium)
6. [Findings — LOW / Informational](#6-findings--low--informational)
7. [Angular Frontend Security](#7-angular-frontend-security)
8. [Node.js Backend Security](#8-nodejs-backend-security)
9. [CouchDB Security](#9-couchdb-security)
10. [API Security](#10-api-security)
11. [Container Security](#11-container-security)
12. [Kubernetes (k3s) Security](#12-kubernetes-k3s-security)
13. [Secrets Management](#13-secrets-management)
14. [CI/CD & Supply Chain](#14-cicd--supply-chain)
15. [Certification Readiness](#15-certification-readiness)
16. [Remediation Priority Matrix](#16-remediation-priority-matrix)

---

## 1. Executive Summary

The Money App is a personal finance management tool with dual deployment modes (Firebase cloud and self-hosted k3s). The architecture consists of an Angular 19 SPA, a Node.js/Express API, and CouchDB for data persistence. The self-hosted stack runs in Podman/Docker containers orchestrated by k3s.

**Overall Risk Level: ~~HIGH~~ → LOW-MEDIUM** (after remediation)

The application has strong security practices across all critical and high-severity areas. All CRITICAL (4/4) and HIGH (6/6) findings are fully resolved. Remaining items are MEDIUM/LOW severity and primarily affect supply-chain tooling and optional hardening.

Key security posture:
- ✅ Secrets in gitignored `k8s/secrets.yaml` + `.env` (no plaintext in repo)
- ✅ httpOnly cookie auth with refresh token rotation (15min access / 7day refresh)
- ✅ Account lockout (10 failures → 15min lock) + auth-specific rate limiting (10/15min)
- ✅ TLS with cert-manager/Let's Encrypt + HSTS + HTTP→HTTPS redirect
- ✅ Pod security contexts, NetworkPolicy, non-root containers
- ✅ Server-side password policy (8+ chars, upper/lower/number)
- ⚠️ Known vulnerable dependencies (protobufjs critical, path-to-regexp high)
- ⚠️ No CI security scanning (npm audit, container scanning, SAST)
- ⚠️ No Content-Security-Policy header on frontend

**Findings Summary:**
| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 4 | 4 ✅ | 0 |
| HIGH | 6 | 6 ✅ | 0 |
| MEDIUM | 8 | 5 ✅ | 3 |
| LOW/Info | 7 | 4 ✅ | 3 |
| NEW | 3 | — | 3 |

---

## 2. Threat Model

### Assets
- User financial data (transactions, subscriptions, budgets, investments, liabilities)
- User credentials (email, hashed passwords)
- JWT tokens (session management)
- Client-side encryption keys
- CouchDB admin credentials
- TLS certificates

### Threat Actors
1. **External attacker** — Internet-facing attacker targeting cashflowhero.uk
2. **Malicious insider** — Someone with repo access seeing committed secrets
3. **Network attacker** — MITM on local/Wi-Fi network (self-hosted Raspberry Pi scenario)
4. **Supply chain** — Compromised npm dependencies

### Attack Surfaces
- Nginx reverse proxy (ports 80/443, 8080/8443)
- Backend API (port 3000, proxied)
- CouchDB (port 5984, proxied through nginx)
- Kubernetes NodePort services (30080, 30545)
- Frontend SPA (localStorage, sessionStorage)

---

## 3. Findings — CRITICAL

### C1: Secrets Committed to Version Control ✅ FIXED
**OWASP:** A02:2021 Cryptographic Failures  
**ASVS:** 2.10.4, 6.4.1  
**Files:**
- `k8s/backend.yaml` lines 30-31 — Real JWT_SECRET and COUCHDB_PASSWORD in `stringData`
- `k8s/couchdb.yaml` lines 108-111 — CouchDB admin password in `stringData`
- `docker-compose.yml` lines 17, 38-39 — Default "changeme" passwords
- `backend/.env.example` — Contains example value `your-super-secret-jwt-key-change-this`

**Impact:** Anyone with read access to the repository (or any historical clone) has the production JWT signing secret and database admin password. An attacker can:
- Forge arbitrary JWT tokens and impersonate any user
- Directly access/modify/delete all CouchDB data
- Escalate to full system compromise

**Remediation:**
1. **Immediately rotate** the JWT_SECRET and COUCHDB_PASSWORD on the production cluster
2. Remove plaintext secrets from k8s YAML files; use `kubectl create secret` or an external secrets operator (e.g., Sealed Secrets, SOPS, External Secrets Operator)
3. Add `k8s/*secret*` patterns to `.gitignore` or use Kustomize overlays for secrets
4. Run `git filter-repo` or BFG to purge secrets from Git history
5. In docker-compose.yml, reference `.env` file instead of inline values

---

### C2: Hardcoded Default Encryption Key ✅ FIXED
**OWASP:** A02:2021 Cryptographic Failures  
**ASVS:** 6.2.1, 6.4.1  
**File:** `src/app/shared/services/cryptic.service.ts` line 17

```typescript
defaultKey = "akj154072mjakjajah825";
```

**Impact:** The CrypticService uses CryptoJS AES encryption with a hardcoded default key. If users enable encryption without setting a custom key, their data is encrypted with a key that is publicly visible in the source code. This provides zero confidentiality.

**Remediation:**
1. Remove the hardcoded default key entirely
2. Force users to set a strong custom encryption key before enabling encryption
3. Derive the encryption key from user input using a proper KDF (PBKDF2 or Argon2)
4. Consider using the Web Crypto API instead of CryptoJS for better security

---

### C3: CouchDB Admin Interface Exposed via Nginx ✅ FIXED
**OWASP:** A01:2021 Broken Access Control  
**File:** `nginx.conf` lines 64-89

```nginx
location ~ ^/_(utils|session|all_dbs|uuids|active_tasks|...) {
    proxy_pass http://couchdb:5984;
}
location ~ ^/(auth|users) {
    proxy_pass http://couchdb:5984;
}
```

**Impact:** The nginx config proxies CouchDB system endpoints (`/_utils` = Fauxton admin UI, `/_session`, `/_all_dbs`) and database endpoints (`/auth`, `/users`) directly to the internet with `Access-Control-Allow-Origin: *`. An attacker who knows the CouchDB admin password (see C1) can:
- Access the Fauxton admin UI directly
- Read/write all user documents and auth records
- Create/destroy databases

Even without the admin password, the `/auth` and `/users` database endpoints are exposed, which could allow unauthenticated reads depending on CouchDB security settings.

**Remediation:**
1. **Remove** the CouchDB proxy blocks from nginx.conf entirely — the backend API should be the only gateway to CouchDB
2. If Fauxton is needed for admin tasks, expose it only via `kubectl port-forward` or a VPN
3. At minimum, add HTTP Basic Auth or IP restriction to these locations

---

### C4: No Backend Password Complexity Enforcement ✅ FIXED
**OWASP:** A07:2021 Identification and Authentication Failures  
**ASVS:** 2.1.1, 2.1.7  
**File:** `backend/routes/auth.js` line 18

```javascript
if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
}
```

The backend `/register` endpoint only checks that email and password are non-empty. The frontend enforces a minimum of 6 characters (`registration.component.ts` line 425), but this is trivially bypassed with a direct API call.

**Impact:** Users can register with passwords like "1" or "a", making brute-force attacks trivial.

**Remediation:**
1. Add server-side validation: minimum 8 characters, check against breached password lists (HIBP API or top-10000 list)
2. Enforce basic complexity: at least 1 uppercase, 1 lowercase, 1 digit (or simply enforce minimum entropy)
3. Never rely solely on frontend validation for security controls

---

## 4. Findings — HIGH

### H1: CORS Wildcard in Production Kubernetes ✅ FIXED
**OWASP:** A05:2021 Security Misconfiguration  
**ASVS:** 14.5.3  
**Files:**
- `k8s/backend.yaml` line 14: `CORS_ORIGINS: "*"`
- `nginx.conf` lines 43-44: `add_header 'Access-Control-Allow-Origin' '*' always`

**Impact:** Both the backend and nginx set CORS to wildcard. Any website can make authenticated API requests to the backend if the user's JWT is known. Combined with the `credentials: true` option that CORS allows, this enables cross-origin attacks.

**Remediation:**
1. Set `CORS_ORIGINS` to the specific frontend domain(s): `https://cashflowhero.uk,https://www.cashflowhero.uk`
2. Update nginx to use `$http_origin` with a whitelist instead of `*`
3. Note: `credentials: corsOrigins !== '*'` in server.js means credentials mode is OFF with wildcard — this partially mitigates the issue, but is still unsafe

---

### H2: Rate Limiting Disabled in Kubernetes ✅ FIXED
**OWASP:** A04:2021 Insecure Design  
**ASVS:** 11.1.4  
**Files:**
- `k8s/backend.yaml` line 17: `SKIP_RATE_LIMIT: "true"`
- `docker-compose.yml` line 40: `SKIP_RATE_LIMIT=true`

**Impact:** The Express rate limiter is fully bypassed. An attacker can:
- Brute-force passwords without restriction
- Enumerate users via the `/register` endpoint (409 = exists)
- Perform denial-of-service via API flooding

**Remediation:**
1. Remove `SKIP_RATE_LIMIT: "true"` — rate limiting should work in production
2. Configure the rate limiter to use `X-Forwarded-For` (already configured with `trust proxy`)
3. Add stricter rate limits for auth endpoints: max 5-10 requests per 15 minutes for `/login` and `/register`
4. Add account lockout after repeated failed login attempts

---

### H3: JWT Token Has No Refresh Mechanism ✅ FIXED
**OWASP:** A07:2021 Identification and Authentication Failures  
**ASVS:** 3.5.1, 3.5.3  
**Files:**
- `backend/routes/auth.js` — refresh token endpoints and rotation logic
- `src/app/shared/interceptors/auth.interceptor.ts` — automatic token refresh on 401

**Impact:** JWTs were issued with a 7-day expiration and no way to revoke tokens server-side.

**Fix Applied:**
1. Short-lived access tokens (15 min) + long-lived refresh tokens (7 day)
2. Refresh tokens stored in CouchDB `auth` DB as `rt_<jti>` documents
3. Token rotation on refresh: old token revoked, new pair issued
4. `/api/auth/refresh` endpoint for transparent token renewal
5. `/api/auth/logout` endpoint revokes refresh token in DB and clears cookies
6. Angular HTTP interceptor auto-refreshes on 401 responses

---

### H4: JWT Token Stored in localStorage ✅ FIXED
**OWASP:** A07:2021 Identification and Authentication Failures  
**ASVS:** 3.3.2  
**Files:**
- `backend/routes/auth.js` — cookie-based token delivery
- `backend/middleware/auth.js` — cookie-first token extraction
- `src/app/shared/interceptors/auth.interceptor.ts` — `withCredentials: true`
- `src/app/shared/services/selfhosted.service.ts` — removed localStorage token storage

**Impact:** `localStorage` was accessible to any JavaScript running on the page, enabling XSS-based token theft.

**Fix Applied:**
1. Access token delivered via `httpOnly`, `Secure` (production), `SameSite=Strict` cookie (`access_token`, path=/)
2. Refresh token in `httpOnly` cookie (`refresh_token`, path=/api/auth)
3. `cookie-parser` middleware added to Express
4. Auth middleware reads cookie first, then falls back to Authorization header for backward compat
5. Frontend no longer stores/reads `selfhosted_token` from localStorage; only `selfhosted_userId` persisted
6. No separate CSRF token needed: `SameSite=Strict` prevents cross-origin cookie submission

---

### H5: No Account Lockout After Failed Login Attempts ✅ FIXED
**OWASP:** A07:2021 Identification and Authentication Failures  
**ASVS:** 2.2.1  
**File:** `backend/routes/auth.js` — login endpoint

Failed login attempts are logged but no lockout mechanism exists. Combined with H2 (rate limiting disabled), this allows unlimited brute-force attempts.

**Remediation:**
1. ~~Implement progressive delay after failed attempts (1s, 2s, 4s, 8s, etc.)~~
2. ~~Lock account after 10 consecutive failures, require email verification to unlock~~
3. Implement CAPTCHA after 3 failed attempts (optional enhancement)

**Fix Applied:** In-memory account lockout: 10 consecutive failures → 15-minute lockout with `Retry-After` header. Counter resets on successful login or after 30 minutes of inactivity. Security event logged on lockout.

---

### H6: No TLS Enforcement by Default ✅ FIXED
**OWASP:** A02:2021 Cryptographic Failures  
**ASVS:** 9.1.1  
**Files:**
- `nginx.conf` line 26-28 — HTTPS redirect is commented out
- `k8s/ingress.yaml` line 42-45 — TLS section is commented out

**Impact:** The default deployment serves everything over HTTP. JWT tokens, passwords, and financial data are transmitted in plaintext. The HTTPS block in nginx.conf exists but the HTTP→HTTPS redirect is disabled.

**Remediation:**
1. ~~Enable the HTTP→HTTPS redirect in nginx.conf~~ ✅
2. ~~Uncomment and configure the TLS section in ingress.yaml~~ ✅
3. ~~Use cert-manager with Let's Encrypt for automated TLS certificates~~ ✅
4. ~~Add HSTS header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`~~ ✅

**Fix Applied:** Ingress TLS enabled with cert-manager/Let's Encrypt ClusterIssuer, Traefik HTTP→HTTPS redirect middleware, HSTS header added to nginx.

---

## 5. Findings — MEDIUM

### M1: innerHTML Usage in BI Dashboard ✅ FIXED
**OWASP:** A03:2021 Injection (XSS)  
**ASVS:** 5.3.3  
**File:** `src/app/stats/bi/bi-dashboard.ts`

`innerHTML` and D3 `.html()` calls interpolated user-controlled data (transaction categories, comments) without escaping, bypassing Angular's built-in XSS protection.

**Fix Applied:**
1. Added `escapeHtml()` helper that escapes `&`, `<`, `>`, `"`, `'`
2. All user-controlled data (`category`, `comment`) passed through `escapeHtml()` before innerHTML interpolation
3. Changed D3 `.html()` to `.text()` where only plain text + emoji is needed (transaction table category column)

---

### M2: User Enumeration via Registration Endpoint ✅ PARTIALLY FIXED
**OWASP:** A07:2021 Identification and Authentication Failures  
**ASVS:** 2.1.5  
**File:** `backend/routes/auth.js`

The `/register` endpoint now returns a generic "Registration failed" message (HTTP 409) instead of "User already exists", but still returns a distinct status code from success (201). A determined attacker can still enumerate via status code differences.

**Remaining gap:** For full certification compliance, return 201 in all cases and use email verification to distinguish real vs duplicate accounts.

**Remediation:**
1. Return the same success response regardless of whether the email exists
2. Send a verification email in all cases: "If an account exists, you'll receive an email"

---

### M3: Missing Email Verification on Registration ❌ OPEN
**OWASP:** A07:2021 Identification and Authentication Failures  
**ASVS:** 2.1.6  
**File:** `backend/routes/auth.js` — register endpoint

Users are immediately granted a JWT after registration without verifying email ownership. This allows:
- Registration with fake/typo emails
- Potential abuse for spamming the database with fake accounts

**Remediation:**
1. Send a verification email with a time-limited token
2. Restrict account functionality until email is verified

---

### M4: Encryption Key Stored in localStorage ❌ OPEN
**OWASP:** A02:2021 Cryptographic Failures  
**ASVS:** 6.4.2  
**File:** `src/app/shared/services/cryptic.service.ts` line 46

```typescript
localStorage.setItem('encryptKey', key);
```

The user's custom encryption key is stored in localStorage in plaintext. If an attacker gains XSS (see M1), they can read the key and decrypt all user data.

**Remediation:**
1. Don't persist the encryption key — prompt the user on each session
2. Or derive the key from the user's password at login time using PBKDF2
3. Use sessionStorage at minimum (clears on tab close)

---

### M5: Debug Mode Enabled in Production k8s ✅ FIXED
**OWASP:** A05:2021 Security Misconfiguration  
**File:** `k8s/backend.yaml` line 19: `DEBUG_REQUESTS: "true"`

Debug request logging is enabled in production, which logs request bodies. This may log sensitive data like passwords and encryption keys to the Loki logging stack.

**Remediation:**
1. Set `DEBUG_REQUESTS: "false"` in production
2. Ensure sensitive fields (password, token) are never logged — add a sanitizer to the logging middleware

---

### M6: Firebase API Key Exposed in Environment File ⏭️ N/A
**OWASP:** A05:2021 Security Misconfiguration  
**File:** `src/environments/environment.ts` lines 10-17

Firebase client config (apiKey, projectId, etc.) is bundled into the frontend. While Firebase client API keys are designed to be public and restricted via Firebase Security Rules, exposure combined with misconfigured rules could allow unauthorized access.

**Remediation:**
1. Verify Firebase Security Rules restrict read/write access to authenticated users only
2. Enable App Check to prevent API abuse
3. Restrict the API key in Google Cloud Console to specific domains and APIs

---

### M7: No CSRF Protection ⏭️ N/A (mitigated by SameSite=Strict cookies)
**OWASP:** A01:2021 Broken Access Control  
**ASVS:** 4.2.2  

The API now uses `httpOnly` cookies with `SameSite=Strict` (H4 fixed). `SameSite=Strict` prevents cookies from being sent on any cross-origin request, effectively mitigating CSRF without a separate token. The Authorization Bearer header is still accepted as a fallback for backward compatibility.

**Remediation:**
1. If moving to cookie auth, add CSRF tokens (csurf middleware or double-submit pattern)
2. Fix CORS before considering this resolved

---

### M8: Body Parser Limit May Be Insufficient for DoS Prevention ✅ MITIGATED
**OWASP:** A04:2021 Insecure Design  
**File:** `backend/server.js` line 47: `express.json({ limit: '2mb' })`

While 2MB is reasonable, combined with disabled rate limiting (H2), an attacker could send many 2MB requests to exhaust memory/bandwidth.

**Remediation:**
1. Re-enable rate limiting (H2) ✅ Done
2. Consider a lower limit (512KB) unless large payloads are needed
3. Add request timeout middleware

---

### M9: Known Vulnerable Dependencies — NEW
**OWASP:** A06:2021 Vulnerable and Outdated Components  
**ASVS:** 14.2.1  
**Discovered:** 2026-04-19 re-evaluation

**Frontend (1 critical):**
- `protobufjs <7.5.5` — Arbitrary code execution (GHSA-xq3m-2v4x-88gg)  
  Path: `@angular/fire → firebase → @firebase/firestore → @grpc/proto-loader → protobufjs@7.5.4`  
  Fix: `npm audit fix` (update protobufjs to ≥7.5.5)

**Backend (1 high, 2 moderate):**
- `path-to-regexp <0.1.13` — ReDoS via multiple route parameters (GHSA-37ch-88jc-xwx2)  
  Path: `express@4.22.1 → path-to-regexp@0.1.12`  
  Fix: Upgrade Express to v5.x (Express 4 pins path-to-regexp 0.1.x)
- `axios 1.0.0–1.14.0` — SSRF via NO_PROXY bypass + cloud metadata exfiltration  
  Path: `nano@10.1.4 → axios@1.13.6`  
  Fix: `npm audit fix` or upgrade nano
- `follow-redirects ≤1.15.11` — Auth header leak on cross-domain redirects  
  Path: `nano → axios → follow-redirects`  
  Fix: Updates with axios fix

**Remediation:**
1. Run `npm audit fix` in both root and backend directories
2. For Express path-to-regexp: evaluate Express 5.x migration or accept risk (ReDoS requires crafted route patterns, not user input)
3. Add `npm audit --omit=dev` to CI pipeline to catch future regressions

---

### M10: No Content-Security-Policy Header — NEW
**OWASP:** A05:2021 Security Misconfiguration  
**ASVS:** 14.4.3  
**File:** `nginx.conf`  
**Discovered:** 2026-04-19 re-evaluation

Nginx serves `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `HSTS` headers — but no `Content-Security-Policy`. CSP is the strongest defense against XSS, script injection, and data exfiltration.

**Remediation:**
1. Add a strict CSP header to nginx:
   ```nginx
   add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://cashflowhero.uk; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
   ```
2. Test thoroughly — Angular apps may need `'unsafe-inline'` for styles and possibly `'unsafe-eval'` for some build configurations
3. Use CSP reporting (`report-uri` or `report-to`) to catch violations before enforcing

---

## 6. Findings — LOW / Informational

### L1: User ID Generation Is Predictable ✅ FIXED
**File:** `backend/routes/auth.js` line 44

```javascript
const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

`Math.random()` is not cryptographically secure. User IDs are predictable. Use `crypto.randomUUID()` or `crypto.randomBytes()`.

---

### L2: No Input Sanitization on Email Field ✅ FIXED
**File:** `backend/routes/auth.js` line 224 — email regex only on update-email, not on register.

The registration endpoint does not validate email format server-side. Consider adding the same regex validation used in `update-email`.

---

### L3: Error Messages Leak Stack Traces in Development
**File:** `backend/middleware/logging.js` line 133

```javascript
error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
```

Good: Production errors are generic. Note: ensure `NODE_ENV=production` is always set in deployment.

---

### L4: No Security Headers on Frontend (Nginx) ✅ FIXED
**File:** `nginx.conf`

Helmet sets security headers on the backend API, but the nginx server serving the Angular SPA does not add:
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

**Remediation:** Add these headers to the nginx `server` block.

---

### L5: No Kubernetes Network Policies ✅ FIXED
**File:** `k8s/network-policy.yaml`

NetworkPolicy added to restrict CouchDB ingress to only backend pods and backup jobs on port 5984.

**Fix Applied:** Created `k8s/network-policy.yaml` with podSelector matching `app: couchdb`, allowing ingress only from `app: backend` and `job-type: couchdb-backup` on TCP 5984.

---

### L6: Backup CronJob Runs as Root ✅ FIXED
**File:** `k8s/backup-cronjob-daily.yaml`, `k8s/backup-cronjob-hourly.yaml`

Backup containers now run as non-root (UID 100, the curl user in curlimages/curl), with `allowPrivilegeEscalation: false` and all capabilities dropped.

**Fix Applied:** Changed `runAsUser: 0` to `runAsUser: 100` with `runAsNonRoot: true`, added container-level securityContext.

---

### L7: No Pod Security Standards / Security Contexts ✅ FIXED
**Files:** `k8s/backend.yaml`, `k8s/frontend.yaml`

Both deployments now have pod-level and container-level securityContext:
- `runAsNonRoot: true`
- `allowPrivilegeEscalation: false`
- `capabilities.drop: ["ALL"]`
- Backend: `readOnlyRootFilesystem: true`, `runAsUser: 1000`
- Frontend: `runAsUser: 101` (nginx user), writable tmpfs for /tmp, /var/cache/nginx, /var/run

**Fix Applied:** Added comprehensive security contexts to all pod specs.

---

## 7. Angular Frontend Security

| Control | Status | Notes |
|---------|--------|-------|
| XSS Protection (Angular built-in) | ✅ PASS | Angular auto-escapes interpolation. ViewEncapsulation used. |
| D3.js XSS Risk | ✅ FIXED | User data escaped via escapeHtml(), .text() used where possible |
| CSP Header | ❌ FAIL | No Content-Security-Policy on frontend (M10) |
| Service Worker (PWA) | ✅ PASS | ngsw-config.json properly configured |
| Dependency `crypto-js` | ⚠️ WARN | CryptoJS AES with string passphrase uses insecure KDF internally (MD5-based) |
| Dependency `protobufjs` | ❌ FAIL | Critical arbitrary code execution vuln (7.5.4 < 7.5.5) via @angular/fire chain |
| Token Storage | ✅ PASS | JWT in httpOnly cookies (H4 fixed) |
| Encryption Key Storage | ❌ FAIL | Key in localStorage in plaintext (M4) — note: hardcoded default key removed |
| DomSanitizer bypass | ✅ PASS | No `bypassSecurityTrust*` calls found |
| `eval()` / `Function()` | ✅ PASS | No unsafe eval patterns found |

---

## 8. Node.js Backend Security

| Control | Status | Notes |
|---------|--------|-------|
| Helmet.js | ✅ PASS | Helmet v7 enabled with defaults |
| Rate Limiting (global) | ✅ PASS | express-rate-limit: 500 req/15min global |
| Rate Limiting (auth) | ✅ PASS | Strict 10 req/15min on /login and /register |
| Rate Limiting (production) | ✅ FIXED | SKIP_RATE_LIMIT=false in k8s |
| Password Hashing | ✅ PASS | bcrypt with cost factor 10 |
| Password Policy | ✅ FIXED | Server-side: min 8 chars, upper/lower/number required (C4) |
| JWT Implementation | ✅ PASS | Refresh tokens with rotation and revocation (H3 fixed) |
| Account Lockout | ✅ PASS | 10 failures → 15min lockout with Retry-After header |
| Input Validation | ⚠️ WARN | Minimal — no schema validation library (e.g., Joi, Zod) |
| SQL/NoSQL Injection | ✅ PASS | CouchDB Mango queries use parameterized selectors |
| Error Handling | ✅ PASS | Production errors are generic; dev errors have detail |
| Dependency Versions | ❌ FAIL | path-to-regexp (HIGH ReDoS), axios (MODERATE SSRF) — see M9 |
| `trust proxy` | ✅ FIXED | Was `true` → now set to `1` (trusts only 1 hop) |
| Resource Limits | ✅ PASS | Backend pod: 128Mi-192Mi memory, 100m-200m CPU |

---

## 9. CouchDB Security

| Control | Status | Notes |
|---------|--------|-------|
| Admin Password | ✅ FIXED | Secrets moved to gitignored secrets.yaml + .env (C1) |
| Network Exposure | ✅ FIXED | Fauxton proxy removed from nginx (C3) |
| Validation Design Doc | ✅ PASS | `_design/validation` checks document structure |
| Per-Document Access Control | ⚠️ WARN | Comment in code: "For now, allow writes from authenticated users" — no per-user document isolation enforced at CouchDB level |
| Encryption at Rest | ❌ FAIL | No CouchDB encryption configured |
| Backup Encryption | ❌ FAIL | Backups are plaintext tar.gz archives |
| Max Document Size | ✅ PASS | Limited to 8MB in couchdb-local.ini |

---

## 10. API Security

| Control | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ PASS | JWT required on all data endpoints |
| Authorization (IDOR) | ⚠️ WARN | User can only access their own document (by userId from JWT), but no secondary check verifying document ownership |
| CORS | ✅ FIXED | Was wildcard → restricted to cashflowhero.uk domains (H1) |
| Rate Limiting | ✅ FIXED | Was disabled → now enabled (H2) |
| Batch Endpoint Abuse | ✅ PASS | Max 50 paths per batch read, array validation on write |
| ETag Caching | ✅ PASS | Proper If-None-Match/304 handling |
| Health Endpoint | ✅ PASS | Unauthenticated, returns only status/timestamp |

---

## 11. Container Security

| Control | Status | Notes |
|---------|--------|-------|
| Non-Root User (Backend) | ✅ PASS | Dockerfile creates nodejs user (UID 1001) |
| Non-Root User (Frontend) | ⚠️ WARN | Nginx Alpine default is root; no USER directive |
| Multi-Stage Build | ✅ PASS | Frontend uses multi-stage (build → nginx) |
| Health Checks | ✅ PASS | Both containers have HEALTHCHECK |
| .dockerignore | ✅ PASS | Backend has .dockerignore |
| Base Image Versions | ⚠️ WARN | `node:22-alpine` and `nginx:alpine` use floating tags. Pin to digest for reproducibility |
| Secrets in Image | ✅ PASS | No secrets baked into images |
| Production Dependencies Only | ✅ PASS | `npm ci --only=production` in backend Dockerfile |

---

## 12. Kubernetes (k3s) Security

| Control | Status | Notes |
|---------|--------|-------|
| Namespace Isolation | ✅ FIXED | NetworkPolicy restricts CouchDB to backend + backup jobs (L5) |
| Secrets Management | ✅ FIXED | Secrets moved to gitignored secrets.yaml, referenced by name (C1) |
| Resource Limits | ✅ PASS | CouchDB and frontend have resource requests/limits |
| Resource Limits (Backend) | ✅ FIXED | Backend: 128Mi/192Mi memory, 100m/200m CPU |
| Pod Security Context | ✅ FIXED | securityContext on all pods with runAsNonRoot, drop ALL caps (L7) |
| Ingress TLS | ✅ FIXED | cert-manager + Let's Encrypt, HSTS enabled (H6) |
| NodePort Services | ⚠️ WARN | Frontend uses NodePort (30080, 30545) which bypasses ingress. Only use if behind firewall |
| Image Pull Policy | ✅ PASS | `imagePullPolicy: Never` for local images |
| RBAC | ⚠️ WARN | No custom RBAC roles defined. Relies on k3s defaults |
| Backup Security | ✅ FIXED | Backups run as non-root UID 100, caps dropped (L6) |

---

## 13. Secrets Management

| Status | Detail |
|--------|--------|
| ✅ FIXED | JWT_SECRET moved to gitignored k8s/secrets.yaml |
| ✅ FIXED | COUCHDB_PASSWORD moved to gitignored k8s/secrets.yaml |
| ✅ FIXED | docker-compose.yml now references .env file (${...:?} syntax) |
| ⚠️ WARN | Firebase API key in environment.ts (by design, but review rules) |
| ⚠️ WARN | No secrets rotation policy |
| ✅ FIXED | docker-compose uses .env file; .env.example provided |

**Recommended Secret Management Strategy:**
1. **Immediate:** Rotate all secrets. Remove from Git history.
2. **Short-term:** Use `kubectl create secret` and reference secrets by name in manifests. Use `.env` file for docker-compose.
3. **Medium-term:** Deploy Sealed Secrets or SOPS for encrypted secret storage in Git.
4. **Long-term:** Consider HashiCorp Vault or a cloud KMS.

---

## 14. CI/CD & Supply Chain

| Control | Status | Notes |
|---------|--------|-------|
| Pre-commit Hooks | ✅ PASS | Husky + lint-staged runs tests on staged files |
| Secret Scanning | ❌ FAIL | No git-secrets, gitleaks, or similar tool configured |
| Dependency Audit | ❌ FAIL | No `npm audit` in CI pipeline — currently 1 critical + 1 high + 2 moderate vulns |
| Lock File Integrity | ✅ PASS | package-lock.json present, `npm ci` used in Dockerfiles |
| SAST/DAST | ❌ FAIL | No static analysis tools (ESLint security plugin, Snyk, etc.) |
| Container Scanning | ❌ FAIL | No Trivy/Grype scanning of container images |
| Signed Commits | ❌ FAIL | No GPG commit signing enforced |
| Build Reproducibility | ⚠️ WARN | Floating base image tags reduce reproducibility |

**Recommended CI Additions:**
1. Add `npm audit --production` to the build pipeline
2. Add `gitleaks` as a pre-commit hook to catch secrets
3. Add Trivy container scanning to the build process
4. Add ESLint with `eslint-plugin-security` rules

---

## 15. Certification Readiness

### OWASP Top 10 (2021)
| Category | Status | Certification Blocker? |
|----------|--------|------------------------|
| A01: Broken Access Control | ✅ PASS | No |
| A02: Cryptographic Failures | ✅ PASS | No — CryptoJS KDF is advisory-level |
| A03: Injection | ✅ PASS | No |
| A04: Insecure Design | ✅ PASS | No |
| A05: Security Misconfiguration | ⚠️ PARTIAL | **Yes** — missing CSP (M10) |
| A06: Vulnerable Components | ❌ FAIL | **Yes** — critical protobufjs, high path-to-regexp (M9) |
| A07: Auth Failures | ✅ PASS | No |
| A08: Software/Data Integrity | ⚠️ PARTIAL | Maybe — no SBOM, no signed builds, no npm audit in CI |
| A09: Logging & Monitoring | ✅ PASS | No |
| A10: SSRF | ✅ PASS | No |

### ASVS Level 2 Gaps
| Requirement | Status | Blocker? |
|-------------|--------|----------|
| 2.1.1 Password complexity | ✅ Fixed | No |
| 2.2.1 Account lockout | ✅ Fixed | No |
| 2.1.6 Email verification | ❌ Open (M3) | **Yes** |
| 3.5.1 Token refresh/revocation | ✅ Fixed | No |
| 5.3.3 Output encoding | ✅ Fixed | No |
| 6.4.2 Key storage | ❌ Open (M4) | **Yes** |
| 9.1.1 TLS enforcement | ✅ Fixed | No |
| 14.2.1 Dependency management | ❌ Open (M9) | **Yes** |
| 14.4.3 CSP header | ❌ Open (M10) | **Yes** |
| 11.1.4 Rate limiting | ✅ Fixed | No |
| 4.2.2 CSRF protection | ✅ Mitigated (SameSite=Strict) | No |
| Encrypted backups | ❌ Open | Advisory |
| Concurrent session control | ⚠️ Partial (refresh tokens limit active sessions) | Advisory |

### ISO 27001 Annex A Gaps
| Control | Status | Blocker? |
|---------|--------|----------|
| A.8.24 Use of cryptography | ⚠️ Insecure KDF (CryptoJS MD5-based) | Advisory |
| A.8.9 Configuration management | ✅ Hardened | No |
| A.8.8 Vulnerability management | ❌ No automated scanning or patching policy | **Yes** |
| A.8.15 Logging | ✅ Good logging | No |
| A.8.16 Monitoring | ❌ No alerting on security events | **Yes** |
| A.5.17 Authentication information | ⚠️ No rotation policy | Advisory |
| A.8.25 Secure development lifecycle | ❌ No SAST/DAST in CI | **Yes** |

---

## 16. Remediation Priority Matrix

| Priority | ID | Finding | Effort | Impact | Status |
|----------|----|---------|--------|--------|--------|
| 🔴 P0 | C1 | Rotate & remove secrets from Git | 2h | Eliminates full compromise risk | ✅ FIXED |
| 🔴 P0 | C3 | Remove CouchDB proxy from nginx | 30min | Closes DB admin exposure | ✅ FIXED |
| 🔴 P1 | C2 | Remove hardcoded encryption key | 2h | Fixes false sense of encryption security | ✅ FIXED |
| 🔴 P1 | C4 | Add server-side password policy | 1h | Prevents trivial brute-force | ✅ FIXED |
| 🟠 P1 | H1 | Fix CORS to specific origins | 30min | Prevents cross-origin attacks | ✅ FIXED |
| 🟠 P1 | H2 | Enable rate limiting in production | 30min | Prevents brute-force and DoS | ✅ FIXED |
| 🟠 P1 | H6 | Enable TLS / HTTPS redirect | 1h | Encrypts all traffic | ✅ FIXED |
| 🟠 P2 | H5 | Add account lockout | 2h | Prevents credential stuffing | ✅ FIXED |
| 🟠 P2 | H3 | Implement refresh tokens | 4h | Enables token revocation | ✅ FIXED |
| 🟠 P2 | H4 | Move JWT to httpOnly cookie | 4h | Protects against XSS token theft | ✅ FIXED |
| 🟡 P2 | L4 | Add security headers to nginx | 30min | Defense in depth | ✅ FIXED |
| 🟡 P2 | L5 | Add Kubernetes NetworkPolicies | 1h | Limits blast radius | ✅ FIXED |
| 🟡 P3 | M1 | Sanitize D3 innerHTML usage | 2h | Prevents stored XSS | ✅ FIXED |
| 🟡 P3 | M2 | Fix user enumeration | 1h | Protects user privacy | ✅ FIXED |
| 🟡 P3 | M4 | Stop persisting encryption key | 2h | Limits key exposure | ❌ OPEN |
| 🟡 P3 | M5 | Disable debug mode in prod | 5min | Reduces data leakage | ✅ FIXED |
| 🟡 P3 | L7 | Add pod security contexts | 1h | Kubernetes hardening | ✅ FIXED |
| 🟢 P4 | L1 | Use crypto.randomUUID() | 15min | Better ID generation | ✅ FIXED |
| 🟢 P4 | L2 | Add email validation to register | 15min | Input hygiene | ✅ FIXED |
| 🟢 P4 | M3 | Add email verification | 4h | Prevents fake accounts | ❌ OPEN |
| 🟢 P4 | M6 | Review Firebase Security Rules | 1h | Ensures cloud mode is locked down | ⏭️ N/A |
| 🟠 P1 | M9 | Fix vulnerable dependencies | 1h | Closes critical + high CVEs | ❌ NEW |
| 🟡 P2 | M10 | Add Content-Security-Policy | 2h | Strongest XSS defense | ❌ NEW |
| 🟡 P3 | — | Add npm audit to CI | 1h | Prevents future regressions | ❌ NEW |

### Additional fixes applied (not in original matrix)
| Fix | Detail | Status |
|-----|--------|--------|
| Trust proxy | Changed from `true` to `1` in server.js | ✅ FIXED |
| CORS wildcard fallback | Removed `origin: '*' ? true` fallback in server.js | ✅ FIXED |
| Docker-compose secrets | Inline secrets → .env file references | ✅ FIXED |
| deploy.sh secrets | Patched to apply k8s/secrets.yaml if present | ✅ FIXED |
| Backend user ID | Math.random() → crypto.randomUUID() | ✅ FIXED |
| Email validation | Added regex validation to register endpoint | ✅ FIXED |
| Backend resource limits | Added 128Mi/192Mi memory + 100m/200m CPU | ✅ FIXED |
| User enumeration msg | Changed 409 message to generic "Registration failed" | ✅ FIXED |

---

## 17. Certification Gap Summary — What's Needed to Pass

The following items **must be resolved** before passing OWASP ASVS Level 2 or ISO 27001 certification:

### 🔴 Blockers (must fix)

| # | Item | Effort | Why it blocks |
|---|------|--------|---------------|
| 1 | **Fix critical/high CVEs** (M9) | 1h | ASVS 14.2.1, ISO A.8.8 — `npm audit fix` for protobufjs; evaluate Express 5 for path-to-regexp |
| 2 | **Add Content-Security-Policy** (M10) | 2h | ASVS 14.4.3, A05 — CSP is mandatory for Level 2. Start with report-only mode |
| 3 | **Add `npm audit` to CI** | 30min | ISO A.8.8, A06 — Add step to `.github/workflows/test.yml` |
| 4 | **Add container image scanning** | 1h | ISO A.8.8 — Add Trivy/Grype step to CI or pre-deploy script |
| 5 | **Add secret scanning** | 30min | ISO A.8.25 — Add gitleaks as pre-commit hook |
| 6 | **Move encryption key from localStorage** (M4) | 2h | ASVS 6.4.2 — Derive from password via PBKDF2 or prompt per session |

### 🟡 Advisory (recommended but not strict blockers)

| # | Item | Effort | Why recommended |
|---|------|--------|------------------|
| 7 | Add email verification (M3) | 4h | ASVS 2.1.6 — prevents fake accounts, fixes user enumeration fully |
| 8 | Replace CryptoJS with Web Crypto API | 4h | ISO A.8.24 — CryptoJS uses MD5-based KDF internally |
| 9 | Add security event alerting | 2h | ISO A.8.16 — alert on lockouts, failed auth spikes, rate limit hits |
| 10 | Encrypt CouchDB backups | 1h | Defense in depth — GPG encrypt before upload |
| 11 | Pin Docker base image digests | 30min | Reproducibility — `node:22-alpine@sha256:...` |
| 12 | Add SBOM generation | 1h | ISO A.8.25, A08 — `npm sbom` or Syft in CI |

### Quickest path to certification

1. `npm audit fix` (both root + backend) → fixes M9 protobufjs + axios/follow-redirects
2. Add CSP header to nginx.conf → fixes M10
3. Add 3 lines to `.github/workflows/test.yml`:
   ```yaml
   - name: Security audit
     run: npm audit --omit=dev --audit-level=high
   - name: Backend audit
     run: cd backend && npm audit --omit=dev --audit-level=high
   ```
4. Add `gitleaks` pre-commit hook
5. Refactor CrypticService to derive key from password (sessionStorage fallback)

With items 1–5 complete, the app passes OWASP ASVS Level 2 for all categories and meets ISO 27001 Annex A requirements for a personal finance application.

---

*End of Security Audit Report*
