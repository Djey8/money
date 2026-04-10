import { Investment } from "./investment";
import { Liability } from "./liability";
import { Share } from "./share";

export type GrowPhase = 'idea' | 'research' | 'plan' | 'execute' | 'monitor' | 'completed';
export type GrowType = 'income-growth' | 'budget-optimization' | 'subscription-action' | 'expense-insight';

export interface GrowLink {
    label: string;
    url: string;
}

export interface GrowNote {
    text: string;
    createdAt: string;
}

export interface GrowActionItem {
    text: string;
    done: boolean;
    priority: 'low' | 'medium' | 'high';
    dueDate?: string;
}

export interface Grow {
    title: string;
    sub: string;
    phase: GrowPhase;
    description: string;
    strategy: string;
    riskScore: number;
    risks: string;
    links: GrowLink[];
    actionItems: GrowActionItem[];
    notes: GrowNote[];
    cashflow: number;
    amount: number;
    isAsset: boolean;
    share: Share;
    investment: Investment;
    liabilitie: Liability;
    createdAt: string;
    updatedAt: string;

    // NEW: Type discrimination for income vs expense optimization
    type?: GrowType; // Default: 'income-growth' for backward compatibility

    // NEW: Expense optimization fields (for budget/subscription/expense types)
    category?: string | string[];    // Budget category or subscription category (can be array for bundled categories)
    currentCost?: number;            // Current monthly cost (for subscriptions/expenses)
    targetCost?: number;             // Recommended new cost
    monthlySavings?: number;         // Expected monthly savings
    annualSavings?: number;          // Expected annual savings
    reasoning?: string;              // Justification for recommendation
    alternative?: string;            // Alternative service/approach (for subscriptions)
    alternativeCost?: number;        // Cost of alternative
    
    // NEW: Expense insight specific fields
    pattern?: string;                // Spending pattern description (e.g., "Weekend restaurant splurges")
    insights?: string;               // AI-generated behavioral insights (e.g., "83% of spending happens Fri-Sun after 7pm")

    // Legacy field — kept for backward compatibility during migration
    status?: string;
}
