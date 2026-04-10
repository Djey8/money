import { Component, EventEmitter, Input, Output, DoCheck } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TrapFocusDirective } from 'src/app/shared/directives/trap-focus.directive';
import { PromptGeneratorService, PromptOptions, PromptType, BROKER_OPTIONS, COUNTRY_OPTIONS } from 'src/app/shared/services/prompt-generator.service';
import { Grow } from 'src/app/interfaces/grow';
import { Smile } from 'src/app/interfaces/smile';
import { Fire } from 'src/app/interfaces/fire';
import { PlannedSubscription, PlannedSubscriptionStatus } from 'src/app/interfaces/planned-subscription';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { PersistenceService } from 'src/app/shared/services/persistence.service';
import { ToastService } from 'src/app/shared/services/toast.service';
import { ConfirmService } from 'src/app/shared/services/confirm.service';
import { isDuplicateTitle } from 'src/app/shared/validation.utils';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TrapFocusDirective],
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.css', '../../shared/styles/add-form.css', '../../shared/styles/filter-styles.css']
})
export class AiAssistantComponent implements DoCheck {
  static isOpen = false;
  static zIndex = 0;
  static initialStep: 'options' | 'prompt' | 'import' = 'options';
  static initialPromptType: PromptType = 'grow-strategy';
  static initialContext: 'grow' | 'smile' | 'fire' | 'all' = 'all';

  classReference = AiAssistantComponent;
  context: 'grow' | 'smile' | 'fire' | 'all' = 'all';

  // Panel state
  currentStep: 'options' | 'prompt' | 'import' = 'options';
  promptType: PromptType = 'grow-strategy';

  // Track previous open state to detect changes
  private previousIsOpen = false;

  // Prompt options
  options: PromptOptions;
  brokerOptions = BROKER_OPTIONS;
  countryOptions = COUNTRY_OPTIONS;

  // Generated prompt
  generatedPrompt = '';
  copySuccess = false;

  // UI state
  showAdvanced = false;
  customBroker = '';
  customCountry = '';
  skippedPrompt = false;
  customNumberOfSuggestions: number | undefined = undefined;
  customInformationFocus = ''; // For Smile "Other" checkbox
  customResearchNeeds = ''; // For Fire "Other" checkbox
  customImproveInformationFocus = ''; // For Improve "Other" checkbox

  // Import
  importText = '';
  importError = '';
  importedProjects: Grow[] = [];
  importSuccess = false;
  importType: 'income-growth' | 'budget-optimization' | 'subscription-action' | 'expense-insight' | 'smile-project' | 'fire-emergency' = 'income-growth';

  // Improve mode - update preview
  importedSmileUpdates: Smile[] = [];
  importedFireUpdates: Fire[] = [];
  updateValidationWarnings: string[] = [];

  constructor(
    private promptService: PromptGeneratorService,
    private persistence: PersistenceService,
    private toast: ToastService,
    private confirmService: ConfirmService
  ) {
    this.options = this.promptService.getDefaultOptions();
    this.currentStep = AiAssistantComponent.initialStep;
    this.promptType = AiAssistantComponent.initialPromptType;
  }

  ngDoCheck() {
    // Detect when panel is opened (transition from closed to open)
    if (AiAssistantComponent.isOpen && !this.previousIsOpen) {
      // Panel just opened - sync with static initializers and reset options
      this.currentStep = AiAssistantComponent.initialStep;
      this.promptType = AiAssistantComponent.initialPromptType;
      this.context = AiAssistantComponent.initialContext;
      this.options = this.promptService.getDefaultOptions();
      this.customInformationFocus = '';
      this.customResearchNeeds = '';
      this.customImproveInformationFocus = '';
      this.customNumberOfSuggestions = undefined;
      this.importedSmileUpdates = [];
      this.importedFireUpdates = [];
      this.updateValidationWarnings = [];
    }
    this.previousIsOpen = AiAssistantComponent.isOpen;
  }

  highlight() {
    AiAssistantComponent.zIndex = 2;
  }

  closeWindow() {
    AiAssistantComponent.isOpen = false;
    AiAssistantComponent.zIndex = 0;
    AiAssistantComponent.initialStep = 'options';
    AiAssistantComponent.initialPromptType = 'grow-strategy';
    AiAssistantComponent.initialContext = 'all';
    this.currentStep = 'options';
    this.promptType = 'grow-strategy';
    this.context = 'all';
    this.generatedPrompt = '';
    this.importText = '';
    this.importError = '';
    this.importedProjects = [];
    this.importSuccess = false;
    this.importType = 'income-growth';
    this.copySuccess = false;
    this.skippedPrompt = false;
    this.options = this.promptService.getDefaultOptions();
    this.customInformationFocus = '';
    this.customResearchNeeds = '';
    this.customImproveInformationFocus = '';
    this.customNumberOfSuggestions = undefined;
    this.importedSmileUpdates = [];
    this.importedFireUpdates = [];
    this.updateValidationWarnings = [];
  }

  // --- Privacy Toggle ---
  toggleAnonymization() {
    // If currently anonymized and user wants to turn it OFF (see exact values)
    if (this.options.anonymized) {
      this.confirmService.confirm(
        'Warning: The prompt will contain your real financial data (exact amounts, names, and titles). Only paste this into AI services you trust. Do you want to continue?',
        () => {
          this.options.anonymized = false;
        },
        'Confirm.continue',
        'primary'
      );
    } else {
      // User wants to turn anonymization back ON (safe)
      this.options.anonymized = true;
    }
  }

  // --- Context filtering for dropdown ---
  isPromptTypeVisible(promptType: PromptType): boolean {
    if (this.context === 'all') return true;
    if (this.context === 'grow') {
      return ['grow-strategy', 'budget-optimizer', 'subscription-audit', 'expense-pattern'].includes(promptType);
    }
    if (this.context === 'smile') {
      return ['smile-create', 'smile-improve'].includes(promptType);
    }
    if (this.context === 'fire') {
      return ['fire-create', 'fire-improve'].includes(promptType);
    }
    return true;
  }

  // --- Context filtering for import types ---
  isImportTypeVisible(importType: string): boolean {
    if (this.context === 'all') return true;
    if (this.context === 'grow') {
      return ['income-growth', 'budget-optimization', 'subscription-action', 'expense-insight'].includes(importType);
    }
    if (this.context === 'smile') {
      return importType === 'smile-project';
    }
    if (this.context === 'fire') {
      return importType === 'fire-emergency';
    }
    return true;
  }

  // --- Helper for checkbox arrays ---
  toggleArrayValue(array: string[], value: string) {
    const index = array.indexOf(value);
    if (index > -1) {
      array.splice(index, 1);
    } else {
      array.push(value);
    }
  }

