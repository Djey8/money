import { of } from 'rxjs';
import { CashflowCardTextService } from './cashflow-card-text.service';

function makeService(currentLang: string, files: Record<string, unknown>) {
  const http = {
    get: jest.fn((url: string) => {
      const lang = /([a-z]+)\.json$/.exec(url)![1];
      if (!(lang in files)) throw new Error('404');
      return of(files[lang]);
    }),
  };
  const translate = { currentLang, defaultLang: 'en' };
  return new CashflowCardTextService(http as any, translate as any);
}

const EN = {
  symbols: { EFH: 'SFH', ETW: 'CONDO' },
  cards: { 'card-1': { title: 'Single-family home for sale' } },
};
const DE = { symbols: { EFH: 'EFH', ETW: 'ETW' }, cards: {} };
const FR = { cards: {} }; // no labels of its own yet

describe('CashflowCardTextService.symbolFor', () => {
  it('gives a property type the label of the language picked for the game', async () => {
    const english = makeService('en', { en: EN, de: DE });
    await english.ensureLoaded();
    expect(english.symbolFor('EFH')).toBe('SFH');
    expect(english.symbolFor('ETW')).toBe('CONDO');

    const german = makeService('de', { en: EN, de: DE });
    await german.ensureLoaded();
    expect(german.symbolFor('EFH')).toBe('EFH');
  });

  it("falls back to English, then to the deck's own label", async () => {
    const french = makeService('fr', { en: EN, fr: FR });
    await french.ensureLoaded();
    expect(french.symbolFor('EFH')).toBe('SFH'); // fr has none, en does
    expect(french.symbolFor('OK4U')).toBe('OK4U'); // a share ticker is never translated
    expect(french.symbolFor(undefined)).toBeUndefined();
  });

  it('counts loaded language files, so caches built from the text can tell they are stale', async () => {
    const service = makeService('en', { en: EN });
    const before = service.version;
    await service.ensureLoaded();
    expect(service.version).toBeGreaterThan(before);
  });

  it('names a card type in the language picked for the game, falling back to English, then the key', async () => {
    const files = {
      en: { families: { EFH: 'Single-family homes' }, cards: {} },
      de: { families: { EFH: 'Einfamilienhäuser' }, cards: {} },
      fr: { cards: {} },
    };
    const german = makeService('de', files);
    await german.ensureLoaded();
    expect(german.familyName('EFH')).toBe('Einfamilienhäuser');

    const french = makeService('fr', files);
    await french.ensureLoaded();
    expect(french.familyName('EFH')).toBe('Single-family homes');
    expect(french.familyName('XYZ')).toBe('XYZ');
  });
});

describe('CashflowCardTextService.groupName', () => {
  it('names a Doodad spending group in the language picked, falling back to English, then the key', async () => {
    const files = {
      en: { doodadGroups: { leisure: 'Leisure and hobbies' }, cards: {} },
      de: { doodadGroups: { leisure: 'Freizeit und Hobby' }, cards: {} },
      fr: { cards: {} },
    };
    const german = makeService('de', files);
    await german.ensureLoaded();
    expect(german.groupName('leisure')).toBe('Freizeit und Hobby');

    const french = makeService('fr', files);
    await french.ensureLoaded();
    expect(french.groupName('leisure')).toBe('Leisure and hobbies');
    expect(french.groupName('unknown')).toBe('unknown');
  });
});
