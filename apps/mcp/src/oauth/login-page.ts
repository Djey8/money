function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Shared design tokens + toolbar/card chrome, hand-copied from the Angular
 * app's src/styles.css (:root / [data-theme='dark']) and
 * registration.component.css's .login-container — this server has no
 * access to the Angular build's stylesheet at runtime, so the values are
 * duplicated here rather than referenced. Keep these two in sync if the
 * app's design tokens change.
 */
const PAGE_CHROME = `
  :root {
    color-scheme: light dark;
    --color-primary: #1976d2;
    --color-primary-hover: #1565c0;
    --color-text: #333333;
    --color-text-secondary: #666666;
    --color-background: #f5f5f5;
    --color-surface: #ffffff;
    --color-border: #cccccc;
    --color-danger: #b51e1e;
    --radius-sm: 4px;
    --radius-lg: 16px;
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
    --font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --color-primary: #7aa2d4;
      --color-primary-hover: #8fb4e0;
      --color-text: #dcddde;
      --color-text-secondary: #b9bbbe;
      --color-background: #2f3136;
      --color-surface: #36393f;
      --color-border: #4a4d54;
      --color-danger: #d95753;
      --shadow-md: 0 4px 14px rgba(0, 0, 0, 0.45);
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: var(--font-family);
    background: var(--color-background);
    color: var(--color-text);
    margin: 0;
    padding: 0;
  }
  .toolbar {
    display: flex;
    align-items: center;
    height: 60px;
    padding: 0 1.5rem;
    background: var(--color-primary);
  }
  .toolbar .logo {
    color: #fff;
    font-weight: 800;
    font-size: 1.3rem;
    text-decoration: none;
  }
  .card-container {
    max-width: 420px;
    margin: 4rem auto 2rem;
    padding: 1.75rem;
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    border-radius: var(--radius-lg);
  }
  h1 {
    text-align: center;
    font-size: 1.4rem;
    margin: 0 0 0.25rem;
    color: var(--color-text);
  }
  .subtitle {
    text-align: center;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin: 0 0 1.25rem;
  }
  .client-name { font-weight: 700; color: var(--color-text); }
  .scope-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .scope-list li {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0.15rem 0.5rem;
    font-family: 'Courier New', monospace;
    font-size: 0.78rem;
    color: var(--color-text-secondary);
  }
  form { display: flex; flex-direction: column; }
  label { margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--color-text); }
  input[type='email'],
  input[type='password'],
  input[type='text'] {
    padding: 10px;
    padding-right: 45px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    margin-bottom: 15px;
    width: 100%;
    font-size: 1rem;
    background: var(--color-surface);
    color: var(--color-text);
  }
  .error {
    color: var(--color-danger);
    font-size: 0.85rem;
    margin: 1rem 0 0;
    text-align: center;
  }
  button[type='submit'] {
    margin-top: 1.5rem;
    width: 100%;
    background: var(--color-primary);
    border: 1px solid var(--color-primary-hover);
    border-radius: var(--radius-lg);
    color: #fff;
    font-weight: bold;
    font-size: 1.05rem;
    padding: 0.75rem;
    cursor: pointer;
  }
  button[type='submit']:hover { background: var(--color-primary-hover); }
  .hint {
    color: var(--color-text-secondary);
    font-size: 0.78rem;
    margin-top: 1.5rem;
    text-align: center;
    line-height: 1.4;
  }
`;

/**
 * Renders the login+consent page shown mid-OAuth-flow. Server-rendered
 * (this is served directly by the MCP HTTP transport, which has no Angular
 * runtime), but styled to match the app's own Sign In screen
 * (registration.component) rather than looking like a generic third-party
 * consent page.
 */
export function renderLoginPage(options: {
  requestId: string;
  clientName: string;
  scopes: string[];
  error?: string;
}): string {
  const { requestId, clientName, scopes, error } = options;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect to Money Manager</title>
<style>${PAGE_CHROME}</style>
</head>
<body>
  <div class="toolbar" role="banner"><span class="logo">MoneyApp</span></div>
  <div class="card-container">
    <h1>Sign in to Money Manager</h1>
    <p class="subtitle"><span class="client-name">${escapeHtml(clientName)}</span> is requesting access to:</p>
    <ul class="scope-list">${scopes.map((scope) => `<li>${escapeHtml(scope)}</li>`).join('')}</ul>
    <form method="post" action="/oauth/login">
      <input type="hidden" name="req" value="${escapeHtml(requestId)}">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required autofocus autocomplete="username">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password">
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
      <button type="submit">Sign in &amp; approve</button>
    </form>
    <p class="hint">This mints a personal access token scoped to exactly what's listed above —
      revoke it any time from Profile &gt; Personal Access Tokens.</p>
  </div>
</body>
</html>`;
}

/**
 * Rendered instead of an HTTP 302 for the final hop of a successful login,
 * which is almost always cross-origin (the client's own redirect_uri, e.g.
 * claude.ai) — deliberately NOT a real redirect response. Angular's service
 * worker intercepts every fetch on this origin (including this POST) and
 * re-issues it via its own internal fetch(), which auto-follows redirects;
 * when that followed redirect crosses origins, the browser silently cancels
 * the navigation instead of completing it (observed directly: a valid
 * code+state reached the SW's fetch of the cross-origin target, then the
 * whole navigation showed as "(canceled)" in DevTools — the OAuth exchange
 * itself worked, only the final hop was lost). A 200 response with a
 * meta-refresh sidesteps this: the SW's re-fetch just gets this same plain
 * HTML back (nothing to auto-follow), and the actual jump to the
 * cross-origin URL happens as a brand-new top-level navigation afterward,
 * entirely outside this origin's service worker scope.
 */
export function renderRedirectPage(url: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=${escapeHtml(url)}">
<title>Connecting…</title>
<style>${PAGE_CHROME}</style>
</head>
<body>
  <div class="toolbar" role="banner"><span class="logo">MoneyApp</span></div>
  <div class="card-container">
    <h1>Connecting…</h1>
    <p class="subtitle">
      If you're not redirected automatically, <a href="${escapeHtml(url)}">click here</a>.
    </p>
  </div>
</body>
</html>`;
}

/** Rendered when a `req` id is missing/expired — no form to retry, since the underlying OAuth state is gone. */
export function renderExpiredPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect to Money Manager</title>
<style>${PAGE_CHROME}</style>
</head>
<body>
  <div class="toolbar" role="banner"><span class="logo">MoneyApp</span></div>
  <div class="card-container">
    <h1>This sign-in link has expired</h1>
    <p class="subtitle">Go back to the app you were connecting and try again.</p>
  </div>
</body>
</html>`;
}
