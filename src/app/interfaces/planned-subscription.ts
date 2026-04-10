import { SubscriptionFrequency } from './subscription';

/**
 * Status of a planned subscription
 * - planned: Created but not yet activated
 * - active: Activated and appears in main subscription list
 * - inactive: Deactivated/paused but not deleted
 */
export type PlannedSubscriptionStatus = 'planned' | 'active' | 'inactive';

/**
 * Planned Subscription interface
 * Represents a subscription payment plan for funding Smile Project or Fire Emergency buckets
 * 
 * Multiple payment plans can exist per project, each with different:
 * - Bucket targeting (single, subset, or all buckets)
 * - Payment frequencies and amounts
 * - Start and target dates
 */
export interface PlannedSubscription {
  id: string;                          // Unique identifier (UUID)
  title: string;                       // e.g., "Flight Fund", "Mountain Guide Payment"
  status: PlannedSubscriptionStatus;   // Current lifecycle state
  projectType: 'smile' | 'fire';       // Which project type this belongs to
  projectTitle: string;                // Title of the parent project
  
  // Subscription details (compatible with regular Subscription interface)
  account: string;                     // Which account to use for payments
  amount: number;                      // Payment amount per period
  startDate: string;                   // When to start payments (ISO date string)
  endDate: string;                     // Calculated based on targetDate (ISO date string)
  category: string;                    // @ProjectTitle (matches transaction category)
  comment: string;                     // Includes bucket allocation tags: "#bucket:Name:Amount"
  frequency: SubscriptionFrequency;    // weekly/biweekly/monthly/quarterly/yearly
  
  // Payment planner specific fields
  targetDate: string;                  // Goal date to have buckets filled by (ISO date string)
  targetBucketIds: string[];           // Which buckets to fund:
                                       // - [] = ALL buckets (smart allocation)
                                       // - ['bucket-id-1'] = ONE specific bucket (100% to it)
                                       // - ['id-1', 'id-2'] = SUBSET (smart allocation across these)
  originalCalculatedAmount: number;    // Auto-calculated amount before user adjustment
  manuallyAdjusted: boolean;           // Did user override the calculation?
  
  // Metadata
  createdAt: string;                   // When plan was created (ISO timestamp)
  updatedAt: string;                   // Last modification (ISO timestamp)
  activatedAt?: string;                // When plan was activated (ISO timestamp)
  deactivatedAt?: string;              // When plan was deactivated (ISO timestamp)
  
  // Optional: Link to real subscription if activated
  activeSubscriptionId?: string;       // Reference to actual subscription in main list (if active)
}
