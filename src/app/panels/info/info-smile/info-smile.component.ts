import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LocalService } from 'src/app/shared/services/local.service';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { IncomeStatementService } from 'src/app/shared/services/income-statement.service';
import { isDuplicateTitle } from 'src/app/shared/validation.utils';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { Smile, SmilePhase, SmileBucket, SmileLink, SmileActionItem, SmileNote } from 'src/app/interfaces/smile';
import { PlannedSubscription } from 'src/app/interfaces/planned-subscription';
import { generateBucketId } from 'src/app/shared/smile-migration.utils';
import { PaymentPlannerService } from 'src/app/shared/services/payment-planner.service';
import { SubscriptionActivationService } from 'src/app/shared/services/subscription-activation.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { PaymentPlannerDialogComponent } from 'src/app/shared/components/payment-planner-dialog/payment-planner-dialog.component';


// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let InfoComponent: any; setTimeout(() => import('../info.component').then(m => InfoComponent = m.InfoComponent));
let ProfileComponent: any; setTimeout(() => import('src/app/panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let AddSmileComponent: any; setTimeout(() => import('src/app/panels/add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
let SmileProjectsComponent: any; setTimeout(() => import('src/app/main/smile/smile-projects/smile-projects.component').then(m => SmileProjectsComponent = m.SmileProjectsComponent));
@Component({
  selector: 'app-info-smile',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe, AppDatePipe, PaymentPlannerDialogComponent],
  templateUrl: './info-smile.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', './info-smile.component.css']
})
export class InfoSmileComponent extends BaseInfoComponent {
  static index = 1;

  static title = "Driver Licence";
  static sub = "";
  static phase: SmilePhase = 'planning';
  static description = "";
  static buckets: SmileBucket[] = [];
  static links: SmileLink[] = [];
  static actionItems: SmileActionItem[] = [];
  static notes: SmileNote[] = [];
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
  static activeTab: 'overview' | 'buckets' | 'actions' | 'notes' | 'paymentPlans' = 'overview';

  static setInfoSmileComponent(id: number, project: Smile) {
    InfoSmileComponent.index = id;
    InfoSmileComponent.title = project.title;
    InfoSmileComponent.sub = project.sub || "";
    InfoSmileComponent.phase = project.phase || 'planning';
    InfoSmileComponent.description = project.description || "";
    InfoSmileComponent.buckets = project.buckets;
    InfoSmileComponent.links = project.links || [];
    InfoSmileComponent.actionItems = project.actionItems || [];
    InfoSmileComponent.notes = project.notes || [];
    InfoSmileComponent.plannedSubscriptions = project.plannedSubscriptions || [];
    InfoSmileComponent.createdAt = project.createdAt || '';
    InfoSmileComponent.updatedAt = project.updatedAt || '';
    InfoSmileComponent.targetDate = project.targetDate || '';
    InfoSmileComponent.completionDate = project.completionDate || '';
    InfoSmileComponent.isEdit = false;
    InfoSmileComponent.activeTab = 'overview';
    InfoSmileComponent.isInfo = true;
    if(InfoComponent?.isInfo){
      InfoSmileComponent.isInfo = false;
    }
  }

  titleTextField = InfoSmileComponent.title;
  subTextField = InfoSmileComponent.sub;
  phaseField: SmilePhase = InfoSmileComponent.phase;
  descriptionTextField = InfoSmileComponent.description;
  targetDateTextField = InfoSmileComponent.targetDate;
  completionDateTextField = InfoSmileComponent.completionDate;
  buckets: SmileBucket[] = [];
  links: SmileLink[] = [];
   actionItems: SmileActionItem[] = [];
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
  
  // Payment Plans
  isPaymentPlannerOpen = false;
  editingPlanIndex: number | null = null;
  
  get notesList(): SmileNote[] {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    return project?.notes || [];
  }

  get relatedTransactions() {
    // Find transactions that reference this smile project (by title or bucket comment tags)
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project) return [];
    
