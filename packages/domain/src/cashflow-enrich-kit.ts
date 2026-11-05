/**
 * What the second pass over the Opportunity cards (JFK, 2026-11-05) adds to a card: how to invest, what to do and not to do, how risky
 * it is and why, and where to read more. The cards of the sketch stay as they are; `enrichOpportunityCards` lays this over them. Every
 * text is written with its German beside it (`tr`), and the German goes into the table the game loads for a German game.
 */
export interface EnrichLink {
  label: string;
  url: string;
}

export interface EnrichAction {
  text: string;
  priority: 'low' | 'medium' | 'high';
}

export interface CardEnrichment {
  /** How to invest or earn with it (replaces the strategy of the sketch). */
  strategy?: string;
  /** Why it works (replaces the reasoning). */
  reasoning?: string;
  /** How risky it is and why, what can go wrong (replaces the risks of the sketch). */
  risks?: string;
  riskScore?: number;
  /** Facts worth knowing (replaces the insights). */
  insights?: string;
  /** A tip and a warning, put into the first note of the Grow project. */
  tip?: string;
  /** More to read: put after the links of the sketch (no more than four links in all). */
  links?: EnrichLink[];
  /** What to do next: put after the tasks of the sketch (no more than five in all). */
  actions?: EnrichAction[];
  /** The cash flow a card advertises (a scam shows one like any other offer; what it really pays is the trap's own business). */
  cashflowMinor?: number;
}

/** The German of every text of the enrichment, by the English text. */
export const ENRICH_DE: Record<string, string> = {};

/** An English text that carries its German into `ENRICH_DE`. */
export const tr = (en: string, de: string): string => {
  ENRICH_DE[en] = de;
  return en;
};

export const link = (label: string, url: string): EnrichLink => ({ label, url });

export const act = (
  en: string,
  de: string,
  priority: EnrichAction['priority'] = 'medium',
): EnrichAction => ({ text: tr(en, de), priority });
