import { of } from 'rxjs';
import { LanguageService } from './language.service';
import { SettingsComponent } from '../../panels/settings/settings.component';

function makeService(currentLang = 'en') {
  const translate = {
    currentLang,
    defaultLang: 'en',
    use: jest.fn((code: string) => {
      translate.currentLang = code;
      return of({});
    }),
  };
  const saved: Record<string, string> = {};
  const localStorage = { saveData: jest.fn((key: string, value: string) => (saved[key] = value)) };
  return { service: new LanguageService(translate as any, localStorage as any), translate, saved };
}

describe('LanguageService', () => {
  afterEach(() => document.body.classList.remove('rtl-text'));

  it("switches the whole app: the translations, the stored flags Settings reads, and Settings' own toggles", async () => {
    const { service, translate, saved } = makeService('en');

    await service.use('de');

    expect(translate.use).toHaveBeenCalledWith('de');
    expect(service.current).toBe('de');
    expect(saved).toEqual({
      isEng: 'false',
      isDe: 'true',
      isEs: 'false',
      isFr: 'false',
      isCn: 'false',
      isAr: 'false',
    });
    expect([SettingsComponent.isEng, SettingsComponent.isDe, SettingsComponent.isCn]).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('turns right-to-left text on for Arabic and off again for anything else', async () => {
    const { service } = makeService();

    await service.use('ar');
    expect(document.body.classList.contains('rtl-text')).toBe(true);
    expect(SettingsComponent.isAr).toBe(true);

    await service.use('fr');
    expect(document.body.classList.contains('rtl-text')).toBe(false);
    expect(SettingsComponent.isFr).toBe(true);
    expect(SettingsComponent.isAr).toBe(false);
  });

  it('offers the six languages of the app, each with a flag', () => {
    const { service } = makeService();
    expect(service.languages.map((l) => l.code)).toEqual(['en', 'de', 'es', 'fr', 'cn', 'ar']);
    expect(service.languages.every((l) => l.flag && l.name)).toBe(true);
  });
});
