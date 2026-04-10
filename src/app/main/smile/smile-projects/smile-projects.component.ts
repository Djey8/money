import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { InfoSmileComponent } from 'src/app/panels/info/info-smile/info-smile.component';
import { LocalService } from 'src/app/shared/services/local.service';
import { Smile, SmilePhase } from 'src/app/interfaces/smile';
import { migrateSmileArray } from 'src/app/shared/smile-migration.utils';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { AppStateService } from '../../../shared/services/app-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { AppDatePipe } from 'src/app/shared/pipes/app-date.pipe';
import { RouterModule } from '@angular/router';
import { AiAssistantComponent } from 'src/app/panels/ai-assistant/ai-assistant.component';

// Deferred imports — resolved after module init to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let AddComponent: any; setTimeout(() => import('src/app/panels/add/add.component').then(m => AddComponent = m.AddComponent));
let AddSmileComponent: any; setTimeout(() => import('src/app/panels/add/add-smile/add-smile.component').then(m => AddSmileComponent = m.AddSmileComponent));
let HomeComponent: any; setTimeout(() => import('../../home/home.component').then(m => HomeComponent = m.HomeComponent));

/**
 * Component for managing Smile Projects.
 */
@Component({
  selector: 'app-smile-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppNumberPipe, AppDatePipe, RouterModule, InfoSmileComponent, AiAssistantComponent],
  templateUrl: './smile-projects.component.html',
  styleUrls: ['./smile-projects.component.css', '../../../app.component.css', '../../../shared/styles/table.css']
})
export class SmileProjectsComponent {

  
  smileAmount = AppStateService.instance.getAmount("Smile", AppStateService.instance.smile/100);

  static isSearched = false;
  static phaseFilter: SmilePhase | 'all' = 'all';
  static get allSmileProjects(): Smile[] { return AppStateService.instance.allSmileProjects; }
  static set allSmileProjects(v: Smile[]) { AppStateService.instance.allSmileProjects = v; }
  static allSearchedSmileProjects: Smile[] = [];

  searchTextField = "";
  phases: (SmilePhase | 'all')[] = ['all', 'planning', 'saving', 'ready', 'completed'];

  public classReference = SmileProjectsComponent;
  public get appReference() { return AppComponent; }
  public settingsReference = SettingsComponent;
  public appState = AppStateService.instance;

  /**
   * Constructs a new SmileProjectsComponent.
   * @param router - The router service.
   * @param localStorage - The local storage service.
   */
  constructor(private router:Router, private localStorage: LocalService) {
    // Only reload from localStorage if AppStateService doesn't have data yet
    // This prevents overwriting in-memory updates when navigating between components
    if (!AppStateService.instance.allSmileProjects || AppStateService.instance.allSmileProjects.length === 0) {
      const rawSmiles = this.localStorage.getData("smile");
      console.log('[Smile Component] Loading from localStorage');
      AppStateService.instance.allSmileProjects = rawSmiles === "" 
        ? [] 
        : migrateSmileArray(JSON.parse(rawSmiles));
    } else {
      console.log('[Smile Component] Using existing data from AppStateService');
    }
    
    this.smileAmount = AppStateService.instance.getAmount("Smile", AppStateService.instance.smile/100);
  }

  /**
   * Performs a search across smile projects.
   */
  search() {
    const searchTerms = this.searchTextField.toLowerCase().split(',');

    SmileProjectsComponent.allSearchedSmileProjects = AppStateService.instance.allSmileProjects.map(smile => {
      // Perform case-insensitive search on multiple fields
      const title = smile.title.toLowerCase();
      const sub = smile.sub?.toLowerCase() || '';
      const description = smile.description?.toLowerCase() || '';
      const amount = String(this.getTotalAmount(smile));
      const target = String(this.getTotalTarget(smile));
      const phase = smile.phase?.toLowerCase() || '';

      const isFiltered = searchTerms.some(term => {
        const t = term.trim();
        return title.includes(t) || 
               sub.includes(t) || 
               description.includes(t) || 
               amount.includes(t) || 
               target.includes(t) ||
               phase.includes(t);
      });

      // Return a new object with the isFiltered field added
      return {
        ...smile,
        isFiltered: isFiltered
      };
    });
    SmileProjectsComponent.isSearched = true;
  }

  /**
   * Clears the search results.
   */
  clearSearch() {
    this.searchTextField = "";
    SmileProjectsComponent.isSearched = false;
    SmileProjectsComponent.allSearchedSmileProjects = [];
  }

  /**
   * Set the phase filter.
   * @param phase - The phase to filter by, or 'all' for no filter.
   */
  setPhaseFilter(phase: SmilePhase | 'all') {
    SmileProjectsComponent.phaseFilter = phase;
  }

  /**
   * Get the count of projects in a specific phase.
   * @param phase - The phase to count, or 'all' for total count.
   * @returns The number of projects in the specified phase.
   */
  getPhaseCount(phase: SmilePhase | 'all'): number {
    if (phase === 'all') {
      return AppStateService.instance.allSmileProjects.length;
    }
    return AppStateService.instance.allSmileProjects.filter(p => p.phase === phase).length;
  }

