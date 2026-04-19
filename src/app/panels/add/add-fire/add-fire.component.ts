import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { gotoTop } from 'src/app/shared/scroll.utils';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { AddSmileComponent } from '../add-smile/add-smile.component';
import { InfoComponent } from 'src/app/panels/info/info.component';
import { FireEmergenciesComponent } from 'src/app/main/fire/fire-emergencies/fire-emergencies.component';
import { Fire, FirePhase, FireBucket, FireLink, FireActionItem, FireNote } from 'src/app/interfaces/fire';
import { PlannedSubscription } from 'src/app/interfaces/planned-subscription';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';
import { generateBucketId } from 'src/app/shared/fire-migration.utils';

import { environment } from 'src/environments/environment';
import { isDuplicateTitle } from 'src/app/shared/validation.utils';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { PaymentPlannerService } from 'src/app/shared/services/payment-planner.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { PaymentPlannerDialogComponent } from 'src/app/shared/components/payment-planner-dialog/payment-planner-dialog.component';



/**
 * Represents the AddFireComponent class.
 */
@Component({
  selector: 'app-add-fire',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe, PaymentPlannerDialogComponent],
  templateUrl: './add-fire.component.html',
  styleUrls: ['../../../shared/styles/add-form.css', './add-fire.component.css']
})
export class AddFireComponent extends BaseAddComponent {

  // Basic fields
  titleTextField = "";
  subTextField = "";
  phaseField: FirePhase = 'idea';
  descriptionTextField = "";
  targetTextField = "";
  amountTextField = "";
  targetDateField = "";

  // Buckets
  buckets: FireBucket[] = [];
  newBucketTitle = "";
  newBucketTarget = "";
  newBucketNotes = "";
  newBucketTargetDate = "";
  editingBucketIndex: number | null = null;
  editBucketTitle = "";
  editBucketTarget = "";
  editBucketNotes = "";
  editBucketTargetDate = "";
  editingBucketLinkBucketIndex: number | null = null;
  editingBucketLinkLinkIndex: number | null = null;
  editBucketLinkLabel = "";
  editBucketLinkUrl = "";
  newBucketLinkLabel = "";
  newBucketLinkUrl = "";
  showAddBucketLink: number | null = null;

  // Links
  links: FireLink[] = [];
  newLinkLabel = "";
  newLinkUrl = "";
  editingLinkIndex = -1;
  editingLinkLabel = "";
  editingLinkUrl = "";

  // Action Items
  actionItems: FireActionItem[] = [];
  newActionItem = "";
  newActionPriority: 'low' | 'medium' | 'high' = 'medium';
  newActionTargetDate = "";
  editingActionIndex = -1;
  editingActionText = "";
  editingActionPriority: 'low' | 'medium' | 'high' = 'medium';
  editingActionDueDate = "";

  // Notes (for info view only, not add)
  notes: FireNote[] = [];
  newNote = "";

  // Payment Plans
  plannedSubscriptions: PlannedSubscription[] = [];
  isPaymentPlannerOpen = false;
  editingPlanIndex: number | null = null;

  // UI state
  showBucketsSection = false;
  showLinksActionsSection = false;
  showAddBucket = false;
  showAddLink = false;
  showAddAction = false;
  showPaymentPlansSection = false;

  phases: FirePhase[] = ['idea', 'planning', 'saving', 'ready', 'completed'];

  static zIndex;
  static isAddFire;
  static isError;

  public classReference = AddFireComponent;

  /**
   * Constructs a new AddFireComponent.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   * @param database - The database service.
   * @param frontendLogger - The frontend logging service.
   */
  constructor(router: Router, private persistence: PersistenceService, private paymentPlannerService: PaymentPlannerService) {
    super(router);
    AddFireComponent.isAddFire = false;
    this.initStatic(AddFireComponent);
  }

  highlight() {
    AddFireComponent.zIndex = 1;
    AddSmileComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    InfoComponent.zIndex = 0;
  }

  override closeWindow() {
    AddFireComponent.isAddFire = false;
    this.resetForm();
    super.closeWindow();
  }

