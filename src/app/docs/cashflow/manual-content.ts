import type { ManualDataId } from './manual-data';

/**
 * The Cashflow game manual is data: one JSON file per language (assets/i18n/cashflow-manual/) holding
 * the sections as a list of blocks, rendered by `CashflowDocsComponent`. It is fetched only when the
 * manual is opened - never part of the app's normal translations - and the numbers in its tables come
 * from the card catalog itself (`manual-data.ts`), not from the text.
 */
export type ManualBlock =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'callout'; kind: 'tip' | 'warning' | 'note' | 'example'; title?: string; text: string }
  | { type: 'steps'; items: { title: string; text: string }[] }
  | { type: 'table'; head: string[]; rows: string[][]; note?: string }
  | { type: 'cards'; items: { icon?: string; title: string; text: string }[] }
  /** A real card from the catalog, drawn like the card on the table. */
  | { type: 'face'; cardId: string; caption?: string }
  /** A table computed from the card catalog. */
  | { type: 'data'; id: ManualDataId; caption?: string }
  | { type: 'glossary'; items: { term: string; text: string }[] };

export interface ManualSection {
  /** The short name in the section list. */
  nav: string;
  title: string;
  intro?: string;
  blocks: ManualBlock[];
}

export interface ManualContent {
  title: string;
  subtitle: string;
  /** Column heads, row names and other small words used by the computed tables and card faces. */
  labels: Record<string, string>;
  sections: Record<string, ManualSection>;
}

export interface ManualSectionRef {
  id: string;
  number: string;
  level: number;
}

/** The order of the manual - the section list, the previous / next buttons and the content files all follow it. */
export const MANUAL_SECTIONS: ManualSectionRef[] = [
  { id: 'start', number: '1', level: 0 },
  { id: 'goal', number: '2', level: 0 },
  { id: 'dashboard', number: '3', level: 0 },
  { id: 'professions', number: '4', level: 0 },
  { id: 'payday', number: '5', level: 0 },
  { id: 'spaces', number: '6', level: 0 },
  { id: 'investing', number: '7', level: 0 },
  { id: 'smalldeal', number: '8', level: 0 },
  { id: 'bigdeal', number: '9', level: 0 },
  { id: 'dice', number: '10', level: 0 },
  { id: 'doodad', number: '11', level: 0 },
  { id: 'market', number: '12', level: 0 },
  { id: 'life', number: '13', level: 0 },
  { id: 'loans', number: '14', level: 0 },
  { id: 'app', number: '15', level: 0 },
  { id: 'games', number: '16', level: 0 },
  { id: 'strategy', number: '17', level: 0 },
  { id: 'lab', number: '18', level: 0 },
  { id: 'odds', number: '19', level: 0 },
  { id: 'faq', number: '20', level: 0 },
  { id: 'glossary', number: '21', level: 0 },
];

/** The languages the manual is written in; every other language shows the English text. */
export const MANUAL_LANGUAGES = ['en', 'de'];
export const MANUAL_FALLBACK_LANGUAGE = 'en';

/** A piece of a line of text: plain, **bold** or `code`. */
export interface RichSegment {
  text: string;
  bold?: boolean;
  code?: boolean;
}

/** Splits a line into plain, bold and code parts, so the page can show them without building HTML from text. */
export function richSegments(text: string): RichSegment[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .filter((part) => part !== '')
    .map((part) =>
      part.startsWith('**')
        ? { text: part.slice(2, -2), bold: true }
        : part.startsWith('`')
          ? { text: part.slice(1, -1), code: true }
          : { text: part },
    );
}
