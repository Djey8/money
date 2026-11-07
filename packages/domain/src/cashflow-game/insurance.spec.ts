import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { DreamPlayer } from './dreamfund/player';
import {
  INSURANCE_CATALOG,
  carPremiumMinor,
  chooseInsurance,
  insuranceOffers,
  offerInsurances,
  withoutDroppedPremiums,
} from './insurance';
import { insuranceCoverage as coverageOf } from './insurance-coverage';
import { EMERGENCY_CARDS } from '../cashflow-emergency-cards';

const insuranceCoverage = (kind: string) => coverageOf(kind, EMERGENCY_CARDS);

const player = (professionId: string) =>
  DreamPlayer.fromSeed({ seed: 5, professionId, rules: { mode: 'free' } as never });

describe('the insurances of a Dreamer character', () => {
  it('prices every character on its own, the Dual Student as it was', () => {
    const premium = (id: string) => {
      const books = player(id).books;
      const line = books.subscriptions.find((sub) => sub.title === 'Haftpflichtversicherung');
      return Math.abs(line?.amountMinor ?? 0);
    };
    expect(premium('dual-student-informatik')).toBe(839);
    const others = ['mehmet-elektroniker', 'lena-pflege', 'katrin-marketing', 'jan-oberarzt'];
    expect(new Set(others.map(premium)).size).toBe(others.length);
    expect(premium('jan-oberarzt')).toBeGreaterThan(premium('lena-pflege'));
  });

  it('offers the car insurances to everybody, held by nobody until the player hops in', () => {
    const jonas = player('mehmet-elektroniker');
    const offers = insuranceOffers(jonas.state);
    const partial = offers.find((offer) => offer.kind === 'car_partial');
    expect(partial).toMatchObject({ held: false, heldNext: false });
    const line = jonas.books.subscriptions.find((sub) => sub.title === partial!.premiumTitle);
    expect(line?.amountMinor).toBe(
      -carPremiumMinor(
        'car_partial',
        jonas.profession.priceFactor,
        jonas.profession.insuranceFactor,
      ),
    );
    // asking again changes nothing
    expect(offerInsurances(jonas.books, {})).toBe(jonas.books);
    // a character without a car has the option as well
    const tobias = player('tobias-designer');
    expect(tobias.state.life?.car).toBe(false);
    expect(insuranceOffers(tobias.state).map((offer) => offer.kind)).toEqual(
      expect.arrayContaining(['car_partial', 'car_full']),
    );
  });

  it('counts at once before the first roll, and waits for the Payday afterwards', () => {
    const jonas = player('mehmet-elektroniker');
    jonas.setInsurance('car_full', true);
    expect(jonas.state.insurance?.active).toContain('car_full');
    expect(jonas.state.insurance?.fresh).toBeUndefined();
    jonas.turns = 3;
    jonas.setInsurance('household', false);
    expect(jonas.state.insurance?.active).toContain('household');
    expect(jonas.state.insurance?.pending).toEqual([{ kind: 'household', on: false }]);
    expect(chooseInsurance(jonas.state, 'nothing', true, true)).toBe(jonas.state);
  });

  it('knows the characters that have it in their start', () => {
    const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories')!;
    const lena = set.professions.find((p) => p.id === 'lena-pflege')!;
    expect(lena.lifeStart).toEqual({ kids: 1, car: true });
    expect(player('lena-pflege').state.life).toMatchObject({ kids: 1, car: true });
  });

  it('offers the insurances of the catalogue, none held', () => {
    const tobias = player('tobias-designer');
    const kinds = insuranceOffers(tobias.state).map((offer) => offer.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        'liability',
        'household',
        'legal',
        'dental',
        'car_partial',
        'disability',
        'travel',
      ]),
    );
    const legal = insuranceOffers(tobias.state).find((offer) => offer.kind === 'legal')!;
    expect(legal).toMatchObject({ held: false, heldNext: false });
  });

  it('holds only one of the two car insurances', () => {
    const jonas = player('mehmet-elektroniker');
    jonas.setInsurance('car_partial', true);
    expect(jonas.state.insurance?.active).toContain('car_partial');
    jonas.setInsurance('car_full', true);
    expect(jonas.state.insurance?.active).toContain('car_full');
    expect(jonas.state.insurance?.active).not.toContain('car_partial');
  });

  it('lists as subscriptions only what the next Payday posts', () => {
    const tobias = player('tobias-designer');
    const title = INSURANCE_CATALOG.find((info) => info.kind === 'legal')!.lineTitle;
    const listed = (books: typeof tobias.books) =>
      withoutDroppedPremiums(books).subscriptions.some((sub) => sub.title === title);
    expect(listed(tobias.books)).toBe(false);
    tobias.turns = 3;
    tobias.setInsurance('legal', true);
    // hopped in: on the bill at once, the cover comes with the Payday
    expect(listed(tobias.books)).toBe(true);
    expect(tobias.state.insurance?.active).not.toContain('legal');
    tobias.setInsurance('legal', false);
    expect(listed(tobias.books)).toBe(false);
  });

  it('knows which cards each insurance works on, the full cover also on those of the partial cover', () => {
    expect(insuranceCoverage('liability').length).toBeGreaterThan(0);
    expect(insuranceCoverage('car_full').length).toBeGreaterThanOrEqual(
      insuranceCoverage('car_partial').length,
    );
    // every insurance of the catalogue works on at least one card (JFK, 2026-11)
    expect(insuranceCoverage('legal').length).toBeGreaterThan(0);
    expect(insuranceCoverage('dental').length).toBeGreaterThan(0);
    expect(insuranceCoverage('household').length).toBeGreaterThan(0);
  });
});
