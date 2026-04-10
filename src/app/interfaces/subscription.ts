/**
 * Subscription frequency options
 */
export type SubscriptionFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Subscription change event for tracking changes over time
 * (e.g., price increases, account changes)
 */
export interface SubscriptionChange {
    effectiveDate: string;  // ISO date when change takes effect
    field: 'amount' | 'account' | 'category' | 'frequency';
    oldValue: any;
    newValue: any;
    reason?: string;  // Optional: "Annual price increase", "Account restructure"
}

/**
 * Subscription interface
 * Represents a recurring financial transaction (e.g., Netflix, gym membership)
 */
export interface Subscription {
    title: string;
    account: string;
    amount: number;
    startDate: string;
    endDate: string;
    category: string;
    comment: string;
    frequency: SubscriptionFrequency;  // NEW: defaults to 'monthly'
    changeHistory?: SubscriptionChange[];  // NEW: Optional time-series of changes
}
