import { of, Subject } from 'rxjs';
import { DreamfundDocsComponent } from './dreamfund-docs.component';
import { ProfileComponent } from '../../panels/profile/profile.component';

// Node globals: the spec tsconfig carries no node typings.
declare const require: (id: string) => any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const manual = (language: string) =>
  JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, `../../../assets/i18n/dreamfund-manual/${language}.json`),
      'utf8',
    ),
  );

function makeComponent(language: string) {
  const http = {
    get: jest.fn((url: string) => of(manual(url.includes('/de.json') ? 'de' : 'en'))),
  };
  const translate = {
    currentLang: language,
    defaultLang: 'en',
    use: jest.fn(),
    onLangChange: new Subject<unknown>(),
    instant: jest.fn((key: string) => key),
  };
  return {
    component: new DreamfundDocsComponent(
      http as any,
      { startDemo: jest.fn() } as any,
      translate as any,
      { navigateByUrl: jest.fn() } as any,
    ),
    http,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('DreamfundDocsComponent', () => {
  const originalMail = ProfileComponent.mail;

  beforeEach(() => {
    window.scrollTo = jest.fn() as any;
  });

  afterEach(() => {
    ProfileComponent.mail = originalMail;
  });

  it('loads the manual of the language and lists its sections in the order of the page', async () => {
    const { component, http } = makeComponent('de');
    component.ngOnInit();
    await flush();
    expect(http.get).toHaveBeenCalledWith('assets/i18n/dreamfund-manual/de.json');
    expect(component.sections.length).toBeGreaterThan(8);
    expect(component.navOf(component.sections[0])).toBe('Überblick');
    expect(component.section?.blocks.length).toBeGreaterThan(0);
    expect(component.usingFallback).toBe(false);
    component.ngOnDestroy();
  });

  it('reads the English manual in a language it has none for, and says so', async () => {
    const { component, http } = makeComponent('fr');
    component.ngOnInit();
    await flush();
    expect(http.get).toHaveBeenCalledWith('assets/i18n/dreamfund-manual/en.json');
    expect(component.usingFallback).toBe(true);
    component.selectSection(2);
    expect(component.selected.id).toBe(component.sections[2].id);
    component.ngOnDestroy();
  });

  it('holds the statistics of Jonas and only draws bold and code in its lines', async () => {
    const english = manual('en');
    const stats = english.sections[english.order[english.order.length - 1]];
    expect(stats.blocks.some((block: { type: string }) => block.type === 'table')).toBe(true);
    const { component } = makeComponent('en');
    expect(component.segments('a **b** `c`').map((part) => part.text)).toEqual([
      'a ',
      'b',
      ' ',
      'c',
    ]);
  });
});
