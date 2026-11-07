/**
 * The blocks of the Dreamer manual that only show something (JFK, 2026-11-06): nothing in them works - they are drawings of what the
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
  | { type: 'examples'; kind: 'fire' | 'smile' | 'grow'; caption?: string }
  | {
      type: 'ladder';
      caption?: string;
      character: string;
      stageWord: string;
      stages: ShowStage[];
      more?: string;
    };
