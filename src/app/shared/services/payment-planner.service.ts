import { Injectable } from '@angular/core';
import { PlannedSubscription } from '../../interfaces/planned-subscription';
import { SubscriptionFrequency } from '../../interfaces/subscription';
import { SmileBucket } from '../../interfaces/smile';
import { FireBucket } from '../../interfaces/fire';

/**
 * Generate a unique ID for a payment plan
 * @returns Unique payment plan ID
 */
function generatePaymentPlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Bucket allocation for a payment
 */
export interface BucketAllocation {
  bucketId: string;
  bucketTitle: string;
  amount: number;
}

/**
 * Validation result for payment plans
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Service for calculating and managing payment plans for Smile Projects and Fire Emergencies
 */
@Injectable({
  providedIn: 'root'
})
export class PaymentPlannerService {

  constructor() { }

  /**
   * Calculate the total missing amount for selected buckets
   * @param buckets - Array of buckets with target and current amount
   * @param selectedBucketIds - Array of bucket IDs to include (empty = all)
   * @returns Total missing amount across selected buckets
   */
  calculateMissingAmount(
    buckets: Array<{id: string, target: number, amount: number}>,
    selectedBucketIds: string[]
  ): number {
    const bucketsToConsider = selectedBucketIds.length === 0 
      ? buckets 
      : buckets.filter(b => selectedBucketIds.includes(b.id));
    
    const totalMissing = bucketsToConsider.reduce((sum, bucket) => {
      const missing = Math.max(0, bucket.target - bucket.amount);
      return sum + missing;
    }, 0);
    
    return Math.round(totalMissing * 100) / 100;
  }

  /**
   * Calculate number of payment periods between two dates for a given frequency
   * @param startDate - Start date (ISO string)
   * @param targetDate - Target/end date (ISO string)
   * @param frequency - Payment frequency
   * @returns Number of payment periods
   */
  calculateNumberOfPeriods(
    startDate: string,
    targetDate: string,
    frequency: SubscriptionFrequency
  ): number {
    const start = new Date(startDate);
    const end = new Date(targetDate);
    
    // Calculate difference in days
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 0;
    
    // Calculate periods based on frequency
    switch (frequency) {
      case 'weekly':
        return Math.ceil(diffDays / 7);
      case 'biweekly':
        return Math.ceil(diffDays / 14);
      case 'monthly':
        // More accurate monthly calculation
        const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                       (end.getMonth() - start.getMonth());
        return Math.max(1, months);
      case 'quarterly':
        const quarters = Math.ceil(
          ((end.getFullYear() - start.getFullYear()) * 12 + 
           (end.getMonth() - start.getMonth())) / 3
        );
        return Math.max(1, quarters);
      case 'yearly':
        const years = end.getFullYear() - start.getFullYear();
        return Math.max(1, years);
      default:
        return 1;
    }
  }

  /**
   * Calculate proportional distribution of payment amount across buckets
   * Based on each bucket's missing amount (proportional allocation)
   * 
   * @param buckets - Array of buckets with id, title, target, and current amount
   * @param selectedBucketIds - Bucket IDs to fund (empty = all)
   * @param paymentAmount - Total payment amount to distribute
   * @returns Array of allocations per bucket
   */
  calculateProportionalDistribution(
    buckets: Array<{id: string, title: string, target: number, amount: number}>,
    selectedBucketIds: string[],
    paymentAmount: number
  ): BucketAllocation[] {
    // Determine which buckets to fund
    const bucketsToFund = selectedBucketIds.length === 0
      ? buckets
      : buckets.filter(b => selectedBucketIds.includes(b.id));
    
    if (bucketsToFund.length === 0) return [];
    
    // Single bucket - 100% of payment
    if (bucketsToFund.length === 1) {
      return [{
        bucketId: bucketsToFund[0].id,
        bucketTitle: bucketsToFund[0].title,
        amount: Math.round(paymentAmount * 100) / 100
      }];
    }
    
    // Multiple buckets - proportional distribution based on missing amounts
    const missingAmounts = bucketsToFund.map(b => ({
      ...b,
      missing: Math.max(0, b.target - b.amount)
    }));
    
    const totalMissing = missingAmounts.reduce((sum, b) => sum + b.missing, 0);
    
    if (totalMissing === 0) {
      // All buckets are full - distribute equally
      const perBucket = paymentAmount / bucketsToFund.length;
      return bucketsToFund.map(b => ({
        bucketId: b.id,
        bucketTitle: b.title,
        amount: Math.round(perBucket * 100) / 100
      }));
    }
    
    // Proportional allocation based on missing amounts
    const allocations: BucketAllocation[] = [];
    let remainingAmount = paymentAmount;
    
    for (let i = 0; i < missingAmounts.length; i++) {
      const bucket = missingAmounts[i];
      let allocation: number;
      
      if (i === missingAmounts.length - 1) {
        // Last bucket gets remaining amount to avoid rounding errors
        allocation = remainingAmount;
      } else {
        // Proportional allocation
        const proportion = bucket.missing / totalMissing;
        allocation = paymentAmount * proportion;
        allocation = Math.round(allocation * 100) / 100;
      }
      
      allocations.push({
        bucketId: bucket.id,
        bucketTitle: bucket.title,
        amount: allocation
      });
      
      remainingAmount -= allocation;
    }
    
    return allocations;
  }