  /**
   * Get the filtered smile projects based on current phase filter.
   * @returns Array of smile projects filtered by current phase.
   */
  getFilteredProjects(): Smile[] {
    const projects = SmileProjectsComponent.isSearched 
      ? SmileProjectsComponent.allSearchedSmileProjects.filter((p: any) => p.isFiltered)
      : AppStateService.instance.allSmileProjects;
    
    let filtered: Smile[];
    if (SmileProjectsComponent.phaseFilter === 'all') {
      filtered = projects;
    } else {
      filtered = projects.filter(p => p.phase === SmileProjectsComponent.phaseFilter);
    }
    
    // Reverse order: newest first
    return filtered.slice().reverse();
  }

  /**
   * Get the total number of buckets in a project.
   * @param smile - The smile project.
   * @returns The total number of buckets, or 1 if no buckets exist (legacy format).
   */
  getTotalBucketCount(smile: Smile): number {
    return smile.buckets?.length || 1;
  }

  /**
   * Get the number of completed buckets in a project.
   * @param smile - The smile project.
   * @returns The number of completed buckets.
   */
  getCompletedBucketCount(smile: Smile): number {
    if (!smile.buckets || smile.buckets.length === 0) {
      // Legacy format: check if project is completed
      return smile.phase === 'completed' ? 1 : 0;
    }
    return smile.buckets.filter(b => b.amount >= b.target).length;
  }

  /**
   * Get total target amount across all buckets.
   * @param smile - The smile project.
   * @returns The total target amount.
   */
  getTotalTarget(smile: Smile): number {
    if (!smile.buckets?.length) return 0;
    return smile.buckets.reduce((sum, bucket) => sum + (bucket.target || 0), 0);
  }

  /**
   * Get total saved amount across all buckets.
   * @param smile - The smile project.
   * @returns The total saved amount.
   */
  getTotalAmount(smile: Smile): number {
    if (!smile.buckets?.length) return 0;
    return smile.buckets.reduce((sum, bucket) => sum + (bucket.amount || 0), 0);
  }

  /**
   * Calculate the overall progress percentage of a project based on total amounts.
   * @param smile - The smile project.
   * @returns The progress percentage (0-100).
   */
  getBucketProgress(smile: Smile): number {
    const total = this.getTotalTarget(smile);
    if (total === 0) return 0;
    return Math.min(100, (this.getTotalAmount(smile) / total) * 100);
  }

  /**
   * Get the original index of a smile project before filtering.
   * @param smile - The smile project.
   * @returns The original index in the unfiltered array.
   */
  getOriginalIndex(smile: Smile): number {
    return AppStateService.instance.allSmileProjects.findIndex(p => 
      p.title === smile.title && p.createdAt === smile.createdAt
    );
  }

  /**
   * Check if a project has associated transactions.
   * @param smile - The smile project.
   * @returns True if the project has linked transactions.
   */
  hasTransactions(smile: Smile): boolean {
    // Check if there are any transactions with this project in comments
    return this.getTotalAmount(smile) > 0;
  }

  /**
   * Check if all buckets in a project are full (amount >= target).
   * @param smile - The smile project.
   * @returns True if all buckets are at or above their targets.
   */
  areAllBucketsFull(smile: Smile): boolean {
    if (!smile.buckets || smile.buckets.length === 0) {
      return false; // No buckets means no restriction
    }
    
    // Check if ALL buckets are full
    return smile.buckets.every(bucket => bucket.amount >= bucket.target);
  }

  /**
   * Handles the click event on a row in the Smile Projects table.
   * @param index - The index of the clicked row.
   */
  clickRow(index: number){
    AppComponent.gotoTop();
    InfoSmileComponent.setInfoSmileComponent(
      index,
      AppStateService.instance.allSmileProjects[index]
    );
  }

  /**
   * Adds a new Smile Project.
   */
  addSmileProject() {
    //AccountingComponent.allTransactions.push({account:'Daily', amount: 0.5, date:'27th may 23'});
    AddSmileComponent.zIndex = 1;
    AddSmileComponent.isAddSmile = true;
    InfoSmileComponent.isInfo = false;
    AddComponent.isAdd = false;
  }

  /**
   * Adds an amount to a Smile Project.
   * @param index - The index of the Smile Project.
   */
  addToProject(index: number) {
    AppComponent.gotoTop();
    AppComponent.addTransaction("Smile", `@${AppStateService.instance.allSmileProjects[index].title}`, "smileprojects");
    const project = AppStateService.instance.allSmileProjects[index];
    const totalTarget = project.buckets.reduce((sum, b) => sum + (b.target || 0), 0);
    const totalAmount = project.buckets.reduce((sum, b) => sum + (b.amount || 0), 0);
    AddComponent.commentTextField = `${project.title} ${totalTarget - totalAmount} `;
  }

  /**
   * Opens the AI Assistant panel for Smile projects.
   */
  openAiAssistant() {
    AiAssistantComponent.initialPromptType = 'smile-create';
    AiAssistantComponent.initialContext = 'smile';
    AiAssistantComponent.isOpen = true;
    AiAssistantComponent.zIndex = 2;
  }
}
