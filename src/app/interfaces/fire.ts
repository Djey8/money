import { PlannedSubscription } from './planned-subscription';

export type FirePhase = 'idea' | 'planning' | 'saving' | 'ready' | 'completed';

export interface FireLink {
  label: string;
  url: string;
}

export interface FireNote {
  text: string;
  createdAt: string;
}

export interface FireActionItem {
  text: string;
  done: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
}

export interface FireBucket {
  id: string;                      // Unique identifier
  title: string;                   // e.g., "Medical Emergency", "Car Repair", "Home Emergency"
  target: number;                  // Planned amount for this bucket
  amount: number;                  // Current saved amount for this bucket
  notes?: string;                  // Optional notes for this bucket
  links?: FireLink[];              // Optional links for this bucket
  targetDate?: string;             // Target completion date
  completionDate?: string;         // Actual completion date
}

export interface Fire {
  title: string;                   // Emergency fund name (e.g., "Family Emergency Fund")
  sub: string;                     // Subtitle/description
  phase: FirePhase;                // Overall phase
  description: string;             // Detailed description
  targetDate?: string;             // When you want to complete this
  completionDate?: string;         // When actually completed
  
  // Bucket system - ALL amounts are now stored in buckets
  // Total target/amount are calculated from buckets
  buckets: FireBucket[];           // Required - at least one bucket needed
  
  // Planning & tracking
  links: FireLink[];               // Helpful resources
  actionItems: FireActionItem[];   // Tasks to complete
  notes: FireNote[];               // Notes/comments
  
  // Metadata
  createdAt: string;               // ISO timestamp
  updatedAt: string;               // ISO timestamp
  
  // Payment Plans (optional - multiple payment plans supported)
  plannedSubscriptions?: PlannedSubscription[];  // Array of payment plans for this emergency fund
}