  /**
   * Generate bucket allocation comment string for transaction
   * Format: "#bucket:BucketName:Amount #bucket:AnotherBucket:Amount"
   * 
   * @param allocations - Array of bucket allocations
   * @returns Comment string with bucket tags
   */
  generateBucketAllocationComment(allocations: BucketAllocation[]): string {
    return allocations
      .map(a => `#bucket:${a.bucketTitle}:${a.amount.toFixed(2)}`)
      .join(' ');
  }

  /**
   * Create a complete payment plan
   * 
   * @param config - Configuration object with all payment plan parameters
   * @returns Configured PlannedSubscription object
   */
  calculatePaymentPlan(config: {
    projectType: 'smile' | 'fire',
    projectTitle: string,
    planTitle: string,
    buckets: Array<{id: string, title: string, target: number, amount: number}>,
    selectedBucketIds: string[],
    startDate: string,
    targetDate: string,
    frequency: SubscriptionFrequency,
    account: string,
    manualAmount?: number
  }): PlannedSubscription {
    
    // Calculate missing amount
    const totalMissing = this.calculateMissingAmount(config.buckets, config.selectedBucketIds);
    
    // Calculate number of periods
    const periods = this.calculateNumberOfPeriods(config.startDate, config.targetDate, config.frequency);
    
    // Calculate suggested payment amount
    const calculatedAmount = periods > 0 ? totalMissing / periods : totalMissing;
    const roundedCalculatedAmount = Math.round(calculatedAmount * 100) / 100;
    
    // Use manual amount if provided, otherwise use calculated
    const finalAmount = config.manualAmount !== undefined ? config.manualAmount : roundedCalculatedAmount;
    
    // Calculate bucket allocations
    const allocations = this.calculateProportionalDistribution(
      config.buckets,
      config.selectedBucketIds,
      finalAmount
    );
    
    // Generate comment with bucket tags
    const comment = this.generateBucketAllocationComment(allocations);
    
    // Create planned subscription
    const now = new Date().toISOString();
    
    const plan: PlannedSubscription = {
      id: generatePaymentPlanId(),
      title: config.planTitle,
      status: 'planned',
      projectType: config.projectType,
      projectTitle: config.projectTitle,
      account: config.account,
      amount: finalAmount,
      startDate: config.startDate,
      endDate: config.targetDate,
      category: `@${config.projectTitle}`,
      comment: comment,
      frequency: config.frequency,
      targetDate: config.targetDate,
      targetBucketIds: [...config.selectedBucketIds],  // Clone array
      originalCalculatedAmount: roundedCalculatedAmount,
      manuallyAdjusted: config.manualAmount !== undefined && config.manualAmount !== roundedCalculatedAmount,
      createdAt: now,
      updatedAt: now
    };
    
    return plan;
  }

