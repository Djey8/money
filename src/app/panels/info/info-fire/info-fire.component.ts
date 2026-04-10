import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LocalService } from 'src/app/shared/services/local.service';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { IncomeStatementService } from 'src/app/shared/services/income-statement.service';
import { isDuplicateTitle } from 'src/app/shared/validation.utils';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { Fire, FirePhase, FireBucket, FireLink, FireActionItem, FireNote } from 'src/app/interfaces/fire';
import { PlannedSubscription } from 'src/app/interfaces/planned-subscription';
import { PaymentPlannerService } from 'src/app/shared/services/payment-planner.service';
import { SubscriptionActivationService } from 'src/app/shared/services/subscription-activation.service';
import { generateBucketId } from 'src/app/shared/fire-migration.utils';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { PaymentPlannerDialogComponent } from 'src/app/shared/components/payment-planner-dialog/payment-planner-dialog.component';

// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let FireEmergenciesComponent: any; setTimeout(() => import('../../../main/fire/fire-emergencies/fire-emergencies.component').then(m => FireEmergenciesComponent = m.FireEmergenciesComponent));
let FireComponent: any; setTimeout(() => import('../../../main/fire/fire.component').then(m => FireComponent = m.FireComponent));
let ProfileComponent: any; setTimeout(() => import('src/app/panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let InfoComponent: any; setTimeout(() => import('../info.component').then(m => InfoComponent = m.InfoComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let AddSmileComponent: any; setTimeout(() => import('src/app/panels/add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
let InfoSmileComponent: any; setTimeout(() => import('../info-smile/info-smile.component').then(m => InfoSmileComponent = m.InfoSmileComponent));
@Component({
  selector: 'app-info-fire',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe, AppDatePipe, PaymentPlannerDialogComponent],
  templateUrl: './info-fire.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-fire.component.css']
})
export class InfoFireComponent extends BaseInfoComponent {
  static index = 1;

  static title = "Emergency Fund";
  static sub = "";
  static phase: FirePhase = 'planning';
  static description = "";
  static buckets: FireBucket[] = [];
  static links: FireLink[] = [];
  static actionItems: FireActionItem[] = [];
  static notes: FireNote[] = [];
  static plannedSubscriptions: PlannedSubscription[] = [];
  static createdAt = "";
  static updatedAt = "";
  static targetDate = "";
  static completionDate = "";
  static isEdit = false;
  
  // Sorting for related transactions
  static sortColumn: string = 'id';  // 'id', 'account', 'amount', 'date'
  static sortDirection: 'asc' | 'desc' = 'desc';  // Default: highest ID first
  
  // Current detail tab
  static activeTab: 'overview' | 'buckets' | 'paymentPlans' | 'actions' | 'notes' = 'overview';

  static setInfoFireComponent(id: number, fire: Fire) {
    InfoFireComponent.index = id;
    InfoFireComponent.title = fire.title;
    InfoFireComponent.sub = fire.sub || "";
    InfoFireComponent.phase = fire.phase || 'planning';
    InfoFireComponent.description = fire.description || "";
    InfoFireComponent.buckets = fire.buckets;
    InfoFireComponent.links = fire.links || [];
    InfoFireComponent.actionItems = fire.actionItems || [];
    InfoFireComponent.notes = fire.notes || [];
    InfoFireComponent.plannedSubscriptions = fire.plannedSubscriptions || [];
    InfoFireComponent.createdAt = fire.createdAt || '';
    InfoFireComponent.updatedAt = fire.updatedAt || '';
    InfoFireComponent.targetDate = fire.targetDate || '';
    InfoFireComponent.completionDate = fire.completionDate || '';
    InfoFireComponent.isEdit = false;
    InfoFireComponent.activeTab = 'overview';
    InfoFireComponent.isInfo = true;
    if(InfoComponent?.isInfo){
      InfoFireComponent.isInfo = false;
    }
  }

  titleTextField = InfoFireComponent.title;
  subTextField = InfoFireComponent.sub;
  phaseField: FirePhase = InfoFireComponent.phase;
  descriptionTextField = InfoFireComponent.description;
  targetDateTextField = InfoFireComponent.targetDate;
  completionDateTextField = InfoFireComponent.completionDate;
  buckets: FireBucket[] = [];
  links: FireLink[] = [];
  actionItems: FireActionItem[] = [];
  showBucketsSection = false;
  showLinksActionsSection = false;
  showNotesSection = false;
  showAddLink = false;
  showAddAction = false;
  showAddBucket = false;
  newLinkLabel = '';
  newLinkUrl = '';
  newActionText = '';
  newActionPriority: 'low' | 'medium' | 'high' = 'medium';
  newActionDueDate = '';

