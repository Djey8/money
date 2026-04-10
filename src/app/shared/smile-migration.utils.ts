import { Smile, SmilePhase, SmileNote, SmileBucket } from '../interfaces/smile';
import { AppStateService } from './services/app-state.service';

/**
 * Migrates a legacy Smile object to the current schema with bucket support.
 * For legacy projects (without buckets), creates a single "Main Goal" bucket.
 * Fills in missing fields with safe defaults.
 * Auto-determines phase based on progress: planning (no transactions), saving (in progress), completed (goal met).
 */
export function migrateSmile(raw: any): Smile {
  const now = new Date().toISOString();

  // Migrate notes: legacy string → array of SmileNote
  let notes: SmileNote[] = [];
  if (Array.isArray(raw.notes)) {
    notes = raw.notes;
  } else if (typeof raw.notes === 'string' && raw.notes.trim()) {
    notes = [{ text: raw.notes, createdAt: raw.createdAt || now }];
  }

  // Migrate or create buckets
  let buckets: SmileBucket[] = [];
  if (Array.isArray(raw.buckets) && raw.buckets.length > 0) {
    // Already has buckets, just ensure they have all required fields
    buckets = raw.buckets.map((b: any) => ({
      id: b.id || generateBucketId(),
      title: b.title || b.name || 'Goal',  // Support both old 'name' and new 'title'
      target: typeof b.target === 'number' ? Math.round(b.target * 100) / 100 : (typeof b.targetAmount === 'number' ? Math.round(b.targetAmount * 100) / 100 : Math.round((parseFloat(b.targetAmount || b.target) || 0) * 100) / 100),
      amount: typeof b.amount === 'number' ? Math.round(b.amount * 100) / 100 : 0,
      notes: b.notes || '',
      links: Array.isArray(b.links) ? b.links : [],
      targetDate: b.targetDate || undefined,
      completionDate: b.completionDate || undefined
    }));
  } else if (raw.target && raw.target > 0) {
    // Legacy project without buckets → create single bucket with project name
    buckets = [{
      id: generateBucketId(),
      title: raw.title || 'Main Goal',
      target: typeof raw.target === 'number' ? Math.round(raw.target * 100) / 100 : Math.round((parseFloat(raw.target) || 0) * 100) / 100,
      amount: typeof raw.amount === 'number' ? Math.round(raw.amount * 100) / 100 : Math.round((parseFloat(raw.amount) || 0) * 100) / 100,
      notes: '',
      links: []
    }];
  }

  // Calculate totals for phase determination
  const totalTarget = buckets.length > 0 
    ? buckets.reduce((sum, b) => sum + (b.target || 0), 0)
    : (typeof raw.target === 'number' ? raw.target : parseFloat(raw.target) || 0);
  
  const totalAmount = buckets.length > 0
    ? buckets.reduce((sum, b) => sum + (b.amount || 0), 0)
    : (typeof raw.amount === 'number' ? raw.amount : parseFloat(raw.amount) || 0);

  // Auto-determine phase if not set or if we should override
  let phase: SmilePhase = 'planning';
  let completionDate = raw.completionDate || raw.completedDate || undefined;

  if (raw.phase && ['idea', 'planning', 'saving', 'ready', 'completed'].includes(raw.phase)) {
    // Preserve existing valid phase
    phase = raw.phase;
  } else {
    // Auto-determine based on progress
    if (totalAmount === 0) {
      phase = 'planning';
    } else if (totalAmount >= totalTarget && totalTarget > 0) {
      phase = 'completed';
      
      // Find last transaction date for this project
      if (!completionDate) {
        const lastTransactionDate = getLastTransactionDate(raw.title);
        if (lastTransactionDate) {
          completionDate = lastTransactionDate;
        }
      }
    } else {
      phase = 'saving';
    }
  }

  const result: Smile = {
    title: raw.title || 'Untitled Project',
    sub: raw.sub || '',
    phase,
    description: raw.description || '',
    targetDate: raw.targetDate || undefined,
    completionDate,
    
    // Bucket system (now required - target and amount removed)
    buckets,
    
    // Planning & tracking
    links: Array.isArray(raw.links) ? raw.links : [],
    actionItems: Array.isArray(raw.actionItems) ? raw.actionItems : [],
    notes,
    
    // Payment plans (preserve existing plans)
    plannedSubscriptions: Array.isArray(raw.plannedSubscriptions) ? raw.plannedSubscriptions : [],
    
    // Metadata
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now
  };

  return result;
}

/**
 * Get the last transaction date for a Smile project by searching related transactions.
 * @param projectTitle - The title of the Smile project
 * @returns ISO date string of the last transaction, or undefined
 */
function getLastTransactionDate(projectTitle: string): string | undefined {
  try {
    const allTransactions = AppStateService.instance?.allTransactions;
    if (!allTransactions || !Array.isArray(allTransactions)) {
      return undefined;
    }

    // Find all transactions for this project (category matches @ProjectTitle)
    const projectTransactions = allTransactions.filter(tx => 
      tx.category === `@${projectTitle}` || tx.comment?.includes(projectTitle)
    );

    if (projectTransactions.length === 0) {
      return undefined;
    }

    // Sort by date (most recent first) and get the last one
    const sorted = projectTransactions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    return sorted[0].date;
  } catch (error) {
    console.warn('[Migrate Smile] Could not determine last transaction date:', error);
    return undefined;
  }
}

/**
 * Migrate an array of smile projects, ensuring all have current schema.
 */
export function migrateSmileArray(projects: any[]): Smile[] {
  if (!Array.isArray(projects)) {
    console.warn('[Migrate Smile] Expected array, got:', typeof projects);
    return [];
  }
  return projects.map(migrateSmile);
}

/**
 * Generate a unique bucket ID (simple timestamp-based)
 */
export function generateBucketId(): string {
  return `bucket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
