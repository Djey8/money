import { of, Subject } from 'rxjs';
import { CashflowDocsComponent } from './cashflow-docs.component';
import { MANUAL_SECTIONS } from './manual-content';
import { ProfileComponent } from '../../panels/profile/profile.component';
import { CashflowCardTextService } from '../../shared/services/cashflow-card-text.service';

// Node globals: the spec tsconfig carries no node typings.
declare const require: (id: string) => any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const manual = (language: string) =>
  JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, `../../../assets/i18n/cashflow-manual/${language}.json`),
      'utf8',
    ),
  );

function makeComponent(language = 'en') {
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
  const cardText = {
    version: 1,
    ensureLoaded: jest.fn(() => Promise.resolve()),
    textFor: jest.fn(() => ({ title: 'Card title', description: 'Card text' })),
    symbolFor: jest.fn((symbol: string) => symbol),
    groupName: jest.fn((group: string) => group),
    familyName: jest.fn((family: string) => family),
  };
  const component = new CashflowDocsComponent(
    http as any,
    { startDemo: jest.fn() } as any,
    translate as any,
    { navigateByUrl: jest.fn() } as any,
    cardText as unknown as CashflowCardTextService,
  );
  return { component, http, cardText, translate };
}

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('CashflowDocsComponent', () => {
  const originalMail = ProfileComponent.mail;

  beforeEach(() => {
    window.scrollTo = jest.fn() as any;
    window.location.hash = '';
  });

  afterEach(() => {
    ProfileComponent.mail = originalMail;
  });

  it('is locked for an account that is not a Cashflow game account', () => {
    ProfileComponent.mail = 'jane@example.com';
    expect(makeComponent().component.isGameAccount).toBe(false);
  });

  it('is open for a Cashflow game account', () => {
    ProfileComponent.mail = 'anna.cashflow@example.com';
    expect(makeComponent().component.isGameAccount).toBe(true);
  });

  it('loads the manual of the app language', async () => {
    const { component, http } = makeComponent('de');
    component.ngOnInit();
    await flush();

    expect(http.get).toHaveBeenCalledWith('assets/i18n/cashflow-manual/de.json');
    expect(component.content?.title).toBe('Cashflow-Spiel-Handbuch');
    expect(component.usingFallback).toBe(false);
  });

  it('shows the manual in each of the six languages', async () => {
    for (const language of ['en', 'de', 'es', 'fr', 'cn', 'ar']) {
      const { component, http } = makeComponent(language);
      component.ngOnInit();
      await flush();

      expect(http.get).toHaveBeenCalledWith(`assets/i18n/cashflow-manual/${language}.json`);
      expect(component.usingFallback).toBe(false);
    }
  });

  it('shows the English manual with a notice for a language without a manual', async () => {
    const { component, http } = makeComponent('it');
    component.ngOnInit();
    await flush();

    expect(http.get).toHaveBeenCalledWith('assets/i18n/cashflow-manual/en.json');
    expect(component.usingFallback).toBe(true);
    expect(component.content).not.toBeNull();
  });

  it('reports a failed load instead of throwing', async () => {
    const { component, http } = makeComponent();
    http.get.mockImplementation(() => {
      throw new Error('offline');
    });
    component.ngOnInit();
    await flush();

    expect(component.loadFailed).toBe(true);
    expect(component.content).toBeNull();
  });

  it('reloads the manual when the language is switched', async () => {
    const { component, translate } = makeComponent('en');
    component.ngOnInit();
    await flush();
    expect(component.content?.title).toBe('Cashflow Game Manual');

    translate.currentLang = 'de';
    translate.onLangChange.next({ lang: 'de' });
    await flush();

    expect(component.content?.title).toBe('Cashflow-Spiel-Handbuch');
    component.ngOnDestroy();
    expect(translate.onLangChange.observed).toBe(false);
  });

  it('walks through the sections with previous and next', async () => {
    const { component } = makeComponent();
    component.ngOnInit();
    await flush();

    expect(component.selected.id).toBe(MANUAL_SECTIONS[0].id);
    expect(component.previous).toBeUndefined();
    expect(component.section?.title).toBeTruthy();

    component.selectSection(3);
    expect(component.selected.id).toBe(MANUAL_SECTIONS[3].id);
    expect(component.previous?.id).toBe(MANUAL_SECTIONS[2].id);
    expect(component.next?.id).toBe(MANUAL_SECTIONS[4].id);

    component.selectSection(MANUAL_SECTIONS.length - 1);
    expect(component.next).toBeUndefined();
  });

  it('opens the section named in the link', () => {
    window.location.hash = '#section=strategy';
    const { component } = makeComponent();
    component.ngOnInit();

    expect(component.selected.id).toBe('strategy');
  });

  it('builds the tables from the card catalog', async () => {
    const { component } = makeComponent();
    component.ngOnInit();
    await flush();

    const table = component.table({ type: 'data', id: 'professions' } as any);
    expect(table.rows).toHaveLength(15);
    expect(component.table({ type: 'data', id: 'professions' } as any)).toBe(table);
  });

  it('draws a real card and skips an unknown one', async () => {
    const { component } = makeComponent();
    component.ngOnInit();
    await flush();

    const face = component.faceOf('classic-small-efh-45k-2k');
    expect(face?.tone).toBe('small');
    expect(face?.facts.map((fact) => fact.label)).toEqual(
      expect.arrayContaining(['Deposit', 'Cashflow']),
    );
    expect(component.faceOf('no-such-card')).toBeNull();
  });

  it('lists every card of a pile in the card reference and filters it by what is typed', async () => {
    const { component } = makeComponent();
    component.ngOnInit();
    await flush();

    expect(component.browserDecks).toEqual(['dealSmall', 'dealBig', 'market', 'doodad']);
    const all = component.browserShown;
    expect(all.length).toBeGreaterThan(10);
    expect(all.every((row) => row.id.startsWith('classic-small-'))).toBe(true);

    component.browserQuery = 'OK4U';
    expect(component.browserShown.length).toBeGreaterThan(0);
    expect(component.browserShown.length).toBeLessThan(all.length);

    component.selectBrowserDeck('doodad');
    expect(component.browserQuery).toBe('');
    expect(component.browserShown.every((row) => row.deck === 'doodad')).toBe(true);
    component.browserQuery = 'zzzz-no-card';
    expect(component.browserShown).toEqual([]);
  });
});