  resetForm() {
    this.titleTextField = "";
    this.subTextField = "";
    this.phaseField = 'idea';
    this.descriptionTextField = "";
    this.targetTextField = "";
    this.amountTextField = "";
    this.targetDateField = "";
    this.buckets = [];
    this.links = [];
    this.actionItems = [];
    this.notes = [];
    this.plannedSubscriptions = [];
    this.newBucketTitle = "";
    this.newBucketTarget = "";
    this.newBucketNotes = "";
    this.editingBucketIndex = null;
    this.editBucketTitle = "";
    this.editBucketTarget = "";
    this.editBucketNotes = "";
    this.newBucketLinkLabel = "";
    this.newBucketLinkUrl = "";
    this.showAddBucketLink = null;
    this.newLinkLabel = "";
    this.newLinkUrl = "";
    this.newActionItem = "";
    this.newActionPriority = 'medium';
    this.newNote = "";
    this.editingBucketIndex = null;
    this.editBucketTitle = "";
    this.editBucketTarget = "";
  }

  /**
   * Checks if the given title is invalid.
   * @param title - The title to check.
   * @returns True if the title is invalid, false otherwise.
   */
  invalidTitle(title: string) {
    return isDuplicateTitle(title, [AppStateService.instance.allFireEmergencies]);
  }

  /**
   * Add a bucket to the emergency fund.
   */
  addBucket() {
    if (this.newBucketTitle.trim() && this.newBucketTarget) {
      this.buckets.push({
        id: generateBucketId(),
        title: this.newBucketTitle.trim(),
        target: Math.round(parseFloat(this.newBucketTarget) * 100) / 100,
        amount: 0,
        notes: this.newBucketNotes.trim(),
        links: [],
        targetDate: this.newBucketTargetDate || undefined
      });
      this.newBucketTitle = "";
      this.newBucketTarget = "";
      this.newBucketNotes = "";
      this.newBucketTargetDate = "";
      this.showAddBucket = false;
    }
  }

  removeBucket(index: number) {
    this.buckets.splice(index, 1);
    if (this.editingBucketIndex === index) {
      this.editingBucketIndex = null;
    }
  }

  startEditBucket(index: number) {
    this.editingBucketIndex = index;
    this.editBucketTitle = this.buckets[index].title;
    this.editBucketTarget = this.buckets[index].target.toString();
    this.editBucketNotes = this.buckets[index].notes || "";
    this.editBucketTargetDate = this.buckets[index].targetDate || "";
  }

  saveEditBucket(index: number) {
    if (this.editBucketTitle.trim() && this.editBucketTarget) {
      this.buckets[index].title = this.editBucketTitle.trim();
      this.buckets[index].target = Math.round(parseFloat(this.editBucketTarget) * 100) / 100;
      this.buckets[index].notes = this.editBucketNotes.trim();
      this.buckets[index].targetDate = this.editBucketTargetDate || undefined;
      this.editingBucketIndex = null;
    }
  }

  cancelEditBucket() {
    this.editingBucketIndex = null;
    this.editBucketTitle = "";
    this.editBucketTarget = "";
    this.editBucketNotes = "";
    this.editBucketTargetDate = "";
  }

  // Bucket-specific link management
  addBucketLink(bucketIndex: number) {
    if (this.newBucketLinkLabel.trim() && this.newBucketLinkUrl.trim()) {
      if (!this.buckets[bucketIndex].links) {
        this.buckets[bucketIndex].links = [];
      }
      this.buckets[bucketIndex].links!.push({
        label: this.newBucketLinkLabel.trim(),
        url: this.newBucketLinkUrl.trim()
      });
      this.newBucketLinkLabel = "";
      this.newBucketLinkUrl = "";
      this.showAddBucketLink = null;
    }
  }

  removeBucketLink(bucketIndex: number, linkIndex: number) {
    if (this.buckets[bucketIndex].links) {
      this.buckets[bucketIndex].links!.splice(linkIndex, 1);
    }
  }

  startEditBucketLink(bucketIndex: number, linkIndex: number) {
    this.editingBucketLinkBucketIndex = bucketIndex;
    this.editingBucketLinkLinkIndex = linkIndex;
    const link = this.buckets[bucketIndex].links![linkIndex];
    this.editBucketLinkLabel = link.label;
    this.editBucketLinkUrl = link.url;
  }

