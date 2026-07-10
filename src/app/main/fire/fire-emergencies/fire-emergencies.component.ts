import { Component } from '@angular/core';
import { LocalService } from 'src/app/shared/services/local.service';
import { InfoFireComponent } from 'src/app/panels/info/info-fire/info-fire.component';
import { Fire, FirePhase } from 'src/app/interfaces/fire';
import { AppStateService } from '../../../shared/services/app-state.service';
import { IncomeStatementService } from '../../../shared/services/income-statement.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { RouterModule } from '@angular/router';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { AiAssistantComponent } from 'src/app/panels/ai-assistant/ai-assistant.component';


// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let AddFireComponent: any; setTimeout(() => import('src/app/panels/add/add-fire/add-fire.component').then(m => AddFireComponent = m.AddFireComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let InfoSmileComponent: any; setTimeout(() => import('src/app/panels/info/info-smile/info-smile.component').then(m => InfoSmileComponent = m.InfoSmileComponent));
let HomeComponent: any; setTimeout(() => import('../../home/home.component').then(m => HomeComponent = m.HomeComponent));
let MenuComponent: any; setTimeout(() => import('src/app/panels/menu/menu.component').then(m => MenuComponent = m.MenuComponent));
@Component({
  selector: 'app-fire-emergencies',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppNumberPipe, AppDatePipe, RouterModule, InfoFireComponent, AiAssistantComponent],
  templateUrl: './fire-emergencies.component.html',
  styleUrls: ['./fire-emergencies.component.css', '../../../app.component.css', '../../../shared/styles/table.css']
})
export class FireEmergenciesComponent {

  fireAmount = AppStateService.instance.getAmount("Fire", AppStateService.instance.fire/100);

  static isSearched = false;
  static phaseFilter: 'all' | FirePhase = 'all';
  static get allFireEmergencies(): Fire[] { return AppStateService.instance.allFireEmergencies; }
  static set allFireEmergencies(v: Fire[]) { AppStateService.instance.allFireEmergencies = v; }
  static allSearchedFireEmergencies = []

  searchTextField = "";
  phases: Array<'all' | FirePhase> = ['all', 'idea', 'planning', 'saving', 'ready', 'completed'];

  public classReference = FireEmergenciesComponent;
  public get appReference() { return AppComponent; }
  public settingsReference = SettingsComponent;
  public appState = AppStateService.instance;


  /**
   * Constructs a new instance of the FireEmergenciesComponent class.
   * @param localStorage - The LocalService instance used for accessing local storage.
   */
  constructor(private localStorage: LocalService) {
    this.fireAmount = AppStateService.instance.getAmount("Fire", AppStateService.instance.fire/100);
  }

  search() {
    const searchTerms = this.searchTextField.toLowerCase().split(',');

    FireEmergenciesComponent.allSearchedFireEmergencies = AppStateService.instance.allFireEmergencies.map(fire => {
      const title = fire.title.toLowerCase();
      const totalAmount = this.getTotalAmount(fire);
      const totalTarget = this.getTotalTarget(fire);
      const bucketTitles = fire.buckets?.map(b => b.title.toLowerCase()).join(' ') || '';

      const isFiltered = searchTerms.some(term => 
        title.includes(term.trim()) || 
        String(totalAmount).includes(term.trim()) || 
        String(totalTarget).includes(term.trim()) ||
        bucketTitles.includes(term.trim())
      );

      return {
        ...fire,
        isFiltered: isFiltered
      };
    });
    FireEmergenciesComponent.isSearched = true;
  }
  
  getTotalTarget(fire: any): number {
    return fire.buckets?.reduce((sum: number, b: any) => sum + (b.target || 0), 0) || 0;
  }

  getTotalAmount(fire: any): number {
    return fire.buckets?.reduce((sum: number, b: any) => sum + (b.amount || 0), 0) || 0;
  }

  getProgress(fire: any): number {
    const target = this.getTotalTarget(fire);
    return target > 0 ? (this.getTotalAmount(fire) / target) * 100 : 0;
  }

  getCompletedBucketCount(fire: Fire): number {
    return fire.buckets?.filter(b => b.amount >= b.target).length || 0;
  }

  getTotalBucketCount(fire: Fire): number {
    return fire.buckets?.length || 0;
  }

  areAllBucketsFull(fire: Fire): boolean {
    if (!fire.buckets || fire.buckets.length === 0) return true;
    return fire.buckets.every(b => b.amount >= b.target);
  }

  setPhaseFilter(phase: 'all' | FirePhase) {
    FireEmergenciesComponent.phaseFilter = phase;
  }

  getPhaseCount(phase: FirePhase): number {
    return AppStateService.instance.allFireEmergencies.filter(f => f.phase === phase).length;
  }

  getFilteredEmergencies(): Fire[] {
    const emergencies = FireEmergenciesComponent.isSearched 
      ? FireEmergenciesComponent.allSearchedFireEmergencies.filter((f: any) => f.isFiltered)
      : AppStateService.instance.allFireEmergencies;

    if (FireEmergenciesComponent.phaseFilter === 'all') {
      return [...emergencies].reverse();
    }
    return emergencies.filter(f => f.phase === FireEmergenciesComponent.phaseFilter).reverse();
  }

  getOriginalIndex(emergency: Fire): number {
    return AppStateService.instance.allFireEmergencies.indexOf(emergency);
  }
  
  /**
   * Clears the search results.
   */
  clearSearch() {
    this.searchTextField = "";
    FireEmergenciesComponent.isSearched = false;
  }

  clickRow(index: number){
    AppComponent.gotoTop();
    InfoFireComponent.setInfoFireComponent(
      index, 
      AppStateService.instance.allFireEmergencies[index]
    );
  }

  addFireEmergencie() {
    AddFireComponent.zIndex = 1;
    AddFireComponent.isAddFire = true;
    InfoSmileComponent.isInfo = false;
    AddComponent.isAdd = false;
    MenuComponent.isMenu = false;
    InfoFireComponent.isInfo = false;
  }

  addToFire(index: number) {
    AppComponent.gotoTop();
    AppComponent.addTransaction("Fire", `@${AppStateService.instance.allFireEmergencies[index].title}`, "fireemergencies");
    const fire = AppStateService.instance.allFireEmergencies[index];
    const totalTarget = IncomeStatementService.getTotalFireTarget(fire);
    const totalAmount = IncomeStatementService.getTotalFireAmount(fire);
    AddComponent.commentTextField = `${fire.title} ${totalTarget - totalAmount} `;
  }

  /**
   * Opens the AI Assistant panel for Fire emergencies.
   */
  openAiAssistant() {
    AiAssistantComponent.initialPromptType = 'fire-create';
    AiAssistantComponent.initialContext = 'fire';
    AiAssistantComponent.isOpen = true;
    AiAssistantComponent.zIndex = 2;
  }
}
