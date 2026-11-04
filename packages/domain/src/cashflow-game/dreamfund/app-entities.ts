import { fromMinorUnits } from '../../money/minor-units';
import type { GameBooks } from '../books';
import type { CashflowDreamProject } from '../types';
import { DreamPlayer, type DreamPlayerData } from './player';
import { dreamProjectParts } from '../dream-project';
import { emergencyProjectParts } from '../emergency-project';

/**
 * A Dreamfund life as the entities the app keeps it in (todo/dreamfund-tables-solo-ui.md, R2 and R6): the Mojo, the dream and the dreams
 * taken as Smile projects, the reserve and the emergencies on a plan as Fire projects. The table keeps a life as books plus the reserve,
 * the savings and the plans; the solo screen, the app's pages and a saved game keep what the solo game keeps. Pure; the browser puts
 * these on screen, the server files them in a saved game. The shapes are the app's (`Smile`, `Fire`), written out so the domain needs
 * nothing of the app.
 */

export interface AppBucket {
  id: string;
  title: string;
  target: number;
  amount: number;
  notes?: string;
  links?: { label: string; url: string }[];
}

interface AppProjectBase {
  title: string;
  sub: string;
  phase: string;
  description: string;
  buckets: AppBucket[];
  links: { label: string; url: string }[];
  actionItems: { text: string; done: boolean; priority: 'low' | 'medium' | 'high' }[];
  notes: { text: string; createdAt: string }[];
  /** The payment plan the table runs for the project: a plan of the app, active (the table pays it at every Payday). */
  plannedSubscriptions?: AppPaymentPlan[];
  /** The day the project was paid in full (completed projects only). */
  completionDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppPaymentPlan {
  id: string;
  title: string;
  status: 'active';
  projectType: 'smile' | 'fire';
  projectTitle: string;
  account: string;
  amount: number;
  startDate: string;
  endDate: string;
  category: string;
  comment: string;
  frequency: 'monthly';
  targetDate: string;
  targetBucketIds: string[];
  originalCalculatedAmount: number;
  manuallyAdjusted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppSmile extends AppProjectBase {
  dream?: boolean;
  /** What the table sets aside for it at every Payday (a plan of the player), minor units. */
  dreamPlanMinor?: number;
  dreamCardId?: string;
  /** What living the dream is worth in dream points. */
  points?: number;
}

export interface AppFire extends AppProjectBase {
  reserve?: boolean;
  dreamPlanMinor?: number;
  emergencyCardId?: string;
}

export interface DreamAppEntities {
  books: GameBooks;
  mojo: { amount: number; target: number };
  smile: AppSmile[];
  fire: AppFire[];
  /** The game's open dreams, with the titles of the viewer's language (the table keeps them in English). */
  openDreams: { cardId: string; projectTitle: string; round: number }[];
}

type Lang = 'en' | 'de';
const langOf = (lang: string): Lang => (lang === 'de' ? 'de' : 'en');

function projectOf(project: CashflowDreamProject, nowIso: string): AppProjectBase {
  return {
    title: project.title,
    sub: project.sub,
    phase: 'planning',
    description: project.description,
    buckets: project.buckets.map((bucket) => ({
      id: `${project.title}-${bucket.id}`,
      title: bucket.title,
      target: fromMinorUnits(bucket.targetMinor),
      amount: 0,
      notes: bucket.notes,
      links: (bucket.links ?? []).map((link) => ({ ...link })),
    })),
    links: project.links.map((link) => ({ ...link })),
    actionItems: project.actionItems.map((item) => ({ ...item, done: false })),
    notes: project.notes.map((text) => ({ text, createdAt: nowIso })),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Where a project stands (JFK, 2026-11-03): nothing paid and no plan is planning; money in or a payment plan running is saving (the
 * phase "execute"); paid in full is completed - and stays, so it is transparent later what happened.
 */
function phaseOf(funded: boolean, paid: number, planned: number): string {
  if (funded) return 'completed';
  return paid > 0 || planned > 0 ? 'saving' : 'planning';
}

/** Puts `minor` into the buckets one after the other, each up to its target (the money goes where the project asks for it first). */
function fill(buckets: AppBucket[], minor: number): void {
  let left = minor;
  for (const bucket of buckets) {
    const put = Math.max(0, Math.min(left, Math.round(bucket.target * 100)));
    bucket.amount = fromMinorUnits(put);
    left -= put;
  }
}

/** Makes the targets of the buckets add up to `totalMinor`, keeping their proportions (the characters' prices differ). */
function scaleTargets(buckets: AppBucket[], totalMinor: number): void {
  const sum = buckets.reduce((s, bucket) => s + Math.round(bucket.target * 100), 0);
  if (sum <= 0 || totalMinor <= 0 || sum === totalMinor) return;
  let used = 0;
  buckets.forEach((bucket, index) => {
    const own =
      index === buckets.length - 1
        ? totalMinor - used
        : Math.round((Math.round(bucket.target * 100) * totalMinor) / sum);
    used += own;
    bucket.target = fromMinorUnits(own);
  });
}

/** The plan a table runs for a project, as a payment plan of the app (nothing when none runs). */
function planOf(
  perMinor: number,
  projectType: 'smile' | 'fire',
  title: string,
  key: string,
  nowIso: string,
): AppPaymentPlan[] {
  if (perMinor <= 0) return [];
  const amount = fromMinorUnits(perMinor);
  return [
    {
      id: `table-plan-${key}`,
      title,
      status: 'active',
      projectType,
      projectTitle: title,
      account: 'Daily',
      amount,
      startDate: nowIso.slice(0, 10),
      endDate: '',
      category: `@${title}`,
      comment: '',
      frequency: 'monthly',
      targetDate: '',
      targetBucketIds: [],
      originalCalculatedAmount: amount,
      manuallyAdjusted: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}

export function dreamAppEntities(
  life: DreamPlayerData,
  lang: string,
  nowIso: string,
): DreamAppEntities {
  const l = langOf(lang);
  const p = DreamPlayer.restore(life, () => 0.5, { sharedMarkets: true });
  const story = p.profession.profile?.texts;
  const text = story?.[l] ?? story?.['en'];
  const monthly = p.monthlyExpenses();

  const smile: AppSmile[] = [];
  const fire: AppFire[] = [];
  const planned = (kind: string, id: string) =>
    p.plans.find((plan) => plan.kind === kind && plan.id === id)?.perMinor ?? 0;

  // the character's own dream: a Smile project from the first day
  if (text?.dream.project) {
    const project: AppSmile = {
      ...projectOf(text.dream.project, nowIso),
      dream: true,
      dreamPlanMinor: planned('life', 'life'),
    };
    project.plannedSubscriptions = planOf(
      planned('life', 'life'),
      'smile',
      project.title,
      'life',
      nowIso,
    );
    scaleTargets(project.buckets, p.dreamTargetMinor);
    const paid = p.dreamLived ? p.dreamTargetMinor : p.dreamSavedMinor;
    fill(project.buckets, paid);
    project.phase = phaseOf(p.dreamLived, paid, planned('life', 'life'));
    if (p.dreamLived) project.completionDate = nowIso.slice(0, 10);
    smile.push(project);
  }

  // the dreams taken from the Dream tiles
  const openDreams = (p.state.dreams?.open ?? []).map((open) => {
    const card = p.dreamCard(open.cardId);
    return { ...open, projectTitle: card ? card.title[l] : open.projectTitle };
  });
  const taken = [
    ...p.smile.map((entry) => ({ entry, complete: false })),
    ...p.done
      .filter((entry) => entry.kind === 'smile')
      .map((entry) => ({
        entry: { cardId: entry.id, totalMinor: entry.totalMinor, savedMinor: entry.totalMinor },
        complete: true,
      })),
  ];
  for (const { entry, complete } of taken) {
    const card = p.dreamCard(entry.cardId);
    if (!card) continue;
    const parts = dreamProjectParts(card, l);
    const project: AppSmile = {
      title: card.title[l],
      sub: `${card.tier} · ${card.category} · ${card.points}`,
      dreamCardId: card.id,
      points: card.points,
      dreamPlanMinor: planned('smile', card.id),
      plannedSubscriptions: planOf(
        complete ? 0 : planned('smile', card.id),
        'smile',
        card.title[l],
        card.id,
        nowIso,
      ),
      phase: 'planning',
      description: parts.description,
      buckets: parts.buckets.map((bucket) => ({
        id: `${card.title[l]}-${bucket.id}`,
        title: bucket.title,
        target: fromMinorUnits(bucket.amountMinor),
        amount: 0,
        notes: bucket.notes,
        links: bucket.links,
      })),
      links: parts.links,
      actionItems: parts.actionItems,
      notes: parts.notes.map((text) => ({ text, createdAt: nowIso })),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    fill(project.buckets, entry.savedMinor);
    project.phase = phaseOf(complete, entry.savedMinor, planned('smile', card.id));
    if (complete) project.completionDate = nowIso.slice(0, 10);
    smile.push(project);
  }

  // the emergency reserve of three monthly expenses, a Fire project
  if (text?.reserve?.project) {
    const project: AppFire = {
      ...projectOf(text.reserve.project, nowIso),
      reserve: true,
      dreamPlanMinor: planned('mojo', 'mojo'),
    };
    project.plannedSubscriptions = planOf(
      planned('mojo', 'mojo'),
      'fire',
      project.title,
      'mojo',
      nowIso,
    );
    for (const bucket of project.buckets) bucket.target = fromMinorUnits(monthly);
    fill(project.buckets, p.reserveMinor);
    project.phase = phaseOf(
      p.reserveMinor >= monthly * 3 && monthly > 0,
      p.reserveMinor,
      planned('mojo', 'mojo'),
    );
    fire.push(project);
  }

  // the emergencies being paid on a plan: what is left is the project's target
  const emergencies = [
    ...p.plans
      .filter((plan) => plan.kind === 'emergency')
      .map((plan) => ({ plan, complete: false })),
    ...p.done
      .filter(
        (entry) =>
          entry.kind === 'emergency' &&
          !p.plans.some((plan) => plan.kind === 'emergency' && plan.id === entry.id),
      )
      .map((entry) => ({
        plan: {
          kind: 'emergency' as const,
          id: entry.id,
          perMinor: 0,
          leftMinor: 0,
          totalMinor: entry.totalMinor,
        },
        complete: true,
      })),
  ];
  for (const { plan, complete } of emergencies) {
    const card = p.emergencyCard(plan.id);
    if (!card) continue;
    const paid = (plan.totalMinor ?? plan.leftMinor) - plan.leftMinor;
    // the project of the card, as the solo game makes it: the plan is one bucket, what the card's own buckets are is told in its notes
    const parts = emergencyProjectParts(card, l);
    const bucketNotes = parts.buckets
      .filter((bucket) => bucket.notes)
      .map((bucket) => `${bucket.title}: ${bucket.notes}`)
      .join('\n');
    fire.push({
      title: card.title[l],
      sub: card.category,
      phase: phaseOf(complete, paid, plan.perMinor),
      ...(complete ? { completionDate: nowIso.slice(0, 10) } : {}),
      description: parts.description,
      buckets: [
        {
          id: `${card.title[l]}-plan`,
          title: card.title[l],
          target: fromMinorUnits(plan.totalMinor ?? plan.leftMinor),
          amount: fromMinorUnits((plan.totalMinor ?? plan.leftMinor) - plan.leftMinor),
          notes: bucketNotes,
        },
      ],
      links: parts.links,
      actionItems: parts.actionItems.map((action) => ({ ...action, done: false })),
      notes: parts.notes.map((text) => ({ text, createdAt: nowIso })),
      emergencyCardId: card.id,
      dreamPlanMinor: plan.perMinor,
      plannedSubscriptions: planOf(plan.perMinor, 'fire', card.title[l], card.id, nowIso),
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  return {
    books: { ...life.books, gameSet: p.gameSet } as GameBooks,
    mojo: { amount: fromMinorUnits(p.reserveMinor), target: fromMinorUnits(monthly * 3) },
    smile,
    fire,
    openDreams,
  };
}
