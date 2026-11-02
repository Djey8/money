import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { DreamPlayer } from './dreamfund/player';
import { carPremiumMinor, chooseInsurance, insuranceOffers, offerCarInsurance } from './insurance';

const player = (professionId: string) =>
  DreamPlayer.fromSeed({ seed: 5, professionId, rules: { mode: 'free' } as never });

describe('the insurances of a Dreamfund character', () => {
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

  it('offers the car insurances to a character with a car, held by nobody until the player hops in', () => {
    const jonas = player('mehmet-elektroniker');
    const offers = insuranceOffers(jonas.state);
    const partial = offers.find((offer) => offer.kind === 'car_partial');
    expect(partial).toMatchObject({ held: false, heldNext: false });
    expect(jonas.state.insurance?.fresh).toEqual(['car_partial', 'car_full']);
    const line = jonas.books.subscriptions.find((sub) => sub.title === partial!.premiumTitle);
    expect(line?.amountMinor).toBe(
      -carPremiumMinor(
        'car_partial',
        jonas.profession.priceFactor,
        jonas.profession.insuranceFactor,
      ),
    );
    // asking again changes nothing
    expect(offerCarInsurance(jonas.books, {})).toBe(jonas.books);
  });

  it('a character without a car is offered none, and one that gets a car is offered them then', () => {
    const tobias = player('tobias-designer');
    expect(insuranceOffers(tobias.state).some((offer) => offer.kind.startsWith('car'))).toBe(false);
    tobias.setState({ ...tobias.state, life: { ...tobias.state.life!, car: true } });
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
});