  /**
   * Validate a single payment plan
   * 
   * @param plan - Payment plan to validate
   * @returns Validation result with errors
   */
  validatePaymentPlan(plan: PlannedSubscription): ValidationResult {
    const errors: string[] = [];
    
    if (!plan.title || plan.title.trim() === '') {
      errors.push('Plan title is required');
    }
    
    if (plan.amount <= 0) {
      errors.push('Payment amount must be greater than zero');
    }
    
    if (!plan.startDate) {
      errors.push('Start date is required');
    }
    
    if (!plan.targetDate) {
      errors.push('Target date is required');
    }
    
    if (plan.startDate && plan.targetDate) {
      const start = new Date(plan.startDate);
      const target = new Date(plan.targetDate);
      
      if (target <= start) {
        errors.push('Target date must be after start date');
      }
    }
    
    if (!plan.account || plan.account.trim() === '') {
      errors.push('Account is required');
    }
    
    if (!plan.frequency) {
      errors.push('Frequency is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate multiple payment plans for conflicts
   * 
   * @param plans - Array of payment plans
   * @param buckets - Project buckets
   * @returns Validation result with warnings
   */
  validateMultiplePlans(
    plans: PlannedSubscription[],
    buckets: Array<{id: string, title: string, target: number, amount: number}>
  ): ValidationResult {
    const warnings: string[] = [];
    
    // Calculate total monthly commitment
    const totalMonthly = this.calculateTotalMonthlyCommitment(plans);
    if (totalMonthly > 5000) {  // Arbitrary threshold
      warnings.push(`High total commitment: ${totalMonthly.toFixed(2)} EUR/month equivalent`);
    }
    
    // Check for over-funding per bucket
    const activePlans = plans.filter(p => p.status === 'active');
    
    buckets.forEach(bucket => {
      const fundingPlans = activePlans.filter(plan => 
        plan.targetBucketIds.length === 0 || plan.targetBucketIds.includes(bucket.id)
      );
      
      if (fundingPlans.length > 1) {
        warnings.push(`Bucket "${bucket.title}" is funded by ${fundingPlans.length} active plans`);
      }
    });
    
    return {
      valid: true,
      errors: [],
      warnings
    };
  }

  /**
   * Calculate total monthly equivalent commitment across all plans
   * 
   * @param plans - Array of payment plans
   * @returns Total monthly equivalent amount
   */
  calculateTotalMonthlyCommitment(plans: PlannedSubscription[]): number {
    const multipliers: Record<SubscriptionFrequency, number> = {
      'weekly': 4.33,
      'biweekly': 2.17,
      'monthly': 1,
      'quarterly': 0.33,
      'yearly': 0.083
    };
    
    return plans
      .filter(p => p.status === 'active')
      .reduce((total, plan) => {
        const monthlyEquivalent = plan.amount * multipliers[plan.frequency];
        return total + monthlyEquivalent;
      }, 0);
  }

  /**
   * Convert any frequency amount to monthly equivalent
   * 
   * @param amount - Payment amount
   * @param frequency - Payment frequency
   * @returns Monthly equivalent amount
   */
  convertToMonthlyEquivalent(amount: number, frequency: SubscriptionFrequency): number {
    const multipliers: Record<SubscriptionFrequency, number> = {
      'weekly': 4.33,
      'biweekly': 2.17,
      'monthly': 1,
      'quarterly': 0.33,
      'yearly': 0.083
    };
    
    return amount * multipliers[frequency];
  }

  /**
   * Parse bucket allocation comment to extract allocations
   * Format: "#bucket:BucketName:Amount #bucket:AnotherBucket:Amount"
   * 
   * @param comment - Comment string with bucket tags
   * @returns Array of bucket allocations
   */
  parseAllocationComment(comment: string): Array<{bucketName: string, amount: number}> {
    if (!comment) return [];
    
    const bucketTagMatches = comment.match(/#bucket:([^:]+):([\d.]+)/g);
    if (!bucketTagMatches) return [];
    
    const allocations: Array<{bucketName: string, amount: number}> = [];
    
    for (const tag of bucketTagMatches) {
      const match = tag.match(/#bucket:([^:]+):([\d.]+)/);
      if (match) {
        allocations.push({
          bucketName: match[1],
          amount: parseFloat(match[2])
        });
      }
    }
    
    return allocations;
  }
}
