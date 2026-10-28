import type { GameBooks } from '@money/domain';
import { fromMinorUnits } from '@money/domain';
import {
  DreamPlayer,
  type DreamPlayerData,
} from '@money/domain/dist/cashflow-game/dreamfund/player';
import type { Smile } from 'src/app/interfaces/smile';
import type { Fire } from 'src/app/interfaces/fire';
import type { Mojo } from 'src/app/interfaces/mojo';
import type { AppStateService } from '../shared/services/app-state.service';
import { dreamToSmile, reserveToFire } from '../main/cashflow-game/dream-project';

/**
 * The bridge from a Dreamfund table to the app (todo/dreamfund-tables-solo-ui.md, R2): the table keeps a player's life as books plus
 * what the solo game keeps in the app's own entities - the reserve (the Mojo), the dream and the dreams taken (Smile projects), the
 * reserve and the emergencies on a plan (Fire projects). This turns the one into the other, so the solo screen and the app's pages
 * draw from a seat's life at a table exactly as they do in a solo game. Pure: nothing here touches the app's state.
 */

export interface DreamApp {
  books: GameBooks;
  mojo: Mojo;
  smile: Smile[];
  fire: Fire[];
  /** The game's open dreams, with the titles of the viewer's language (the table keeps them in English). */
  openDreams: { cardId: string; projectTitle: string; round: number }[];
}

type Lang = 'en' | 'de';
const langOf = (lang: string): Lang => (lang === 'de' ? 'de' : 'en');

/** Puts `minor` into the buckets one after the other, each up to its target (the money goes where the project asks for it first). */
function fill<T extends { target: number; amount: number }>(buckets: T[], minor: number): void {
  let left = minor;
  for (const bucket of buckets) {
    const put = Math.max(0, Math.min(left, Math.round(bucket.target * 100)));
    bucket.amount = fromMinorUnits(put);
    left -= put;
  }
}

/** Makes the targets of the buckets add up to `totalMinor`, keeping their proportions (the characters' prices differ). */
function scaleTargets(buckets: { target: number }[], totalMinor: number): void {
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

export function dreamLifeToApp(life: DreamPlayerData, lang: string, nowIso: string): DreamApp {
  const l = langOf(lang);
  const p = DreamPlayer.restore(life, () => 0.5, { sharedMarkets: true });
  const story = p.profession.profile?.texts;
  const text = story?.[l] ?? story?.['en'];
  const monthly = p.monthlyExpenses();

  const smile: Smile[] = [];
  const fire: Fire[] = [];

  // the character's own dream: a Smile project from the first day
  if (text?.dream.project) {
    const project = dreamToSmile(text.dream.project, nowIso);
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
    const project: Smile = {
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
    const project = reserveToFire(text.reserve.project, nowIso);
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

/**
 * Puts the Dreamfund extras on screen after the books were (`applyBooksToApp` empties Smile, Fire and the Mojo, as the classic table
 * has none): the Mojo, the projects, and the open dreams under the titles of the viewer's language.
 */
export function applyDreamExtrasToApp(state: AppStateService, app: DreamApp): void {
  state.mojo = app.mojo as typeof state.mojo;
  state.allSmileProjects = app.smile as typeof state.allSmileProjects;
  state.allFireEmergencies = app.fire as typeof state.allFireEmergencies;
  const game = state.cashflowGame as { dreams?: { open: DreamApp['openDreams'] } };
  if (game.dreams) game.dreams = { ...game.dreams, open: app.openDreams };
  // a dream taken this turn: the card shows the project it became (named in the viewer's language)
  const pending = state.cashflowGame.turn?.pending as
    { dream?: { dreamTakenCardId?: string; taken?: string } } | undefined;
  const takenId = pending?.dream?.dreamTakenCardId;
  if (pending?.dream && takenId) {
    const project = app.openDreams.find((open) => open.cardId === takenId);
    if (project) pending.dream.taken = project.projectTitle;
  }
}
