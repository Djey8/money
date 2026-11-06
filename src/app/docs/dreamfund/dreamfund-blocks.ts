/**
 * The blocks of the Dreamfund manual that only show something (JFK, 2026-11-06): nothing in them works - they are drawings of what the
 * game puts on the screen, with real numbers of the printed cards, for reading and clicking.
 */

/** A card as it lies on the table, as an example. */
export interface ShowCard {
  pile: 'seed' | 'sapling' | 'tree';
  kind: string;
  title: string;
  text: string;
  facts: { label: string; value: string }[];
  /** What the die or the risk adds, in one line. */
  note?: string;
}

/** A project of the game's books (a Fire project for an emergency, a Smile project for a dream), as a small drawing to open. */
export interface ShowProject {
  id: string;
  kind: 'emergency' | 'dream';
  icon: string;
  title: string;
  subtitle: string;
  story: string;
  /** Percent of the money in. */
  percent: number;
  /** "720 of 2,160 paid" */
  progress: string;
  facts: { label: string; value: string }[];
  buckets: { title: string; amount: string; percent: number; note?: string }[];
  plan: { title: string; per: string; left: string; text: string };
  notes: string[];
}

/** One step of a character's career ladder. */
export interface ShowStage {
  stage: number;
  title: string;
  story: string;
  net: string;
  gross: string;
  living: string;
  /** What it takes to climb to the next one. */
  next: string;
  /** What the step costs once. */
  oneTime?: string;
}

export type DreamfundShowBlock =
  | { type: 'cardfaces'; caption?: string; items: ShowCard[] }
  | {
      type: 'mockprojects';
      caption?: string;
      items: ShowProject[];
      banner: string;
      close: string;
      open: string;
      notesTitle: string;
      bucketsTitle: Record<'emergency' | 'dream', string>;
    }
  | {
      type: 'ladder';
      caption?: string;
      character: string;
      stageWord: string;
      stages: ShowStage[];
      more?: string;
    };
