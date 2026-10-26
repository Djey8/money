import { AppDataService } from './app-data.service';
import { AppStateService } from './app-state.service';
import { CashflowGameService } from './cashflow-game.service';
import { IncomeStatementService } from './income-statement.service';
import { ProfileComponent } from '../../panels/profile/profile.component';
import { migrateFire } from '../fire-migration.utils';
import { migrateSmile } from '../smile-migration.utils';

/**
 * A Dreamfund game that is closed and opened again must be what it was (JFK, 2026-10-26: after a reload the life, the career, the
 * dreams and the reserve were gone). The state is written leaf by leaf - everything a string once encrypted - and read back by name:
 * a part the reader does not know is lost. Here a game is played, stored the way the database stores it, and read back.
 */
describe('a Dreamfund game survives a reload', () => {
  let service: CashflowGameService;
  const ok = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
  const state = () => AppStateService.instance;

  /** What the database does to a state: every leaf becomes text, lists and objects keep their shape. */
  const stored = (value: unknown): unknown => {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) return value.map(stored);
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        const leaf = stored(item);
        if (leaf !== undefined) out[key] = leaf;
      }
      return out;
    }
    return String(value);
  };

  const reader = (): any => {
    const reading: any = Object.create(AppDataService.prototype);
    reading.cryptic = { decrypt: (value: unknown) => String(value) };
    return reading;
  };

  const land = (tile: string) => {
    state().cashflowGame = {
      ...state().cashflowGame,
      turn: {
        phase: 'decide',
        count: 5,
        pending: {
          kind: 'story',
          tile: tile as 'life',
          storyCardId: `${tile}-filler`,
          spaceIndex: 3,
        },
      },
    };
  };

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    localStorage.clear();
    ProfileComponent.mail = 'player@cashflow.example';
    const s = state();
    s.daily = 60;
    s.splurge = 10;
    s.smile = 10;
    s.fire = 20;
    const persistence = {
      batchWriteAndSync: jest.fn((config) => config.onSuccess()),
      writeAndSync: jest.fn((config) => config.onSuccess()),
    };
    const translate = { instant: jest.fn((key: string) => key), currentLang: 'en' };
    service = new CashflowGameService(
      persistence as any,
      new IncomeStatementService({ saveData: jest.fn() } as any),
      translate as any,
    );
    service.pickProfession('jfk-stories', 'dual-student-informatik', ok(), 'solo');
    service.payday(ok());
  });

  it('keeps the life, the career, the dreams, the insurances and the card on the tile', () => {
    // a life: a partner, a baby on the way, a move
    land('life');
    service.drawLife(ok(), 'L01');
    service.decideLife({ kind: 'fate' }, ok());
    land('life');
    service.drawLife(ok(), 'L17');
    service.decideLife({ kind: 'accept' }, ok());
    land('life');
    service.drawLife(ok(), 'L05');
    service.rng = () => 0;
    service.decideLife({ kind: 'roll' }, ok());
    // a dream taken, an insurance dropped for the next Payday, a promotion
    land('dream');
    service.drawDream(ok(), { cardId: 'D16' });
    service.takeDream('D16', ok());
    service.setInsurance('household', false, ok());
    state().cashflowGame = { ...state().cashflowGame, career: { stage: 'C1', paydaysInStage: 3 } };
    land('career');
    service.rng = () => 0.99;
    service.rollCareerTile(ok());
    // an emergency with its dice and its project, left open on the tile
    land('emergency');
    service.drawEmergency(ok(), 'E21');
    service.rollEmergencyDie('main', ok());

    const before = JSON.parse(JSON.stringify(state().cashflowGame));
    const after = reader().decryptCashflowGameState(stored(before));
    // every part of the state, one by one: a part that is lost names itself
    for (const key of Object.keys(before))
      expect({ [key]: after[key] }).toEqual({ [key]: before[key] });
    // and the parts the reader once lost are really there
    expect(after.life).toBeTruthy();
    expect(after.life.location).toBe('abroad_europe');
    expect(after.career.stage).toBe('C2');
    expect(after.dreams.open).toHaveLength(1);
    expect(after.insurance.pending).toEqual([{ kind: 'household', on: false }]);
    expect(after.lifeScheduled).toHaveLength(1);
    expect(after.turn.pending.tile).toBe('emergency');
    expect(after.turn.pending.emergency.rolls.main).toBeGreaterThanOrEqual(1);
  });

  it('keeps what makes a Smile or a Fire project a part of the game', () => {
    expect(
      migrateSmile({ title: 'Dream', dream: true, dreamCardId: 'D01', buckets: [] }),
    ).toMatchObject({
      dream: true,
      dreamCardId: 'D01',
    });
    expect(migrateSmile({ title: 'Plain', buckets: [] }).dream).toBeUndefined();
    expect(
      migrateFire({ title: 'Reserve', reserve: true, emergencyCardId: 'E01', buckets: [] }),
    ).toMatchObject({
      reserve: true,
      emergencyCardId: 'E01',
    });
    expect(migrateFire({ title: 'Plain', buckets: [] }).reserve).toBeUndefined();
  });
});
