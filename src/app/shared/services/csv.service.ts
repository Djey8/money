import { Injectable } from '@angular/core';
import { Transaction } from '../../interfaces/transaction';

/**
 * Service for handling CSV operations.
 */
@Injectable({
  providedIn: 'root'
})
export class CsvService {

  constructor() { }

  /**
   * Downloads a CSV file containing the provided transactions.
   * @param transactions - The array of transactions to be included in the CSV file.
   */
  downloadCsv(transactions: Transaction[]) {
    const csv = this.convertToCsv(transactions);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('hidden', '');
    link.setAttribute('href', url);
    link.setAttribute('download', 'transactions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Converts an array of transactions into a CSV string.
   * @param transactions - The array of transactions to be converted.
   * @returns The CSV string representation of the transactions.
   */
  private convertToCsv(transactions: Transaction[]): string {
    const header = Object.keys(transactions[0]).join(',');
    const rows = transactions.map(t => {
      return Object.values(t).map(value => {
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',');
    }).join('\n');
    return `${header}\n${rows}`;
  }
}