    const transactions = AppStateService.instance.allTransactions.filter(tx => {
      if (tx.category === `@${project.title}`) return true;
      // Check if transaction comment references any bucket by name
      if (tx.comment && project.buckets?.length) {
        return project.buckets.some(bucket => tx.comment.match(new RegExp(`#bucket:${bucket.title}:[\\d.]+`)));
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
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project) return [];
    
    // Find bucket by ID to get its name
    const bucket = project.buckets.find(b => b.id === bucketId);
    if (!bucket) return [];
    
    const transactions = AppStateService.instance.allTransactions.filter(tx => {
      // MUST be for this project first
      if (tx.category !== `@${project.title}`) return false;
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
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project) return tx.amount;
    
    const bucket = project.buckets.find(b => b.id === bucketId);
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
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project) return [];
    
    // Migrate old transactions without allocation tags
    this.migrateTransactionAllocations();
    
    const transactions = AppStateService.instance.allTransactions.filter(tx => {
      // Must be for this project
      if (tx.category !== `@${project.title}`) return false;
      
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
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project?.buckets?.length) return;
    
    AppStateService.instance.allTransactions.forEach(tx => {
      // Only migrate transactions for this project
      if (tx.category !== `@${project.title}`) return;
      
      // Check if already has allocation tags
      const hasAllocationTags = tx.comment?.match(/#bucket:[^:]+:[\d.]+/);
      if (hasAllocationTags) return; // Already migrated
      
      // Distribute amount equally across all current buckets and append tags
      const amountPerBucket = Math.abs(tx.amount) / project.buckets.length;
      const allocationTags = project.buckets
        .map(bucket => `#bucket:${bucket.title}:${amountPerBucket.toFixed(2)}`)
        .join(' ');
      
      tx.comment = tx.comment
        ? `${tx.comment}\n${allocationTags}`
        : allocationTags;
    });
  }

  /**
   * Get allocation details for a distributed transaction
   * Parses #bucket:Name:Amount tags from comment
   */
  getTransactionAllocations(tx: any): Array<{bucket: SmileBucket, amount: number}> {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project || !tx.comment) return [];
    
    const allocations: Array<{bucket: SmileBucket, amount: number}> = [];
    
    // Parse all #bucket:Name:Amount tags
    const bucketTagMatches = tx.comment.match(/#bucket:([^:]+):([\d.]+)/g);
    if (!bucketTagMatches) return [];
    
    bucketTagMatches.forEach(tag => {
      const match = tag.match(/#bucket:([^:]+):([\d.]+)/);
      if (match) {
        const bucketName = match[1];
        const amount = parseFloat(match[2]);
        const bucket = project.buckets.find(b => b.title === bucketName);
        if (bucket) {
          allocations.push({ bucket, amount });
        }
      }
    });
    
    return allocations;
  }

  /**
   * Calculate amount distributed to each bucket from a transaction
   * Reads from comment tags
   */
  getDistributionPerBucket(tx: any): number {
    const allocations = this.getTransactionAllocations(tx);
    if (allocations.length > 0) {
      return allocations[0].amount; // First allocation amount
    }
    // Fallback for transactions without tags
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project?.buckets?.length) return 0;
    return Math.abs(tx.amount) / project.buckets.length;
  }

  /**
   * Calculate total target amount across all buckets
   */
  getTotalTarget(): number {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project?.buckets?.length) return 0;
    return project.buckets.reduce((sum, bucket) => sum + (bucket.target || 0), 0);
  }

  /**
   * Calculate total saved amount across all buckets
   */
  getTotalAmount(): number {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project?.buckets?.length) return 0;
    return project.buckets.reduce((sum, bucket) => sum + (bucket.amount || 0), 0);
  }

  /**
   * Calculate overall progress percentage (0-100)
   */
  getOverallProgress(): number {
    const total = this.getTotalTarget();
    if (total === 0) return 0;
    return Math.min(100, (this.getTotalAmount() / total) * 100);
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
    if (InfoSmileComponent.sortColumn === column) {
      // Toggle direction
      InfoSmileComponent.sortDirection = InfoSmileComponent.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column - default to descending
      InfoSmileComponent.sortColumn = column;
      InfoSmileComponent.sortDirection = 'desc';
    }
  }

  /**
   * Get sort icon for column header.
   */
  getSortIcon(column: string): string {
    if (InfoSmileComponent.sortColumn !== column) return '';
    return InfoSmileComponent.sortDirection === 'asc' ? '▲' : '▼';
  }

  /**
   * Sort transactions array based on current sort column and direction.
   */
  sortTransactions(transactions: any[]): any[] {
    const sorted = [...transactions];
    
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (InfoSmileComponent.sortColumn) {
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
        return InfoSmileComponent.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return InfoSmileComponent.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    return sorted;
  }

  /**
   * Get bucket segments for stacked progress bar
   * Returns array of {bucket, percentage, color}
   */
  getBucketSegments(): Array<{bucket: SmileBucket, percentage: number, colorClass: string}> {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project?.buckets?.length) return [];
    
    const totalTarget = this.getTotalTarget();
    if (totalTarget === 0) return [];

    const colors = ['bucket-color-1', 'bucket-color-2', 'bucket-color-3', 'bucket-color-4', 'bucket-color-5'];
    
    return project.buckets.map((bucket, index) => ({
      bucket,
      percentage: (bucket.amount / totalTarget) * 100,
      colorClass: colors[index % colors.length]
    }));
  }

  deleteTransactionsChecked = true;

  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoSmileComponent;
  constructor(
    router: Router, 
    private localStorage: LocalService, 
    private persistence: PersistenceService, 
    private incomeStatement: IncomeStatementService,
    private paymentPlannerService: PaymentPlannerService,
    private subscriptionActivationService: SubscriptionActivationService
  ) {
    super(router);
    this.initStatic(InfoSmileComponent);
  }

  highlight() {
    InfoSmileComponent.zIndex = InfoSmileComponent.zIndex + 1;
    // Don't reset InfoComponent.zIndex to 0 - it might be displaying a transaction on top
    // InfoComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddSmileComponent.zIndex = 0;
  }

  add() {
    // General add without specific bucket - will distribute equally across all buckets
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    const totalRemaining = this.getTotalTarget() - this.getTotalAmount();
    
    AddComponent.categoryTextField = `@${InfoSmileComponent.title}`;
    AddComponent.selectedOption = "Smile";
    AddComponent.commentTextField = `${InfoSmileComponent.title} ${totalRemaining}`;
    
    AddComponent.url = "/smileprojects";
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
    InfoSmileComponent.isInfo = false;
  }

  addToBucket(bucketId: string, bucketTitle: string, bucketRemaining: number) {
    // Add to specific bucket with pre-filled comment using bucket name and amount
    bucketRemaining = Math.round(bucketRemaining * 100) / 100;
    AddComponent.categoryTextField = `@${InfoSmileComponent.title}`;
    AddComponent.selectedOption = "Smile";
    AddComponent.amountTextField = (bucketRemaining * -1).toString();
    AddComponent.commentTextField = `${InfoSmileComponent.title} ${bucketRemaining.toFixed(0)}\n#bucket:${bucketTitle}:${bucketRemaining.toFixed(2)}`;
    
    AddComponent.url = "/smileprojects";
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
    InfoSmileComponent.isInfo = false;
  }

  getNextPhase(): SmilePhase {
    const phases: SmilePhase[] = ['idea', 'planning', 'saving', 'ready', 'completed'];
    const currentIndex = phases.indexOf(InfoSmileComponent.phase);
    return phases[Math.min(currentIndex + 1, phases.length - 1)];
  }

  areAllBucketsFull(): boolean {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project?.buckets || project.buckets.length === 0) {
      return false; // No buckets means no restriction
    }
    
    // Check if ALL buckets are full
    return project.buckets.every(bucket => bucket.amount >= bucket.target);
  }

