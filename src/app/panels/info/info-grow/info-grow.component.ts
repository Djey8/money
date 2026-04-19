import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { Share } from 'src/app/interfaces/share';
import { Investment } from 'src/app/interfaces/investment';
import { Liability } from 'src/app/interfaces/liability';
import { Asset } from 'src/app/interfaces/asset';
import { Grow, GrowPhase, GrowLink, GrowActionItem, GrowNote, GrowType } from 'src/app/interfaces/grow';
import { isDuplicateTitle } from 'src/app/shared/validation.utils';
import { BaseInfoComponent } from 'src/app/shared/base/base-info.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { IncomeStatementService } from 'src/app/shared/services/income-statement.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';

// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let GrowComponent: any; setTimeout(() => import('../../../main/grow/grow.component').then(m => GrowComponent = m.GrowComponent));
let BalanceComponent: any; setTimeout(() => import('../../../main/cashflow/balance/balance.component').then(m => BalanceComponent = m.BalanceComponent));
let AddGrowComponent: any; setTimeout(() => import('src/app/panels/add/add-grow/add-grow.component').then(m => AddGrowComponent = m.AddGrowComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let ProfileComponent: any; setTimeout(() => import('src/app/panels/profile/profile.component').then(m => ProfileComponent = m.ProfileComponent));
let InfoComponent: any; setTimeout(() => import('../info.component').then(m => InfoComponent = m.InfoComponent));
@Component({
  selector: 'app-info-grow',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule, AppNumberPipe, AppDatePipe],
  templateUrl: './info-grow.component.html',
  styleUrls: ['../../../shared/styles/info-panel.css', '../../../shared/styles/add-form.css', './info-grow.component.css']
})
export class InfoGrowComponent extends BaseInfoComponent {
  static index = 1;

  static title = "";
  static sub = "";
  static type: GrowType = 'income-growth';
  static phase: GrowPhase = 'idea';
  static description = "";
  static strategy = "";
  static riskScore = 0;
  static risks = "";
  static amount = 0.0;
  static cashflow = 0.0;
  static isAsset = false;
  static share = null;
  static investment = null;
  static liabilitie = null;
  // Expense optimization fields
  static category: string | string[] = "";
  static currentCost = 0.0;
  static targetCost = 0.0;
  static monthlySavings = 0.0;
  static annualSavings = 0.0;
  static reasoning = "";
  static alternative = "";
  static alternativeCost = 0.0;
  static pattern = "";
  static insights = "";
  static links: GrowLink[] = [];
  static actionItems: GrowActionItem[] = [];
  static notes: GrowNote[] = [];
  static createdAt = "";
  static updatedAt = "";

  static isLoan = false;
  static isInvestment = false;
  static isShare = false;

  static isEdit = false;

  // Current detail tab
  static activeTab: 'overview' | 'actions' | 'notes' | 'financials' = 'overview';

  static setInfoGrowComponent(id: number, project: Grow) {
    InfoGrowComponent.index = id;
    InfoGrowComponent.title = project.title;
    InfoGrowComponent.sub = project.sub;
    InfoGrowComponent.type = project.type || 'income-growth';
    InfoGrowComponent.phase = project.phase || 'idea';
    InfoGrowComponent.description = project.description;
    InfoGrowComponent.strategy = project.strategy;
    InfoGrowComponent.riskScore = project.riskScore || 0;
    InfoGrowComponent.risks = project.risks;
    InfoGrowComponent.amount = project.amount;
    InfoGrowComponent.cashflow = project.cashflow;
    InfoGrowComponent.isAsset = project.isAsset;
    InfoGrowComponent.share = project.share;
    InfoGrowComponent.investment = project.investment;
    InfoGrowComponent.liabilitie = project.liabilitie;
    // Expense optimization fields
    InfoGrowComponent.category = project.category || '';
    InfoGrowComponent.currentCost = project.currentCost || 0;
    InfoGrowComponent.targetCost = project.targetCost || 0;
    InfoGrowComponent.monthlySavings = project.monthlySavings || 0;
    InfoGrowComponent.annualSavings = project.annualSavings || 0;
    InfoGrowComponent.reasoning = project.reasoning || '';
    InfoGrowComponent.alternative = project.alternative || '';
    InfoGrowComponent.alternativeCost = project.alternativeCost || 0;
    InfoGrowComponent.pattern = project.pattern || '';
    InfoGrowComponent.insights = project.insights || '';
    InfoGrowComponent.links = project.links || [];
    InfoGrowComponent.actionItems = project.actionItems || [];
    InfoGrowComponent.notes = project.notes || [];
    InfoGrowComponent.createdAt = project.createdAt || '';
    InfoGrowComponent.updatedAt = project.updatedAt || '';
    InfoGrowComponent.isLoan = project.liabilitie != null;
    InfoGrowComponent.isShare = project.share != null;
    InfoGrowComponent.isInvestment = project.investment != null;

    InfoGrowComponent.isEdit = false;
    InfoGrowComponent.activeTab = 'overview';
    InfoGrowComponent.isInfo = true;
    if(InfoComponent.isInfo){
      InfoGrowComponent.isInfo = false;
    }
  }

  

  showCreditOptions = false;

  titleTextField = InfoGrowComponent.title;
  subTextField = InfoGrowComponent.sub;
  typeField: GrowType = InfoGrowComponent.type;
  phaseField: GrowPhase = InfoGrowComponent.phase;
  descriptionTextField = InfoGrowComponent.description;
  strategyTextField = InfoGrowComponent.strategy;
  risksTextField = InfoGrowComponent.risks;
  riskScoreField = InfoGrowComponent.riskScore;
  amountTextField = InfoGrowComponent.amount;
  cashflowTextField = InfoGrowComponent.cashflow;
  // Expense optimization fields
  categoryArray: string[] = [];
  newCategoryInput = "";
  currentCostTextField = InfoGrowComponent.currentCost;
  targetCostTextField = InfoGrowComponent.targetCost;
  monthlySavingsTextField = InfoGrowComponent.monthlySavings;
  annualSavingsTextField = InfoGrowComponent.annualSavings;
  reasoningTextField = InfoGrowComponent.reasoning;
  alternativeTextField = InfoGrowComponent.alternative;
  alternativeCostTextField = InfoGrowComponent.alternativeCost;
  patternTextField = InfoGrowComponent.pattern;
  insightsTextField = InfoGrowComponent.insights;
  notesTextField = '';
  showAddLink = false;
  showAddAction = false;
  showStrategySection = false;
  showFinancialsSection = false;
  showLinksActionsSection = false;
  newNoteText = '';
  editingNoteIndex = -1;
  editingNoteText = '';
  share = InfoGrowComponent.share;
  investment = InfoGrowComponent.investment;
  liabilitie = InfoGrowComponent.liabilitie;
  loanTextField = InfoGrowComponent.liabilitie ? InfoGrowComponent.liabilitie.amount : 0;
  creditTextField = InfoGrowComponent.liabilitie ? InfoGrowComponent.liabilitie.credit : 0;
  mortageTextField = InfoGrowComponent.investment ? InfoGrowComponent.investment.mortage : 0;
  quantityTextField = InfoGrowComponent.share ? InfoGrowComponent.share.quantity : 0;
  priceTextField = InfoGrowComponent.share ? InfoGrowComponent.share.price : 0;


  static zIndex;
  static isInfo;
  static isError;
  public classReference = InfoGrowComponent;
  public settingsReference = SettingsComponent;
  constructor(router: Router, private persistence: PersistenceService, private incomeStatement: IncomeStatementService) {
    super(router);
    this.initStatic(InfoGrowComponent);
  }

  toggleAsset() {
    InfoGrowComponent.isAsset = !InfoGrowComponent.isAsset;
    InfoGrowComponent.isInvestment = false;
    InfoGrowComponent.isShare = false;
  }

  toggleShare() {
    InfoGrowComponent.isShare = !InfoGrowComponent.isShare;
    InfoGrowComponent.isAsset = false;
    InfoGrowComponent.isInvestment = false;
  }

  toggleInvestment() {
    InfoGrowComponent.isInvestment = !InfoGrowComponent.isInvestment;
    InfoGrowComponent.isAsset = false;
    InfoGrowComponent.isShare = false;
  }

  toggleCreditOptions() {
    this.showCreditOptions = !this.showCreditOptions;
  }

  isExpenseType(): boolean {
    return this.typeField !== 'income-growth';
  }

  highlight() {
    InfoGrowComponent.zIndex = InfoGrowComponent.zIndex + 1;
    InfoGrowComponent.zIndex = 0;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    AddComponent.zIndex = 0;
    AddGrowComponent.zIndex = 0;
  }

  override closeWindow() {
    this.classReference.isInfo = false;
    InfoGrowComponent.isEdit = false;
  }

  /**
   * Adds an amount to a Smile Project.
   * @param index - The index of the Smile Project.
   */
  paybackProject(index: number) {
    // find liabilitie index
    let idx = -1;
    for (let i = 0; i < AppStateService.instance.liabilities.length; i++) {
      if (AppStateService.instance.liabilities[i].tag === AppStateService.instance.allGrowProjects[index].title){
        idx = i;
      }
    }
    if (idx != -1){
      AppComponent.gotoTop();
      AddComponent.categoryTextField = `@${AppStateService.instance.liabilities[idx].tag}`;
      AddComponent.url = "/grow";
      AddComponent.commentTextField = "Payback Liabilitie " + AppStateService.instance.liabilities[idx].amount + " " + AppStateService.instance.liabilities[idx].credit + ";";
      AddComponent.amountTextField = "-1";
      AddComponent.selectedOption = "Fire";
      AddComponent.isLiabilitie = false;
      InfoGrowComponent.isInfo = false;
      AddComponent.isAdd = true;
      MenuComponent.isMenu = false;
      InfoComponent.isInfo = false;
    }
  }

  editGrowProject() {
    AppComponent.gotoTop();
    InfoGrowComponent.isEdit = true;
    InfoGrowComponent.isError = false;
    this.titleTextField = InfoGrowComponent.title;
    this.subTextField = InfoGrowComponent.sub;
    this.typeField = InfoGrowComponent.type;
    this.phaseField = InfoGrowComponent.phase;
    this.amountTextField = InfoGrowComponent.amount;
    this.descriptionTextField = InfoGrowComponent.description;
    this.strategyTextField = InfoGrowComponent.strategy;
    this.risksTextField = InfoGrowComponent.risks;
    this.riskScoreField = InfoGrowComponent.riskScore;
    this.cashflowTextField = InfoGrowComponent.cashflow;
    // Expense optimization fields - initialize category array
    const currentCat = InfoGrowComponent.category;
    this.categoryArray = Array.isArray(currentCat) ? [...currentCat] : (currentCat ? [currentCat] : []);
    this.newCategoryInput = "";
    this.currentCostTextField = InfoGrowComponent.currentCost;
    this.targetCostTextField = InfoGrowComponent.targetCost;
    this.monthlySavingsTextField = InfoGrowComponent.monthlySavings;
    this.annualSavingsTextField = InfoGrowComponent.annualSavings;
    this.reasoningTextField = InfoGrowComponent.reasoning;
    this.alternativeTextField = InfoGrowComponent.alternative;
    this.alternativeCostTextField = InfoGrowComponent.alternativeCost;
    this.notesTextField = '';
    // Initialize links and action items
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    this.links = project.links || [];
    this.actionItems = project.actionItems || [];
    this.share = InfoGrowComponent.share;
    this.investment = InfoGrowComponent.investment;
    this.liabilitie = InfoGrowComponent.liabilitie;
    this.loanTextField = InfoGrowComponent.liabilitie ? InfoGrowComponent.liabilitie.amount : 0;
    this.creditTextField = InfoGrowComponent.liabilitie ? InfoGrowComponent.liabilitie.credit : 0;
    this.priceTextField = InfoGrowComponent.share ? InfoGrowComponent.share.price : 0;
    this.quantityTextField = InfoGrowComponent.share ? InfoGrowComponent.share.quantity : 0;
    this.mortageTextField = InfoGrowComponent.investment ? InfoGrowComponent.investment.amount : 0;
    this.showCreditOptions = false;
  }
  override cancel() {
    InfoGrowComponent.isEdit = false;
  }

  invalidTitle(title: string) {
    return isDuplicateTitle(title, [AppStateService.instance.allGrowProjects]);
  }

  updateGrowProject() {
    //Validation (check if Amount is not empty)
    if (this.titleTextField == "") {
      this.showError("Please fill out all required fields.");
    } else {
      if (AppStateService.instance.allGrowProjects[InfoGrowComponent.index].title != this.titleTextField) {
        if (this.invalidTitle(this.titleTextField)) {
          this.showError("This grow project already exists.");
        }
      }
      let isInvest = InfoGrowComponent.isAsset || InfoGrowComponent.isShare || InfoGrowComponent.isInvestment

      let liabilitie: Liability = null
      if(InfoGrowComponent.isLoan){
        if (this.loanTextField === "" || this.loanTextField === "0") {
          this.showError("Please fill out all required field (Loan).");
        } else {
          if(this.showCreditOptions){
              if (this.creditTextField === "") {
                this.creditTextField = "0";
              }
              this.creditTextField = Math.round(parseFloat(this.loanTextField) * (parseFloat(this.creditTextField) / 100) * 100) / 100;
          }
          liabilitie = {tag: this.titleTextField, amount: this.loanTextField, credit: this.creditTextField, investment: isInvest}
        }
      }

      let share: Share = null
      if(InfoGrowComponent.isShare){
        if (this.quantityTextField === "" || this.priceTextField === "") {
          this.showError("Please fill out all required fields (Quantity, Price).");
        } else {
          share = {tag: this.titleTextField, quantity: this.quantityTextField, price: this.priceTextField}
          this.amountTextField = parseFloat(this.quantityTextField) * parseFloat(this.priceTextField) - parseFloat(this.loanTextField);
          for(let i = 0; i < AppStateService.instance.allShares.length; i++){
            if(this.titleTextField == AppStateService.instance.allShares[i].tag){
              AppStateService.instance.allShares[i].price = parseFloat(this.priceTextField);
            }
          }
        }
      }

      let investment: Investment = null
      if(InfoGrowComponent.isInvestment){
        if (this.mortageTextField === "" || this.mortageTextField === "0") {
          this.showError("Please fill out all required fields (Mortage).");
        } else {
            let deposit = Number(this.amountTextField) + parseFloat(this.loanTextField);
            investment = {tag: this.titleTextField, deposit: deposit, amount: this.mortageTextField}
        }
      }
      if (!InfoGrowComponent.isError) {
        const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
        project.title = this.titleTextField;
        project.sub = this.subTextField;
        project.type = this.typeField;
        project.phase = this.phaseField;
        project.amount = this.amountTextField;
        project.description = this.descriptionTextField;
        project.strategy = this.strategyTextField;
        project.riskScore = this.riskScoreField;
        project.risks = this.risksTextField;
        project.cashflow = this.cashflowTextField;
        project.isAsset = InfoGrowComponent.isAsset;
        project.share = share;
        project.investment = investment;
        project.liabilitie = liabilitie;
        // Expense optimization fields
        project.category = this.isExpenseType() && this.categoryArray.length > 0 ? (this.categoryArray.length === 1 ? this.categoryArray[0] : this.categoryArray) : undefined;
        project.currentCost = this.roundToTwo(this.isExpenseType() && this.currentCostTextField ? parseFloat(String(this.currentCostTextField)) : undefined);
        project.targetCost = this.roundToTwo(this.isExpenseType() && this.targetCostTextField ? parseFloat(String(this.targetCostTextField)) : undefined);
        project.monthlySavings = this.roundToTwo(this.isExpenseType() && this.monthlySavingsTextField ? parseFloat(String(this.monthlySavingsTextField)) : undefined);
        project.annualSavings = this.roundToTwo(this.isExpenseType() && this.annualSavingsTextField ? parseFloat(String(this.annualSavingsTextField)) : undefined);
        project.reasoning = this.isExpenseType() && this.reasoningTextField ? this.reasoningTextField : undefined;
        project.alternative = this.typeField === 'subscription-action' && this.alternativeTextField ? this.alternativeTextField : undefined;
        project.alternativeCost = this.typeField === 'subscription-action' && this.alternativeCostTextField ? parseFloat(String(this.alternativeCostTextField)) : undefined;
        project.pattern = this.typeField === 'expense-insight' && this.patternTextField ? this.patternTextField : undefined;
        project.insights = this.typeField === 'expense-insight' && this.insightsTextField ? this.insightsTextField : undefined;
        // Save links and action items
        project.links = this.links;
        project.actionItems = this.actionItems;
        project.updatedAt = new Date().toISOString();

        InfoGrowComponent.title = this.titleTextField;
        InfoGrowComponent.sub = this.subTextField;
        InfoGrowComponent.phase = this.phaseField;
        InfoGrowComponent.amount = this.amountTextField;
        InfoGrowComponent.description = this.descriptionTextField;
        InfoGrowComponent.strategy = this.strategyTextField;
        InfoGrowComponent.riskScore = this.riskScoreField;
        InfoGrowComponent.risks = this.risksTextField;
        InfoGrowComponent.cashflow = this.cashflowTextField;
        InfoGrowComponent.share = share;
        InfoGrowComponent.investment = investment;
        InfoGrowComponent.liabilitie = liabilitie;

        InfoGrowComponent.isEdit = false;
        InfoGrowComponent.isInfo = false;
        AppStateService.instance.isSaving = true;

        this.persistence.writeAndSync({
          tag: 'grow',
          data: AppStateService.instance.allGrowProjects,
          localStorageKey: 'grow',
          logEvent: 'update_grow',
          logMetadata: {
            title: this.titleTextField,
            hasLoan: InfoGrowComponent.isLoan,
            hasShare: InfoGrowComponent.isShare,
            hasInvestment: InfoGrowComponent.isInvestment
          },
          onSuccess: () => {
            AppStateService.instance.isSaving = false;
            this.clearError();
            this.toastService.show('Grow project updated', 'update');
            AppComponent.gotoTop();
          },
          onError: (error) => {
            AppStateService.instance.isSaving = false;
            this.toastService.show(error.message || 'Database write failed', 'error');
          }
        });
      }
    }
  }

  deleteGrow(index: number) {
    this.confirmService.confirm(this.translate.instant('Confirm.deleteGrow'), () => {
      // Save title before deleting
      const deletedTitle = AppStateService.instance.allGrowProjects[index].title;
    
    //remove all transactions
    let found = true;
    while (found) {
      found = false;
      for (let i = 0; i < AppStateService.instance.allTransactions.length; i++) {
        if ("@" + deletedTitle === AppStateService.instance.allTransactions[i].category) {
          AppStateService.instance.allTransactions.splice(i, 1);
          found = true;
        }
      }
    }

    try {
      //update database
      //now delete grow project
      AppStateService.instance.allGrowProjects.splice(index, 1);

      // Recalculate income statement after removing transactions
      this.incomeStatement.recalculate();

      const writes = [
        { tag: "transactions", data: AppStateService.instance.allTransactions },
        { tag: "grow", data: AppStateService.instance.allGrowProjects },
        ...this.incomeStatement.getWrites()
      ];

      InfoGrowComponent.isInfo = false;
      InfoGrowComponent.isError = false;
      AppStateService.instance.isSaving = true;

      this.persistence.batchWriteAndSync({
        writes,
        localStorageSaves: [
          { key: 'transactions', data: JSON.stringify(AppStateService.instance.allTransactions) },
          { key: 'grow', data: JSON.stringify(AppStateService.instance.allGrowProjects) }
        ],
        logEvent: 'delete_grow',
        logMetadata: { title: deletedTitle, index: index },
        onSuccess: () => {
          AppStateService.instance.isSaving = false;
          this.incomeStatement.saveToLocalStorage();
          this.toastService.show('Grow project deleted', 'delete');
          AppComponent.gotoTop();
          this.router.navigate(['/grow']);
        },
        onError: (error) => {
          AppStateService.instance.isSaving = false;
          this.toastService.show(error.message || 'Database write failed', 'error');
        }
      });
    } catch (error) {
      this.showError(error.message || 'Error occurred');
    }
    });
  }

  // --- Action Item Management ---

  toggleActionItem(itemIndex: number) {
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (project.actionItems && project.actionItems[itemIndex]) {
      project.actionItems[itemIndex].done = !project.actionItems[itemIndex].done;
      project.updatedAt = new Date().toISOString();
      this.persistProject();
    }
  }

  addActionItem(text: string, priority: 'low' | 'medium' | 'high' = 'medium') {
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (!project.actionItems) project.actionItems = [];
    project.actionItems.push({ text, done: false, priority });
    project.updatedAt = new Date().toISOString();
    InfoGrowComponent.actionItems = project.actionItems;
    this.persistProject();
  }

  removeActionItem(itemIndex: number) {
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (project.actionItems) {
      project.actionItems.splice(itemIndex, 1);
      project.updatedAt = new Date().toISOString();
      InfoGrowComponent.actionItems = project.actionItems;
      this.persistProject();
    }
  }

  startEditAction(index: number) {
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (project.actionItems && project.actionItems[index]) {
      this.editingActionIndex = index;
      this.editingActionText = project.actionItems[index].text;
      this.editingActionPriority = project.actionItems[index].priority;
      this.editingActionDueDate = project.actionItems[index].dueDate || '';
    }
  }

  saveEditAction(index: number) {
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (this.editingActionText.trim() && project.actionItems && project.actionItems[index]) {
      project.actionItems[index].text = this.editingActionText.trim();
      project.actionItems[index].priority = this.editingActionPriority;
      project.actionItems[index].dueDate = this.editingActionDueDate || undefined;
      project.updatedAt = new Date().toISOString();
      InfoGrowComponent.actionItems = project.actionItems;
      this.cancelEditAction();
      this.persistProject();
    }
  }

  cancelEditAction() {
    this.editingActionIndex = -1;
    this.editingActionText = '';
    this.editingActionPriority = 'medium';
    this.editingActionDueDate = '';
  }

  addLink(label: string, url: string) {
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (!project.links) project.links = [];
    project.links.push({ label, url });
    project.updatedAt = new Date().toISOString();
    InfoGrowComponent.links = project.links;
    this.persistProject();
  }

  removeLink(linkIndex: number) {
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (project.links) {
      project.links.splice(linkIndex, 1);
      project.updatedAt = new Date().toISOString();
      InfoGrowComponent.links = project.links;
      this.persistProject();
    }
  }

  startEditLink(index: number) {
    this.editingLinkIndex = index;
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (project.links && project.links[index]) {
      this.editingLinkLabel = project.links[index].label;
      this.editingLinkUrl = project.links[index].url;
    }
  }

  saveEditLink(index: number) {
    if (this.editingLinkLabel.trim() && this.editingLinkUrl.trim()) {
      const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
      if (project.links && project.links[index]) {
        project.links[index].label = this.editingLinkLabel.trim();
        project.links[index].url = this.editingLinkUrl.trim();
        project.updatedAt = new Date().toISOString();
        InfoGrowComponent.links = project.links;
        
        this.editingLinkIndex = -1;
        this.editingLinkLabel = '';
        this.editingLinkUrl = '';
        
        this.persistProject();
      }
    }
  }

  cancelEditLink() {
    this.editingLinkIndex = -1;
    this.editingLinkLabel = '';
    this.editingLinkUrl = '';
  }

  getNextPhase(): GrowPhase {
    const order: GrowPhase[] = ['idea', 'research', 'plan', 'execute', 'monitor', 'completed'];
    const idx = order.indexOf(this.classReference.phase);
    return idx < order.length - 1 ? order[idx + 1] : 'completed';
  }

  advancePhase() {
    const order: GrowPhase[] = ['idea', 'research', 'plan', 'execute', 'monitor', 'completed'];
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    const idx = order.indexOf(project.phase);
    if (idx < order.length - 1) {
      project.phase = order[idx + 1];
      project.updatedAt = new Date().toISOString();
      InfoGrowComponent.phase = project.phase;
      this.persistProject();
    }
  }

  setPhase(phase: GrowPhase) {
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    project.phase = phase;
    project.updatedAt = new Date().toISOString();
    InfoGrowComponent.phase = phase;
    this.persistProject();
  }

  // Category array helpers
  isCategoryArray(category: string | string[] | undefined): boolean {
    return Array.isArray(category);
  }

  getCategoryArray(category: string | string[] | undefined): string[] {
    return Array.isArray(category) ? category : [];
  }

  /**
   * Get unique categories from all transactions, sorted alphabetically
   */
  getExistingCategories(): string[] {
    const categories = new Set<string>();
    // Iterate in reverse to preserve most recently used order
    for (let i = AppStateService.instance.allTransactions.length - 1; i >= 0; i--) {
      const tx = AppStateService.instance.allTransactions[i];
      if (tx.category && tx.category.trim()) {
        categories.add(tx.category.trim());
      }
    }
    return Array.from(categories);
  }

  addCategoryFromDropdown() {
    const cat = this.newCategoryInput.trim();
    if (cat && cat !== '' && !this.categoryArray.includes(cat)) {
      this.categoryArray.push(cat);
      this.newCategoryInput = "";
    }
  }

  addCategory() {
    const cat = this.newCategoryInput.trim();
    if (cat && !this.categoryArray.includes(cat)) {
      this.categoryArray.push(cat);
      this.newCategoryInput = "";
    }
  }

  removeCategory(index: number) {
    this.categoryArray.splice(index, 1);
  }

  roundToTwo(num: number | undefined): number | undefined {
    return num !== undefined ? Math.round(num * 100) / 100 : undefined;
  }

  saveNotes() {
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    project.notes = InfoGrowComponent.notes;
    project.updatedAt = new Date().toISOString();
    this.persistProject();
  }

  private persistProject() {
    this.persistence.writeAndSync({
      tag: 'grow',
      data: AppStateService.instance.allGrowProjects,
      localStorageKey: 'grow',
      logEvent: 'update_grow',
      logMetadata: { index: InfoGrowComponent.index },
      onSuccess: () => {},
      onError: (error: any) => {
        this.showError(error.message || 'Save failed');
      }
    });
  }

  // Arrays for links and action items
  links: GrowLink[] = [];
  actionItems: GrowActionItem[] = [];

  // Input fields for adding action items / links
  newActionText = '';
  newActionPriority: 'low' | 'medium' | 'high' = 'medium';
  newActionDueDate = '';
  newLinkLabel = '';
  newLinkUrl = '';
  editingLinkIndex = -1;
  editingLinkLabel = '';
  editingLinkUrl = '';
  editingActionIndex = -1;
  editingActionText = '';
  editingActionPriority: 'low' | 'medium' | 'high' = 'medium';
  editingActionDueDate = '';

  submitActionItem() {
    if (!this.newActionText.trim()) return;
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (!project.actionItems) project.actionItems = [];
    const item: GrowActionItem = {
      text: this.newActionText.trim(),
      done: false,
      priority: this.newActionPriority
    };
    if (this.newActionDueDate) item.dueDate = this.newActionDueDate;
    project.actionItems.push(item);
    project.updatedAt = new Date().toISOString();
    InfoGrowComponent.actionItems = project.actionItems;
    this.newActionText = '';
    this.newActionPriority = 'medium';
    this.newActionDueDate = '';
    this.persistProject();
  }

  submitLink() {
    if (!this.newLinkLabel.trim() || !this.newLinkUrl.trim()) return;
    this.addLink(this.newLinkLabel.trim(), this.newLinkUrl.trim());
    this.newLinkLabel = '';
    this.newLinkUrl = '';
    this.showAddLink = false;
  }

  // --- Notes CRUD ---

  get notesList(): GrowNote[] {
    return InfoGrowComponent.notes || [];
  }

  addNote() {
    if (!this.newNoteText.trim()) return;
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (!Array.isArray(project.notes)) project.notes = [];
    const note: GrowNote = { text: this.newNoteText.trim(), createdAt: new Date().toISOString() };
    project.notes.unshift(note);
    project.updatedAt = new Date().toISOString();
    InfoGrowComponent.notes = project.notes;
    this.newNoteText = '';
    this.persistProject();
  }

  startEditNote(index: number) {
    this.editingNoteIndex = index;
    this.editingNoteText = this.notesList[index].text;
  }

  saveEditNote(index: number) {
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (project.notes && project.notes[index]) {
      project.notes[index].text = this.editingNoteText.trim();
      project.updatedAt = new Date().toISOString();
      InfoGrowComponent.notes = project.notes;
      this.persistProject();
    }
    this.editingNoteIndex = -1;
    this.editingNoteText = '';
  }

  cancelEditNote() {
    this.editingNoteIndex = -1;
    this.editingNoteText = '';
  }

  deleteNote(index: number) {
    const project = AppStateService.instance.allGrowProjects[InfoGrowComponent.index];
    if (project.notes) {
      project.notes.splice(index, 1);
      project.updatedAt = new Date().toISOString();
      InfoGrowComponent.notes = project.notes;
      this.persistProject();
    }
  }

  // --- Related Transactions ---

  get relatedTransactions() {
    const title = InfoGrowComponent.title;
    if (!title) return [];
    const category = '@' + title;
    return (AppStateService.instance.allTransactions || [])
      .filter(tx => tx.category === category)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  openTransaction(tx: any) {
    const all = AppStateService.instance.allTransactions || [];
    const index = all.indexOf(tx);
    if (index < 0) return;
    AppComponent?.gotoTop?.();
    InfoComponent.setInfoComponent(
      index, tx.account, tx.amount, tx.date, tx.time, tx.category, tx.comment
    );
  }
}
