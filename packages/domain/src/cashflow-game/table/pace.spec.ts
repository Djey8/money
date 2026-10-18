import { createTable } from './reducer';
import { testContext } from './testing';
import { TableCommandError } from './types';

const make = (settings: object) =>
  createTable(
    { id: 't', hostId: 'host', hostName: 'Host', settings: { name: 'T', ...settings }, seed: 1 },
    testContext,
  ).table;

describe('the pace of a table', () => {
  it('is normal unless the host chose another, and is kept in the settings', () => {
    expect(make({}).settings.pace).toBe('normal');
    expect(make({ pace: 'slow' }).settings.pace).toBe('slow');
    expect(make({ pace: 'fast' }).settings.pace).toBe('fast');
  });

  it('refuses a pace that does not exist', () => {
    expect(() => make({ pace: 'warp' })).toThrow(TableCommandError);
  });
});
