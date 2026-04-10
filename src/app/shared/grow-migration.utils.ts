import { Grow, GrowPhase, GrowNote } from '../interfaces/grow';

/**
 * Migrates a legacy Grow object (or any partial Grow) to the current schema.
 * Fills in missing fields with safe defaults. Existing values are preserved.
 */
export function migrateGrow(raw: any): Grow {
  console.log('[Migrate] Processing:', raw.title, 'raw.type:', raw.type, 'Keys:', Object.keys(raw).filter(k => k.startsWith('t')));
  const now = new Date().toISOString();

  // Map legacy "status" to phase
  let phase: GrowPhase = raw.phase || 'idea';
  if (!raw.phase && raw.status) {
    const s = raw.status.toLowerCase();
    if (s.includes('complet') || s.includes('done')) phase = 'completed';
    else if (s.includes('monitor') || s.includes('running')) phase = 'monitor';
    else if (s.includes('execut') || s.includes('active') || s.includes('bought')) phase = 'execute';
    else if (s.includes('plan') || s.includes('ready')) phase = 'plan';
    else if (s.includes('research') || s.includes('analyz')) phase = 'research';
    else if (s.includes('recommend') || s.includes('suggest') || s.includes('optional')) phase = 'research';
    else phase = 'idea';
  }

    // Migrate notes: legacy string → array of GrowNote
    let notes: GrowNote[] = [];
    if (Array.isArray(raw.notes)) {
      notes = raw.notes;
    } else if (typeof raw.notes === 'string' && raw.notes.trim()) {
      notes = [{ text: raw.notes, createdAt: raw.createdAt || now }];
    }

  const result = {
    title: raw.title || '',
    sub: raw.sub || '',
    phase,
    description: raw.description || '',
    strategy: raw.strategy || '',
    riskScore: typeof raw.riskScore === 'number' ? Math.min(5, Math.max(0, raw.riskScore)) : parseFloat(raw.riskScore) || 0,
    risks: raw.risks || '',
    links: Array.isArray(raw.links) ? raw.links : [],
    actionItems: Array.isArray(raw.actionItems) ? raw.actionItems : [],
    notes,
    cashflow: typeof raw.cashflow === 'number' ? raw.cashflow : parseFloat(raw.cashflow) || 0,
    amount: typeof raw.amount === 'number' ? raw.amount : parseFloat(raw.amount) || 0,
    isAsset: !!raw.isAsset,
    share: raw.share || null,
    investment: raw.investment || null,
    liabilitie: raw.liabilitie || null,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    
    // NEW: Preserve type and expense optimization fields
    type: raw.type || 'income-growth',
    category: raw.category || undefined,
    currentCost: typeof raw.currentCost === 'number' ? raw.currentCost : (raw.currentCost ? parseFloat(raw.currentCost) : undefined),
    targetCost: typeof raw.targetCost === 'number' ? raw.targetCost : (raw.targetCost ? parseFloat(raw.targetCost) : undefined),
    monthlySavings: typeof raw.monthlySavings === 'number' ? raw.monthlySavings : (raw.monthlySavings ? parseFloat(raw.monthlySavings) : undefined),
    annualSavings: typeof raw.annualSavings === 'number' ? raw.annualSavings : (raw.annualSavings ? parseFloat(raw.annualSavings) : undefined),
    reasoning: raw.reasoning || undefined,
    alternative: raw.alternative || undefined,
    alternativeCost: typeof raw.alternativeCost === 'number' ? raw.alternativeCost : (raw.alternativeCost ? parseFloat(raw.alternativeCost) : undefined),
    pattern: raw.pattern || undefined,
    insights: raw.insights || undefined,

    
    status: raw.status
  };
  console.log('[Migrate] Result:', result.title, 'result.type:', result.type);
  return result;
}

/**
 * Migrate an array of grow projects, ensuring all have current schema.
 */
export function migrateGrowArray(projects: any[]): Grow[] {
  return projects.map(migrateGrow);
}
