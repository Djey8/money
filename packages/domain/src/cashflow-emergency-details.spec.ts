import { EMERGENCY_CARDS } from './cashflow-emergency-cards';
import { emergencyProjectParts } from './cashflow-game/emergency-project';
import { quoteEmergency } from './cashflow-game/emergency-deck';

describe('the detail of the Emergency cards', () => {
  it('every card has a description, a note for every bucket or choice, three actions and a tip or a fun fact last', () => {
    for (const card of EMERGENCY_CARDS) {
      expect(card.description?.en && card.description?.de).toBeTruthy();
      const parts = card.type === 'choice' ? (card.choices ?? []) : (card.buckets ?? []);
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        expect(part.notes?.en && part.notes?.de).toBeTruthy();
      }
      expect(card.actions.length).toBeGreaterThanOrEqual(3);
      const last = card.notes?.[card.notes.length - 1];
      expect(last?.en).toMatch(/^(Tip|Fun fact): /);
      expect(last?.de).toMatch(/^(Tipp: |Wusstest du\? )/);
      for (const link of [...card.links, ...parts.flatMap((part) => part.links ?? [])]) {
        expect(link.url).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/);
        expect(link.label.en.length).toBeGreaterThan(3);
      }
    }
  });

  it('the project of a card carries bucket notes, links, actions and at most four notes', () => {
    for (const card of EMERGENCY_CARDS) {
      const quote = quoteEmergency(
        card,
        { choiceId: card.choices?.[0]?.id, rolls: { main: 1, extra: 1, 'bucket:b2': 1 } },
        { insurances: [], traits: [], openEmergencies: 0 },
      );
      for (const lang of ['en', 'de'] as const) {
        const parts = emergencyProjectParts(card, lang, quote);
        expect(parts.description.length).toBeGreaterThan(60);
        expect(parts.notes.length).toBeGreaterThan(0);
        expect(parts.notes.length).toBeLessThanOrEqual(4);
        expect(parts.notes[parts.notes.length - 1]).toMatch(/^(Tip|Fun fact|Tipp|Wusstest du)/);
      }
    }
  });

  it('an insured card limits the cost to the deductible of the card, and an uninsured one may cost more', () => {
    const bike = EMERGENCY_CARDS.find((card) => card.id === 'E18')!;
    const insured = quoteEmergency(
      bike,
      { rolls: { main: 6 } },
      { insurances: ['household'], traits: [], openEmergencies: 0 },
    );
    expect(insured.insured).toBe(true);
    expect(insured.payMinor).toBe(20000);
    const accident = EMERGENCY_CARDS.find((card) => card.id === 'E28')!;
    const without = quoteEmergency(
      accident,
      { rolls: { main: 1 } },
      { insurances: [], traits: [], openEmergencies: 0 },
    );
    const withLiability = quoteEmergency(
      accident,
      { rolls: { main: 1 } },
      { insurances: ['liability'], traits: [], openEmergencies: 0 },
    );
    expect(without.fullMinor).toBe(80000 + 150000);
    expect(withLiability.fullMinor).toBe(80000);
  });
});
