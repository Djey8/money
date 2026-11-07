import { accountLabel } from '../account-label';
import { AccountLabelPipe } from './account-label.pipe';

describe('the name of an account on screen', () => {
  it('calls the stored Smile account Dream and leaves the others as they are', () => {
    const pipe = new AccountLabelPipe();
    expect(pipe.transform('Smile')).toBe('Dream');
    expect(accountLabel('Smile')).toBe('Dream');
    for (const account of ['Daily', 'Splurge', 'Fire', 'Income', 'Mojo']) {
      expect(pipe.transform(account)).toBe(account);
    }
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
