import type { GameBooks } from '@money/domain';
import type { DreamPlayerData } from '@money/domain/dist/cashflow-game/dreamfund/player';
import { dreamAppEntities } from '@money/domain/dist/cashflow-game/dreamfund/app-entities';
import type { Smile } from 'src/app/interfaces/smile';
import type { Fire } from 'src/app/interfaces/fire';
import type { Mojo } from 'src/app/interfaces/mojo';
import type { AppStateService } from '../shared/services/app-state.service';

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

/** The life of a seat as the app's entities: the domain works it out, the screen puts it on show. */
export function dreamLifeToApp(life: DreamPlayerData, lang: string, nowIso: string): DreamApp {
  return dreamAppEntities(life, lang, nowIso) as unknown as DreamApp;
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
