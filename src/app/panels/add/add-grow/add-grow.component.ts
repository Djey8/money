import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { gotoTop } from 'src/app/shared/scroll.utils';
import { Grow, GrowPhase, GrowType, GrowLink, GrowActionItem } from 'src/app/interfaces/grow';
import { BalanceComponent } from 'src/app/main/cashflow/balance/balance.component';
import { GrowComponent } from 'src/app/main/grow/grow.component';
import { InfoComponent } from 'src/app/panels/info/info.component';
import { MenuComponent } from 'src/app/panels/menu/menu.component';
import { ProfileComponent } from 'src/app/panels/profile/profile.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { BaseAddComponent } from 'src/app/shared/base/base-add.component';
import { isDuplicateTitle } from 'src/app/shared/validation.utils';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { AiAssistantComponent } from 'src/app/panels/ai-assistant/ai-assistant.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
@Component({
  selector: 'app-add-grow',
  standalone: true,
  imports: [TrapFocusDirective, CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-grow.component.html',
  styleUrls: ['../../../shared/styles/add-form.css', './add-grow.component.css']
})
export class AddGrowComponent extends BaseAddComponent {
  titleTextField = "";
  subTextField = "";
  typeField: GrowType = 'income-growth';
  phaseField: GrowPhase = 'idea';
  notesTextField = "";
  descriptionTextField = "";
  strategyTextField = "";
  risksTextField = "";
  riskScoreField = 0;

  // Expense optimization fields
  categoryArray: string[] = [];
  newCategoryInput = "";
  currentCostTextField = "";
  targetCostTextField = "";
  monthlySavingsTextField = "";
  annualSavingsTextField = "";
  reasoningTextField = "";
  alternativeTextField = "";
  alternativeCostTextField = "";
  patternTextField = "";
  insightsTextField = "";

  // Links and Actions
  links: GrowLink[] = [];
  actionItems: GrowActionItem[] = [];
  showAddLink = false;
  showAddAction = false;
  newLinkLabel = '';
  newLinkUrl = '';
  newActionText = '';
  newActionPriority: 'low' | 'medium' | 'high' = 'medium';
  newActionDueDate = '';
  editingActionIndex = -1;
  editingActionText = '';
  editingActionPriority: 'low' | 'medium' | 'high' = 'medium';
  editingActionDueDate = '';
  editingLinkIndex = -1;
  editingLinkLabel = '';
  editingLinkUrl = '';

  showStrategySection = false;
  showFinancialsSection = false;
  showLinksActionsSection = false;
  loanTextField = "";
  creditTextField = "";
  mortageTextField = "";
  amountTextField = "";
  cashflowTextField = "";
  quantityTextField = "";
  priceTextField = "";

  showCreditOptions = false;

  static zIndex;
  static isAddSmile;
  static isError;

  static isLoan = false;
  static isInvestment = false;
  static isShare = false;
  static isAsset = false;


  public classReference = AddGrowComponent;
  public settingsReference = SettingsComponent;
  /**
   * Initializes a new instance of the AddGrowComponent class.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   * @param database - The database service.
   * @param frontendLogger - The frontend logging service.
   */
  constructor(router: Router, private persistence: PersistenceService) {
    super(router);
    AddGrowComponent.isAddSmile = false;
    this.initStatic(AddGrowComponent);
  }

  highlight() {
    AddGrowComponent.zIndex = 1;
    ProfileComponent.zIndex = 0;
    MenuComponent.zIndex = 0;
    InfoComponent.zIndex = 0;
  }

  override closeWindow() {
    AddGrowComponent.isAddSmile = false;
    this.amountTextField = "";
    this.typeField = 'income-growth';
    super.closeWindow();
  }

  isExpenseType(): boolean {
    return this.typeField !== 'income-growth';
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

  // Links management
  addLink(label: string, url: string) {
    if (!label.trim() || !url.trim()) return;
    this.links.push({ label: label.trim(), url: url.trim() });
  }

  removeLink(index: number) {
    this.links.splice(index, 1);
  }

  submitLink() {
    if (!this.newLinkLabel.trim() || !this.newLinkUrl.trim()) return;
    this.addLink(this.newLinkLabel, this.newLinkUrl);
    this.newLinkLabel = '';
    this.newLinkUrl = '';
    this.showAddLink = false;
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

  // Action items management
  addActionItem(text: string, priority: 'low' | 'medium' | 'high' = 'medium', dueDate?: string) {
    if (!text.trim()) return;
    const item: GrowActionItem = {
      text: text.trim(),
      done: false,
      priority
    };
    if (dueDate) item.dueDate = dueDate;
    this.actionItems.push(item);
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

  submitActionItem() {
    if (!this.newActionText.trim()) return;
    this.addActionItem(this.newActionText, this.newActionPriority, this.newActionDueDate || undefined);
    this.newActionText = '';
    this.newActionPriority = 'medium';
    this.newActionDueDate = '';
    this.showAddAction = false;
  }

  /**
   * Checks if the title is invalid.
   * @param title - The title to be checked.
   * @returns True if the title is invalid, false otherwise.
   */
  invalidTitle(title: string) {
    return isDuplicateTitle(title, [AppStateService.instance.allGrowProjects]);
  }
  
  toggleAsset() {
    AddGrowComponent.isAsset = !AddGrowComponent.isAsset;
    AddGrowComponent.isInvestment = false;
    AddGrowComponent.isShare = false;
  }

  toggleShare() {
    AddGrowComponent.isShare = !AddGrowComponent.isShare;
    AddGrowComponent.isAsset = false;
    AddGrowComponent.isInvestment = false;
  }

  toggleInvestment() {
    AddGrowComponent.isInvestment = !AddGrowComponent.isInvestment;
    AddGrowComponent.isAsset = false;
    AddGrowComponent.isShare = false;
  }

  toggleCreditOptions() {
    this.showCreditOptions = !this.showCreditOptions;
  }

  openAiImport() {
    AiAssistantComponent.initialStep = 'import';
    AiAssistantComponent.isOpen = true;
    AiAssistantComponent.zIndex = 2;
    this.closeWindow();
  }

  /**
   * Adds a smile project.
   */
  addGrowProject(){
    //First trim string
    this.titleTextField = this.titleTextField.trim();
    //Validation (check if Amount is not empty)
    const requiredFields: { name: string; value: any; label: string }[] = [
      { name: 'title', value: this.titleTextField, label: 'Title' }
    ];
    if (AddGrowComponent.isLoan) {
      requiredFields.push({ name: 'loan', value: (this.loanTextField === '' || this.loanTextField === '0') ? '' : this.loanTextField, label: 'Loan' });
    }
    if (AddGrowComponent.isShare) {
      requiredFields.push(
        { name: 'quantity', value: (this.quantityTextField === '' || this.quantityTextField === '0') ? '' : this.quantityTextField, label: 'Quantity' },
        { name: 'price', value: (this.priceTextField === '' || this.priceTextField === '0') ? '' : this.priceTextField, label: 'Price' }
      );
    }
    if (!this.validateRequired(requiredFields)) {
      // field errors shown inline
    } else if (this.invalidTitle(this.titleTextField)) {
      this.showError("This grow project already exists.");
    } else {

      if(this.showCreditOptions){
          if (this.creditTextField === "") {
            this.creditTextField = "0";
          }
          this.creditTextField = String(Math.round(parseFloat(this.loanTextField) * (parseFloat(this.creditTextField) / 100) * 100) / 100);
      } else {
        if(this.creditTextField === "") {
          this.creditTextField = "0";
        } 
      }
      let loanAmount = AddGrowComponent.isLoan ? parseFloat(this.loanTextField) : 0;
      if(AddGrowComponent.isShare){
        this.amountTextField = String(parseFloat(this.quantityTextField) * parseFloat(this.priceTextField) - loanAmount);
      }

      let isInvest = AddGrowComponent.isAsset || AddGrowComponent.isShare || AddGrowComponent.isInvestment
      
      // ready to write to Database new Transaction
      let newGrow: Grow = {
        title: this.titleTextField,
        sub: this.subTextField || "",
        type: this.typeField,
        phase: this.phaseField,
        description: this.descriptionTextField || "",
        strategy: this.strategyTextField || "",
        riskScore: this.riskScoreField || 0,
        risks: this.risksTextField || "",
        amount: this.amountTextField === "" ? 0 : parseFloat(this.amountTextField),
        cashflow: this.cashflowTextField === "" ? 0 : parseFloat(this.cashflowTextField),
        isAsset: AddGrowComponent.isAsset,
        share: AddGrowComponent.isShare ? {tag: this.titleTextField, quantity: parseFloat(this.quantityTextField), price: parseFloat(this.priceTextField)} : null,
        investment: AddGrowComponent.isInvestment ? {tag: this.titleTextField, deposit: parseFloat(this.amountTextField)+parseFloat(this.loanTextField), amount: parseFloat(this.mortageTextField)} : null,
        liabilitie: AddGrowComponent.isLoan ? {tag: this.titleTextField, amount: parseFloat(this.loanTextField), investment: isInvest, credit: parseFloat(this.creditTextField)} : null,
        // Expense optimization fields
        category: this.isExpenseType() && this.categoryArray.length > 0 ? (this.categoryArray.length === 1 ? this.categoryArray[0] : this.categoryArray) : undefined,
        currentCost: this.roundToTwo(this.isExpenseType() && this.currentCostTextField ? parseFloat(this.currentCostTextField) : undefined),
        targetCost: this.roundToTwo(this.isExpenseType() && this.targetCostTextField ? parseFloat(this.targetCostTextField) : undefined),
        monthlySavings: this.roundToTwo(this.isExpenseType() && this.monthlySavingsTextField ? parseFloat(this.monthlySavingsTextField) : undefined),
        annualSavings: this.roundToTwo(this.isExpenseType() && this.annualSavingsTextField ? parseFloat(this.annualSavingsTextField) : undefined),
        reasoning: this.isExpenseType() && this.reasoningTextField ? this.reasoningTextField : undefined,
        alternative: this.typeField === 'subscription-action' && this.alternativeTextField ? this.alternativeTextField : undefined,
        alternativeCost: this.typeField === 'subscription-action' && this.alternativeCostTextField ? parseFloat(this.alternativeCostTextField) : undefined,
        pattern: this.typeField === 'expense-insight' && this.patternTextField ? this.patternTextField : undefined,
        insights: this.typeField === 'expense-insight' && this.insightsTextField ? this.insightsTextField : undefined,
        actionItems: this.actionItems.length > 0 ? this.actionItems : [],
        links: this.links.length > 0 ? this.links : [],
        notes: this.notesTextField.trim() ? [{ text: this.notesTextField.trim(), createdAt: new Date().toISOString() }] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      AppStateService.instance.allGrowProjects.push(newGrow);
      // Clean Up close Window
      this.titleTextField = "";
      this.subTextField = "";
      this.typeField = 'income-growth';
      this.phaseField = 'idea';
      this.notesTextField = "";
      this.descriptionTextField = "";
      this.strategyTextField = "";
      this.risksTextField = "";
      this.riskScoreField = 0;
      this.loanTextField = "";
      this.creditTextField = "";
      this.mortageTextField = "";
      this.cashflowTextField = "";
      this.amountTextField = "";
      this.quantityTextField = "";
      this.priceTextField = "";
      this.categoryArray = [];
      this.newCategoryInput = "";
      this.currentCostTextField = "";
      this.targetCostTextField = "";
      this.monthlySavingsTextField = "";
      this.annualSavingsTextField = "";
      this.reasoningTextField = "";
      this.alternativeTextField = "";
      this.alternativeCostTextField = "";
      this.patternTextField = "";
      this.insightsTextField = "";
      this.links = [];
      this.actionItems = [];
      this.showAddLink = false;
      this.showAddAction = false;
      this.newLinkLabel = '';
      this.newLinkUrl = '';
      this.newActionText = '';
      this.newActionPriority = 'medium';
      this.newActionDueDate = '';
      AddGrowComponent.isLoan = false;
      AddGrowComponent.isShare = false;
      AddGrowComponent.isAsset = false;
      AddGrowComponent.isInvestment = false;
      this.clearError();
      this.persistence.batchWriteAndSync({
        writes: [
          { tag: "grow", data: AppStateService.instance.allGrowProjects },
          { tag: "balance/liabilities", data: AppStateService.instance.liabilities },
          { tag: "balance/asset/assets", data: AppStateService.instance.allAssets },
          { tag: "balance/asset/shares", data: AppStateService.instance.allShares },
          { tag: "balance/asset/investments", data: AppStateService.instance.allInvestments }
        ],
        localStorageSaves: [
          { key: "grow", data: JSON.stringify(AppStateService.instance.allGrowProjects) },
          { key: "liabilities", data: JSON.stringify(AppStateService.instance.liabilities) },
          { key: "assets", data: JSON.stringify(AppStateService.instance.allAssets) },
          { key: "shares", data: JSON.stringify(AppStateService.instance.allShares) },
          { key: "investments", data: JSON.stringify(AppStateService.instance.allInvestments) }
        ],
        logEvent: 'add_grow',
        logMetadata: {
          title: this.titleTextField,
          hasLoan: AddGrowComponent.isLoan,
          hasShare: AddGrowComponent.isShare,
          hasInvestment: AddGrowComponent.isInvestment
        },
        onSuccess: () => {
          this.closeWindow();
          this.toastService.show('Grow project added', 'success');
          gotoTop();
          this.router.navigate(['/grow']);
        },
        onError: (error) => {
          this.showError(error.message || 'Database write failed');
        }
      });
    }
  }
}