  // --- Step 1: Generate Prompt ---
  generatePrompt() {
    // Resolve custom "Other" values
    const opts = { ...this.options };
    if (opts.broker === 'Other' && this.customBroker.trim()) {
      opts.broker = this.customBroker.trim();
    }
    if ((opts.country === 'Other' || opts.country === 'Other EU') && this.customCountry.trim()) {
      opts.country = this.customCountry.trim();
    }
    if (opts.numberOfSuggestions === -1 && this.customNumberOfSuggestions && this.customNumberOfSuggestions > 0) {
      opts.numberOfSuggestions = this.customNumberOfSuggestions;
    }
    // Resolve custom information focus for Smile
    if (opts.smileInformationFocus.includes('custom') && this.customInformationFocus.trim()) {
      opts.smileCustomInformationFocus = this.customInformationFocus.trim();
    }
    // Resolve custom research needs for Fire
    if (opts.fireResearchNeeds.includes('custom') && this.customResearchNeeds.trim()) {
      opts.fireCustomResearchNeeds = this.customResearchNeeds.trim();
    }

    // Generate prompt based on type
    switch (this.promptType) {
      case 'grow-strategy':
        this.generatedPrompt = this.promptService.generateGrowPrompt(opts);
        break;
      case 'budget-optimizer':
        this.generatedPrompt = this.promptService.generateBudgetOptimizerPrompt(opts);
        break;
      case 'subscription-audit':
        this.generatedPrompt = this.promptService.generateSubscriptionAuditPrompt(opts);
        break;
      case 'expense-pattern':
        this.generatedPrompt = this.promptService.generateExpensePatternAnalysisPrompt(opts);
        break;
      case 'smile-create':
        const smileOpts = { ...opts };
        if (smileOpts.smileNumberOfSuggestions === -1 && this.customNumberOfSuggestions && this.customNumberOfSuggestions > 0) {
          smileOpts.smileNumberOfSuggestions = this.customNumberOfSuggestions;
        }
        this.generatedPrompt = this.promptService.generateSmileCreatePrompt({
          goal: smileOpts.smileGoal || 'My Smile Project Goal',
          urgency: smileOpts.smileUrgency,
          researchDepth: smileOpts.smileResearchDepth,
          informationFocus: smileOpts.smileInformationFocus,
          budgetFlexibility: smileOpts.smileBudgetFlexibility,
          complexity: smileOpts.smileComplexity,
          numberOfSuggestions: smileOpts.smileNumberOfSuggestions,
          anonymized: smileOpts.anonymized
        });
        break;
      case 'smile-improve':
        if (opts.selectedSmileProjects.length === 0) {
          this.generatedPrompt = 'Please select at least one Smile project to improve.';
          this.currentStep = 'prompt';
          return;
        }
        // Resolve custom info focus
        if (opts.improveInformationFocus.includes('custom') && this.customImproveInformationFocus.trim()) {
          opts.improveInformationFocus = opts.improveInformationFocus.filter(f => f !== 'custom');
          opts.improveInformationFocus.push(this.customImproveInformationFocus.trim());
        }
        const selectedSmileProjects = this.getSelectedSmileProjectObjects();
        this.generatedPrompt = this.promptService.generateSmileImprovePrompt(selectedSmileProjects, {
          userPlan: opts.improveUserPlan,
          improvementAreas: opts.improveAreas,
          researchDepth: opts.improveDetailLevel,
          informationFocus: opts.improveInformationFocus,
          customInstructions: opts.improveCustomInstructions,
          anonymized: opts.anonymized
        });
        break;
      case 'fire-create':
        const fireOpts = { ...opts };
        if (fireOpts.fireNumberOfSuggestions === -1 && this.customNumberOfSuggestions && this.customNumberOfSuggestions > 0) {
          fireOpts.fireNumberOfSuggestions = this.customNumberOfSuggestions;
        }
        this.generatedPrompt = this.promptService.generateFireCreatePrompt({
          emergencyType: fireOpts.fireEmergencyType,
          totalAmount: fireOpts.fireTotalAmount,
          alreadyBorrowed: fireOpts.fireAlreadyBorrowed,
          lenderDetails: fireOpts.fireLenderDetails,
          urgency: fireOpts.fireUrgency,
          paybackStrategy: fireOpts.firePaybackStrategy,
          researchNeeds: fireOpts.fireResearchNeeds,
          numberOfSuggestions: fireOpts.fireNumberOfSuggestions,
          anonymized: fireOpts.anonymized
        });
        break;
      case 'fire-improve':
        if (opts.selectedFireEmergencies.length === 0) {
          this.generatedPrompt = 'Please select at least one Fire emergency to improve.';
          this.currentStep = 'prompt';
          return;
        }
        // Resolve custom info focus
        if (opts.improveInformationFocus.includes('custom') && this.customImproveInformationFocus.trim()) {
          opts.improveInformationFocus = opts.improveInformationFocus.filter(f => f !== 'custom');
          opts.improveInformationFocus.push(this.customImproveInformationFocus.trim());
        }
        const selectedFireEmergencies = this.getSelectedFireEmergencyObjects();
        this.generatedPrompt = this.promptService.generateFireImprovePrompt(selectedFireEmergencies, {
          userPlan: opts.improveUserPlan,
          improvementAreas: opts.improveAreas,
          researchDepth: opts.improveDetailLevel,
          informationFocus: opts.improveInformationFocus,
          customInstructions: opts.improveCustomInstructions,
          anonymized: opts.anonymized
        });
        break;
      default:
        this.generatedPrompt = this.promptService.generateGrowPrompt(opts);
    }

    this.currentStep = 'prompt';
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.generatedPrompt).then(() => {
      this.copySuccess = true;
      setTimeout(() => this.copySuccess = false, 2000);
    });
  }

  goToImport() {
    // Set import type based on prompt type
    if (this.promptType === 'budget-optimizer') {
      this.importType = 'budget-optimization';
    } else if (this.promptType === 'subscription-audit') {
      this.importType = 'subscription-action';
    } else if (this.promptType === 'expense-pattern') {
      this.importType = 'expense-insight';
    } else if (this.promptType === 'smile-create' || this.promptType === 'smile-improve') {
      this.importType = 'smile-project';
    } else if (this.promptType === 'fire-create' || this.promptType === 'fire-improve') {
      this.importType = 'fire-emergency';
    } else {
      this.importType = 'income-growth';
    }
    this.currentStep = 'import';
  }

  skipToImport() {
    this.skippedPrompt = true;
    // Set import type based on prompt type
    if (this.promptType === 'budget-optimizer') {
      this.importType = 'budget-optimization';
    } else if (this.promptType === 'subscription-audit') {
      this.importType = 'subscription-action';
    } else if (this.promptType === 'expense-pattern') {
      this.importType = 'expense-insight';
    } else if (this.promptType === 'smile-create' || this.promptType === 'smile-improve') {
      this.importType = 'smile-project';
    } else if (this.promptType === 'fire-create' || this.promptType === 'fire-improve') {
      this.importType = 'fire-emergency';
    } else {
      this.importType = 'income-growth';
    }
    this.currentStep = 'import';
  }

  goBack() {
    if (this.currentStep === 'prompt') {
      this.currentStep = 'options';
    } else if (this.currentStep === 'import') {
      if (this.skippedPrompt) {
        this.skippedPrompt = false;
        this.currentStep = 'options';
      } else {
        this.currentStep = 'prompt';
      }
    }
  }

  // --- Step 3: Import ---
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (!file.name.endsWith('.json')) {
      this.importError = 'Please select a .json file';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.importText = reader.result as string;
      this.importError = '';
    };
    reader.readAsText(file);
  }

  parseAndPreview() {
    this.importError = '';
    this.importedProjects = [];
    this.importedSmileUpdates = [];
    this.importedFireUpdates = [];
    this.updateValidationWarnings = [];

    if (!this.importText.trim()) {
      this.importError = 'Please paste the JSON response or upload a file.';
      return;
    }

    // Route to improve parsers when in improve mode
    if (this.promptType === 'smile-improve' && this.importType === 'smile-project') {
      this.parseSmileUpdates();
      return;
    } else if (this.promptType === 'fire-improve' && this.importType === 'fire-emergency') {
      this.parseFireUpdates();
      return;
    }

    // Handle Smile and Fire imports separately
    if (this.importType === 'smile-project') {
      this.parseSmileProjects();
      return;
    } else if (this.importType === 'fire-emergency') {
      this.parseFireEmergencies();
      return;
    }

    // Original Grow import logic
    try {
      const rawText = this.importText.trim();
      let parsed: any;

      // Strategy: Try to extract JSON from the text in multiple ways
      // 1. Try direct JSON parse (user pasted only JSON)
      // 2. Extract JSON array from markdown code blocks
      // 3. Extract individual JSON objects from markdown code blocks

      try {
        parsed = JSON.parse(rawText);
      } catch {
        // Not plain JSON — extract from markdown code blocks
        const codeBlocks = this.extractJsonFromCodeBlocks(rawText);
        if (codeBlocks.length === 0) {
          throw new Error('No JSON found');
        }

        // Find the largest array (the combined one at the end) or merge individual objects
        let bestArray: any[] | null = null;
        const individualObjects: any[] = [];

        for (const block of codeBlocks) {
          try {
            const blockParsed = JSON.parse(block);
            if (Array.isArray(blockParsed) && (!bestArray || blockParsed.length > bestArray.length)) {
              bestArray = blockParsed;
            } else if (typeof blockParsed === 'object' && !Array.isArray(blockParsed) && blockParsed.title) {
              individualObjects.push(blockParsed);
            }
          } catch { /* skip invalid blocks */ }
        }

        // Prefer the combined array if it has all items, otherwise use individual objects
        parsed = (bestArray && bestArray.length >= individualObjects.length) ? bestArray : individualObjects;
      }

      // Handle if LLM wrapped it in an object
      if (!Array.isArray(parsed)) {
        if (parsed.projects && Array.isArray(parsed.projects)) {
          parsed = parsed.projects;
        } else if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          parsed = parsed.recommendations;
        } else {
          parsed = [parsed];
        }
      }

      const validated: Grow[] = [];
      const errors: string[] = [];

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item.title || typeof item.title !== 'string') {
          errors.push(`Item ${i + 1}: missing or invalid "title"`);
          continue;
        }
        // Sanitize strings to prevent XSS
        const sanitize = (val: any): string => {
          if (typeof val !== 'string') return '';
          return val.replace(/<[^>]*>/g, '').substring(0, 2000);
        };

        // Use the user-selected import type from the dropdown
        let growType = this.importType;

        // For budget optimization: recalculate using real budget amounts
        let actualCurrentCost = typeof item.currentCost === 'number' ? item.currentCost : (item.currentCost ? parseFloat(item.currentCost) : undefined);
        let actualTargetCost = typeof item.targetCost === 'number' ? item.targetCost : (item.targetCost ? parseFloat(item.targetCost) : undefined);
        let actualMonthlySavings = typeof item.monthlySavings === 'number' ? item.monthlySavings : (item.monthlySavings ? parseFloat(item.monthlySavings) : undefined);
        let actualAnnualSavings = typeof item.annualSavings === 'number' ? item.annualSavings : (item.annualSavings ? parseFloat(item.annualSavings) : undefined);

        if (growType === 'budget-optimization' && item.category) {
          // Handle category as string or array (bundled categories)
          const categories = Array.isArray(item.category) ? item.category : [item.category];
          
          // Sum up budget amounts from all categories
          let totalRealBudgetAmount = 0;
          let foundCategories: string[] = [];
          
          categories.forEach(cat => {
            const realAmount = this.getActualBudgetAmount(cat);
            if (realAmount !== undefined && realAmount > 0) {
              totalRealBudgetAmount += realAmount;
              foundCategories.push(cat);
            }
          });
          
          if (totalRealBudgetAmount > 0) {
            // Calculate AI's recommended reduction percentage
            let reductionPercentage = 0;
            
            if (actualCurrentCost && actualCurrentCost > 0 && actualTargetCost !== undefined) {
              // Calculate percentage from AI's currentCost -> targetCost reduction
              reductionPercentage = ((actualCurrentCost - actualTargetCost) / actualCurrentCost) * 100;
            } else if (item.percentage !== undefined) {
              // Use explicit percentage if provided
              reductionPercentage = parseFloat(item.percentage);
            }

            // Apply reduction percentage to real budget amount
            if (reductionPercentage > 0) {
              actualCurrentCost = totalRealBudgetAmount;
              actualTargetCost = totalRealBudgetAmount * (1 - reductionPercentage / 100);
              actualMonthlySavings = actualCurrentCost - actualTargetCost;
              actualAnnualSavings = actualMonthlySavings * 12;

              console.log('[Budget Optimizer] Recalculated for bundled categories', foundCategories, ':', {
                realBudgetTotal: totalRealBudgetAmount,
                aiReduction: reductionPercentage.toFixed(1) + '%',
                newTarget: actualTargetCost.toFixed(2),
                monthlySavings: actualMonthlySavings.toFixed(2),
                annualSavings: actualAnnualSavings.toFixed(2)
              });
            } else {
              // No reduction percentage available, just use real budget as currentCost
              actualCurrentCost = totalRealBudgetAmount;
              console.log('[Budget Optimizer] Using real budget total for', foundCategories, ':', totalRealBudgetAmount);
            }
          }
        }

        const grow: Grow = {
          title: sanitize(item.title).substring(0, 100),
          sub: sanitize(item.sub || item.category || ''),
          phase: (['idea','research','plan','execute','monitor','completed'].includes(item.phase)) ? item.phase : 'idea',
          description: sanitize(item.description || item.reasoning || ''),
          strategy: sanitize(item.strategy || ''),
          riskScore: typeof item.riskScore === 'number' ? Math.min(5, Math.max(0, item.riskScore)) : parseFloat(item.riskScore) || 0,
          risks: sanitize(item.risks || ''),
          cashflow: typeof item.cashflow === 'number' ? item.cashflow : parseFloat(item.cashflow) || 0,
          amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0,
          isAsset: !!item.isAsset,
          share: item.share && ('quantity' in item.share) && ('price' in item.share) ? {
            tag: sanitize(item.share.tag || item.title).substring(0, 100),
            quantity: parseFloat(item.share.quantity) || 0,
            price: parseFloat(item.share.price) || 0
          } : null,
          investment: item.investment && ('amount' in item.investment) ? {
            tag: sanitize(item.investment.tag || item.title).substring(0, 100),
            deposit: parseFloat(item.investment.deposit) || 0,
            amount: parseFloat(item.investment.amount) || 0
          } : null,
          liabilitie: item.liabilitie && ('amount' in item.liabilitie) ? {
            tag: sanitize(item.liabilitie.tag || item.title).substring(0, 100),
            amount: parseFloat(item.liabilitie.amount) || 0,
            investment: !!item.liabilitie.investment,
            credit: parseFloat(item.liabilitie.credit) || 0
          } : null,
          actionItems: Array.isArray(item.actionItems) ? item.actionItems.map((a: any) => ({
            text: sanitize(a.text).substring(0, 500),
            done: !!a.done,
            priority: (['low','medium','high'].includes(a.priority)) ? a.priority : 'medium',
            ...(a.dueDate ? { dueDate: sanitize(a.dueDate) } : {})
          })) : [],
          links: Array.isArray(item.links) ? item.links.filter((l: any) => l.label && l.url).map((l: any) => ({
            label: sanitize(l.label).substring(0, 200),
            url: sanitize(l.url).substring(0, 500)
          })) : [],
          notes: item.notes ? [{ text: sanitize(typeof item.notes === 'string' ? item.notes : ''), createdAt: new Date().toISOString() }] : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          
          // NEW: Set type and expense optimization fields
          type: growType,
          category: item.category ? (
            Array.isArray(item.category) 
              ? item.category.map(cat => sanitize(String(cat))).filter(cat => cat.length > 0)
              : sanitize(String(item.category))
          ) : undefined,
          currentCost: actualCurrentCost,
          targetCost: actualTargetCost,
          monthlySavings: actualMonthlySavings,
          annualSavings: actualAnnualSavings,
          reasoning: item.reasoning ? sanitize(item.reasoning) : undefined,
          alternative: item.alternative ? sanitize(item.alternative) : undefined,
          alternativeCost: typeof item.alternativeCost === 'number' ? item.alternativeCost : (item.alternativeCost ? parseFloat(item.alternativeCost) : undefined),
          pattern: item.pattern ? sanitize(item.pattern) : undefined,
          insights: item.insights ? sanitize(item.insights) : undefined,

        };
        console.log('[AI Import] Created grow object:', grow.title, 'with type:', grow.type, '(promptType:', this.promptType, ')');
        validated.push(grow);
      }

      if (errors.length > 0 && validated.length === 0) {
        this.importError = errors.join('\n');
        return;
      }

      this.importedProjects = validated;
      if (errors.length > 0) {
        this.importError = `${errors.length} item(s) skipped due to errors. ${validated.length} ready to import.`;
      }
    } catch (e: any) {
      this.importError = 'No valid JSON found. Copy the JSON code blocks from the AI response, or the entire response.';
    }
  }

  private parseSmileProjects() {
    try {
      const rawText = this.importText.trim();
      let parsed = this.extractAndParseJson(rawText);

      // Handle if LLM wrapped it in an object
      if (!Array.isArray(parsed)) {
        if (parsed.projects && Array.isArray(parsed.projects)) {
          parsed = parsed.projects;
        } else if (parsed.smileProjects && Array.isArray(parsed.smileProjects)) {
          parsed = parsed.smileProjects;
        } else {
          parsed = [parsed];
        }
      }

      const validated: Smile[] = [];
      const errors: string[] = [];

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item.title || typeof item.title !== 'string') {
          errors.push(`Item ${i + 1}: missing or invalid "title"`);
          continue;
        }
        if (!item.buckets || !Array.isArray(item.buckets) || item.buckets.length === 0) {
          errors.push(`Item ${i + 1}: missing or invalid "buckets" array`);
          continue;
        }

        // Construct Smile object
        const smile: Smile = {
          title: this.sanitize(item.title),
          sub: this.sanitize(item.sub || ''),
          phase: item.phase || 'idea',
          description: this.sanitize(item.description || ''),
          targetDate: item.targetDate || '',
          completionDate: item.completionDate || undefined,
          buckets: item.buckets.map((b: any, idx: number) => ({
            id: b.id || `bucket-${idx + 1}`,
            title: this.sanitize(b.title || `Bucket ${idx + 1}`),
            target: typeof b.target === 'number' ? b.target : parseFloat(b.target) || 0,
            amount: typeof b.amount === 'number' ? b.amount : parseFloat(b.amount) || 0,
            notes: this.sanitize(b.notes || ''),
            links: Array.isArray(b.links) ? b.links.map((l: any) => ({
              label: this.sanitize(l.label || ''),
              url: this.sanitize(l.url || '')
            })) : [],
            targetDate: b.targetDate || undefined,
            completionDate: b.completionDate || undefined
          })),
          links: Array.isArray(item.links) ? item.links.map((l: any) => ({
            label: this.sanitize(l.label || ''),
            url: this.sanitize(l.url || '')
          })) : [],
          actionItems: Array.isArray(item.actionItems) ? item.actionItems.map((a: any) => ({
            text: this.sanitize(a.text || ''),
            done: a.done === true,
            priority: a.priority || 'medium',
            dueDate: a.dueDate || undefined
          })) : [],
          notes: Array.isArray(item.notes) ? item.notes.map((n: any) => ({
            text: this.sanitize(n.text || ''),
            createdAt: n.createdAt || new Date().toISOString()
          })) : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Support both field names for backwards compatibility and transform to proper PlannedSubscription format
          plannedSubscriptions: this.transformPaymentPlans(item.plannedSubscriptions || item.plannedPayments || [], item.title, 'smile', item.buckets)
        };

        validated.push(smile);
      }

      (this.importedProjects as any) = validated;
      if (errors.length > 0) {
        this.importError = `${errors.length} item(s) skipped due to errors. ${validated.length} ready to import.`;
      }
    } catch (e: any) {
      this.importError = `Failed to parse Smile projects: ${e.message}`;
    }
  }

  private parseFireEmergencies() {
    try {
      const rawText = this.importText.trim();
      let parsed = this.extractAndParseJson(rawText);

      // Handle if LLM wrapped it in an object
      if (!Array.isArray(parsed)) {
        if (parsed.emergencies && Array.isArray(parsed.emergencies)) {
          parsed = parsed.emergencies;
        } else if (parsed.fireEmergencies && Array.isArray(parsed.fireEmergencies)) {
          parsed = parsed.fireEmergencies;
        } else {
          parsed = [parsed];
        }
      }

      const validated: Fire[] = [];
      const errors: string[] = [];

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item.title || typeof item.title !== 'string') {
          errors.push(`Item ${i + 1}: missing or invalid "title"`);
          continue;
        }
        if (!item.buckets || !Array.isArray(item.buckets) || item.buckets.length === 0) {
          errors.push(`Item ${i + 1}: missing or invalid "buckets" array`);
          continue;
        }

        // Construct Fire object
        const fire: Fire = {
          title: this.sanitize(item.title),
          sub: this.sanitize(item.sub || ''),
          phase: item.phase || 'idea',
          description: this.sanitize(item.description || ''),
          targetDate: item.targetDate || '',
          completionDate: item.completionDate || undefined,
          buckets: item.buckets.map((b: any, idx: number) => ({
            id: b.id || `bucket-${idx + 1}`,
            title: this.sanitize(b.title || `Bucket ${idx + 1}`),
            target: typeof b.target === 'number' ? b.target : parseFloat(b.target) || 0,
            amount: typeof b.amount === 'number' ? b.amount : parseFloat(b.amount) || 0,
            notes: this.sanitize(b.notes || ''),
            links: Array.isArray(b.links) ? b.links.map((l: any) => ({
              label: this.sanitize(l.label || ''),
              url: this.sanitize(l.url || '')
            })) : [],
            targetDate: b.targetDate || undefined,
            completionDate: b.completionDate || undefined
          })),
          links: Array.isArray(item.links) ? item.links.map((l: any) => ({
            label: this.sanitize(l.label || ''),
            url: this.sanitize(l.url || '')
          })) : [],
          actionItems: Array.isArray(item.actionItems) ? item.actionItems.map((a: any) => ({
            text: this.sanitize(a.text || ''),
            done: a.done === true,
            priority: a.priority || 'medium',
            dueDate: a.dueDate || undefined
          })) : [],
          notes: Array.isArray(item.notes) ? item.notes.map((n: any) => ({
            text: this.sanitize(n.text || ''),
            createdAt: n.createdAt || new Date().toISOString()
          })) : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Support both field names for backwards compatibility and transform to proper PlannedSubscription format
          plannedSubscriptions: this.transformPaymentPlans(item.plannedSubscriptions || item.plannedPayments || [], item.title, 'fire', item.buckets)
        };

        validated.push(fire);
      }

      (this.importedProjects as any) = validated;
      if (errors.length > 0) {
        this.importError = `${errors.length} item(s) skipped due to errors. ${validated.length} ready to import.`;
      }
    } catch (e: any) {
      this.importError = `Failed to parse Fire emergencies: ${e.message}`;
    }
  }

  private extractAndParseJson(rawText: string): any {
    try {
      return JSON.parse(rawText);
    } catch {
      // Not plain JSON — extract from markdown code blocks
      const codeBlocks = this.extractJsonFromCodeBlocks(rawText);
      if (codeBlocks.length === 0) {
        throw new Error('No JSON found');
      }

      // Find the largest array or merge individual objects
      let bestArray: any[] | null = null;
      const individualObjects: any[] = [];

      for (const block of codeBlocks) {
        try {
          const blockParsed = JSON.parse(block);
          if (Array.isArray(blockParsed) && (!bestArray || blockParsed.length > bestArray.length)) {
            bestArray = blockParsed;
          } else if (typeof blockParsed === 'object' && !Array.isArray(blockParsed) && blockParsed.title) {
            individualObjects.push(blockParsed);
          }
        } catch { /* skip invalid blocks */ }
      }

      return (bestArray && bestArray.length >= individualObjects.length) ? bestArray : individualObjects;
    }
  }

  private sanitize(val: any): string {
    if (typeof val !== 'string') return '';
    return val.replace(/<[^>]*>/g, '').substring(0, 2000);
  }

  /**
   * Transform simplified AI payment plan format to proper PlannedSubscription objects
   */
  private transformPaymentPlans(plans: any[], projectTitle: string, projectType: 'smile' | 'fire', buckets: any[]): PlannedSubscription[] {
    if (!Array.isArray(plans)) return [];
    
    return plans.map(plan => {
      // Handle both 'targetBuckets' and 'targetBucketIds' field names
      let targetBucketIds: string[] = [];
      if (Array.isArray(plan.targetBucketIds)) {
        targetBucketIds = plan.targetBucketIds;
      } else if (Array.isArray(plan.targetBuckets)) {
        targetBucketIds = plan.targetBuckets;
      }
      
      // Transform 'all' string to empty array (means all buckets)
      if (targetBucketIds.length === 1 && targetBucketIds[0] === 'all') {
        targetBucketIds = [];
      }
      
      // Handle 'active' boolean vs 'status' field
      let status: PlannedSubscriptionStatus = 'planned';
      if (plan.status) {
        status = plan.status;
      } else if (plan.active === true) {
        status = 'active';
      } else if (plan.active === false) {
        status = 'planned';
      }
      
      // Generate title from description or id if not provided
      const title = plan.title || plan.description || plan.id || 'Payment Plan';
      
      // Use Smile or Fire account based on project type
      const account = projectType === 'smile' ? 'Smile' : 'Fire';
      
      // Generate comment with bucket allocation tags
      let comment = plan.description || '';
      if (targetBucketIds.length > 0) {
        const bucketNames = targetBucketIds.map(id => {
          const bucket = buckets.find(b => b.id === id);
          return bucket ? bucket.title : id;
        }).join(', ');
        comment += ` [Buckets: ${bucketNames}]`;
      } else {
        comment += ' [All buckets]';
      }
      
      return {
        id: plan.id || `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: this.sanitize(title),
        status: status,
        projectType: projectType,
        projectTitle: this.sanitize(projectTitle),
        account: account,
        amount: typeof plan.amount === 'number' ? plan.amount : parseFloat(plan.amount) || 0,
        startDate: plan.startDate || new Date().toISOString().split('T')[0],
        endDate: plan.endDate || plan.targetDate || new Date().toISOString().split('T')[0],
        category: `@${projectTitle}`,
        comment: this.sanitize(comment),
        frequency: plan.frequency || 'monthly',
        targetDate: plan.targetDate || plan.endDate || new Date().toISOString().split('T')[0],
        targetBucketIds: targetBucketIds,
        originalCalculatedAmount: typeof plan.amount === 'number' ? plan.amount : parseFloat(plan.amount) || 0,
        manuallyAdjusted: false,
        createdAt: plan.createdAt || new Date().toISOString(),
        updatedAt: plan.updatedAt || new Date().toISOString(),
        activatedAt: status === 'active' ? (plan.activatedAt || new Date().toISOString()) : undefined,
        deactivatedAt: status === 'inactive' ? (plan.deactivatedAt || new Date().toISOString()) : undefined
      };
    });
  }

  private extractJsonFromCodeBlocks(text: string): string[] {
    const results: string[] = [];
    const regex = /```(?:json)?\s*\n?([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const content = match[1].trim();
      if (content.startsWith('{') || content.startsWith('[')) {
        results.push(content);
      }
    }
    return results;
  }

  importProjects() {
    if (this.importedProjects.length === 0) return;

    // Handle improve mode — update existing projects
    if (this.promptType === 'smile-improve' && this.importType === 'smile-project') {
      this.importSmileUpdates();
      return;
    }
    if (this.promptType === 'fire-improve' && this.importType === 'fire-emergency') {
      this.importFireUpdates();
      return;
    }

    // Handle Smile projects
    if (this.importType === 'smile-project') {
      this.importSmileProjects();
      return;
    }

    // Handle Fire emergencies
    if (this.importType === 'fire-emergency') {
      this.importFireEmergencies();
      return;
    }

    // Handle Grow projects (original logic)
    const existing = AppStateService.instance.allGrowProjects;
    let imported = 0;
    let skipped = 0;

    for (const project of this.importedProjects) {
      if (isDuplicateTitle(project.title, [existing])) {
        skipped++;
        continue;
      }
      existing.push(project);
      imported++;
    }

    if (imported === 0) {
      this.importError = `All ${skipped} project(s) already exist (duplicate titles).`;
      return;
    }

    console.log('[AI Import] Saving to localStorage. Sample project types:', existing.slice(-3).map((g: Grow) => ({ title: g.title, type: g.type })));
    console.log('[AI Import] Saving', existing.length, 'projects. Last 3 types:', existing.slice(-3).map((g: Grow) => ({ title: g.title, type: g.type })));
    const jsonString = JSON.stringify(existing);
    const reparsed = JSON.parse(jsonString);
    console.log('[AI Import] After JSON.stringify/parse, last 3 types:', reparsed.slice(-3).map((g: any) => ({ title: g.title, type: g.type })));
    this.persistence.batchWriteAndSync({
      writes: [
        { tag: 'grow', data: existing }
      ],
      localStorageSaves: [
        { key: 'grow', data: jsonString }
      ],
      logEvent: 'ai_import_grow',
      logMetadata: { count: imported },
      onSuccess: () => {
        this.importSuccess = true;
        const msg = skipped > 0
          ? `${imported} project(s) imported, ${skipped} skipped (duplicates).`
          : `${imported} project(s) imported successfully.`;
        this.toast.show(msg, 'success');
      },
      onError: (error: any) => {
        this.importError = error.message || 'Import failed.';
      }
    });
  }

  private importSmileProjects() {
    const smileProjects = this.importedProjects as any as Smile[];
    const existing = AppStateService.instance.allSmileProjects;
    let imported = 0;
    let skipped = 0;

    for (const project of smileProjects) {
      if (isDuplicateTitle(project.title, [existing])) {
        skipped++;
        continue;
      }
      existing.push(project);
      imported++;
    }

    if (imported === 0) {
      this.importError = `All ${skipped} Smile project(s) already exist (duplicate titles).`;
      return;
    }

    const jsonString = JSON.stringify(existing);
    this.persistence.batchWriteAndSync({
      writes: [
        { tag: 'smile', data: existing }
      ],
      localStorageSaves: [
        { key: 'smile', data: jsonString }
      ],
      logEvent: 'ai_import_smile',
      logMetadata: { count: imported },
      onSuccess: () => {
        this.importSuccess = true;
        const msg = skipped > 0
          ? `${imported} Smile project(s) imported, ${skipped} skipped (duplicates).`
          : `${imported} Smile project(s) imported successfully.`;
        this.toast.show(msg, 'success');
      },
      onError: (error: any) => {
        this.importError = error.message || 'Import failed.';
      }
    });
  }

  private importFireEmergencies() {
    const fireEmergencies = this.importedProjects as any as Fire[];
    const existing = AppStateService.instance.allFireEmergencies;
    let imported = 0;
    let skipped = 0;

    for (const emergency of fireEmergencies) {
      if (isDuplicateTitle(emergency.title, [existing])) {
        skipped++;
        continue;
      }
      existing.push(emergency);
      imported++;
    }

    if (imported === 0) {
      this.importError = `All ${skipped} Fire emergency(ies) already exist (duplicate titles).`;
      return;
    }

    const jsonString = JSON.stringify(existing);
    this.persistence.batchWriteAndSync({
      writes: [
        { tag: 'fire', data: existing }
      ],
      localStorageSaves: [
        { key: 'fire', data: jsonString }
      ],
      logEvent: 'ai_import_fire',
      logMetadata: { count: imported },
      onSuccess: () => {
        this.importSuccess = true;
        const msg = skipped > 0
          ? `${imported} Fire emergency(ies) imported, ${skipped} skipped (duplicates).`
          : `${imported} Fire emergency(ies) imported successfully.`;
        this.toast.show(msg, 'success');
      },
      onError: (error: any) => {
        this.importError = error.message || 'Import failed.';
      }
    });
  }

  // --- Improve Mode: Project Selection ---
  getAvailableSmileProjects(): Smile[] {
    return AppStateService.instance.allSmileProjects || [];
  }

  getAvailableFireEmergencies(): Fire[] {
    return AppStateService.instance.allFireEmergencies || [];
  }

  isSmileProjectSelected(title: string): boolean {
    return this.options.selectedSmileProjects.includes(title);
  }

  isFireEmergencySelected(title: string): boolean {
    return this.options.selectedFireEmergencies.includes(title);
  }

  toggleSmileProject(title: string) {
    const idx = this.options.selectedSmileProjects.indexOf(title);
    if (idx > -1) {
      this.options.selectedSmileProjects.splice(idx, 1);
    } else {
      this.options.selectedSmileProjects.push(title);
    }
  }

  toggleFireEmergency(title: string) {
    const idx = this.options.selectedFireEmergencies.indexOf(title);
    if (idx > -1) {
      this.options.selectedFireEmergencies.splice(idx, 1);
    } else {
      this.options.selectedFireEmergencies.push(title);
    }
  }

  selectAllSmileProjects() {
    this.options.selectedSmileProjects = this.getAvailableSmileProjects().map(p => p.title);
  }

  deselectAllSmileProjects() {
    this.options.selectedSmileProjects = [];
  }

  selectAllFireEmergencies() {
    this.options.selectedFireEmergencies = this.getAvailableFireEmergencies().map(e => e.title);
  }

  deselectAllFireEmergencies() {
    this.options.selectedFireEmergencies = [];
  }

  private getSelectedSmileProjectObjects(): Smile[] {
    const all = AppStateService.instance.allSmileProjects || [];
    return all.filter(p => this.options.selectedSmileProjects.includes(p.title));
  }

  private getSelectedFireEmergencyObjects(): Fire[] {
    const all = AppStateService.instance.allFireEmergencies || [];
    return all.filter(e => this.options.selectedFireEmergencies.includes(e.title));
  }

  // --- Improve Mode: Check if we're in improve mode ---
  get isImproveMode(): boolean {
    return this.promptType === 'smile-improve' || this.promptType === 'fire-improve';
  }

  // --- Improve Mode: Parse and validate updates ---
  parseSmileUpdates() {
    try {
      const rawText = this.importText.trim();
      let parsed = this.extractAndParseJson(rawText);

      if (!Array.isArray(parsed)) {
        if (parsed.projects && Array.isArray(parsed.projects)) {
          parsed = parsed.projects;
        } else if (parsed.smileProjects && Array.isArray(parsed.smileProjects)) {
          parsed = parsed.smileProjects;
        } else {
          parsed = [parsed];
        }
      }

      const validated: Smile[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];
      const existing = AppStateService.instance.allSmileProjects || [];

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item.title || typeof item.title !== 'string') {
          errors.push(`Item ${i + 1}: missing or invalid "title"`);
          continue;
        }
        if (!item.buckets || !Array.isArray(item.buckets) || item.buckets.length === 0) {
          errors.push(`Item ${i + 1}: missing or invalid "buckets" array`);
          continue;
        }

        // Find existing project by title
        const existingProject = existing.find(p => p.title === item.title);
        if (!existingProject) {
          warnings.push(`"${item.title}": No existing project found — will be added as new.`);
        }

        // Validate bucket constraints against existing
        if (existingProject) {
          for (const existBucket of existingProject.buckets) {
            if ((existBucket.amount || 0) > 0) {
              const updatedBucket = item.buckets.find((b: any) => b.id === existBucket.id);
              if (!updatedBucket) {
                warnings.push(`"${item.title}": Locked bucket "${existBucket.title}" (${existBucket.amount} saved) was removed by AI — will be restored.`);
                // Re-add the locked bucket
                item.buckets.push(existBucket);
              } else {
                // Enforce: keep title, keep amount, keep target >= amount
                if (updatedBucket.title !== existBucket.title) {
                  warnings.push(`"${item.title}": Bucket "${existBucket.title}" was renamed to "${updatedBucket.title}" — reverting (has money).`);
                  updatedBucket.title = existBucket.title;
                }
                updatedBucket.amount = existBucket.amount;
                if ((updatedBucket.target || 0) < existBucket.amount) {
                  warnings.push(`"${item.title}": Bucket "${existBucket.title}" target was reduced below saved amount — adjusted to ${existBucket.amount}.`);
                  updatedBucket.target = existBucket.amount;
                }
              }
            }
          }

          // Preserve existing payment plans that were removed
          const existingPlans = existingProject.plannedSubscriptions || [];
          const updatedPlans = item.plannedSubscriptions || item.plannedPayments || [];
          for (const existPlan of existingPlans) {
            const found = updatedPlans.find((p: any) => p.id === existPlan.id);
            if (!found) {
              warnings.push(`"${item.title}": Payment plan "${existPlan.title}" was removed — restoring.`);
              updatedPlans.push(existPlan);
            }
          }
          item.plannedSubscriptions = updatedPlans;
        }

        // Build the Smile object (same as create parsing)
        const smile: Smile = {
          title: this.sanitize(item.title),
          sub: this.sanitize(item.sub || ''),
          phase: item.phase || (existingProject ? existingProject.phase : 'idea'),
          description: this.sanitize(item.description || ''),
          targetDate: item.targetDate || '',
          completionDate: item.completionDate || (existingProject ? existingProject.completionDate : undefined),
          buckets: item.buckets.map((b: any, idx: number) => ({
            id: b.id || `bucket-${idx + 1}`,
            title: this.sanitize(b.title || `Bucket ${idx + 1}`),
            target: typeof b.target === 'number' ? b.target : parseFloat(b.target) || 0,
            amount: typeof b.amount === 'number' ? b.amount : parseFloat(b.amount) || 0,
            notes: this.sanitize(b.notes || ''),
            links: Array.isArray(b.links) ? b.links.map((l: any) => ({
              label: this.sanitize(l.label || ''),
              url: this.sanitize(l.url || '')
            })) : [],
            targetDate: b.targetDate || undefined,
            completionDate: b.completionDate || undefined
          })),
          links: Array.isArray(item.links) ? item.links.map((l: any) => ({
            label: this.sanitize(l.label || ''),
            url: this.sanitize(l.url || '')
          })) : [],
          actionItems: Array.isArray(item.actionItems) ? item.actionItems.map((a: any) => ({
            text: this.sanitize(a.text || ''),
            done: a.done === true,
            priority: a.priority || 'medium',
            dueDate: a.dueDate || undefined
          })) : [],
          notes: Array.isArray(item.notes) ? item.notes.map((n: any) => ({
            text: this.sanitize(n.text || ''),
            createdAt: n.createdAt || new Date().toISOString()
          })) : [],
          createdAt: existingProject ? existingProject.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          plannedSubscriptions: this.transformPaymentPlans(
            item.plannedSubscriptions || item.plannedPayments || [],
            item.title, 'smile', item.buckets
          )
        };

        validated.push(smile);
      }

      this.importedSmileUpdates = validated;
      this.updateValidationWarnings = warnings;
      // Also set importedProjects length for the preview UI
      (this.importedProjects as any) = validated;

      if (errors.length > 0 && validated.length === 0) {
        this.importError = errors.join('\n');
        return;
      }
      if (errors.length > 0) {
        this.importError = `${errors.length} item(s) skipped. ${validated.length} ready to import.`;
      }
    } catch (e: any) {
      this.importError = `Failed to parse Smile updates: ${e.message}`;
    }
  }

  parseFireUpdates() {
    try {
      const rawText = this.importText.trim();
      let parsed = this.extractAndParseJson(rawText);

      if (!Array.isArray(parsed)) {
        if (parsed.emergencies && Array.isArray(parsed.emergencies)) {
          parsed = parsed.emergencies;
        } else if (parsed.fireEmergencies && Array.isArray(parsed.fireEmergencies)) {
          parsed = parsed.fireEmergencies;
        } else {
          parsed = [parsed];
        }
      }

      const validated: Fire[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];
      const existing = AppStateService.instance.allFireEmergencies || [];

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item.title || typeof item.title !== 'string') {
          errors.push(`Item ${i + 1}: missing or invalid "title"`);
          continue;
        }
        if (!item.buckets || !Array.isArray(item.buckets) || item.buckets.length === 0) {
          errors.push(`Item ${i + 1}: missing or invalid "buckets" array`);
          continue;
        }

        const existingEmergency = existing.find(e => e.title === item.title);
        if (!existingEmergency) {
          warnings.push(`"${item.title}": No existing emergency found — will be added as new.`);
        }

        // Validate bucket constraints
        if (existingEmergency) {
          for (const existBucket of existingEmergency.buckets) {
            if ((existBucket.amount || 0) > 0) {
              const updatedBucket = item.buckets.find((b: any) => b.id === existBucket.id);
              if (!updatedBucket) {
                warnings.push(`"${item.title}": Locked bucket "${existBucket.title}" (${existBucket.amount} saved) was removed by AI — will be restored.`);
                item.buckets.push(existBucket);
              } else {
                if (updatedBucket.title !== existBucket.title) {
                  warnings.push(`"${item.title}": Bucket "${existBucket.title}" was renamed — reverting (has money).`);
                  updatedBucket.title = existBucket.title;
                }
                updatedBucket.amount = existBucket.amount;
                if ((updatedBucket.target || 0) < existBucket.amount) {
                  warnings.push(`"${item.title}": Bucket "${existBucket.title}" target adjusted to ${existBucket.amount} (can't be less than saved).`);
                  updatedBucket.target = existBucket.amount;
                }
              }
            }
          }

          // Preserve existing payment plans
          const existingPlans = existingEmergency.plannedSubscriptions || [];
          const updatedPlans = item.plannedSubscriptions || item.plannedPayments || [];
          for (const existPlan of existingPlans) {
            if (!updatedPlans.find((p: any) => p.id === existPlan.id)) {
              warnings.push(`"${item.title}": Payment plan "${existPlan.title}" was removed — restoring.`);
              updatedPlans.push(existPlan);
            }
          }
          item.plannedSubscriptions = updatedPlans;
        }

        const fire: Fire = {
          title: this.sanitize(item.title),
          sub: this.sanitize(item.sub || ''),
          phase: item.phase || (existingEmergency ? existingEmergency.phase : 'idea'),
          description: this.sanitize(item.description || ''),
          targetDate: item.targetDate || '',
          completionDate: item.completionDate || (existingEmergency ? existingEmergency.completionDate : undefined),
          buckets: item.buckets.map((b: any, idx: number) => ({
            id: b.id || `bucket-${idx + 1}`,
            title: this.sanitize(b.title || `Bucket ${idx + 1}`),
            target: typeof b.target === 'number' ? b.target : parseFloat(b.target) || 0,
            amount: typeof b.amount === 'number' ? b.amount : parseFloat(b.amount) || 0,
            notes: this.sanitize(b.notes || ''),
            links: Array.isArray(b.links) ? b.links.map((l: any) => ({
              label: this.sanitize(l.label || ''),
              url: this.sanitize(l.url || '')
            })) : [],
            targetDate: b.targetDate || undefined,
            completionDate: b.completionDate || undefined
          })),
          links: Array.isArray(item.links) ? item.links.map((l: any) => ({
            label: this.sanitize(l.label || ''),
            url: this.sanitize(l.url || '')
          })) : [],
          actionItems: Array.isArray(item.actionItems) ? item.actionItems.map((a: any) => ({
            text: this.sanitize(a.text || ''),
            done: a.done === true,
            priority: a.priority || 'medium',
            dueDate: a.dueDate || undefined
          })) : [],
          notes: Array.isArray(item.notes) ? item.notes.map((n: any) => ({
            text: this.sanitize(n.text || ''),
            createdAt: n.createdAt || new Date().toISOString()
          })) : [],
          createdAt: existingEmergency ? existingEmergency.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          plannedSubscriptions: this.transformPaymentPlans(
            item.plannedSubscriptions || item.plannedPayments || [],
            item.title, 'fire', item.buckets
          )
        };

        validated.push(fire);
      }

      this.importedFireUpdates = validated;
      this.updateValidationWarnings = warnings;
      (this.importedProjects as any) = validated;

      if (errors.length > 0 && validated.length === 0) {
        this.importError = errors.join('\n');
        return;
      }
      if (errors.length > 0) {
        this.importError = `${errors.length} item(s) skipped. ${validated.length} ready to import.`;
      }
    } catch (e: any) {
      this.importError = `Failed to parse Fire updates: ${e.message}`;
    }
  }

  // --- Improve Mode: Import updates (replace existing) ---
  private importSmileUpdates() {
    if (this.importedSmileUpdates.length === 0) return;

    const existing = AppStateService.instance.allSmileProjects;
    let updated = 0;
    let added = 0;

    for (const updatedProject of this.importedSmileUpdates) {
      const existIdx = existing.findIndex(p => p.title === updatedProject.title);
      if (existIdx > -1) {
        existing[existIdx] = updatedProject;
        updated++;
      } else {
        existing.push(updatedProject);
        added++;
      }
    }

    const jsonString = JSON.stringify(existing);
    this.persistence.batchWriteAndSync({
      writes: [{ tag: 'smile', data: existing }],
      localStorageSaves: [{ key: 'smile', data: jsonString }],
      logEvent: 'ai_improve_smile',
      logMetadata: { updated, added },
      onSuccess: () => {
        this.importSuccess = true;
        const parts: string[] = [];
        if (updated > 0) parts.push(`${updated} project(s) updated`);
        if (added > 0) parts.push(`${added} project(s) added`);
        this.toast.show(parts.join(', ') + '.', 'success');
      },
      onError: (error: any) => {
        this.importError = error.message || 'Import failed.';
      }
    });
  }

  private importFireUpdates() {
    if (this.importedFireUpdates.length === 0) return;

    const existing = AppStateService.instance.allFireEmergencies;
    let updated = 0;
    let added = 0;

    for (const updatedEmergency of this.importedFireUpdates) {
      const existIdx = existing.findIndex(e => e.title === updatedEmergency.title);
      if (existIdx > -1) {
        existing[existIdx] = updatedEmergency;
        updated++;
      } else {
        existing.push(updatedEmergency);
        added++;
      }
    }

    const jsonString = JSON.stringify(existing);
    this.persistence.batchWriteAndSync({
      writes: [{ tag: 'fire', data: existing }],
      localStorageSaves: [{ key: 'fire', data: jsonString }],
      logEvent: 'ai_improve_fire',
      logMetadata: { updated, added },
      onSuccess: () => {
        this.importSuccess = true;
        const parts: string[] = [];
        if (updated > 0) parts.push(`${updated} emergency(ies) updated`);
        if (added > 0) parts.push(`${added} emergency(ies) added`);
        this.toast.show(parts.join(', ') + '.', 'success');
      },
      onError: (error: any) => {
        this.importError = error.message || 'Import failed.';
      }
    });
  }

  // --- Budget Category Selection ---
  private normalizeCategory(category: string): string {
    // Remove @ symbols, trim whitespace, and normalize
    return category.replace(/@/g, '').trim();
  }

  private getActualBudgetAmount(category: string): number | undefined {
    // Get the actual budget amount for a category from last month
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = lastMonth.toISOString().substring(0, 7); // YYYY-MM
    const normalized = this.normalizeCategory(category);

    const budget = AppStateService.instance.allBudgets.find(
      b => b.date === lastMonthKey && this.normalizeCategory(b.tag) === normalized
    );

    return budget ? budget.amount : undefined;
  }

  getAvailableBudgetCategories(): string[] {
    // Get last completed month (previous month)
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = lastMonth.toISOString().substring(0, 7); // YYYY-MM

    // Get all budget categories from last month
    const categories = new Set<string>();
    AppStateService.instance.allBudgets.forEach(budget => {
      if (budget.date === lastMonthKey && budget.tag) {
        const normalized = this.normalizeCategory(budget.tag);
        if (normalized) {
          categories.add(normalized);
        }
      }
    });

    return Array.from(categories).sort();
  }

  getOtherCategories(): string[] {
    // Get categories from last month transactions that DON'T have budgets
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = lastMonth.toISOString().substring(0, 7); // YYYY-MM

    const budgetCategories = new Set(this.getAvailableBudgetCategories());
    const otherCategories = new Set<string>();

    // Get all transaction categories from last month
    const monthly = (this.promptService as any).getMonthlyBreakdown();
    const lastMonthData = monthly[lastMonthKey];
    
    if (lastMonthData && lastMonthData.byCategory) {
      Object.keys(lastMonthData.byCategory).forEach(cat => {
        const normalized = this.normalizeCategory(cat);
        // Only add if this category doesn't have a budget and is not empty
        // Use explicit check to ensure no duplicates
        if (normalized && !budgetCategories.has(normalized)) {
          otherCategories.add(normalized);
        }
      });
    }

    return Array.from(otherCategories).sort();
  }

  isCategorySubscription(category: string): boolean {
    // Check if this category is used by any subscription
    const normalized = this.normalizeCategory(category);
    return AppStateService.instance.allSubscriptions.some(
      sub => sub.category && this.normalizeCategory(sub.category) === normalized
    );
  }

  isBudgetCategorySelected(category: string): boolean {
    const normalized = this.normalizeCategory(category);
    return this.options.selectedBudgetCategories.some(c => this.normalizeCategory(c) === normalized);
  }

  toggleBudgetCategory(category: string): void {
    const arr = this.options.selectedBudgetCategories;
    const normalized = this.normalizeCategory(category);
    const index = arr.findIndex(c => this.normalizeCategory(c) === normalized);
    if (index === -1) {
      arr.push(normalized);
    } else {
      arr.splice(index, 1);
    }
  }

  selectAllBudgetCategories(): void {
    this.options.selectedBudgetCategories = [
      ...this.getAvailableBudgetCategories(),
      ...this.getOtherCategories()
    ];
  }

  deselectAllBudgetCategories(): void {
    this.options.selectedBudgetCategories = [];
  }

  // --- Subscription Selection ---
  getAvailableSubscriptions() {
    // Filter to only active subscriptions (endDate is empty or in the future)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return AppStateService.instance.allSubscriptions.filter(sub => {
      if (!sub.endDate) return true; // No end date = active
      const endDate = new Date(sub.endDate);
      endDate.setHours(0, 0, 0, 0);
      return endDate >= today; // End date today or in future = active
    });
  }

  isSubscriptionSelected(subscription: any): boolean {
    const title = subscription.title || 'Unnamed';
    return this.options.selectedSubscriptions.some(t => t === title);
  }

  toggleSubscription(subscription: any): void {
    const arr = this.options.selectedSubscriptions;
    const title = subscription.title || 'Unnamed';
    const index = arr.findIndex(t => t === title);
    if (index === -1) {
      arr.push(title);
    } else {
      arr.splice(index, 1);
    }
  }

  selectAllSubscriptions(): void {
    this.options.selectedSubscriptions = this.getAvailableSubscriptions()
      .map(sub => sub.title || 'Unnamed');
  }

  deselectAllSubscriptions(): void {
    this.options.selectedSubscriptions = [];
  }
}
