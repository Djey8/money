import { fromMinorUnits } from '../../money/minor-units';
import type { GameBooks } from '../books';
import type { CashflowDreamProject } from '../types';
import { DreamPlayer, type DreamPlayerData } from './player';

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
  createdAt: string;
  updatedAt: string;
}

export interface AppSmile extends AppProjectBase {
  dream?: boolean;
  dreamCardId?: string;
}

export interface AppFire extends AppProjectBase {
  reserve?: boolean;
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

  // the character's own dream: a Smile project from the first day
  if (text?.dream.project) {
    const project: AppSmile = { ...projectOf(text.dream.project, nowIso), dream: true };
    scaleTargets(project.buckets, p.dreamTargetMinor);
    fill(project.buckets, p.dreamLived ? p.dreamTargetMinor : p.dreamSavedMinor);
    smile.push(project);
  }

  // the dreams taken from the Dream tiles
  const openDreams = (p.state.dreams?.open ?? []).map((open) => {
    const card = p.dreamCard(open.cardId);
    return { ...open, projectTitle: card ? card.title[l] : open.projectTitle };
  });
  for (const entry of p.smile) {
    const card = p.dreamCard(entry.cardId);
    if (!card) continue;
    const project: AppSmile = {
      title: card.title[l],
      sub: `${card.tier} · ${card.category} · ${card.points}`,
      dreamCardId: card.id,
      phase: 'planning',
      description: card.story[l],
      buckets: card.buckets.map((bucket) => ({
        id: `${card.title[l]}-${bucket.id}`,
        title: bucket.title[l],
        target: fromMinorUnits(bucket.amountMinor),
        amount: 0,
        notes: '',
      })),
      links: card.links.map((link) => ({ label: link.label[l], url: link.url })),
      actionItems: card.actions.map((action) => ({
        text: action.text[l],
        done: false,
        priority: action.priority,
      })),
      notes: card.stat ? [{ text: card.stat[l], createdAt: nowIso }] : [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    fill(project.buckets, entry.savedMinor);
    smile.push(project);
  }

  // the emergency reserve of three monthly expenses, a Fire project
  if (text?.reserve?.project) {
    const project: AppFire = { ...projectOf(text.reserve.project, nowIso), reserve: true };
    for (const bucket of project.buckets) bucket.target = fromMinorUnits(monthly);
    fill(project.buckets, p.reserveMinor);
    fire.push(project);
  }

  // the emergencies being paid on a plan: what is left is the project's target
  for (const plan of p.plans) {
    if (plan.kind !== 'emergency') continue;
    const card = p.emergencyCard(plan.id);
    if (!card) continue;
    fire.push({
      title: card.title[l],
      sub: card.category,
      phase: 'saving',
      description: card.story[l],
      buckets: [
        {
          id: `${card.title[l]}-plan`,
          title: card.title[l],
          target: fromMinorUnits(plan.leftMinor),
          amount: 0,
          notes: '',
        },
      ],
      links: [],
      actionItems: [],
      notes: [],
      emergencyCardId: card.id,
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
