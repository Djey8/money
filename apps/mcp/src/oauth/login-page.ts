function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders the login+consent page shown mid-OAuth-flow. No framework, no
 * build step — this is served directly by the MCP HTTP transport, which has
 * no other UI of its own. Kept intentionally minimal: this exists to prove
 * "you are the account owner", not to be a polished product surface.
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
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 420px; margin: 10vh auto; padding: 0 1.5rem; }
  h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
  .client-name { font-weight: 600; }
  ul { padding-left: 1.2rem; margin: 0.5rem 0 0; }
  li { margin: 0.15rem 0; }
  label { display: block; margin-top: 1rem; font-size: 0.9rem; }
  input { width: 100%; padding: 0.5rem; margin-top: 0.25rem; box-sizing: border-box; font-size: 1rem; }
  button { margin-top: 1.5rem; width: 100%; padding: 0.6rem; font-size: 1rem; cursor: pointer; }
  .error { color: #c0392b; margin-top: 1rem; font-size: 0.9rem; }
  .hint { color: #666; font-size: 0.8rem; margin-top: 2rem; }
</style>
</head>
<body>
  <h1>Sign in to Money Manager</h1>
  <p><span class="client-name">${escapeHtml(clientName)}</span> is requesting access to:</p>
  <ul>${scopes.map((scope) => `<li><code>${escapeHtml(scope)}</code></li>`).join('')}</ul>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
  <form method="post" action="/oauth/login">
    <input type="hidden" name="req" value="${escapeHtml(requestId)}">
    <label>Email<input type="email" name="email" required autofocus autocomplete="username"></label>
    <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
    <button type="submit">Sign in &amp; approve</button>
  </form>
  <p class="hint">This mints a personal access token scoped to exactly what's listed above — revoke it any
    time from Profile &gt; Personal Access Tokens.</p>
</body>
</html>`;
}

/** Rendered when a `req` id is missing/expired — no form to retry, since the underlying OAuth state is gone. */
export function renderExpiredPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Connect to Money Manager</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 420px; margin: 10vh auto; padding: 0 1.5rem; }
</style>
</head>
<body>
  <h1>This sign-in link has expired</h1>
  <p>Go back to the app you were connecting and try again.</p>
</body>
</html>`;
}
