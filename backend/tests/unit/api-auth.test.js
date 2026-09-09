'use strict';

const { hasScope } = require('../../middleware/api-auth');

describe('hasScope', () => {
  it('grants when the exact scope is present', () => {
    expect(hasScope(['transactions:r'], 'transactions:r')).toBe(true);
    expect(hasScope(['transactions:bulk'], 'transactions:bulk')).toBe(true);
  });

  it('denies when the resource matches but the level does not', () => {
    expect(hasScope(['transactions:r'], 'transactions:w')).toBe(false);
    expect(hasScope(['transactions:w'], 'transactions:bulk')).toBe(false);
  });

  it('denies when only a different resource is granted', () => {
    expect(hasScope(['reports:r'], 'transactions:r')).toBe(false);
  });

  it('lets rw satisfy both r and w for the same resource', () => {
    expect(hasScope(['transactions:rw'], 'transactions:r')).toBe(true);
    expect(hasScope(['transactions:rw'], 'transactions:w')).toBe(true);
  });

  it('never lets rw satisfy bulk — bulk is always a separate, explicit grant', () => {
    expect(hasScope(['transactions:rw'], 'transactions:bulk')).toBe(false);
  });

  it('admin satisfies any scope', () => {
    expect(hasScope(['admin'], 'transactions:bulk')).toBe(true);
    expect(hasScope(['admin'], 'data:bulk')).toBe(true);
  });

  it('denies when the caller has no scopes at all', () => {
    expect(hasScope([], 'transactions:r')).toBe(false);
  });
});
