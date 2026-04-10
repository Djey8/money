import { Fire, FirePhase, FireNote, FireBucket } from '../interfaces/fire';

/**
 * Migrates a legacy Fire object to the current schema with bucket support.
 * For legacy projects (without buckets), creates a single bucket with the project name.
 * Fills in missing fields with safe defaults.
 * Auto-determines phase based on progress: planning (no transactions), saving (in progress), ready/completed (goal met).
 * If transactions are provided and buckets are full, uses the last transaction date as completion date.
 */
export function migrateFire(raw: any, transactions?: any[]): Fire {
  const now = new Date().toISOString();

  // Migrate notes: legacy string → array of FireNote
  let notes: FireNote[] = [];
  if (Array.isArray(raw.notes)) {
    notes = raw.notes;
  } else if (typeof raw.notes === 'string' && raw.notes.trim()) {
    notes = [{ text: raw.notes, createdAt: raw.createdAt || now }];
  }

  // Migrate or create buckets
  let buckets: FireBucket[] = [];
  if (Array.isArray(raw.buckets) && raw.buckets.length > 0) {
    // Already has buckets, just ensure they have all required fields
    buckets = raw.buckets.map((b: any) => ({
      id: b.id || generateBucketId(),
      title: b.title || 'Emergency Fund',
      target: typeof b.target === 'number' ? Math.round(b.target * 100) / 100 : Math.round((parseFloat(b.target) || 0) * 100) / 100,
      amount: typeof b.amount === 'number' ? Math.round(b.amount * 100) / 100 : 0,
      notes: b.notes || '',
      links: Array.isArray(b.links) ? b.links : [],
      targetDate: b.targetDate || undefined,
      completionDate: b.completionDate || undefined
    }));
  } else {
    // Legacy project without buckets → create single default bucket
    // Use the fire emergency's title for the bucket name
    const defaultBucketTitle = raw.title || 'Emergency Fund';
    buckets = [{
      id: generateBucketId(),
      title: defaultBucketTitle,
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

  // Auto-determine phase if not set
  let phase: FirePhase = raw.phase || 'planning';
  let completionDate = raw.completionDate || '';
  
  if (!raw.phase) {
    const progress = totalTarget > 0 ? (totalAmount / totalTarget) : 0;
    const allBucketsFull = buckets.length > 0 && buckets.every(b => b.amount >= b.target);
    
    if (totalAmount === 0) {
      phase = 'planning';
    } else if (allBucketsFull || progress >= 1.0) {
      phase = 'completed';
      // Set completion date to last transaction date if available and buckets are full
      if (!completionDate && transactions && transactions.length > 0) {
        // Find the last transaction that contributed to this Fire emergency
        const fireTitle = raw.title || 'Emergency Fund';
        const relatedTransactions = transactions.filter((tx: any) => {
          if (tx.category === `@${fireTitle}`) return true;
          // Check if matches any bucket
          return buckets.some(b => tx.category === `@${b.title}`);
        });
        
        if (relatedTransactions.length > 0) {
          // Sort by date descending and get the most recent
          const sortedTx = relatedTransactions.sort((a: any, b: any) => {
            const dateA = a.date + (a.time || '00:00:00');
            const dateB = b.date + (b.time || '00:00:00');
            return dateB.localeCompare(dateA);
          });
          completionDate = sortedTx[0].date;
        } else {
          completionDate = now.split('T')[0];
        }
      } else if (!completionDate) {
        completionDate = now.split('T')[0];
      }
    } else if (progress >= 0.8) {
      phase = 'ready';
    } else {
      phase = 'saving';
    }
  }

  return {
    title: raw.title || 'Emergency Fund',
    sub: raw.sub || '',
    phase: phase,
    description: raw.description || '',
    buckets: buckets,
    links: Array.isArray(raw.links) ? raw.links : [],
    actionItems: Array.isArray(raw.actionItems) ? raw.actionItems : [],
    notes: notes,
    plannedSubscriptions: Array.isArray(raw.plannedSubscriptions) ? raw.plannedSubscriptions : [],
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    targetDate: raw.targetDate || '',
    completionDate: completionDate
  };
}

/**
 * Migrates an array of Fire emergency funds
 * If transactions are provided, uses them to determine completion dates
 */
export function migrateFireArray(rawArray: any[], transactions?: any[]): Fire[] {
  return rawArray.map(raw => migrateFire(raw, transactions));
}

/**
 * Generates a unique bucket ID using timestamp + random string
 */
export function generateBucketId(): string {
  return `bucket_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
