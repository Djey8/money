import type { CashflowDreamProject } from '@money/domain';
import { fromMinorUnits } from '@money/domain';
import type { Smile } from 'src/app/interfaces/smile';

/**
 * The dream of a character as the app's own Smile project (JFK, 2026-10-25): the static content of the character - buckets with what
 * they cost and why, links, tasks, notes - turned into the entity the Smile page and its info panel already work with. Nothing
 * here is new to the app; it only fills a Smile project when a game starts (or shows it, before it does).
 */
export function dreamToSmile(project: CashflowDreamProject, nowIso: string): Smile {
  return {
    title: project.title,
    sub: project.sub,
    dream: true,
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
