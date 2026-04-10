import { Subscription, SubscriptionFrequency, SubscriptionChange } from '../../interfaces/subscription';

/**
 * Migrates a subscription object to the current schema.
 * Adds 'frequency' field if missing, defaults to 'monthly'.
 * Handles legacy subscriptions without changeHistory.
 * 
 * @param raw - Raw subscription object from database or localStorage
 * @returns Migrated subscription with all required fields
 */
export function migrateSubscription(raw: any): Subscription {
  // Handle null/undefined
  if (!raw) {
    return {
      title: '',
      account: 'Daily',
      amount: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      category: '@',
      comment: '',
      frequency: 'monthly',
      changeHistory: []
    };
  }

  // Normalize amount to number
  let amount = 0;
  if (typeof raw.amount === 'number') {
    amount = Math.round(raw.amount * 100) / 100;  // Round to 2 decimals
  } else if (typeof raw.amount === 'string') {
    amount = Math.round(parseFloat(raw.amount) * 100) / 100 || 0;
  }

  // Validate and default frequency
  const frequency = validateFrequency(raw.frequency);

  // Validate changeHistory
  let changeHistory: SubscriptionChange[] = [];
  if (Array.isArray(raw.changeHistory)) {
    changeHistory = raw.changeHistory.map((change: any) => ({
      effectiveDate: change.effectiveDate || new Date().toISOString().split('T')[0],
      field: validateChangeField(change.field),
      oldValue: change.oldValue,
      newValue: change.newValue,
      reason: change.reason || undefined
    }));
  }

  return {
    title: raw.title || '',
    account: raw.account || 'Daily',
    amount: amount,
    startDate: raw.startDate || new Date().toISOString().split('T')[0],
    endDate: raw.endDate || '',
    category: raw.category || '@',
    comment: raw.comment || '',
    frequency: frequency,
    changeHistory: changeHistory
  };
}

/**
 * Migrates an array of subscriptions.
 * Safe to call on null/undefined, returns empty array.
 * 
 * @param rawArray - Array of raw subscription objects
 * @returns Array of migrated subscriptions
 */
export function migrateSubscriptionArray(rawArray: any): Subscription[] {
  if (!Array.isArray(rawArray)) {
    return [];
  }
  return rawArray.map(raw => migrateSubscription(raw));
}

/**
 * Validates frequency value, returns 'monthly' if invalid.
 * 
 * @param frequency - Frequency value to validate
 * @returns Valid frequency or default 'monthly'
 */
export function validateFrequency(frequency: any): SubscriptionFrequency {
  const validFrequencies: SubscriptionFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];
  if (typeof frequency === 'string' && validFrequencies.includes(frequency as SubscriptionFrequency)) {
    return frequency as SubscriptionFrequency;
  }
  return 'monthly';  // Default fallback
}

/**
 * Validates change field value, returns 'amount' if invalid.
 * 
 * @param field - Field value to validate
 * @returns Valid field or default 'amount'
 */
function validateChangeField(field: any): 'amount' | 'account' | 'category' | 'frequency' {
  const validFields = ['amount', 'account', 'category', 'frequency'];
  if (typeof field === 'string' && validFields.includes(field)) {
    return field as 'amount' | 'account' | 'category' | 'frequency';
  }
  return 'amount';  // Default fallback
}

/**
 * Helper to get the effective value of a subscription field at a specific date.
 * Used for transaction generation with change history support.
 * 
 * @param subscription - Subscription with potential change history
 * @param field - Field to get value for
 * @param date - Date to get value at (ISO string)
 * @returns The effective value at that date
 */
export function getEffectiveValue(subscription: Subscription, field: keyof Subscription, date: string): any {
  if (!subscription.changeHistory || subscription.changeHistory.length === 0) {
    return subscription[field];  // No history, use current value
  }

  // Find all changes for this field that are on or before the target date, sorted newest first
  const relevantChanges = subscription.changeHistory
    .filter(ch => ch.field === field && ch.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  if (relevantChanges.length > 0) {
    return relevantChanges[0].newValue;  // Most recent change before/on this date
  }

  // No changes before this date, look for future changes to get original value
  const futureChanges = subscription.changeHistory
    .filter(ch => ch.field === field && ch.effectiveDate > date)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  if (futureChanges.length > 0) {
    // The earliest future change has the oldValue that was in effect before it
    return futureChanges[0].oldValue;
  }

  return subscription[field];  // Fallback to current value
}
