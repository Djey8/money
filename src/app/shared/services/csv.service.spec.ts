import { CsvService } from './csv.service';
import { Transaction } from '../../interfaces/transaction';

describe('CsvService', () => {
  let service: CsvService;

  beforeEach(() => {
    service = new CsvService();
  });

  function tx(overrides: Partial<Transaction> = {}): Transaction {
    return { account: 'Daily', amount: -50, date: '2026-01-15', time: '10:30', category: 'Food', comment: '', ...overrides };
  }

  // --- convertToCsv (private — tested via accessor) -----------------------

  describe('convertToCsv()', () => {
    it('generates header from transaction keys', () => {
      const csv = (service as any).convertToCsv([tx()]);
      const header = csv.split('\n')[0];
      expect(header).toBe('account,amount,date,time,category,comment');
    });

    it('generates one row per transaction', () => {
      const csv = (service as any).convertToCsv([tx(), tx({ account: 'Splurge' })]);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(3); // header + 2 rows
    });

    it('wraps values containing commas in quotes', () => {
      const csv = (service as any).convertToCsv([tx({ comment: 'a, b' })]);
      expect(csv).toContain('"a, b"');
    });

    it('handles numeric and string values correctly', () => {
      const csv = (service as any).convertToCsv([tx({ amount: -123.45 })]);
      expect(csv).toContain('-123.45');
    });
  });

  // --- downloadCsv (DOM interaction) --------------------------------------

  describe('downloadCsv()', () => {
    it('creates a downloadable link and clicks it', () => {
      const clickSpy = jest.fn();
      const setAttrSpy = jest.fn();
      const fakeLink = { setAttribute: setAttrSpy, click: clickSpy } as unknown as HTMLAnchorElement;
      jest.spyOn(document, 'createElement').mockReturnValue(fakeLink as any);
      jest.spyOn(document.body, 'appendChild').mockImplementation((n) => n as any);
      jest.spyOn(document.body, 'removeChild').mockImplementation((n) => n as any);
      (window.URL.createObjectURL as any) = jest.fn().mockReturnValue('blob:http://test/abc');

      service.downloadCsv([tx()]);

      expect(setAttrSpy).toHaveBeenCalledWith('href', 'blob:http://test/abc');
      expect(setAttrSpy).toHaveBeenCalledWith('download', 'transactions.csv');
      expect(clickSpy).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalledWith(fakeLink);
    });
  });
});
