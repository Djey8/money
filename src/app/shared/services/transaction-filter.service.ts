import { Injectable } from '@angular/core';
import { Transaction } from '../../interfaces/transaction';
import { IncomeFilter } from '../../interfaces/income-filter';

/**
 * Shared service for transaction filtering logic
 * Used by accounting, daily, splurge, smile, and fire components
 */
@Injectable({
  providedIn: 'root'
})
export class TransactionFilterService {

  /**
   * Parse a value string as a date and return ISO format (yyyy-mm-dd), or null.
   * Supports: dd.mm.yyyy, dd.mm.yy, dd/mm/yyyy, dd/mm/yy, yyyy-mm-dd
   */
  static parseAsDate(value: string): string | null {
    // dd.mm.yyyy or dd.mm.yy
    let m = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (m) {
      let year = m[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    // dd/mm/yyyy or dd/mm/yy
    m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      let year = m[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    // yyyy-mm-dd (ISO)
    m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
    return null;
  }

  /**
   * Parse a value string as a time and return normalized HH:MM, or null.
   * Supports: hh:mm, hh:mmam/pm, Xam/Xpm
   */
  static parseAsTime(value: string): string | null {
    // hh:mm (24h)
    let m = value.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return m[1].padStart(2, '0') + ':' + m[2];
    // hh:mmam/pm
    m = value.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (m) {
      let hours = parseInt(m[1], 10);
      if (m[3].toLowerCase() === 'pm' && hours !== 12) hours += 12;
      if (m[3].toLowerCase() === 'am' && hours === 12) hours = 0;
      return hours.toString().padStart(2, '0') + ':' + m[2];
    }
    // Xam / Xpm (e.g. 3pm, 11am)
    m = value.match(/^(\d{1,2})\s*(am|pm)$/i);
    if (m) {
      let hours = parseInt(m[1], 10);
      if (m[2].toLowerCase() === 'pm' && hours !== 12) hours += 12;
      if (m[2].toLowerCase() === 'am' && hours === 12) hours = 0;
      return hours.toString().padStart(2, '0') + ':00';
    }
    return null;
  }

  /**
   * Helper method to check if a search term matches any selected field in a transaction.
   * Auto-detects the format of the search term (date, time, amount, text) and only
   * checks the corresponding field to avoid cross-field false positives.
   */
  static checkSearchTermMatch(transaction: Transaction, searchTerm: string, searchFields: IncomeFilter['searchFields']): boolean {
    // Detect format: strip operator to inspect the value part
    const operatorMatch = searchTerm.match(/^(>=|<=|>|<)(.+)$/);
    const valuePart = operatorMatch ? operatorMatch[2].trim() : searchTerm;

    // Try to parse as date
    const parsedDate = TransactionFilterService.parseAsDate(valuePart);
    if (parsedDate) {
      if (!searchFields.date) return false;
      if (operatorMatch) {
        switch (operatorMatch[1]) {
          case '>': return transaction.date > parsedDate;
          case '<': return transaction.date < parsedDate;
          case '>=': return transaction.date >= parsedDate;
          case '<=': return transaction.date <= parsedDate;
        }
      }
      return transaction.date === parsedDate;
    }

    // Try to parse as time
    const parsedTime = TransactionFilterService.parseAsTime(valuePart);
    if (parsedTime) {
      if (!searchFields.time) return false;
      if (!transaction.time || transaction.time.trim() === '') return false;
      const normalizedTransaction = TransactionFilterService.parseAsTime(transaction.time) || transaction.time;
      if (operatorMatch) {
        switch (operatorMatch[1]) {
          case '>': return normalizedTransaction > parsedTime;
          case '<': return normalizedTransaction < parsedTime;
          case '>=': return normalizedTransaction >= parsedTime;
          case '<=': return normalizedTransaction <= parsedTime;
        }
      }
      return normalizedTransaction.includes(parsedTime);
    }

    // Operator + pure number → amount comparison only
    if (operatorMatch && /^-?\d+\.?\d*$/.test(valuePart)) {
      if (!searchFields.amount) return false;
      const value = parseFloat(valuePart);
      if (isNaN(value)) return false;
      switch (operatorMatch[1]) {
        case '>': return transaction.amount > value;
        case '<': return transaction.amount < value;
        case '>=': return transaction.amount >= value;
        case '<=': return transaction.amount <= value;
      }
      return false;
    }

    // TEXT: no specific format — check all enabled fields as plain text contains
    if (searchFields.account && transaction.account.toLowerCase().includes(searchTerm)) return true;
    if (searchFields.amount && transaction.amount.toString().includes(searchTerm)) return true;
    if (searchFields.date && transaction.date && transaction.date.toLowerCase().includes(searchTerm)) return true;
    if (searchFields.time && transaction.time && transaction.time.toLowerCase().includes(searchTerm)) return true;
    if (searchFields.category) {
      const cleanCategory = transaction.category.replace('@', '');
      if (cleanCategory.toLowerCase().includes(searchTerm)) return true;
    }
    if (searchFields.comment && transaction.comment.toLowerCase().includes(searchTerm)) return true;

    return false;
  }

  /**
   * Apply filters to a list of transactions
   * @param transactions - Array of all transactions
   * @param filter - Filter configuration
   * @param allowedAccounts - Optional array of allowed account names (e.g., ['Daily', 'Income'])
   * @returns Filtered transactions
   */
  applyFilters(transactions: Transaction[], filter: IncomeFilter, allowedAccounts?: string[]): Transaction[] {
    return transactions.filter((transaction: Transaction) => {
      // Filter by allowed accounts if specified
      if (allowedAccounts && allowedAccounts.length > 0) {
        if (!allowedAccounts.includes(transaction.account)) {
          return false;
        }
      }

      // Date range filter
      if (filter.startDate && transaction.date < filter.startDate) {
        return false;
      }
      if (filter.endDate && transaction.date > filter.endDate) {
        return false;
      }

      // Account filter (if specific accounts are selected within allowed accounts)
      if (filter.selectedAccounts.length > 0) {
        if (!filter.selectedAccounts.includes(transaction.account)) {
          return false;
        }
      }

      // Tag filter (if specific tags are selected)
      if (filter.selectedTags.length > 0) {
        const cleanCategory = transaction.category.replace('@', '');
        if (!filter.selectedTags.includes(cleanCategory)) {
          return false;
        }
      }

      // Search text filter with boolean logic
      if (filter.searchText.trim()) {
        // Replace word operators with symbols
        let searchExpression = filter.searchText
          .replace(/\band\b/gi, '&&')
          .replace(/\bor\b/gi, '||')
          .replace(/\bnot\b/gi, '!');
        
        // Split by || (OR) to get OR groups
        const orGroups = searchExpression.split('||').map(g => g.trim());
        let matchFound = false;
        
        for (const orGroup of orGroups) {
          // Split by && (AND) to get AND terms
          const andTerms = orGroup.split('&&').map(t => t.trim());
          let allAndTermsMatch = true;
          
          for (let term of andTerms) {
            let isNegated = false;
            let searchTerm = term.toLowerCase().trim();
            
            // Handle negation
            if (searchTerm.startsWith('!')) {
              isNegated = true;
              searchTerm = searchTerm.substring(1).trim();
            }
            
            if (!searchTerm) continue;
            
            // Check if this term matches any field
            let termMatches = TransactionFilterService.checkSearchTermMatch(transaction, searchTerm, filter.searchFields);
            
            // Apply negation if needed
            if (isNegated) {
              termMatches = !termMatches;
            }
            
            // If this AND term doesn't match, this OR group fails
            if (!termMatches) {
              allAndTermsMatch = false;
              break;
            }
          }
          
          // If all AND terms matched in this OR group, we found a match
          if (allAndTermsMatch && andTerms.length > 0) {
            matchFound = true;
            break;
          }
        }
        
        if (!matchFound) {
          return false;
        }
      }

      return transaction.amount !== 0.0;
    });
  }

  /**
   * Get available tags (categories) from transactions
   */
  getAvailableTags(transactions: Transaction[]): string[] {
    const tagsSet = new Set<string>();
    // Iterate in reverse to maintain most recently used order
    for (let i = transactions.length - 1; i >= 0; i--) {
      const cleanCategory = transactions[i].category.replace('@', '');
      if (cleanCategory) {
        tagsSet.add(cleanCategory);
      }
    }
    return Array.from(tagsSet); // Set maintains insertion order
  }

  /**
   * Get available accounts from transactions
   */
  getAvailableAccounts(transactions: Transaction[], allowedAccounts?: string[]): string[] {
    const accountsSet = new Set<string>();
    transactions.forEach(transaction => {
      if (transaction.account) {
        // Only add if in allowed accounts list (if specified)
        if (!allowedAccounts || allowedAccounts.includes(transaction.account)) {
          accountsSet.add(transaction.account);
        }
      }
    });
    return Array.from(accountsSet).sort();
  }
}
