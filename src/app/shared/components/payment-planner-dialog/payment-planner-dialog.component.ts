import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { PlannedSubscription } from 'src/app/interfaces/planned-subscription';
import { SubscriptionFrequency } from 'src/app/interfaces/subscription';
import { SmileBucket } from 'src/app/interfaces/smile';
import { FireBucket } from 'src/app/interfaces/fire';
import { PaymentPlannerService, BucketAllocation } from '../../services/payment-planner.service';
import { AppNumberPipe } from '../../pipes/app-number.pipe';
import { AppStateService } from '../../services/app-state.service';

/**
 * Bucket selection mode for payment plan
 */
type BucketSelectionMode = 'all' | 'subset' | 'single';

/**
 * Payment Planner Dialog Component
 * Reusable modal for creating/editing payment plans for Smile Projects and Fire Emergencies
 */
@Component({
  selector: 'app-payment-planner-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './payment-planner-dialog.component.html',
  styleUrls: ['./payment-planner-dialog.component.css']
})
export class PaymentPlannerDialogComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() projectType: 'smile' | 'fire' = 'smile';
  @Input() projectTitle = '';
  @Input() projectTargetDate = '';  // Project target date to prefill
  @Input() buckets: Array<SmileBucket | FireBucket> = [];
  @Input() existingPlan?: PlannedSubscription;  // For editing
  
  @Output() planCreated = new EventEmitter<PlannedSubscription>();
  @Output() planUpdated = new EventEmitter<PlannedSubscription>();
  @Output() cancelled = new EventEmitter<void>();
  
  // Error handling
  errorMessage = '';
  showErrorMessage = false;

  // Form fields
  planTitle = '';
  bucketSelectionMode: BucketSelectionMode = 'all';
  selectedBucketIds: string[] = [];
  selectedSingleBucketId = '';
  startDate = '';
  targetDate = '';
  frequency: SubscriptionFrequency = 'monthly';
  account = '';
  manualAmount: number | null = null;
  
  // Calculated values
  totalMissing = 0;
  numberOfPeriods = 0;
  calculatedAmount = 0;
  allocations: BucketAllocation[] = [];
  
  // Available options
  frequencies: SubscriptionFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];
  accounts: string[] = [];

  // UI state
  showAdvanced = false;
  
  constructor(private paymentPlannerService: PaymentPlannerService) {}

  ngOnChanges(changes: SimpleChanges): void {
    // When dialog opens or when project inputs change, reset form to defaults
    if (changes['isOpen'] && changes['isOpen'].currentValue === true) {
      // Dialog just opened, initialize/reset the form
      this.initializeForm();
    } else if (changes['projectTitle'] || changes['projectTargetDate']) {
      // Project data changed while dialog is open, update relevant fields
      if (!this.existingPlan && this.isOpen) {
        if (changes['projectTitle'] && this.projectTitle) {
          this.planTitle = this.projectTitle;
        }
        if (changes['projectTargetDate'] && this.projectTargetDate) {
          this.targetDate = this.projectTargetDate.split('T')[0];
          this.recalculate();
        }
      }
    }
  }

  ngOnInit(): void {
    // Initialize accounts with the same options as subscriptions
    this.accounts = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income', 'Mojo'];
    if (this.accounts.length > 0 && !this.account) {
      this.account = this.accounts[0];
    }
    
    this.initializeForm();
  }

  /**
   * Initialize or reset form fields
   */
  private initializeForm(): void {
    // Clear error message
    this.errorMessage = '';
    this.showErrorMessage = false;
    
    // If editing existing plan, populate fields
    if (this.existingPlan) {
      this.loadExistingPlan();
    } else {
      // Reset to defaults for new plan
      this.planTitle = this.projectTitle || `Payment Plan ${new Date().toLocaleDateString()}`;
      this.bucketSelectionMode = 'all';
      this.selectedBucketIds = [];
      this.selectedSingleBucketId = '';
      
      // Set start date to today
      const today = new Date();
      this.startDate = today.toISOString().split('T')[0];
      
      // Prefill target date from project if available
      if (this.projectTargetDate && this.projectTargetDate.trim() !== '') {
        // Handle both ISO format and date-only format
        const dateStr = this.projectTargetDate.includes('T') 
          ? this.projectTargetDate.split('T')[0] 
          : this.projectTargetDate;
        this.targetDate = dateStr;
      } else {
        this.targetDate = '';
      }
      
      this.frequency = 'monthly';
      this.manualAmount = null;
    }
    
    this.recalculate();
  }

  /**
   * Load existing plan values for editing
   */
  loadExistingPlan(): void {
    if (!this.existingPlan) return;
    
    this.planTitle = this.existingPlan.title;
    this.startDate = this.existingPlan.startDate.split('T')[0];
    this.targetDate = this.existingPlan.targetDate.split('T')[0];
    this.frequency = this.existingPlan.frequency;
    this.account = this.existingPlan.account;
    
    // Determine bucket selection mode
    if (this.existingPlan.targetBucketIds.length === 0) {
      this.bucketSelectionMode = 'all';
    } else if (this.existingPlan.targetBucketIds.length === 1) {
      this.bucketSelectionMode = 'single';
      this.selectedSingleBucketId = this.existingPlan.targetBucketIds[0];
    } else {
      this.bucketSelectionMode = 'subset';
      this.selectedBucketIds = [...this.existingPlan.targetBucketIds];
    }
    
    // If manually adjusted, use that amount
    if (this.existingPlan.manuallyAdjusted) {
      this.manualAmount = this.existingPlan.amount;
    }
  }

  /**
   * Recalculate payment plan values when inputs change
   */
  recalculate(): void {
    // Determine which buckets to include
    const bucketsToFund = this.getSelectedBucketIds();
    
    // Calculate total missing amount
    this.totalMissing = this.paymentPlannerService.calculateMissingAmount(
      this.buckets,
      bucketsToFund
    );
    
    // Calculate number of periods
    if (this.startDate && this.targetDate) {
      this.numberOfPeriods = this.paymentPlannerService.calculateNumberOfPeriods(
        this.startDate,
        this.targetDate,
        this.frequency
      );
    }
    
    // Calculate suggested payment amount
    this.calculatedAmount = this.numberOfPeriods > 0 
      ? this.totalMissing / this.numberOfPeriods 
      : this.totalMissing;
    this.calculatedAmount = Math.round(this.calculatedAmount * 100) / 100;
    
    // Use manual amount if provided, otherwise use calculated
    const paymentAmount = this.manualAmount !== null ? this.manualAmount : this.calculatedAmount;
    
    // Calculate bucket allocations
    this.allocations = this.paymentPlannerService.calculateProportionalDistribution(
      this.buckets,
      bucketsToFund,
      paymentAmount
    );
  }

  /**
   * Get selected bucket IDs based on current mode
   */
  getSelectedBucketIds(): string[] {
    switch (this.bucketSelectionMode) {
      case 'all':
        return [];
      case 'single':
        return this.selectedSingleBucketId ? [this.selectedSingleBucketId] : [];
      case 'subset':
        return this.selectedBucketIds;
      default:
        return [];
    }
  }

  /**
   * Handle bucket selection mode change
   */
  onModeChange(): void {
    // Reset selections when mode changes
    if (this.bucketSelectionMode === 'single' && this.buckets.length > 0) {
      this.selectedSingleBucketId = this.buckets[0].id;
    }
    this.recalculate();
  }

  /**
   * Handle bucket checkbox toggle (for subset mode)
   */
  toggleBucketSelection(bucketId: string): void {
    const index = this.selectedBucketIds.indexOf(bucketId);
    if (index === -1) {
      this.selectedBucketIds.push(bucketId);
    } else {
      this.selectedBucketIds.splice(index, 1);
    }
    this.recalculate();
  }

  /**
   * Check if bucket is selected (for subset mode)
   */
  isBucketSelected(bucketId: string): boolean {
    return this.selectedBucketIds.includes(bucketId);
  }

  /**
   * Get missing amount for a specific bucket
   */
  getBucketMissingAmount(bucket: SmileBucket | FireBucket): number {
    return Math.max(0, bucket.target - bucket.amount);
  }

  /**
   * Handle manual amount change
   */
  onManualAmountChange(): void {
    this.recalculate();
  }

  /**
   * Reset to calculated amount
   */
  useCalculatedAmount(): void {
    this.manualAmount = null;
    this.recalculate();
  }

  /**
   * Create or update payment plan
   */
  savePlan(): void {
    const bucketsToFund = this.getSelectedBucketIds();
    const finalAmount = this.manualAmount !== null ? this.manualAmount : this.calculatedAmount;
    
    const plan = this.paymentPlannerService.calculatePaymentPlan({
      projectType: this.projectType,
      projectTitle: this.projectTitle,
      planTitle: this.planTitle,
      buckets: this.buckets,
      selectedBucketIds: bucketsToFund,
      startDate: this.startDate,
      targetDate: this.targetDate,
      frequency: this.frequency,
      account: this.account,
      manualAmount: this.manualAmount !== null ? this.manualAmount : undefined
    });
    
    // Validate plan
    const validation = this.paymentPlannerService.validatePaymentPlan(plan);
    if (!validation.valid) {
      this.showError('Validation failed: ' + validation.errors.join(', '));
      return;
    }
    
    if (this.existingPlan) {
      // Update existing plan (keep the same ID)
      plan.id = this.existingPlan.id;
      plan.status = this.existingPlan.status;
      plan.createdAt = this.existingPlan.createdAt;
      plan.activeSubscriptionId = this.existingPlan.activeSubscriptionId;
      this.planUpdated.emit(plan);
    } else {
      // Create new plan
      this.planCreated.emit(plan);
    }
    
    this.close();
  }

  /**
   * Cancel and close dialog
   */
  cancel(): void {
    this.clearError();
    this.cancelled.emit();
    this.close();
  }

  /**
   * Close dialog and reset form
   */
  close(): void {
    this.clearError();
    this.isOpen = false;
    this.resetForm();
  }

  /**
   * Reset form to initial state
   */
  resetForm(): void {
    this.planTitle = '';
    this.bucketSelectionMode = 'all';
    this.selectedBucketIds = [];
    this.selectedSingleBucketId = '';
    this.frequency = 'monthly';
    this.manualAmount = null;
    
    const today = new Date();
    this.startDate = today.toISOString().split('T')[0];
    this.targetDate = '';
    
    if (this.accounts.length > 0) {
      this.account = this.accounts[0];
    }
    
    this.clearError();
  }

  /**
   * Get bucket name by ID
   */
  getBucketName(bucketId: string): string {
    const bucket = this.buckets.find(b => b.id === bucketId);
    return bucket ? bucket.title : 'Unknown';
  }
  
  /**
   * Show error message
   */
  private showError(message: string): void {
    this.errorMessage = message;
    this.showErrorMessage = true;
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.clearError();
    }, 5000);
  }
  
  /**
   * Clear error message
   */
  private clearError(): void {
    this.errorMessage = '';
    this.showErrorMessage = false;
  }
}
