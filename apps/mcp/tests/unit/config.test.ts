import { loadConfig } from '../../src/config';

describe('loadConfig', () => {
  it('returns apiUrl/apiToken when both env vars are set', () => {
    const config = loadConfig({
      MM_API_URL: 'http://localhost:3000/api/v1',
      MM_API_TOKEN: 'mmpat_abc',
    });
    expect(config).toEqual({ apiUrl: 'http://localhost:3000/api/v1', apiToken: 'mmpat_abc' });
  });

  it('throws naming MM_API_URL when only it is missing', () => {
    expect(() => loadConfig({ MM_API_TOKEN: 'mmpat_abc' })).toThrow(/MM_API_URL/);
  });

  it('throws naming MM_API_TOKEN when only it is missing', () => {
    expect(() => loadConfig({ MM_API_URL: 'http://localhost:3000/api/v1' })).toThrow(
      /MM_API_TOKEN/,
    );
  });

  it('throws naming both when neither is set', () => {
    expect(() => loadConfig({})).toThrow(/MM_API_URL, MM_API_TOKEN/);
  });

  it('never echoes back a token value in the thrown error message', () => {
    let message = '';
    try {
      loadConfig({ MM_API_TOKEN: 'super-secret-value' });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain('super-secret-value');
  });
});