  // Payment Plans management
  isPaymentPlannerOpen = false;
  editingPlanIndex: number | null = null;
  newBucketTitle = '';
  newBucketTarget = 0;
  newBucketNotes = '';
  newBucketTargetDate = '';
  newNoteText = '';
  editingNoteIndex = -1;
  editingNoteText = '';
  editingBucketIndex = -1;
  editingBucketTitle = '';
  editingBucketTarget = 0;
  editingBucketAmount = 0;
  editBucketNotes = '';
  editBucketTargetDate = '';
  editingBucketLinkBucketIndex: number | null = null;
  editingBucketLinkLinkIndex: number | null = null;
  editBucketLinkLabel = '';
  editBucketLinkUrl = '';
  newBucketLinkLabel = '';
  newBucketLinkUrl = '';
  showAddBucketLink: number | null = null;
  editingLinkIndex = -1;
  editingLinkLabel = '';
  editingLinkUrl = '';
  editingActionIndex = -1;
  editingActionText = '';
  editingActionPriority: 'low' | 'medium' | 'high' = 'medium';
  editingActionDueDate = '';
  
  get notesList(): FireNote[] {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    return fire?.notes || [];
  }

  get relatedTransactions() {
    // Find transactions that reference this Fire emergency (by title or bucket categories)
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (!fire) return [];
    
    const transactions = AppStateService.instance.allTransactions.filter(tx => {
      if (tx.category === `@${fire.title}`) return true;
      // Check if transaction comment references any bucket by name
      if (tx.comment && fire.buckets?.length) {
        return fire.buckets.some(bucket => tx.comment.match(new RegExp(`#bucket:${bucket.title}:[\\d.]+`)));
      }
      return false;
    });
    
    // Apply sorting
    return this.sortTransactions(transactions);
  }

  /**
   * Get transactions for a specific bucket
   * Looks for #bucket:BucketName:Amount tags in comments
   */
  getTransactionsForBucket(bucketId: string) {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (!fire) return [];
    
    // Find bucket by ID to get its name
    const bucket = fire.buckets.find(b => b.id === bucketId);
    if (!bucket) return [];
    
    const transactions = AppStateService.instance.allTransactions.filter(tx => {
      // MUST be for this fire emergency first
      if (tx.category !== `@${fire.title}`) return false;
      // Check if transaction comment includes this bucket's name in allocation tag
      return tx.comment && tx.comment.match(new RegExp(`#bucket:${bucket.title}:[\\d.]+`));
    });
    
    // Apply sorting
    return this.sortTransactions(transactions);
  }

  /**
   * Get the allocated amount for a specific bucket from a transaction.
   * Returns the amount from #bucket:BucketName:Amount tag, or full amount if not found.
   */
  getAllocatedAmountForBucket(tx: any, bucketId: string): number {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (!fire) return tx.amount;
    
    const bucket = fire.buckets.find(b => b.id === bucketId);
    if (!bucket || !tx.comment) return tx.amount;
    
    // Parse bucket allocation tag for this specific bucket
    const regex = new RegExp(`#bucket:${bucket.title}:([\\d.]+)`);
    const match = tx.comment.match(regex);
    
    if (match) {
      return -parseFloat(match[1]); // Negative because it's an expense
    }
    
    return tx.amount; // Fallback to full amount
  }

