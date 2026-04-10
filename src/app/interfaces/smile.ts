import { PlannedSubscription } from './planned-subscription';

export type SmilePhase = 'idea' | 'planning' | 'saving' | 'ready' | 'completed';

export interface SmileLink {
    label: string;
    url: string;
}

export interface SmileNote {
    text: string;
    createdAt: string;
}

export interface SmileActionItem {
    text: string;
    done: boolean;
    priority: 'low' | 'medium' | 'high';
    dueDate?: string;
}

export interface SmileBucket {
    id: string;                      // Unique identifier
    title: string;                   // e.g., "Flight", "Hotel", "Food" (renamed from 'name' for consistency)
    target: number;                  // Planned budget for this bucket (renamed from 'targetAmount')
    amount: number;                  // Current saved amount for this bucket
    notes?: string;                  // Optional notes for this bucket
    links?: SmileLink[];             // Optional links for this bucket
    targetDate?: string;             // Target completion date
    completionDate?: string;         // Actual completion date
}

export interface Smile {
    title: string;                   // Project name
    sub: string;                     // Subtitle/description
    phase: SmilePhase;               // Overall project phase
    description: string;             // Detailed description
    targetDate?: string;             // When you want to achieve this goal
    completionDate?: string;         // When actually completed (renamed from completedDate for consistency)
    
    // Bucket system - ALL amounts are now stored in buckets
    // Total target/amount are calculated from buckets
    buckets: SmileBucket[];          // Required - at least one bucket needed
    
    // Planning & tracking
    links: SmileLink[];              // Helpful resources
    actionItems: SmileActionItem[];  // Tasks to complete
    notes: SmileNote[];              // Notes/comments
    
    // Metadata
    createdAt: string;               // ISO timestamp
    updatedAt: string;               // ISO timestamp
    
    // Payment Plans (optional - multiple payment plans supported)
    plannedSubscriptions?: PlannedSubscription[];  // Array of payment plans for this project
}
