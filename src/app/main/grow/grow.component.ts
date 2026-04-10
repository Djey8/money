import { Router } from '@angular/router';
import { Grow, GrowPhase, GrowType } from 'src/app/interfaces/grow';
import { LocalService } from 'src/app/shared/services/local.service';
import { migrateGrowArray } from 'src/app/shared/grow-migration.utils';
import { InfoGrowComponent } from 'src/app/panels/info/info-grow/info-grow.component';
import { InfoComponent } from 'src/app/panels/info/info.component';
import { InfoAssetComponent } from 'src/app/panels/info/info-asset/info-asset.component';
import { InfoShareComponent } from 'src/app/panels/info/info-share/info-share.component';
import { InfoInvestmentComponent } from 'src/app/panels/info/info-investment/info-investment.component';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {LiveAnnouncer} from '@angular/cdk/a11y';
import {AfterViewInit, Component, ViewChild, inject} from '@angular/core';
import {MatSort, Sort, MatSortModule} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatFormFieldModule} from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Transaction } from 'src/app/interfaces/transaction';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { AppDataService } from 'src/app/shared/services/app-data.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { RouterModule } from '@angular/router';
import { InfoLiabilitieComponent } from 'src/app/panels/info/info-liabilitie/info-liabilitie.component';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { AiAssistantComponent } from 'src/app/panels/ai-assistant/ai-assistant.component';


// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let BalanceComponent: any; setTimeout(() => import('../cashflow/balance/balance.component').then(m => BalanceComponent = m.BalanceComponent));
let AccountingComponent: any; setTimeout(() => import('../accounting/accounting.component').then(m => AccountingComponent = m.AccountingComponent));
let AddGrowComponent: any; setTimeout(() => import('src/app/panels/add/add-grow/add-grow.component').then(m => AddGrowComponent = m.AddGrowComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let IncomeComponent: any; setTimeout(() => import('../cashflow/income/income.component').then(m => IncomeComponent = m.IncomeComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
let InfoInterestsComponent: any; setTimeout(() => import('src/app/panels/info/info-interests/info-interests.component').then(m => InfoInterestsComponent = m.InfoInterestsComponent));
@Component({
  selector: 'app-grow',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppNumberPipe, MatTableModule, MatSortModule, RouterModule, InfoAssetComponent, InfoShareComponent, InfoInvestmentComponent, InfoLiabilitieComponent, InfoGrowComponent, AiAssistantComponent],
  templateUrl: './grow.component.html',
  styleUrls: ['./grow.component.css', '../../app.component.css', '../../shared/styles/table.css']
})
export class GrowComponent {

  static isSearched = false;
  static phaseFilter: GrowPhase | 'all' = 'all';
  static typeFilter: GrowType | 'all' = 'all';
  static get allGrowProjects(): Grow[] { return AppStateService.instance.allGrowProjects; }
  static set allGrowProjects(v: Grow[]) { AppStateService.instance.allGrowProjects = v; }
  static allSearchedGrowProjects = []

  private _liveAnnouncer = inject(LiveAnnouncer);
  displayedColumns: string[] = ['id', 'account', 'amount', 'date'];

  searchTextField = "";
  isSorting = false;

  public classReference = GrowComponent;
  public get appReference() { return AppComponent; }
  public settingsReference = SettingsComponent;
  public appState = AppStateService.instance;
  public balanceRefference = BalanceComponent;
  get accountingReference() { return AccountingComponent; }

   /**
   * Constructs a new SmileProjectsComponent.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   */
   constructor(private router:Router, private localStorage: LocalService) {
    AppStateService.instance.allGrowProjects = this.localStorage.getData("grow")=="" ? [] : migrateGrowArray(JSON.parse(this.localStorage.getData("grow")));
    if (AccountingComponent?.dataSource) {
      AccountingComponent.dataSource.data = AppStateService.instance.allTransactions;
      AccountingComponent.dataSource.data = AccountingComponent.dataSource.data.map((transaction, index) => {
        return { ...transaction, id: index };
      });
    }
    // Tier 3: Load fresh data from server if not yet loaded
    if (AppDataService.instance && !AppStateService.instance.tier3GrowLoaded) {
      AppDataService.instance.loadGrowData();
    }
  }

  @ViewChild(MatSort) sort!: MatSort;

  /**
   * Custom sorting function for MatTableDataSource.
   * @param dataSource - The data source to apply the custom sorting.
   */
  applyCustomSorting(dataSource: MatTableDataSource<any>) {
    dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'id':
          return item.id; // Example: Sort by id as a number
        case 'amount':
          return item.amount; // Example: Sort by amount as a number
        case 'date':
          return new Date(item.date).getTime(); // Example: Sort by startDate as a timestamp
        default:
          return item[property]; // Default sorting
      }
    };
  }

  ngAfterViewInit() {
    if (this.sort && AccountingComponent?.dataSource) {
      setTimeout(() => {
        AccountingComponent.dataSource.sort = this.sort;
        this.sort.active = 'id'; // Column to sort by
        this.sort.direction = 'desc'; // Sorting direction
        this.sort.sortChange.emit(); // Emit the sort change event to apply the default sorting
      });
    } else {
      console.warn('MatSort is not initialized yet.');
    }
    
  }

  ngOnInit() { 
    // Apply custom sorting
    if (AccountingComponent?.dataSource) {
      this.applyCustomSorting(AccountingComponent.dataSource);
    }
  }

  /** Announce the change in sort state for assistive technology. */
  announceSortChange(sortState: Sort | null) {
    if (sortState && sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }

  getGrowTransactions(index: number){
    let found = false;
    for(let i = 0; i < AppStateService.instance.allTransactions.length; i++){
      if(AppStateService.instance.allTransactions[i].category.replace("@", "") === AppStateService.instance.allGrowProjects[index].title){
        found = true;
      }
    }
    return found;
  }

  search() {
    const searchTerms = this.searchTextField.toLowerCase().split(',');

    GrowComponent.allSearchedGrowProjects = AppStateService.instance.allGrowProjects.map(grow => {
      // Perform case-insensitive search on account, category, comment, date, and amount fields
      const title = grow.title ? grow.title.toLowerCase() : "";
      const description = grow.description ? grow.description.toLowerCase() : "";
      const strategy = grow.strategy ? grow.strategy.toLowerCase() : "";
      const risks = grow.risks ? grow.risks.toLowerCase() : "";
      const amount = grow.amount ? String(grow.amount) : "";
      const liabilitie = grow.liabilitie ? String(grow.liabilitie) : "";
      const credit = grow.liabilitie && grow.liabilitie.credit ? String(grow.liabilitie.credit) : "";
      const status = grow.status ? grow.status.toLowerCase() : "";
      const cashflow = grow.cashflow ? String(grow.cashflow) : "";
      const mortage = grow.investment && grow.investment.amount ? String(grow.investment.amount) : "";

      const isFiltered = searchTerms.some(term => 
        title.includes(term.trim()) ||
        status.includes(term.trim()) ||
        description.includes(term.trim()) ||
        strategy.includes(term.trim()) ||
        risks.includes(term.trim()) || 
        amount.includes(term.trim()) || 
        liabilitie.includes(term.trim()) ||
        credit.includes(term.trim()) ||
        cashflow.includes(term.trim()) ||
        mortage.includes(term.trim())
      );

      // Return a new object with the isFiltered field added
      return {
        ...grow,
        isFiltered: isFiltered
      };
    });
    GrowComponent.isSearched = true;
  }

  buyProject(index: number) {
    AppComponent.gotoTop();    
    AddComponent.categoryTextField = `@${AppStateService.instance.allGrowProjects[index].title}`;
    AddComponent.selectedOption = "Fire";
    AddComponent.loanTextField = "";
    AddComponent.creditTextField = "";
    if(AppStateService.instance.allGrowProjects[index].liabilitie){
      AddComponent.isLiabilitie = true;
      AddComponent.creditTextField = String(AppStateService.instance.allGrowProjects[index].liabilitie.credit);
      AddComponent.loanTextField = String(AppStateService.instance.allGrowProjects[index].liabilitie.amount);
    }
    let found = false;
    if(AppStateService.instance.allGrowProjects[index].isAsset){
      found = true;
      let totalAmount = (AppStateService.instance.allGrowProjects[index].amount ? Number(AppStateService.instance.allGrowProjects[index].amount) : 0) + 
            (AppStateService.instance.allGrowProjects[index].liabilitie && AppStateService.instance.allGrowProjects[index].liabilitie.amount ? Number(AppStateService.instance.allGrowProjects[index].liabilitie.amount) : 0);
      AddComponent.amountTextField = "-1";
      AddComponent.commentTextField = `Buy Asset ${AppStateService.instance.allGrowProjects[index].title} 1 x ${totalAmount};`;
    } else if (AppStateService.instance.allGrowProjects[index].share){
      found = true;
      let quantity = AppStateService.instance.allGrowProjects[index].share.quantity;
      let price = AppStateService.instance.allGrowProjects[index].share.price;
      
      AddComponent.amountTextField = "-1";
      AddComponent.commentTextField = `Buy Share ${AppStateService.instance.allGrowProjects[index].title} ${quantity} x ${price};`;
    } else if (AppStateService.instance.allGrowProjects[index].investment){
      found = true;
      AddComponent.amountTextField = "-1";
      AddComponent.commentTextField = `Buy Investment ${AppStateService.instance.allGrowProjects[index].title} ${AppStateService.instance.allGrowProjects[index].investment.deposit} ${AppStateService.instance.allGrowProjects[index].investment.amount};`;
    }
    AddComponent.url = "/grow";
    InfoGrowComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
    AddComponent.isAdd = true;
  }

  sellProject(index: number) {
    AppComponent.gotoTop();  
    InfoGrowComponent.isInfo = false;
    AddComponent.categoryTextField = `@${AppStateService.instance.allGrowProjects[index].title}`;
    AddComponent.selectedOption = "Income";
    AddComponent.amountTextField = "1";
    let found = false;
    if(AppStateService.instance.allGrowProjects[index].isAsset){
      found = true;
      AddComponent.commentTextField = `Sell Asset ${AppStateService.instance.allGrowProjects[index].title} 1 x ${this.getAssetAmount(index)};`;
      
    } else if (AppStateService.instance.allGrowProjects[index].share){
      found = true;
      let quantity = 0;
      let price = 0;  
      for(let i = 0; i < AppStateService.instance.allShares.length; i++){
        if(AppStateService.instance.allGrowProjects[index].title == AppStateService.instance.allShares[i].tag){
          quantity = AppStateService.instance.allShares[i].quantity;
          price = AppStateService.instance.allShares[i].price;
        }
      }
      AddComponent.commentTextField = `Sell Share ${AppStateService.instance.allGrowProjects[index].title} ${quantity} x ${price};`;
    
    } else if (AppStateService.instance.allGrowProjects[index].investment){
      found = true;
      let deposit = 0;
      let mortage = 0;
      for(let i =0; i < AppStateService.instance.allInvestments.length; i++){
        if(AppStateService.instance.allGrowProjects[index].title == AppStateService.instance.allInvestments[i].tag){
          deposit = AppStateService.instance.allInvestments[i].deposit;
          mortage = AppStateService.instance.allInvestments[i].amount; 
        }
      }
      if(AppStateService.instance.allGrowProjects[index].liabilitie){
        AddComponent.commentTextField = `Payback Liabilitie ${AppStateService.instance.allGrowProjects[index].liabilitie.amount} ${AppStateService.instance.allGrowProjects[index].liabilitie.credit}; `;
      }
      AddComponent.commentTextField += `Sell Investment ${AppStateService.instance.allGrowProjects[index].title} ${deposit} ${mortage};`;
      
    }
    AddComponent.url = "/grow";
    AddComponent.isLiabilitie = false;
    InfoGrowComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false
    AddComponent.isAdd = true;
  }

  
  /**
   * Clears the search results.
   */
  clearSearch() {
    this.searchTextField = "";
    GrowComponent.isSearched = false;
  }

  /**
   * Handles the click event on a row in the Smile Projects table.
   * @param index - The index of the clicked row.
   */
  clickRow(index: number){
    if(!AddComponent.isAdd && !this.isSorting){
      AppComponent.gotoTop();
      InfoGrowComponent.setInfoGrowComponent(index, AppStateService.instance.allGrowProjects[index]);
    }
  }

  clickTRow(index: number) {
    AppComponent.gotoTop();
    InfoComponent.setInfoComponent(
      index,
      AppStateService.instance.allTransactions[index].account,
      AppStateService.instance.allTransactions[index].amount,
      AppStateService.instance.allTransactions[index].date,
      AppStateService.instance.allTransactions[index].time,
      AppStateService.instance.allTransactions[index].category,
      AppStateService.instance.allTransactions[index].comment
    );
  }

  clickHRow() {
    this.isSorting = true;
    setTimeout(() => {
      this.isSorting = false;
    }, 1000);
  }

  getGrowProjectsGV(index: number){
    let amount = 0//Number(AppStateService.instance.allGrowProjects[index].cashflow);
    for(let i = 0; i < AppStateService.instance.allTransactions.length; i++){
      if(AppStateService.instance.allTransactions[i].category.replace("@", "") === AppStateService.instance.allGrowProjects[index].title){
        amount += AppStateService.instance.allTransactions[i].amount;
      }
    }
    return amount;
  }

  getAssetAmount(index: number){
    let amount = 0;
    for(let i = 0; i < AppStateService.instance.allAssets.length; i++){
      if(AppStateService.instance.allAssets[i].tag === AppStateService.instance.allGrowProjects[index].title){
        amount = AppStateService.instance.allAssets[i].amount;
      }
    }
    for(let i = 0; i < AppStateService.instance.allShares.length; i++){
      if(AppStateService.instance.allShares[i].tag === AppStateService.instance.allGrowProjects[index].title){
        amount = AppStateService.instance.allShares[i].quantity * AppStateService.instance.allShares[i].price;
      }
    }
    for(let i=0; i < AppStateService.instance.allInvestments.length; i++){
      if(AppStateService.instance.allInvestments[i].tag === AppStateService.instance.allGrowProjects[index].title){
        amount = AppStateService.instance.allInvestments[i].amount + AppStateService.instance.allInvestments[i].deposit;
      }
    }
    return amount;
  }

  /**
   * Adds a new Smile Project.
   */
  addGrowProject() {
    AddGrowComponent.zIndex = 1;
    AddGrowComponent.isAddSmile = true;
    //InfoSmileComponent.isInfo = false;type
  }

  openAiAssistant() {
    AiAssistantComponent.isOpen = true;
    AiAssistantComponent.zIndex = 2;
  }

  cashflowProject(index: number){
    AppComponent.gotoTop();
    AddComponent.categoryTextField = `@${AppStateService.instance.allGrowProjects[index].title}`;
    AddComponent.url = "/grow";
    AddComponent.commentTextField = "CASHFLOW " + AppStateService.instance.allGrowProjects[index].cashflow;
    let cashflow = AppStateService.instance.allGrowProjects[index].cashflow;
    if (AppStateService.instance.allGrowProjects[index].liabilitie) {
      cashflow -= AppStateService.instance.allGrowProjects[index].liabilitie.credit
      AddComponent.commentTextField += " - CREDIT " + AppStateService.instance.allGrowProjects[index].liabilitie.credit;
    }
    AddComponent.commentTextField += ";";
    AddComponent.amountTextField = String(cashflow);
    AddComponent.selectedOption = "Income";
    AddComponent.isLiabilitie = false;
    InfoGrowComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
    AddComponent.isAdd = true;
  }

  depositProject(index: number){
    AppComponent.gotoTop();
    AddComponent.categoryTextField = `@${AppStateService.instance.allGrowProjects[index].title}`;
    AddComponent.url = "/grow";
    AddComponent.commentTextField = "Deposit " + AppStateService.instance.allGrowProjects[index].amount+";";
    AddComponent.amountTextField = "-"+String(AppStateService.instance.allGrowProjects[index].amount);
    AddComponent.selectedOption = "Fire";
    AddComponent.isLiabilitie = false;
    InfoGrowComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
    AddComponent.isAdd = true;
  }

  dividende(index: number){
    AddComponent.categoryTextField = `@${AppStateService.instance.allGrowProjects[index].title}`;
    AddComponent.selectedOption = "Income";
    AddComponent.amountTextField = "1";
    AddComponent.commentTextField = `Dividende Share ${AppStateService.instance.allGrowProjects[index].title} ${AppStateService.instance.allGrowProjects[index].share.quantity} x ${AppStateService.instance.allGrowProjects[index].share.price};`;
    AddComponent.isLiabilitie = false;
    AddComponent.creditTextField = "";
    AddComponent.url = "/grow";
    InfoShareComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
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
      AddComponent.isAdd = true;
    }
    
  }

  updateValueProject(index: number){
    if(AppStateService.instance.allGrowProjects[index].isAsset){
      let amount = 0;
      let id = -1;
      for(let i = 0; i < AppStateService.instance.allAssets.length; i++){
        if(AppStateService.instance.allAssets[i].tag === AppStateService.instance.allGrowProjects[index].title){
          amount = AppStateService.instance.allAssets[i].amount;
          id = i;
        }
      }
      if(id != -1){
        InfoAssetComponent.setInfoAssetComponent(id, AppStateService.instance.allGrowProjects[index].title, amount);
        AppComponent.gotoTop();
        AddGrowComponent.zIndex = 1;
        InfoGrowComponent.isInfo = false;
        AddComponent.isAdd = false;
        MenuComponent.isMenu = false;
        InfoComponent.isInfo = false;
      }
    } else if(AppStateService.instance.allGrowProjects[index].share){
      let quantity = 0;
      let price = 0;
      let id = -1;
      for(let i = 0; i < AppStateService.instance.allShares.length; i++){
        if(AppStateService.instance.allShares[i].tag === AppStateService.instance.allGrowProjects[index].title){
          quantity = AppStateService.instance.allShares[i].quantity;
          price = AppStateService.instance.allShares[i].price;
          id = i;
        }
      }
      if(id != -1){
        InfoShareComponent.setInfoShareComponent(id, AppStateService.instance.allGrowProjects[index].title, quantity, price);
        AppComponent.gotoTop();
        AddGrowComponent.zIndex = 1;
        InfoGrowComponent.isInfo = false;
        AddComponent.isAdd = false;
        MenuComponent.isMenu = false;
        InfoComponent.isInfo = false;
      }
    } else if (AppStateService.instance.allGrowProjects[index].investment){
      let deposit = 0
      let mortage = 0
      let id = -1;
      for(let i = 0; i < AppStateService.instance.allInvestments.length; i++){
        if(AppStateService.instance.allInvestments[i].tag === AppStateService.instance.allGrowProjects[index].title){
          deposit = AppStateService.instance.allInvestments[i].deposit;
          mortage = AppStateService.instance.allInvestments[i].amount;
          id = i;
        }
      }
      if(id != -1){
        InfoInvestmentComponent.setInfoInvestmentComponent(id, AppStateService.instance.allGrowProjects[index].title, deposit, mortage);
        AppComponent.gotoTop();
        AddGrowComponent.zIndex = 1;
        InfoGrowComponent.isInfo = false;
        AddComponent.isAdd = false;
        MenuComponent.isMenu = false;
        InfoComponent.isInfo = false;
      }

    }
    
  }

  // --- Phase filtering ---

  get phases(): (GrowPhase | 'all')[] {
    return ['all', 'idea', 'research', 'plan', 'execute', 'monitor', 'completed'];
  }

  get types(): (GrowType | 'all')[] {
    return ['all', 'income-growth', 'budget-optimization', 'subscription-action', 'expense-insight'];
  }

  setPhaseFilter(phase: GrowPhase | 'all') {
    GrowComponent.phaseFilter = phase;
  }

  setTypeFilter(type: GrowType | 'all') {
    GrowComponent.typeFilter = type;
  }

  get filteredProjects(): Grow[] {
    let projects = GrowComponent.isSearched
      ? GrowComponent.allSearchedGrowProjects.filter((p: any) => p.isFiltered)
      : [...AppStateService.instance.allGrowProjects];
    if (GrowComponent.phaseFilter !== 'all') {
      projects = projects.filter(p => p.phase === GrowComponent.phaseFilter);
    }
    if (GrowComponent.typeFilter !== 'all') {
      projects = projects.filter(p => (p.type || 'income-growth') === GrowComponent.typeFilter);
    }
    return projects.reverse();
  }

  getPhaseCount(phase: GrowPhase): number {
    return AppStateService.instance.allGrowProjects.filter(p => p.phase === phase).length;
  }

  getTypeCount(type: GrowType): number {
    return AppStateService.instance.allGrowProjects.filter(p => (p.type || 'income-growth') === type).length;
  }

  // --- Action item helpers ---

  getActionProgress(project: Grow): string {
    if (!project.actionItems || project.actionItems.length === 0) return '';
    const done = project.actionItems.filter(a => a.done).length;
    return `${done}/${project.actionItems.length}`;
  }

  getActionPercent(project: Grow): number {
    if (!project.actionItems || project.actionItems.length === 0) return 0;
    return Math.round((project.actionItems.filter(a => a.done).length / project.actionItems.length) * 100);
  }

  // --- Project type label ---

  getProjectType(project: Grow): string {
    if (project.share) return 'Share';
    if (project.investment) return 'Investment';
    if (project.isAsset) return 'Asset';
    return '';
  }

  getOriginalIndex(project: Grow): number {
    return AppStateService.instance.allGrowProjects.indexOf(project);
  }

  // --- Investment/Liability helpers ---

  getDepositAmount(project: Grow): number {
    // Deposit is always the amount field (user's own money)
    return project.amount || 0;
  }

  getMortgageAmount(project: Grow): number {
    // Mortgage comes from investment.amount (the property value)
    return project.investment?.amount || 0;
  }

  getLoanAmount(project: Grow): number {
    // Loan comes from liabilitie.amount (the borrowed money)
    return project.liabilitie?.amount || 0;
  }

  getCreditAmount(project: Grow): number {
    // Credit/interest from liabilitie
    return project.liabilitie?.credit || 0;
  }

  // --- Share helpers ---

  getShareQuantity(project: Grow): number {
    return project.share?.quantity || 0;
  }

  getSharePrice(project: Grow): number {
    return project.share?.price || 0;
  }

  // --- Category helpers ---
  
  isCategoryArray(category: string | string[] | undefined): boolean {
    return Array.isArray(category);
  }

  getCategoryArray(category: string | string[] | undefined): string[] {
    return Array.isArray(category) ? category : [];
  }
  
}