  /**
   * Get transactions that were distributed across buckets
   * Returns transactions that have multiple #bucket:Name:Amount tags
   */
  getDistributedTransactions() {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (!fire) return [];
    
    // Migrate old transactions without allocation tags
    this.migrateTransactionAllocations();
    
    const transactions = AppStateService.instance.allTransactions.filter(tx => {
      // Must be for this fire emergency
      if (tx.category !== `@${fire.title}`) return false;
      
      // Check if comment has multiple bucket allocation tags
      const bucketTagMatches = tx.comment?.match(/#bucket:[^:]+:[\d.]+/g);
      return bucketTagMatches && bucketTagMatches.length > 1;
    });
    
    // Apply sorting
    return this.sortTransactions(transactions);
  }

  /**
   * Migrate old transactions without bucket allocation tags
   * Appends allocation tags to comments based on current buckets
   */
  migrateTransactionAllocations() {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (!fire?.buckets?.length) return;
    
    AppStateService.instance.allTransactions.forEach(tx => {
      // Only migrate transactions for this fire emergency
      if (tx.category !== `@${fire.title}`) return;
      
      // Check if already has allocation tags
      const hasAllocationTags = tx.comment?.match(/#bucket:[^:]+:[\d.]+/);
      if (hasAllocationTags) return; // Already migrated
      
      // Distribute amount equally across all current buckets and append tags
      const amountPerBucket = Math.abs(tx.amount) / fire.buckets.length;
      const allocationTags = fire.buckets
        .map(bucket => `#bucket:${bucket.title}:${amountPerBucket.toFixed(2)}`)
        .join(' ');
      
      tx.comment = tx.comment
        ? `${tx.comment}\n${allocationTags}`
        : allocationTags;
    });
  }

  /**
   * Get the original transaction ID from the full allTransactions array.
   * Returns a 1-based ID with newest transactions having highest IDs.
   */
  getTransactionId(tx: any): number {
    const allTransactions = AppStateService.instance.allTransactions;
    const txIndex = allTransactions.findIndex(t => 
      t.account === tx.account && 
      t.amount === tx.amount && 
      t.date === tx.date && 
      t.time === tx.time &&
      t.category === tx.category &&
      t.comment === tx.comment
    );
    
    if (txIndex === -1) return 0;
    
    // Since array is oldest-first, add 1 to index for 1-based ID
    return txIndex + 1;
  }

  /**
   * Toggle sort for related transactions table.
   * Clicking same column toggles direction, clicking different column resets to descending.
   */
  toggleSort(column: string) {
    if (InfoFireComponent.sortColumn === column) {
      // Toggle direction
      InfoFireComponent.sortDirection = InfoFireComponent.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column - default to descending
      InfoFireComponent.sortColumn = column;
      InfoFireComponent.sortDirection = 'desc';
    }
  }

  /**
   * Get sort icon for column header.
   */
  getSortIcon(column: string): string {
    if (InfoFireComponent.sortColumn !== column) return '';
    return InfoFireComponent.sortDirection === 'asc' ? '▲' : '▼';
  }

  /**
   * Sort transactions array based on current sort column and direction.
   */
  sortTransactions(transactions: any[]): any[] {
    const sorted = [...transactions];
    
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (InfoFireComponent.sortColumn) {
        case 'id':
          aValue = this.getTransactionId(a);
          bValue = this.getTransactionId(b);
          break;
        case 'account':
          aValue = a.account.toLowerCase();
          bValue = b.account.toLowerCase();
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'date':
          aValue = a.date + (a.time || '00:00:00');
          bValue = b.date + (b.time || '00:00:00');
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) {
        return InfoFireComponent.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return InfoFireComponent.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    return sorted;
  }

  /**
   * Opens the transaction info panel for a related transaction.
   * @param tx - The transaction to open
   */
  openTransactionInfo(tx: any) {
    // Find the index of this transaction in the full allTransactions array
    const txIndex = AppStateService.instance.allTransactions.findIndex(t => 
      t.account === tx.account && 
      t.amount === tx.amount && 
      t.date === tx.date && 
      t.category === tx.category &&
      t.comment === tx.comment
    );
    
    if (txIndex !== -1) {
      // Set InfoComponent z-index much higher to appear on top of InfoFireComponent
      InfoComponent.zIndex = InfoFireComponent.zIndex + 10;
      
      AppComponent.gotoTop();
      InfoComponent.setInfoComponent(
        txIndex,
        tx.account,
        tx.amount,
        tx.date,
        tx.time,
        tx.category,
        tx.comment
      );
    }
  }

  getTotalTarget(): number {
    return InfoFireComponent.buckets?.reduce((sum, b) => sum + (b.target || 0), 0) || 0;
  }

  getTotalAmount(): number {
    return InfoFireComponent.buckets?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
  }

  getProgress(): number {
    const target = this.getTotalTarget();
    return target > 0 ? (this.getTotalAmount() / target) * 100 : 0;
  }

  getBucketProgress(bucket: FireBucket): number {
    return bucket.target > 0 ? (bucket.amount / bucket.target) * 100 : 0;
  }

  deleteTransactionsChecked = true;

  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoFireComponent;
  
  constructor(
    router: Router, 
    private localStorage: LocalService, 
    private persistence: PersistenceService, 
    private incomeStatement: IncomeStatementService,
    private paymentPlannerService: PaymentPlannerService,
    private subscriptionActivationService: SubscriptionActivationService
  ) {
    super(router);
    this.initStatic(InfoFireComponent);
  }

  highlight() {
    InfoFireComponent.zIndex = InfoFireComponent.zIndex + 1;
    InfoSmileComponent.zIndex = 0;
    // Don't reset InfoComponent.zIndex to 0 - it might be displaying a transaction on top
    // InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  override closeWindow() {
    InfoFireComponent.isEdit = false;
    super.closeWindow();
  }

  setTab(tab: typeof InfoFireComponent.activeTab) {
    InfoFireComponent.activeTab = tab;
  }

  add() {
    AddComponent.categoryTextField = `@${InfoFireComponent.title}`;
    AddComponent.selectedOption = "Fire";
    AddComponent.url = "/fireemergencies";
    const remaining = this.getTotalTarget() - this.getTotalAmount();
    AddComponent.commentTextField = `${InfoFireComponent.title} ${remaining} `;
    InfoFireComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  editFireEmergencie() {
    AppComponent.gotoTop();
    this.isEdit = true;
    InfoFireComponent.isError = false;
    InfoFireComponent.isEdit = true;
    this.titleTextField = InfoFireComponent.title;
    this.subTextField = InfoFireComponent.sub;
    this.phaseField = InfoFireComponent.phase;
    this.descriptionTextField = InfoFireComponent.description;
    this.targetDateTextField = InfoFireComponent.targetDate;
    this.buckets = JSON.parse(JSON.stringify(InfoFireComponent.buckets));
    this.links = JSON.parse(JSON.stringify(InfoFireComponent.links));
    this.actionItems = JSON.parse(JSON.stringify(InfoFireComponent.actionItems));
  }

  addLink() {
    if (this.newLinkLabel.trim() && this.newLinkUrl.trim()) {
      this.links.push({
        label: this.newLinkLabel.trim(),
        url: this.newLinkUrl.trim()
      });
      this.newLinkLabel = '';
      this.newLinkUrl = '';
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
    this.editingLinkLabel = '';
    this.editingLinkUrl = '';
  }

  addActionItem() {
    if (this.newActionText.trim()) {
      this.actionItems.push({
        text: this.newActionText.trim(),
        done: false,
        priority: this.newActionPriority,
        dueDate: this.newActionDueDate || undefined
      });
      this.newActionText = '';
      this.newActionPriority = 'medium';
      this.newActionDueDate = '';
    }
  }

  removeActionItem(index: number) {
    this.actionItems.splice(index, 1);
  }

  toggleActionItem(index: number) {
    this.actionItems[index].done = !this.actionItems[index].done;
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

  addBucket() {
    if (this.newBucketTitle.trim() && this.newBucketTarget > 0) {
      this.buckets.push({
        id: generateBucketId(),
        title: this.newBucketTitle.trim(),
        target: this.newBucketTarget,
        amount: 0,
        notes: this.newBucketNotes || '',
        links: [],
        targetDate: this.newBucketTargetDate || undefined
      });
      this.newBucketTitle = '';
      this.newBucketTarget = 0;
      this.newBucketNotes = '';
      this.newBucketTargetDate = '';
    }
  }

  removeBucket(index: number) {
    this.buckets.splice(index, 1);
  }

  startEditBucket(index: number) {
    this.editingBucketIndex = index;
    this.editingBucketTitle = this.buckets[index].title;
    this.editingBucketTarget = this.buckets[index].target;
    this.editingBucketAmount = this.buckets[index].amount;
    this.editBucketNotes = this.buckets[index].notes || '';
    this.editBucketTargetDate = this.buckets[index].targetDate || '';
  }

  saveBucketEdit() {
    if (this.editingBucketIndex >= 0) {
      this.buckets[this.editingBucketIndex].title = this.editingBucketTitle;
      this.buckets[this.editingBucketIndex].target = Math.round(this.editingBucketTarget * 100) / 100;
      this.buckets[this.editingBucketIndex].amount = Math.round(this.editingBucketAmount * 100) / 100;
      this.buckets[this.editingBucketIndex].notes = this.editBucketNotes.trim();
      this.buckets[this.editingBucketIndex].targetDate = this.editBucketTargetDate || undefined;
      this.cancelBucketEdit();
    }
  }

  cancelBucketEdit() {
    this.editingBucketIndex = -1;
    this.editingBucketTitle = '';
    this.editingBucketTarget = 0;
    this.editingBucketAmount = 0;
    this.editBucketNotes = '';
    this.editBucketTargetDate = '';
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
      this.newBucketLinkLabel = '';
      this.newBucketLinkUrl = '';
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
    this.editBucketLinkLabel = '';
    this.editBucketLinkUrl = '';
  }

  addNote() {
    if (this.newNoteText.trim()) {
      const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
      if (!fire.notes) fire.notes = [];
      
      fire.notes.push({
        text: this.newNoteText.trim(),
        createdAt: new Date().toISOString()
      });
      
      this.newNoteText = '';
      this.saveFireChanges();
    }
  }

  removeNote(index: number) {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (fire.notes) {
      fire.notes.splice(index, 1);
      this.saveFireChanges();
    }
  }

  startEditNote(index: number) {
    this.editingNoteIndex = index;
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (fire.notes && fire.notes[index]) {
      this.editingNoteText = fire.notes[index].text;
    }
  }

  saveEditNote(index: number) {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (fire.notes && fire.notes[index] && this.editingNoteText.trim()) {
      fire.notes[index].text = this.editingNoteText.trim();
      fire.updatedAt = new Date().toISOString();
      this.editingNoteIndex = -1;
      this.editingNoteText = '';
      this.saveFireChanges();
    }
  }

  cancelEditNote() {
    this.editingNoteIndex = -1;
    this.editingNoteText = '';
  }

  invalidTitle(title: string) {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (fire && fire.title === title) return false; // Same title is OK
    return isDuplicateTitle(title, [AppStateService.instance.allFireEmergencies]);
  }

  updateFireEmergencie() {
    if (this.titleTextField.trim() === "" || this.buckets.length === 0) {
      this.showError("Please provide a title and at least one bucket.");
      return;
    }
    
    if (this.invalidTitle(this.titleTextField.trim())) {
      this.showError("This fire emergency already exists.");
      return;
    }
    
    const now = new Date().toISOString();
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    
    fire.title = this.titleTextField.trim();
    fire.sub = this.subTextField.trim();
    fire.phase = this.phaseField;
    fire.description = this.descriptionTextField.trim();
    fire.targetDate = this.targetDateTextField || '';
    fire.completionDate = this.phaseField === 'completed' ? (fire.completionDate || now) : '';
    fire.buckets = this.buckets;
    fire.links = this.links;
    fire.actionItems = this.actionItems;
    fire.updatedAt = now;
    
    // Update static for display
    InfoFireComponent.title = fire.title;
    InfoFireComponent.sub = fire.sub;
    InfoFireComponent.phase = fire.phase;
    InfoFireComponent.description = fire.description;
    InfoFireComponent.buckets = fire.buckets;
    InfoFireComponent.links = fire.links;
    InfoFireComponent.actionItems = fire.actionItems;
    InfoFireComponent.updatedAt = fire.updatedAt;
    InfoFireComponent.targetDate = fire.targetDate;
    InfoFireComponent.completionDate = fire.completionDate;
    
    this.persistence.writeAndSync({
      tag: 'fire',
      data: AppStateService.instance.allFireEmergencies,
      localStorageKey: 'fire',
      logEvent: 'update_fire',
      logMetadata: {
        title: fire.title,
        phase: fire.phase
      },
      onSuccess: () => {
        this.clearError();
        InfoFireComponent.isEdit = false;
        this.isEdit = false;
        this.toastService.show('Emergency fund updated', 'update');
        AppComponent.gotoTop();
      },
      onError: (error) => {
        this.showError(error.message || 'Database write failed');
      }
    });
  }

  private saveFireChanges() {
    this.persistence.writeAndSync({
      tag: 'fire',
      data: AppStateService.instance.allFireEmergencies,
      localStorageKey: 'fire',
      logEvent: 'update_fire_emergency',
      logMetadata: { source: 'info_panel' },
      onSuccess: () => {},
      onError: (error) => console.error('Save failed:', error)
    });
  }

  // ── Link Management (View Mode) ──
  submitLink() {
    if (this.newLinkLabel && this.newLinkUrl) {
      const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
      if (!fire.links) fire.links = [];
      
      fire.links.push({
        label: this.newLinkLabel,
        url: this.newLinkUrl
      });
      fire.updatedAt = new Date().toISOString();
      
      this.newLinkLabel = '';
      this.newLinkUrl = '';
      this.showAddLink = false;
      
      InfoFireComponent.links = fire.links;
      
      this.persistence.writeAndSync({
        tag: 'fire',
        data: AppStateService.instance.allFireEmergencies,
        localStorageKey: 'fire',
        logEvent: 'add_fire_link',
        logMetadata: { title: fire.title },
        onSuccess: () => {
          this.toastService.show('Link added', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to add link');
        }
      });
    }
  }

  removeLinkViewMode(index: number) {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (fire.links) {
      fire.links.splice(index, 1);
      fire.updatedAt = new Date().toISOString();
      
      InfoFireComponent.links = fire.links;
      
      this.persistence.writeAndSync({
        tag: 'fire',
        data: AppStateService.instance.allFireEmergencies,
        localStorageKey: 'fire',
        logEvent: 'remove_fire_link',
        logMetadata: { title: fire.title },
        onSuccess: () => {
          this.toastService.show('Link removed', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to remove link');
        }
      });
    }
  }

  startEditLinkViewMode(index: number) {
    this.editingLinkIndex = index;
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (fire.links && fire.links[index]) {
      this.editingLinkLabel = fire.links[index].label;
      this.editingLinkUrl = fire.links[index].url;
    }
  }

  saveEditLinkViewMode(index: number) {
    if (this.editingLinkLabel.trim() && this.editingLinkUrl.trim()) {
      const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
      if (fire.links && fire.links[index]) {
        fire.links[index].label = this.editingLinkLabel.trim();
        fire.links[index].url = this.editingLinkUrl.trim();
        fire.updatedAt = new Date().toISOString();
        
        InfoFireComponent.links = fire.links;
        
        this.editingLinkIndex = -1;
        this.editingLinkLabel = '';
        this.editingLinkUrl = '';
        
        this.persistence.writeAndSync({
          tag: 'fire',
          data: AppStateService.instance.allFireEmergencies,
          localStorageKey: 'fire',
          logEvent: 'update_fire_link',
          logMetadata: { title: fire.title },
          onSuccess: () => {
            this.toastService.show('Link updated', 'update');
          },
          onError: (error) => {
            this.showError(error.message || 'Failed to update link');
          }
        });
      }
    }
  }

  cancelEditLinkViewMode() {
    this.editingLinkIndex = -1;
    this.editingLinkLabel = '';
    this.editingLinkUrl = '';
  }

  // ── Action Item Management (View Mode) ──
  submitActionItem() {
    if (this.newActionText) {
      const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
      if (!fire.actionItems) fire.actionItems = [];
      
      fire.actionItems.push({
        text: this.newActionText,
        done: false,
        priority: this.newActionPriority,
        dueDate: this.newActionDueDate || undefined
      });
      fire.updatedAt = new Date().toISOString();
      
      this.newActionText = '';
      this.newActionPriority = 'medium';
      this.newActionDueDate = '';
      this.showAddAction = false;
      
      InfoFireComponent.actionItems = fire.actionItems;
      
      this.persistence.writeAndSync({
        tag: 'fire',
        data: AppStateService.instance.allFireEmergencies,
        localStorageKey: 'fire',
        logEvent: 'add_fire_action',
        logMetadata: { title: fire.title },
        onSuccess: () => {
          this.toastService.show('Action added', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to add action');
        }
      });
    }
  }

  toggleActionItemViewMode(index: number) {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (fire.actionItems && fire.actionItems[index]) {
      fire.actionItems[index].done = !fire.actionItems[index].done;
      fire.updatedAt = new Date().toISOString();
      
      InfoFireComponent.actionItems = fire.actionItems;
      
      this.persistence.writeAndSync({
        tag: 'fire',
        data: AppStateService.instance.allFireEmergencies,
        localStorageKey: 'fire',
        logEvent: 'toggle_fire_action',
        logMetadata: { title: fire.title },
        onSuccess: () => {
          this.toastService.show('Action updated', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to update action');
        }
      });
    }
  }

  removeActionItemViewMode(index: number) {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (fire.actionItems) {
      fire.actionItems.splice(index, 1);
      fire.updatedAt = new Date().toISOString();
      
      InfoFireComponent.actionItems = fire.actionItems;
      
      this.persistence.writeAndSync({
        tag: 'fire',
        data: AppStateService.instance.allFireEmergencies,
        localStorageKey: 'fire',
        logEvent: 'remove_fire_action',
        logMetadata: { title: fire.title },
        onSuccess: () => {
          this.toastService.show('Action removed', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to remove action');
        }
      });
    }
  }

  startEditActionViewMode(index: number) {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (fire.actionItems && fire.actionItems[index]) {
      this.editingActionIndex = index;
      this.editingActionText = fire.actionItems[index].text;
      this.editingActionPriority = fire.actionItems[index].priority;
      this.editingActionDueDate = fire.actionItems[index].dueDate || '';
    }
  }

  saveEditActionViewMode(index: number) {
    const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
    if (this.editingActionText.trim() && fire.actionItems && fire.actionItems[index]) {
      fire.actionItems[index].text = this.editingActionText.trim();
      fire.actionItems[index].priority = this.editingActionPriority;
      fire.actionItems[index].dueDate = this.editingActionDueDate || undefined;
      fire.updatedAt = new Date().toISOString();
      
      InfoFireComponent.actionItems = fire.actionItems;
      
      this.editingActionIndex = -1;
      this.editingActionText = '';
      this.editingActionPriority = 'medium';
      this.editingActionDueDate = '';
      
      this.persistence.writeAndSync({
        tag: 'fire',
        data: AppStateService.instance.allFireEmergencies,
        localStorageKey: 'fire',
        logEvent: 'edit_fire_action',
        logMetadata: { title: fire.title },
        onSuccess: () => {
          this.toastService.show('Action updated', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to update action');
        }
      });
    }
  }

  cancelEditActionViewMode() {
    this.editingActionIndex = -1;
    this.editingActionText = '';
    this.editingActionPriority = 'medium';
    this.editingActionDueDate = '';
  }

  addBucketToTransaction(bucketId: string, bucketTitle: string, bucketRemaining: number) {
    // Add to specific bucket with pre-filled comment using bucket name and amount
    bucketRemaining = Math.round(bucketRemaining * 100) / 100;
    AddComponent.categoryTextField = `@${InfoFireComponent.title}`;
    AddComponent.selectedOption = "Fire";
    AddComponent.amountTextField = (bucketRemaining * -1).toString();
    AddComponent.commentTextField = `${InfoFireComponent.title} ${bucketRemaining.toFixed(2)}\n#bucket:${bucketTitle}:${bucketRemaining.toFixed(2)}`;
    
    AddComponent.url = "/fireemergencies";
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
    InfoFireComponent.isInfo = false;
  }

  getNextPhase(): FirePhase {
    const phases: FirePhase[] = ['idea', 'planning', 'saving', 'ready', 'completed'];
    const currentIndex = phases.indexOf(InfoFireComponent.phase);
    return phases[Math.min(currentIndex + 1, phases.length - 1)];
  }

  advancePhase() {
    const nextPhase = this.getNextPhase();
    if (nextPhase !== InfoFireComponent.phase) {
      const fire = AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
      console.log('[Advance Phase] Before update:', fire.title, 'Current phase:', fire.phase, 'Next phase:', nextPhase);
      
      fire.phase = nextPhase;
      fire.updatedAt = new Date().toISOString();
      
      // If advancing to completed, set completion date
      if (nextPhase === 'completed' && !fire.completionDate) {
        fire.completionDate = new Date().toISOString().split('T')[0];
      }
      
      InfoFireComponent.phase = nextPhase;
      
      console.log('[Advance Phase] After update in memory:', fire.title, 'Phase:', fire.phase);
      console.log('[Advance Phase] Writing to persistence...', AppStateService.instance.allFireEmergencies.map(f => ({ title: f.title, phase: f.phase })));
      
      this.persistence.writeAndSync({
        tag: 'fire',
        data: AppStateService.instance.allFireEmergencies,
        localStorageKey: 'fire',
        logEvent: 'advance_fire_phase',
        logMetadata: { title: fire.title, phase: nextPhase },
        onSuccess: () => {
          console.log('[Advance Phase] Write successful!');
          this.toastService.show('Phase advanced', 'update');
        },
        onError: (error) => {
          console.error('[Advance Phase] Write failed:', error);
          this.showError(error.message || 'Failed to advance phase');
        }
      });
    }
  }

  deleteFire(index: number) {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteFire'), () => {
      const fire = AppStateService.instance.allFireEmergencies[index];
      const deletedTitle = fire.title;
      
      // Remove all transactions matching this fire or any of its buckets
      if (this.deleteTransactionsChecked) {
        const categoriesToDelete = [`@${fire.title}`, ...fire.buckets.map(b => `@${b.title}`)];
        AppStateService.instance.allTransactions = AppStateService.instance.allTransactions.filter(
          tx => !categoriesToDelete.includes(tx.category)
        );
      }
      
      try {
        // Delete fire emergency
        AppStateService.instance.allFireEmergencies.splice(index, 1);

        // Recalculate income statement if transactions were deleted
        if (this.deleteTransactionsChecked) {
          this.incomeStatement.recalculate();
        }

        const writes: { tag: string, data: any }[] = [
          { tag: "fire", data: AppStateService.instance.allFireEmergencies }
        ];
        if (this.deleteTransactionsChecked) {
          writes.push({ tag: "transactions", data: AppStateService.instance.allTransactions });
          writes.push(...this.incomeStatement.getWrites());
        }

        InfoFireComponent.isInfo = false;
        InfoFireComponent.isError = false;

        this.persistence.batchWriteAndSync({
          writes,
          localStorageSaves: [
            { key: 'transactions', data: AppStateService.instance.allTransactions },
            { key: 'fire', data: AppStateService.instance.allFireEmergencies }
          ],
          logEvent: 'delete_fire',
          logMetadata: { title: deletedTitle, index: index },
          onSuccess: () => {
            if (this.deleteTransactionsChecked) {
              this.incomeStatement.saveToLocalStorage();
            }
            this.toastService.show('Emergency fund deleted', 'delete');
            AppComponent.gotoTop();
            this.router.navigate(['/fireemergencies']);
          },
          onError: (error) => {
            this.showError(error.message || 'Database write failed');
          }
        });
      } catch (error) {
        this.showError(error.message || 'Error occurred');
      }
    });
  }

  // ===== Payment Plans Section =====
  
  openPaymentPlanner() {
    this.editingPlanIndex = null;
    this.isPaymentPlannerOpen = true;
  }

  editPaymentPlan(index: number) {
    this.editingPlanIndex = index;
    this.isPaymentPlannerOpen = true;
  }

  onPlanCreated(plan: PlannedSubscription) {
    const fire = this.getCurrentFire();
    if (!fire.plannedSubscriptions) {
      fire.plannedSubscriptions = [];
    }
    fire.plannedSubscriptions.push(plan);
    InfoFireComponent.plannedSubscriptions = fire.plannedSubscriptions;
    this.isPaymentPlannerOpen = false;
    this.saveProject('Payment plan created');
  }

  onPlanUpdated(plan: PlannedSubscription) {
    const fire = this.getCurrentFire();
    if (this.editingPlanIndex !== null && fire.plannedSubscriptions) {
      fire.plannedSubscriptions[this.editingPlanIndex] = plan;
      InfoFireComponent.plannedSubscriptions = fire.plannedSubscriptions;
    }
    this.isPaymentPlannerOpen = false;
    this.editingPlanIndex = null;
    this.saveProject('Payment plan updated');
  }

  onPlanCancelled() {
    this.isPaymentPlannerOpen = false;
    this.editingPlanIndex = null;
  }

  activatePaymentPlan(plan: PlannedSubscription) {
    const fire = this.getCurrentFire();
    this.confirmService.confirm(
      `Activate payment plan "${plan.title}"? This will create a recurring subscription.`,
      () => {
        this.subscriptionActivationService.activatePlannedSubscription(plan, fire);
        InfoFireComponent.plannedSubscriptions = fire.plannedSubscriptions || [];
        this.saveProject('Payment plan activated');
      },
      'Fire.paymentPlans.activate',
      'primary'
    );
  }

  deactivatePaymentPlan(plan: PlannedSubscription) {
    const fire = this.getCurrentFire();
    this.confirmService.confirm(
      `Deactivate payment plan "${plan.title}"? The subscription will be removed.`,
      () => {
        this.subscriptionActivationService.deactivatePlannedSubscription(plan, fire);
        InfoFireComponent.plannedSubscriptions = fire.plannedSubscriptions || [];
        this.saveProject('Payment plan deactivated');
      },
      'Fire.paymentPlans.deactivate',
      'delete'
    );
  }

  reactivatePaymentPlan(plan: PlannedSubscription) {
    const fire = this.getCurrentFire();
    this.confirmService.confirm(
      `Reactivate payment plan "${plan.title}"?`,
      () => {
        this.subscriptionActivationService.reactivatePlannedSubscription(plan, fire);
        InfoFireComponent.plannedSubscriptions = fire.plannedSubscriptions || [];
        this.saveProject('Payment plan reactivated');
      },
      'Fire.paymentPlans.reactivate',
      'primary'
    );
  }

  deletePaymentPlan(plan: PlannedSubscription) {
    const fire = this.getCurrentFire();
    this.confirmService.confirm(
      `Delete payment plan "${plan.title}"?`,
      () => {
        this.subscriptionActivationService.deletePlannedSubscription(plan.id, fire);
        InfoFireComponent.plannedSubscriptions = fire.plannedSubscriptions || [];
        this.saveProject('Payment plan deleted');
      }
    );
  }

  duplicatePaymentPlan(plan: PlannedSubscription) {
    const fire = this.getCurrentFire();
    const duplicate: PlannedSubscription = {
      ...plan,
      id: crypto.randomUUID(),
      title: `${plan.title} (Copy)`,
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    delete duplicate.activeSubscriptionId;
    delete duplicate.activatedAt;
    delete duplicate.deactivatedAt;
    
    fire.plannedSubscriptions = fire.plannedSubscriptions || [];
    fire.plannedSubscriptions.push(duplicate);
    InfoFireComponent.plannedSubscriptions = fire.plannedSubscriptions;
    this.saveProject('Payment plan duplicated');
  }

  getBucketNameById(bucketId: string): string {
    const fire = this.getCurrentFire();
    const bucket = fire.buckets.find(b => b.id === bucketId);
    return bucket ? bucket.title : 'Unknown Bucket';
  }

  calculateTotalMonthlyCommitment(): number {
    const fire = this.getCurrentFire();
    if (!fire.plannedSubscriptions) {
      return 0;
    }
    
    return fire.plannedSubscriptions
      .filter(plan => plan.status === 'active')
      .reduce((total, plan) => {
        // Convert to monthly equivalent
        let monthlyAmount = plan.amount;
        if (plan.frequency === 'yearly') {
          monthlyAmount = plan.amount / 12;
        } else if (plan.frequency === 'weekly') {
          monthlyAmount = plan.amount * 52 / 12;
        }
        return total + monthlyAmount;
      }, 0);
  }

  getPlannedSubscriptions(): PlannedSubscription[] {
    const fire = this.getCurrentFire();
    return (fire.plannedSubscriptions || []).filter(p => p.status === 'planned');
  }

  getActiveSubscriptions(): PlannedSubscription[] {
    const fire = this.getCurrentFire();
    return (fire.plannedSubscriptions || []).filter(p => p.status === 'active');
  }

  getInactiveSubscriptions(): PlannedSubscription[] {
    const fire = this.getCurrentFire();
    return (fire.plannedSubscriptions || []).filter(p => p.status === 'inactive');
  }

  /**
   * TrackBy function for payment plans to improve performance
   */
  trackByPlanId(index: number, plan: PlannedSubscription): string {
    return plan.id;
  }

  private getCurrentFire(): Fire {
    return AppStateService.instance.allFireEmergencies[InfoFireComponent.index];
  }

  private saveProject(message: string) {
    // Determine toast type based on message
    let toastType: 'success' | 'update' | 'delete' = 'success';
    if (message.includes('updated') || message.includes('activated') || message.includes('deactivated') || message.includes('reactivated')) {
      toastType = 'update';
    } else if (message.includes('deleted')) {
      toastType = 'delete';
    }
    
    const fire = this.getCurrentFire();
    fire.updatedAt = new Date().toISOString();
    this.persistence.writeAndSync({
      tag: 'fire',
      data: AppStateService.instance.allFireEmergencies,
      localStorageKey: 'fire',
      logEvent: 'update_fire_payment_plan',
      logMetadata: {
        title: fire.title,
        phase: fire.phase,
        action: message
      },
      onSuccess: () => {
        this.toastService.show(message, toastType);
      },
      onError: (error) => {
        console.error('Failed to save payment plan:', error);
      }
    });
  }
}
