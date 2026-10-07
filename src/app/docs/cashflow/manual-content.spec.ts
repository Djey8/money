import { CASHFLOW_GAME_SETS } from '../../shared/cashflow-content';
import {
  MANUAL_LANGUAGES,
  MANUAL_SECTIONS,
  richSegments,
  type ManualContent,
} from './manual-content';
import { buildManualTable, MANUAL_DATA_IDS, type ManualContext } from './manual-data';

// Node globals: the spec tsconfig carries no node typings.
declare const require: (id: string) => any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../../../assets/i18n/cashflow-manual');
const load = (language: string): ManualContent =>
  JSON.parse(fs.readFileSync(path.join(dir, `${language}.json`), 'utf8'));

const classic = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;
const cardIds = new Set(
  Object.values(classic.decks as Record<string, { id: string }[]>)
    .flat()
    .map((card) => card.id),
);
const BLOCK_TYPES = [
  'p',
  'h3',
  'list',
  'callout',
  'steps',
  'table',
  'cards',
  'face',
  'data',
  'cardbrowser',
  'glossary',
];

describe('Cashflow manual content', () => {
  it('has a file for every supported manual language', () => {
    expect(MANUAL_LANGUAGES).toEqual(['en', 'de']);
    for (const language of MANUAL_LANGUAGES)
      expect(fs.existsSync(path.join(dir, `${language}.json`))).toBe(true);
  });

  describe.each(MANUAL_LANGUAGES)('%s', (language) => {
    const content = load(language);

    it('has a title, a subtitle and every section', () => {
      expect(content.title.length).toBeGreaterThan(0);
      expect(content.subtitle.length).toBeGreaterThan(0);
      for (const ref of MANUAL_SECTIONS) {
        const section = content.sections[ref.id];
        expect(section).toBeDefined();
        expect(section.nav.length).toBeGreaterThan(0);
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.blocks.length).toBeGreaterThan(0);
      }
      expect(Object.keys(content.sections).sort()).toEqual(
        MANUAL_SECTIONS.map((ref) => ref.id).sort(),
      );
    });

    it('uses only known block types, real data ids and real card ids', () => {
      for (const section of Object.values(content.sections)) {
        for (const block of section.blocks as any[]) {
          expect(BLOCK_TYPES).toContain(block.type);
          if (block.type === 'data')
            expect(MANUAL_DATA_IDS as readonly string[]).toContain(block.id);
          if (block.type === 'face') expect(cardIds.has(block.cardId)).toBe(true);
        }
      }
    });

    it('has no empty text and balanced bold / code markers', () => {
      const texts: string[] = [];
      const collect = (value: unknown) => {
        if (typeof value === 'string') texts.push(value);
        else if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === 'object') Object.values(value).forEach(collect);
      };
      collect(content);
      for (const text of texts) {
        expect(text.trim().length).toBeGreaterThan(0);
        expect((text.match(/\*\*/g) ?? []).length % 2).toBe(0);
        expect((text.match(/`/g) ?? []).length % 2).toBe(0);
      }
    });

    it('defines every label the data tables ask for', () => {
      const asked = new Set<string>();
      const ctx: ManualContext = {
        labels: new Proxy(content.labels, {
          get: (target, key) => {
            asked.add(String(key));
            return target[String(key)] ?? String(key);
          },
        }),
        money: (minor) => String(minor / 100),
        percent: (ratio) => String(Math.round(ratio * 100)),
        number: (value) => String(value),
        professionTitle: (profession) => profession.title,
        groupName: (group) => group,
        familyName: (family) => family,
      };
      for (const id of MANUAL_DATA_IDS) buildManualTable(id, ctx);

      const missing = [...asked].filter(
        (key) => typeof key === 'string' && !(key in content.labels),
      );
      expect(missing).toEqual([]);
    });

    it('defines the labels of the card faces', () => {
      for (const key of [
        'factPrice',
        'factRange',
        'factDeposit',
        'factMortgage',
        'factCashflow',
        'factCost',
        'factCoins',
        'factDice',
        'factPayout',
        'factAccount',
        'factOffer',
        'factSymbol',
        'factBoost',
        'factUpTo',
        'unit',
        'coin',
      ]) {
        expect(content.labels[key]).toBeTruthy();
      }
    });
  });

  it('keeps the languages in step: same labels, sections and block layout', () => {
    const en = load('en');
    const de = load('de');
    expect(Object.keys(de.labels).sort()).toEqual(Object.keys(en.labels).sort());
    for (const ref of MANUAL_SECTIONS) {
      const shape = (content: ManualContent) =>
        (content.sections[ref.id].blocks as any[]).map(
          (block) => `${block.type}:${block.id ?? block.cardId ?? ''}`,
        );
      expect(shape(de)).toEqual(shape(en));
    }
  });

  it('splits bold and code markers without HTML', () => {
    expect(richSegments('a **b** `c` d').map((part) => part.text)).toEqual([
      'a ',
      'b',
      ' ',
      'c',
      ' d',
    ]);
  });
});