  saveEditBucketLink() {
    if (this.editingBucketLinkBucketIndex !== null && this.editingBucketLinkLinkIndex !== null && 
        this.editBucketLinkLabel.trim() && this.editBucketLinkUrl.trim()) {
      this.buckets[this.editingBucketLinkBucketIndex].links![this.editingBucketLinkLinkIndex] = {
        label: this.editBucketLinkLabel.trim(),
        url: this.editBucketLinkUrl.trim()
      };
      this.cancelEditBucketLink();
    }
  }

  cancelEditBucketLink() {
    this.editingBucketLinkBucketIndex = null;
    this.editingBucketLinkLinkIndex = null;
    this.editBucketLinkLabel = "";
    this.editBucketLinkUrl = "";
  }

  /**
   * Add a link to the emergency fund.
   */
  addLink() {
    if (this.newLinkLabel.trim() && this.newLinkUrl.trim()) {
      this.links.push({
        label: this.newLinkLabel.trim(),
        url: this.newLinkUrl.trim()
      });
      this.newLinkLabel = "";
      this.newLinkUrl = "";
    }
  }

  removeLink(index: number) {
    this.links.splice(index, 1);
  }

  startEditLink(index: number) {
    this.editingLinkIndex = index;
    this.editingLinkLabel = this.links[index].label;
    this.editingLinkUrl = this.links[index].url;
  }

  saveEditLink(index: number) {
    if (this.editingLinkLabel.trim() && this.editingLinkUrl.trim()) {
      this.links[index].label = this.editingLinkLabel.trim();
      this.links[index].url = this.editingLinkUrl.trim();
      this.cancelEditLink();
    }
  }

  cancelEditLink() {
    this.editingLinkIndex = -1;
    this.editingLinkLabel = "";
    this.editingLinkUrl = "";
  }

  /**
   * Add an action item to the emergency fund.
   */
  addActionItem() {
    if (this.newActionItem.trim()) {
      const actionItem: FireActionItem = {
        text: this.newActionItem.trim(),
        done: false,
        priority: this.newActionPriority
      };
      if (this.newActionTargetDate) {
        actionItem.dueDate = this.newActionTargetDate;
      }
      this.actionItems.push(actionItem);
      this.newActionItem = "";
      this.newActionPriority = 'medium';
      this.newActionTargetDate = "";
    }
  }

  removeActionItem(index: number) {
    this.actionItems.splice(index, 1);
  }

  startEditAction(index: number) {
    this.editingActionIndex = index;
    this.editingActionText = this.actionItems[index].text;
    this.editingActionPriority = this.actionItems[index].priority;
    this.editingActionDueDate = this.actionItems[index].dueDate || '';
  }

  saveEditAction(index: number) {
    if (this.editingActionText.trim()) {
      this.actionItems[index].text = this.editingActionText.trim();
      this.actionItems[index].priority = this.editingActionPriority;
      this.actionItems[index].dueDate = this.editingActionDueDate || undefined;
      this.cancelEditAction();
    }
  }

  cancelEditAction() {
    this.editingActionIndex = -1;
    this.editingActionText = '';
    this.editingActionPriority = 'medium';
    this.editingActionDueDate = '';
  }

  toggleActionItem(index: number) {
    this.actionItems[index].done = !this.actionItems[index].done;
  }

  /**
   * Add a note to the emergency fund.
   */
  addNote() {
    if (this.newNote.trim()) {
      this.notes.push({
        text: this.newNote.trim(),
        createdAt: new Date().toISOString()
      });
      this.newNote = "";
    }
  }

  removeNote(index: number) {
    this.notes.splice(index, 1);
  }

  /**
   * Open payment planner dialog
   */
  openPaymentPlanner(): void {
    this.isPaymentPlannerOpen = true;
    this.editingPlanIndex = null;
  }

  /**
   * Edit existing payment plan
   */
  editPaymentPlan(index: number): void {
    this.editingPlanIndex = index;
    this.isPaymentPlannerOpen = true;
  }

  /**
   * Handle new payment plan created
   */
  onPlanCreated(plan: PlannedSubscription): void {
    this.plannedSubscriptions.push(plan);
    this.isPaymentPlannerOpen = false;
    this.toastService.show('Payment plan created', 'success');
  }