  advancePhase() {
    const nextPhase = this.getNextPhase();
    if (nextPhase !== InfoSmileComponent.phase) {
      const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
      console.log('[Advance Phase] Before update:', project.title, 'Current phase:', project.phase, 'Next phase:', nextPhase);
      
      project.phase = nextPhase;
      project.updatedAt = new Date().toISOString();
      
      // If advancing to completed, set completion date
      if (nextPhase === 'completed' && !project.completionDate) {
        project.completionDate = new Date().toISOString().split('T')[0];
      }
      
      InfoSmileComponent.phase = nextPhase;
      
      console.log('[Advance Phase] After update in memory:', project.title, 'Phase:', project.phase);
      console.log('[Advance Phase] Writing to persistence...', AppStateService.instance.allSmileProjects.map(p => ({ title: p.title, phase: p.phase })));
      
      this.persistence.writeAndSync({
        tag: 'smile',
        data: AppStateService.instance.allSmileProjects,
        localStorageKey: 'smile',
        logEvent: 'advance_smile_phase',
        logMetadata: { title: project.title, phase: nextPhase },
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
      // Set InfoComponent z-index much higher to appear on top of InfoSmileComponent
      // Use +10 instead of +1 to ensure it stays on top even if InfoSmileComponent is clicked
      InfoComponent.zIndex = InfoSmileComponent.zIndex + 10;
      
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

  // ── Link Management ──
  submitLink() {
    if (this.newLinkLabel && this.newLinkUrl) {
      const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
      if (!project.links) project.links = [];
      
      project.links.push({
        label: this.newLinkLabel,
        url: this.newLinkUrl
      });
      project.updatedAt = new Date().toISOString();
      
      this.newLinkLabel = '';
      this.newLinkUrl = '';
      this.showAddLink = false;
      
      InfoSmileComponent.links = project.links;
      
      this.persistence.writeAndSync({
        tag: 'smile',
        data: AppStateService.instance.allSmileProjects,
        localStorageKey: 'smile',
        logEvent: 'add_smile_link',
        logMetadata: { title: project.title },
        onSuccess: () => {
          this.toastService.show('Link added', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to add link');
        }
      });
    }
  }

  removeLink(index: number) {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (project.links) {
      project.links.splice(index, 1);
      project.updatedAt = new Date().toISOString();
      
      InfoSmileComponent.links = project.links;
      
      this.persistence.writeAndSync({
        tag: 'smile',
        data: AppStateService.instance.allSmileProjects,
        localStorageKey: 'smile',
        logEvent: 'remove_smile_link',
        logMetadata: { title: project.title },
        onSuccess: () => {
          this.toastService.show('Link removed', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to remove link');
        }
      });
    }
  }

  startEditLink(index: number) {
    this.editingLinkIndex = index;
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (project.links && project.links[index]) {
      this.editingLinkLabel = project.links[index].label;
      this.editingLinkUrl = project.links[index].url;
    }
  }

  saveEditLink(index: number) {
    if (this.editingLinkLabel.trim() && this.editingLinkUrl.trim()) {
      const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
      if (project.links && project.links[index]) {
        project.links[index].label = this.editingLinkLabel.trim();
        project.links[index].url = this.editingLinkUrl.trim();
        project.updatedAt = new Date().toISOString();
        
        InfoSmileComponent.links = project.links;
        
        this.editingLinkIndex = -1;
        this.editingLinkLabel = '';
        this.editingLinkUrl = '';
        
        this.persistence.writeAndSync({
          tag: 'smile',
          data: AppStateService.instance.allSmileProjects,
          localStorageKey: 'smile',
          logEvent: 'update_smile_link',
          logMetadata: { title: project.title },
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

  cancelEditLink() {
    this.editingLinkIndex = -1;
    this.editingLinkLabel = '';
    this.editingLinkUrl = '';
  }

  // ── Action Item Management ──
  submitActionItem() {
    if (this.newActionText) {
      const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
      if (!project.actionItems) project.actionItems = [];
      
      project.actionItems.push({
        text: this.newActionText,
        done: false,
        priority: this.newActionPriority,
        dueDate: this.newActionDueDate || undefined
      });
      project.updatedAt = new Date().toISOString();
      
      this.newActionText = '';
      this.newActionPriority = 'medium';
      this.newActionDueDate = '';
      this.showAddAction = false;
      
      InfoSmileComponent.actionItems = project.actionItems;
      
      this.persistence.writeAndSync({
        tag: 'smile',
        data: AppStateService.instance.allSmileProjects,
        localStorageKey: 'smile',
        logEvent: 'add_smile_action',
        logMetadata: { title: project.title },
        onSuccess: () => {
          this.toastService.show('Action added', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to add action');
        }
      });
    }
  }

  toggleActionItem(index: number) {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (project.actionItems && project.actionItems[index]) {
      project.actionItems[index].done = !project.actionItems[index].done;
      project.updatedAt = new Date().toISOString();
      
      InfoSmileComponent.actionItems = project.actionItems;
      
      this.persistence.writeAndSync({
        tag: 'smile',
        data: AppStateService.instance.allSmileProjects,
        localStorageKey: 'smile',
        logEvent: 'toggle_smile_action',
        logMetadata: { title: project.title },
        onSuccess: () => {
          this.toastService.show('Action updated', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to update action');
        }
      });
    }
  }

  removeActionItem(index: number) {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (project.actionItems) {
      project.actionItems.splice(index, 1);
      project.updatedAt = new Date().toISOString();
      
      InfoSmileComponent.actionItems = project.actionItems;
      
      this.persistence.writeAndSync({
        tag: 'smile',
        data: AppStateService.instance.allSmileProjects,
        localStorageKey: 'smile',
        logEvent: 'remove_smile_action',
        logMetadata: { title: project.title },
        onSuccess: () => {
          this.toastService.show('Action removed', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to remove action');
        }
      });
    }
  }

  startEditAction(index: number) {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (project.actionItems && project.actionItems[index]) {
      this.editingActionIndex = index;
      this.editingActionText = project.actionItems[index].text;
      this.editingActionPriority = project.actionItems[index].priority;
      this.editingActionDueDate = project.actionItems[index].dueDate || '';
    }
  }

  saveEditAction(index: number) {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (this.editingActionText.trim() && project.actionItems && project.actionItems[index]) {
      project.actionItems[index].text = this.editingActionText.trim();
      project.actionItems[index].priority = this.editingActionPriority;
      project.actionItems[index].dueDate = this.editingActionDueDate || undefined;
      project.updatedAt = new Date().toISOString();
      
      InfoSmileComponent.actionItems = project.actionItems;
      
      this.editingActionIndex = -1;
      this.editingActionText = '';
      this.editingActionPriority = 'medium';
      this.editingActionDueDate = '';
      
      this.persistence.writeAndSync({
        tag: 'smile',
        data: AppStateService.instance.allSmileProjects,
        localStorageKey: 'smile',
        logEvent: 'edit_smile_action',
        logMetadata: { title: project.title },
        onSuccess: () => {
          this.toastService.show('Action updated', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to update action');
        }
      });
    }
  }

  cancelEditAction() {
    this.editingActionIndex = -1;
    this.editingActionText = '';
    this.editingActionPriority = 'medium';
    this.editingActionDueDate = '';
  }

  // ── Bucket Management ──
  submitBucket() {
    if (this.newBucketTitle && this.newBucketTarget > 0) {
      this.buckets.push({
        id: generateBucketId(),
        title: this.newBucketTitle,
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
      this.showAddBucket = false;
    }
  }

  startEditBucket(index: number) {
    this.editingBucketIndex = index;
    this.editingBucketTitle = this.buckets[index].title;
    this.editingBucketTarget = this.buckets[index].target;
    this.editingBucketAmount = this.buckets[index].amount || 0;
    this.editBucketNotes = this.buckets[index].notes || '';
    this.editBucketTargetDate = this.buckets[index].targetDate || '';
  }

  saveEditBucket(index: number) {
    if (this.editingBucketTitle.trim() && this.editingBucketTarget > 0) {
      this.buckets[index].title = this.editingBucketTitle;
      this.buckets[index].target = Math.round(this.editingBucketTarget * 100) / 100;
      this.buckets[index].amount = Math.round(this.editingBucketAmount * 100) / 100;
      this.buckets[index].notes = this.editBucketNotes.trim();
      this.buckets[index].targetDate = this.editBucketTargetDate || undefined;
      this.cancelEditBucket();
    }
  }

  cancelEditBucket() {
    this.editingBucketIndex = -1;
    this.editingBucketTitle = '';
    this.editingBucketTarget = 0;
    this.editingBucketAmount = 0;
    this.editBucketNotes = '';
    this.editBucketTargetDate = '';
  }

  removeBucket(index: number) {
    this.buckets.splice(index, 1);
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

  // ── Note Management ──
  addNote() {
    if (this.newNoteText.trim()) {
      const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
      if (!project.notes) project.notes = [];
      
      project.notes.push({
        text: this.newNoteText,
        createdAt: new Date().toISOString()
      });
      project.updatedAt = new Date().toISOString();
      
      this.newNoteText = '';
      
      this.persistence.writeAndSync({
        tag: 'smile',
        data: AppStateService.instance.allSmileProjects,
        localStorageKey: 'smile',
        logEvent: 'add_smile_note',
        logMetadata: { title: project.title },
        onSuccess: () => {
          InfoSmileComponent.notes = project.notes;
          this.toastService.show('Note added', 'success');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to add note');
        }
      });
    }
  }

  startEditNote(index: number) {
    this.editingNoteIndex = index;
    this.editingNoteText = this.notesList[index].text;
  }

  saveEditNote(index: number) {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (project.notes && project.notes[index]) {
      project.notes[index].text = this.editingNoteText;
      project.updatedAt = new Date().toISOString();
      
      this.persistence.writeAndSync({
        tag: 'smile',
        data: AppStateService.instance.allSmileProjects,
        localStorageKey: 'smile',
        logEvent: 'update_smile_note',
        logMetadata: { title: project.title },
        onSuccess: () => {
          this.editingNoteIndex = -1;
          this.editingNoteText = '';
          this.toastService.show('Note updated', 'update');
        },
        onError: (error) => {
          this.showError(error.message || 'Failed to update note');
        }
      });
    }
  }

  cancelEditNote() {
    this.editingNoteIndex = -1;
    this.editingNoteText = '';
  }

  deleteNote(index: number) {
    this.confirmService.confirm('Delete this note?', () => {
      const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
      if (project.notes) {
        project.notes.splice(index, 1);
        project.updatedAt = new Date().toISOString();
        
        this.persistence.writeAndSync({
          tag: 'smile',
          data: AppStateService.instance.allSmileProjects,
          localStorageKey: 'smile',
          logEvent: 'delete_smile_note',
          logMetadata: { title: project.title },
          onSuccess: () => {
            InfoSmileComponent.notes = project.notes;
            this.toastService.show('Note deleted', 'delete');
          },
          onError: (error) => {
            this.showError(error.message || 'Failed to delete note');
          }
        });
      }
    });
  }

  override closeWindow() {
    InfoSmileComponent.isInfo = false;
    InfoSmileComponent.isEdit = false;
  }

  override cancel() {
    InfoSmileComponent.isEdit = false;
  }

  editSmileProject() {
    AppComponent.gotoTop();
    InfoSmileComponent.isEdit = true;
    InfoSmileComponent.isError = false;
    this.titleTextField = InfoSmileComponent.title;
    this.subTextField = InfoSmileComponent.sub;
    this.phaseField = InfoSmileComponent.phase;
    this.descriptionTextField = InfoSmileComponent.description;
    this.targetDateTextField = InfoSmileComponent.targetDate;
    this.completionDateTextField = InfoSmileComponent.completionDate;
    
    // Deep copy buckets, links, and action items for editing
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    this.buckets = project.buckets ? JSON.parse(JSON.stringify(project.buckets)) : [];
    this.links = project.links ? JSON.parse(JSON.stringify(project.links)) : [];
    this.actionItems = project.actionItems ? JSON.parse(JSON.stringify(project.actionItems)) : [];
  }

  invalidTitle(title: string) {
    return isDuplicateTitle(title, [AppStateService.instance.allSmileProjects]);
  }

  updateSmileProject() {
    // Validation
    if (this.titleTextField === "") {
      this.showError("Please enter a title.");
      return;
    }
    
    if (this.buckets.length === 0) {
      this.showError("Add at least one bucket to your Smile project.");
      return;
    }
    
    if (AppStateService.instance.allSmileProjects[InfoSmileComponent.index].title != this.titleTextField) {
      if (this.invalidTitle(this.titleTextField)) {
        this.showError("This smile project already exists.");
        return;
      }
    }
    
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    project.title = this.titleTextField;
    project.sub = this.subTextField;
    project.phase = this.phaseField;
    project.description = this.descriptionTextField;
    project.targetDate = this.targetDateTextField;
    project.completionDate = this.completionDateTextField;
    project.buckets = this.buckets;
    project.links = this.links;
    project.actionItems = this.actionItems;
    project.updatedAt = new Date().toISOString();
    
    // Update static properties
    InfoSmileComponent.title = this.titleTextField;
    InfoSmileComponent.sub = this.subTextField;
    InfoSmileComponent.phase = this.phaseField;
    InfoSmileComponent.description = this.descriptionTextField;
    InfoSmileComponent.targetDate = this.targetDateTextField;
    InfoSmileComponent.completionDate = this.completionDateTextField;
    InfoSmileComponent.buckets = this.buckets;
    InfoSmileComponent.links = this.links;
    InfoSmileComponent.actionItems = this.actionItems;
    
    this.persistence.writeAndSync({
      tag: 'smile',
      data: AppStateService.instance.allSmileProjects,
      localStorageKey: 'smile',
      logEvent: 'update_smile',
      logMetadata: {
        title: this.titleTextField,
        phase: this.phaseField,
        bucketCount: this.buckets.length
      },
      onSuccess: () => {
        this.clearError();
        InfoSmileComponent.isEdit = false;
        this.toastService.show('Smile project updated', 'update');
        AppComponent.gotoTop();
      },
      onError: (error) => {
        this.showError(error.message || 'Database write failed');
      }
    });
  }

  deleteSmile(index: number) {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteSmile'), () => {
      // Save title before deleting
      const deletedTitle = AppStateService.instance.allSmileProjects[index].title;
      
      // Track if we actually deleted any transactions
      let deletedTransactionsCount = 0;
      
      //remove all transactions
      if (this.deleteTransactionsChecked) {
        let found = true;
        while (found) {
          found = false;
          for (let i = 0; i < AppStateService.instance.allTransactions.length; i++) {
            if ("@" + deletedTitle === AppStateService.instance.allTransactions[i].category) {
              AppStateService.instance.allTransactions.splice(i, 1);
              deletedTransactionsCount++;
              found = true;
            }
          }
        }
      }

      //now delete smile project
      AppStateService.instance.allSmileProjects.splice(index, 1);

      // Recalculate income statement if transactions were actually deleted
      if (deletedTransactionsCount > 0) {
        this.incomeStatement.recalculate();
      }

      InfoSmileComponent.isInfo = false;
      InfoSmileComponent.isError = false;

      // Use batchWriteAndSync ONLY if transactions were actually deleted
      if (deletedTransactionsCount > 0) {
        // Note: Don't include 'smile' here as incomeStatement.getWrites() already includes it
        const writes: { tag: string, data: any }[] = [
          { tag: "transactions", data: AppStateService.instance.allTransactions },
          ...this.incomeStatement.getWrites()
        ];

        const localStorageSaves = [
          { key: 'smile', data: AppStateService.instance.allSmileProjects },
          { key: 'transactions', data: AppStateService.instance.allTransactions }
        ];

        this.persistence.batchWriteAndSync({
          writes,
          localStorageSaves,
          logEvent: 'delete_smile',
          logMetadata: { title: deletedTitle, index: index, deletedTransactions: deletedTransactionsCount },
          onSuccess: () => {
            this.incomeStatement.saveToLocalStorage();
            this.toastService.show('Smile project deleted', 'delete');
            AppComponent.gotoTop();
            this.router.navigate(['/smileprojects']);
          },
          onError: (error) => {
            this.showError(error.message || 'Database write failed');
          }
        });
      } else {
        // Simple delete - just smile project (no transactions were deleted)
        this.persistence.writeAndSync({
          tag: 'smile',
          data: AppStateService.instance.allSmileProjects,
          localStorageKey: 'smile',
          logEvent: 'delete_smile',
          logMetadata: { title: deletedTitle, index: index },
          onSuccess: () => {
            this.toastService.show('Smile project deleted', 'delete');
            AppComponent.gotoTop();
            this.router.navigate(['/smileprojects']);
          },
          onError: (error) => {
            this.showError(error.message || 'Database write failed');
          }
        });
      }
    });
  }

  // =========== Payment Plans ===========

  /**
   * Open payment planner dialog to create new plan
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
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    if (!project.plannedSubscriptions) {
      project.plannedSubscriptions = [];
    }
    project.plannedSubscriptions.push(plan);
    InfoSmileComponent.plannedSubscriptions = project.plannedSubscriptions;
    
    this.isPaymentPlannerOpen = false;
    this.saveProject('Payment plan created');
  }

  /**
   * Handle payment plan updated
   */
  onPlanUpdated(plan: PlannedSubscription): void {
    if (this.editingPlanIndex !== null) {
      const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
      if (project.plannedSubscriptions) {
        project.plannedSubscriptions[this.editingPlanIndex] = plan;
        InfoSmileComponent.plannedSubscriptions = project.plannedSubscriptions;
      }
      this.isPaymentPlannerOpen = false;
      this.editingPlanIndex = null;
      this.saveProject('Payment plan updated');
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
   * Activate a planned subscription
   */
  activatePaymentPlan(planIndex: number): void {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    const plan = project.plannedSubscriptions?.[planIndex];
    
    if (!plan || plan.status !== 'planned') return;
    
    this.confirmService.confirm(
      `Activate payment plan "${plan.title}"? This will create a recurring subscription.`,
      () => {
        this.subscriptionActivationService.activatePlannedSubscription(plan, project);
        InfoSmileComponent.plannedSubscriptions = project.plannedSubscriptions || [];
        this.saveProject('Payment plan activated');
      },
      'Smile.paymentPlans.activate',
      'primary'
    );
  }

  /**
   * Deactivate an active subscription
   */
  deactivatePaymentPlan(planIndex: number): void {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    const plan = project.plannedSubscriptions?.[planIndex];
    
    if (!plan || plan.status !== 'active') return;
    
    this.confirmService.confirm(
      `Deactivate payment plan "${plan.title}"? The subscription will be removed.`,
      () => {
        this.subscriptionActivationService.deactivatePlannedSubscription(plan, project);
        InfoSmileComponent.plannedSubscriptions = project.plannedSubscriptions || [];
        this.saveProject('Payment plan deactivated');
      },
      'Smile.paymentPlans.deactivate',
      'delete'
    );
  }

  /**
   * Reactivate an inactive subscription
   */
  reactivatePaymentPlan(planIndex: number): void {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    const plan = project.plannedSubscriptions?.[planIndex];
    
    if (!plan || plan.status !== 'inactive') return;
    
    this.confirmService.confirm(
      `Reactivate payment plan "${plan.title}"?`,
      () => {
        this.subscriptionActivationService.reactivatePlannedSubscription(plan, project);
        InfoSmileComponent.plannedSubscriptions = project.plannedSubscriptions || [];
        this.saveProject('Payment plan reactivated');
      },
      'Smile.paymentPlans.reactivate',
      'primary'
    );
  }

  /**
   * Delete a payment plan
   */
  deletePaymentPlan(planIndex: number): void {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    const plan = project.plannedSubscriptions?.[planIndex];
    
    if (!plan) return;
    
    this.confirmService.confirm(
      `Delete payment plan "${plan.title}"?`,
      () => {
        this.subscriptionActivationService.deletePlannedSubscription(plan.id, project);
        InfoSmileComponent.plannedSubscriptions = project.plannedSubscriptions || [];
        this.saveProject('Payment plan deleted');
      }
    );
  }

  /**
   * Duplicate a payment plan
   */
  duplicatePaymentPlan(planIndex: number): void {
    const project = AppStateService.instance.allSmileProjects[InfoSmileComponent.index];
    const plan = project.plannedSubscriptions?.[planIndex];
    
    if (!plan) return;
    
    // Create a copy with new ID and reset status
    const duplicate: PlannedSubscription = {
      ...plan,
      id: `plan_${Date.now()}`,
      title: `${plan.title} (Copy)`,
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activatedAt: undefined,
      deactivatedAt: undefined
    };
    
    if (!project.plannedSubscriptions) {
      project.plannedSubscriptions = [];
    }
    project.plannedSubscriptions.push(duplicate);
    InfoSmileComponent.plannedSubscriptions = project.plannedSubscriptions;
    
    this.saveProject('Payment plan duplicated');
  }

  /**
   * Get bucket name by ID
   */
  getBucketNameById(bucketId: string): string {
    const bucket = InfoSmileComponent.buckets.find(b => b.id === bucketId);
    return bucket ? bucket.title : 'Unknown';
  }

  /**
   * Calculate total monthly commitment across all planned subscriptions
   */
  calculateTotalMonthlyCommitment(): number {
    return this.paymentPlannerService.calculateTotalMonthlyCommitment(
      InfoSmileComponent.plannedSubscriptions
    );
  }

  /**
   * Get planned subscriptions only
   */
  getPlannedSubscriptions(): PlannedSubscription[] {
    return InfoSmileComponent.plannedSubscriptions.filter(p => p.status === 'planned');
  }

  /**
   * Get active subscriptions only
   */
  getActiveSubscriptions(): PlannedSubscription[] {
    return InfoSmileComponent.plannedSubscriptions.filter(p => p.status === 'active');
  }

  /**
   * Get inactive subscriptions only
   */
  getInactiveSubscriptions(): PlannedSubscription[] {
    return InfoSmileComponent.plannedSubscriptions.filter(p => p.status === 'inactive');
  }

  /**
   * TrackBy function for payment plans to improve performance
   */
  trackByPlanId(index: number, plan: PlannedSubscription): string {
    return plan.id;
  }

  /**
   * Helper to save project after payment plan changes
   */
  private saveProject(message: string): void {
    // Determine toast type based on message
    let toastType: 'success' | 'update' | 'delete' = 'success';
    if (message.includes('updated') || message.includes('activated') || message.includes('deactivated') || message.includes('reactivated')) {
      toastType = 'update';
    } else if (message.includes('deleted')) {
      toastType = 'delete';
    }
    
    this.persistence.writeAndSync({
      tag: 'smile',
      data: AppStateService.instance.allSmileProjects,
      localStorageKey: 'smile',
      logEvent: 'update_smile_payment_plan',
      logMetadata: { title: InfoSmileComponent.title },
      onSuccess: () => {
        this.toastService.show(message, toastType);
      },
      onError: (error) => {
        this.showError(error.message || 'Database write failed');
      }
    });
  }
}
