import { renderLoginPage } from '../../src/oauth/login-page';

describe('renderLoginPage', () => {
  const scopes = ['transactions:rw', 'game:rw'];

  it('offers every scope as a ticked box by default', () => {
    const html = renderLoginPage({ requestId: 'r1', clientName: 'Claude', scopes });
    expect(html).toContain('name="scope" value="transactions:rw" checked');
    expect(html).toContain('name="scope" value="game:rw" checked');
    expect(html).toContain('name="scopes_chosen"');
  });

  it('keeps an earlier selection when the page is shown again after an error', () => {
    const html = renderLoginPage({
      requestId: 'r1',
      clientName: 'Claude',
      scopes,
      selected: ['game:rw'],
      error: 'Invalid email or password.',
    });
    expect(html).toContain('name="scope" value="game:rw" checked');
    expect(html).not.toContain('name="scope" value="transactions:rw" checked');
  });

  it('escapes a hostile client name', () => {
    const html = renderLoginPage({ requestId: 'r1', clientName: '<script>x</script>', scopes });
    expect(html).not.toContain('<script>x</script>');
  });
});