  /**
   * Handle payment plan updated
   */
  onPlanUpdated(plan: PlannedSubscription): void {
    if (this.editingPlanIndex !== null) {
      this.plannedSubscriptions[this.editingPlanIndex] = plan;
      this.isPaymentPlannerOpen = false;
      this.editingPlanIndex = null;
      this.toastService.show('Payment plan updated', 'success');
    }
  }

  /**
   * Handle payment planner cancelled
   */
  onPlannerCancelled(): void {
    this.isPaymentPlannerOpen = false;
    this.editingPlanIndex = null;
  }

  /**
   * Delete payment plan
   */
  deletePaymentPlan(index: number): void {
    this.plannedSubscriptions.splice(index, 1);
    this.toastService.show('Payment plan deleted', 'success');
  }

  /**
   * Get bucket name by ID
   */
  getBucketNameById(bucketId: string): string {
    const bucket = this.buckets.find(b => b.id === bucketId);
    return bucket ? bucket.title : 'Unknown';
  }

  /**
   * Calculate total monthly commitment across all plans
   */
  calculateTotalMonthlyCommitment(): number {
    return this.paymentPlannerService.calculateTotalMonthlyCommitment(this.plannedSubscriptions);
  }

  /**
   * Adds a fire emergency.
   */
  addFireEmergencie(){
    // First trim string
    this.titleTextField = this.titleTextField.trim();
    
    // Validation: either target OR at least one bucket required
    const hasTargetAmount = this.targetTextField && parseFloat(this.targetTextField) > 0;
    const hasBuckets = this.buckets.length > 0;
    
    if (!this.titleTextField) {
      this.showError("Title is required");
      return;
    } else if (!hasBuckets && !hasTargetAmount) {
      this.showError("Target Amount is required (or add at least one Bucket)");
      return;
    } else if (this.invalidTitle(this.titleTextField)) {
      this.showError("This fire emergency already exists.");
      return;
    }
    
    const now = new Date().toISOString();
    
    // Build final bucket list
    let finalBuckets = [];
    
    // 1. If target amount provided, always create a default bucket first
    if (hasTargetAmount) {
      finalBuckets.push({
        id: `bucket_${Date.now()}`,
        title: this.titleTextField,  // Default bucket name matches fire emergency name
        target: parseFloat(this.targetTextField),
        amount: this.amountTextField === "" ? 0.0 : parseFloat(this.amountTextField),
        notes: "",
        links: []
      });
    }
    
    // 2. Then add any custom buckets the user created
    if (this.buckets.length > 0) {
      finalBuckets = [...finalBuckets, ...this.buckets];
    }
    
    // Create new Fire emergency - ALL amounts now in buckets
    let newFire: Fire = {
      title: this.titleTextField,
      sub: this.subTextField.trim(),
      phase: this.phaseField,
      description: this.descriptionTextField.trim(),
      targetDate: this.targetDateField || undefined,
      completionDate: this.phaseField === 'completed' ? now : undefined,
      buckets: finalBuckets,
      links: this.links,
      actionItems: this.actionItems,
      notes: this.notes,
      plannedSubscriptions: this.plannedSubscriptions,  // Include payment plans
      createdAt: now,
      updatedAt: now
    };

    AppStateService.instance.allFireEmergencies.push(newFire);
    
    this.clearError();
    this.resetForm();
    this.closeWindow();
    AppStateService.instance.isSaving = true;
    this.persistence.writeAndSync({
      tag: 'fire',
      data: AppStateService.instance.allFireEmergencies,
      localStorageKey: 'fire',
      logEvent: 'add_fire',
      logMetadata: { 
        title: newFire.title, 
        target: finalBuckets.reduce((sum, b) => sum + b.target, 0), 
        phase: this.phaseField 
      },
      onSuccess: () => {
        AppStateService.instance.isSaving = false;
        this.toastService.show('Emergency fund added', 'success');
        gotoTop();
        const route = environment.mode === 'selfhosted' ? '/fire' : '/fireemergencies';
        this.router.navigate([route]);
      },
      onError: (error) => {
        AppStateService.instance.isSaving = false;
        this.toastService.show(error.message || 'Database write failed', 'error');
      }
    });
  }
}
