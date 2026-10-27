/**
 * The builder of the Dreamfund characters (JFK, 2026-10-27): a character is described by a handful of numbers - gross salary, price
 * level, how much is left of a month, debts, the dream - and the month (taxes and social insurance of the German salary, the rent, the
 * groceries...) is worked out from them the same way for everybody. That keeps the nine new characters comparable with the Dual
 * Student: what a card is worth in proportion to a character's life is the same for all of them, and what makes one character harder
 * than another is a number in the description, not a quirk of the data.
 *
 * Every character exists three times - Easy, Medium and Hard (`id`, `id~easy`, `id~hard`): the story is the same, the numbers are
 * not. Easy is round and simple (few lines, round amounts, a little more left of a month), Medium is a realistic budget, Hard is tight.
 */
import type { CareerStage, CareerTrack } from './cashflow-game/career';
import { germanPay, type GermanPayOptions } from './cashflow-game/german-pay';
import type { Difficulty } from './cashflow-game/difficulty';
import type {
  CashflowDreamProject,
  CashflowExpenseLine,
  CashflowProfession,
  CashflowProfileTexts,
  CashflowStarterKitEntry,
} from './cashflow-game/types';

type Lang = 'en' | 'de';
type Pair = { en: string; de: string };

/** The Dual Student's month left over: what a price level of 1 and an ease of 1 leave. */
const BASE_SURPLUS = 500;

export interface DebtSpec {
  /** One of the keys the app translates: parentsLoan, carLoan, studentLoanDebt, creditCardDebt, bankLoan, licenceLoan, mortgage. */
  key: string;
  /** The debt as the books carry it (German, like the other tags). */
  tag: string;
  label: Pair;
  /** Euros at the price level of the character (Medium). */
  amount: number;
}

export interface BucketSpec {
  id: string;
  title: Pair;
  amount: number;
  note?: Pair;
}

export interface DreamSpec {
  title: Pair;
  sub: Pair;
  description?: Pair;
  summary?: Pair;
  buckets: BucketSpec[];
  notes?: Pair[];
  actions?: { text: Pair; priority: 'low' | 'medium' | 'high' }[];
  links?: { label: Pair; url: string }[];
}

export interface RungSpec {
  id: string;
  title: Pair;
  story: Pair;
  /** Gross, euros a year. */
  grossYear: number;
  /** Paydays in the stage before the tile can promote, and the roll that promotes. */
  minPaydays: number;
  rollFrom: number;
  /** A yearly bonus in percent of the gross (net of tax roughly 55 %). */
  bonusPercent?: number;
  companyCar?: boolean;
}

export interface ExtraLine {
  key: string;
  title: string;
  amount: number;
  account?: 'Daily' | 'Splurge' | 'Fire';
}

export interface ProfessionSpec {
  id: string;
  /** The job title (the card's `title`). */
  title: string;
  name: Pair;
  tagline: Pair;
  background: Pair;
  values: [Pair, Pair, Pair];
  /** Gross salary per month in euros at the first stage. */
  gross: number;
  pay?: GermanPayOptions;
  /** The price level: what the cards, the dream and the debts cost compared with the Dual Student. */
  scale: number;
  /** Left of a month in proportion to the Dual Student's (1 = the same share of the price level; below 1 = harder). */
  ease: number;
  savings: number;
  debts: DebtSpec[];
  /** How much of a raise goes into the lifestyle (default 0.3): the higher the pay, the more of every raise is spent. */
  creep?: number;
  /** The rent or the house, the children, the car: what is special about this life. */
  extras: ExtraLine[];
  /** The key of the home line (`rent`, or `mortgageRent` for a house). */
  homeKey?: 'rent' | 'mortgageRent';
  homeTitle?: string;
  homeAmount: number;
  dream: DreamSpec;
  ladder: RungSpec[];
}

/** What a difficulty does to the numbers of a character. */
export interface VariantTuning {
  ease: number;
  debts: number;
  savings: number;
  dream: number;
  /** A promotion needs this much more (Hard) or less (Easy) of a roll; added to the roll that promotes. */
  rollShift: number;
}

export const VARIANT_TUNING: Record<Difficulty, VariantTuning> = {
  easy: { ease: 1.3, debts: 0.8, savings: 1.5, dream: 0.9, rollShift: -1 },
  medium: { ease: 1, debts: 1, savings: 1, dream: 1, rollShift: 0 },
  hard: { ease: 0.85, debts: 1.1, savings: 0.75, dream: 1.05, rollShift: 1 },
};

/** Weights of the rest of a month (after taxes, insurances and the special lines), taken from the Dual Student's budget. */
const WEIGHTS = {
  home: 0.546,
  utilities: 0.0485,
  subscriptions: 0.016,
  groceries: 0.205,
  takeaway: 0.034,
  hygiene: 0.0205,
  haircut: 0.01,
  restaurant: 0.041,
  hobbies: 0.0786,
};

const round = (value: number, step = 1) => Math.round(value / step) * step;
const minor = (euros: number) => Math.round(euros * 100);

/** Premiums of the two insurances of the Emergency pile: what they cost grows a little with the price level. */
const insurancePremiums = (scale: number, easy: boolean) => {
  if (easy)
    return { liability: round(10 * scale, 10) || 10, household: round(20 * scale, 10) || 20 };
  // whole euros together (24 for the Dual Student: 8.39 and 15.61), so that the groceries come out in whole euros
  const total = Math.max(1, Math.round(24 * Math.sqrt(scale)));
  const liability = Math.round(total * 0.3496 * 100) / 100;
  return { liability, household: Math.round((total - liability) * 100) / 100 };
};

interface BuiltMonth {
  salaryMinor: number;
  expenses: CashflowExpenseLine[];
}

function buildMonth(
  spec: ProfessionSpec,
  gross: number,
  surplus: number,
  easy: boolean,
): BuiltMonth {
  const pay = germanPay(gross, spec.pay);
  const step = easy ? 10 : 1;
  const tax = round(pay.taxMonth, step);
  const pension = round(pay.pensionMonth, step);
  const health = round(pay.healthMonth, step);
  const care = round(pay.careMonth, step);
  const unemployment = round(pay.unemploymentMonth, step);
  const insurance = insurancePremiums(spec.scale, easy);
  const lines: CashflowExpenseLine[] = [];
  const add = (
    key: string,
    title: string,
    amount: number,
    account?: CashflowExpenseLine['account'],
    extra: Partial<CashflowExpenseLine> = {},
  ) => {
    if (amount > 0) {
      lines.push({
        title,
        amountMinor: minor(amount),
        key,
        ...(account ? { account } : {}),
        ...extra,
      });
    }
  };
  add('incomeTax', 'Lohnsteuer', tax);
  if (easy) {
    // the social insurances in two lines: the pension, and the rest
    add('pension', 'Rentenversicherung', pension);
    add(
      'healthInsurance',
      'Kranken-, Pflege- & Arbeitslosenversicherung',
      health + care + unemployment,
      'Fire',
    );
  } else {
    add('pension', 'Rentenversicherung', pension);
    add(
      'healthInsurance',
      spec.pay?.civilServant ? 'Private Krankenversicherung' : 'Krankenversicherung',
      health,
      'Fire',
    );
    add('careInsurance', 'Pflegeversicherung', care, 'Fire');
    add('unemploymentInsurance', 'Arbeitslosenversicherung', unemployment, 'Fire');
  }
  add('liabilityInsurance', 'Haftpflichtversicherung', insurance.liability, 'Fire', {
    insurance: 'liability',
  });
  add('householdInsurance', 'Hausratversicherung', insurance.household, 'Fire', {
    insurance: 'household',
  });
  for (const extra of spec.extras) {
    add(
      extra.key,
      extra.title,
      easy ? round(extra.amount, 50) : round(extra.amount, 5),
      extra.account,
    );
  }
  const salary = easy ? round(gross, 100) : round(gross);
  const w = WEIGHTS;
  const nonHome = 1 - w.home;
  const given = spec.homeAmount > 0 ? (easy ? round(spec.homeAmount, 50) : spec.homeAmount) : 0;
  // what is left to live on: the salary less everything above, the home and the surplus
  const fixed = lines.reduce((sum, line) => sum + line.amountMinor, 0) / 100;
  const rest = Math.max(0, salary - fixed - surplus - given);
  const home = given || (easy ? round(rest * w.home, 50) : round(rest * w.home));
  // the money for everything but the home
  const pool = given ? rest : rest - home;
  const share = (weight: number) => (pool * weight) / nonHome;
  add(spec.homeKey ?? 'rent', spec.homeTitle ?? 'Miete', home);
  if (easy) {
    const utilities = round(share(w.utilities + w.subscriptions), 10);
    const leisure = round(share(w.takeaway + w.restaurant + w.hobbies), 50);
    add('utilities', 'Nebenkosten & Telekom', utilities);
    add('leisure', 'Freizeit & Essen gehen', leisure, 'Splurge');
    // the rest, so that the surplus is exactly the one asked for
    const used = lines.reduce((sum, line) => sum + line.amountMinor, 0) / 100;
    add('living', 'Lebensmittel & Alltag', Math.max(0, salary - surplus - used));
  } else {
    add('utilities', 'Nebenkosten & Telekom', round(share(w.utilities)));
    add('subscriptions', 'Abos', round(share(w.subscriptions)));
    add('takeaway', 'Essen to go', round(share(w.takeaway)), 'Splurge');
    add('hygiene', 'Drogerie & Hygiene', round(share(w.hygiene)), 'Splurge');
    add('haircut', 'Friseur', round(share(w.haircut)), 'Splurge');
    add('restaurant', 'Restaurant', round(share(w.restaurant)), 'Splurge');
    add('hobbies', 'Hobbys', round(share(w.hobbies)), 'Splurge');
    // the groceries take whatever rounding leaves, so that the surplus is exactly the one asked for
    const used = lines.reduce((sum, line) => sum + line.amountMinor, 0) / 100;
    add('groceries', 'Lebensmittel', Math.max(0, salary - surplus - used));
  }
  return { salaryMinor: minor(salary), expenses: lines };
}

/** The ladder: stage numbers worked out from the gross of each rung the way the Dual Student's are. */
function buildCareer(spec: ProfessionSpec, tuning: VariantTuning, easy: boolean): CareerTrack {
  const first = germanPay(spec.ladder[0].grossYear / 12, spec.pay);
  const stages: CareerStage[] = spec.ladder.map((rung, index) => {
    const gross = rung.grossYear / 12;
    const pay = germanPay(gross, spec.pay);
    const previous = index > 0 ? germanPay(spec.ladder[index - 1].grossYear / 12, spec.pay) : pay;
    const step = easy ? 10 : 1;
    const delta =
      index === 0 ? 0 : Math.max(0, pay.netMonth - previous.netMonth) * (spec.creep ?? 0.3);
    const ratio = pay.netMonth / first.netMonth;
    const next = spec.ladder[index + 1];
    return {
      id: rung.id,
      stage: index + 1,
      title: rung.title,
      story: rung.story,
      grossYearMinor: minor(easy ? round(rung.grossYear, 1000) : rung.grossYear),
      netMonthMinor: minor(round(pay.netMonth, step)),
      taxMonthMinor: minor(round(pay.taxMonth, step)),
      socialMonthMinor: minor(round(pay.socialMonth, step)),
      expensesDeltaMinor: minor(round(delta * (spec.scale >= 1 ? 1 : 1), 50)),
      ...(index > 0 ? { oneTimeMinor: 0 } : {}),
      ...(rung.bonusPercent
        ? {
            bonus: {
              percent: rung.bonusPercent,
              netMinor: minor(round(((rung.grossYear * rung.bonusPercent) / 100) * 0.55, 500)),
              everyPaydays: 12,
            },
          }
        : {}),
      livingStandard: Math.round(spec.scale * (1 + 0.5 * Math.log(ratio)) * 20) / 20,
      ...(rung.companyCar ? { companyCar: true } : {}),
      next: next
        ? {
            stages: [next.id],
            minPaydays: rung.minPaydays,
            rollFrom: Math.min(6, Math.max(2, rung.rollFrom + tuning.rollShift)),
          }
        : null,
      links: [],
    } as CareerStage;
  });
  // `oneTimeMinor: 0` is noise
  for (const stage of stages) if (!stage.oneTimeMinor) delete stage.oneTimeMinor;
  return { start: spec.ladder[0].id, stages };
}

const fmt = (amount: number, lang: Lang) =>
  amount.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 });

/** The dream as the Smile project of one language. */
function dreamProject(
  spec: ProfessionSpec,
  lang: Lang,
  scale: number,
  round_: boolean,
): CashflowDreamProject {
  const dream = spec.dream;
  const bucketAmount = (amount: number) =>
    round_ ? round(amount * scale, 100) : round(amount * scale);
  return {
    title: dream.title[lang],
    sub: dream.sub[lang],
    description: dream.description?.[lang] ?? dream.sub[lang],
    buckets: dream.buckets.map((bucket) => ({
      id: bucket.id,
      title: bucket.title[lang],
      targetMinor: minor(bucketAmount(bucket.amount)),
      notes: bucket.note?.[lang] ?? '',
    })),
    links: (dream.links ?? []).map((link) => ({ label: link.label[lang], url: link.url })),
    actionItems: (dream.actions ?? []).map((item) => ({
      text: item.text[lang],
      priority: item.priority,
    })),
    notes: (dream.notes ?? []).map((note) => note[lang]),
  };
}

/** The debts of a variant: tuned and, on Easy, round. */
function debtsOf(
  spec: ProfessionSpec,
  tuning: VariantTuning,
  easy: boolean,
): (CashflowStarterKitEntry & { label: Pair })[] {
  return spec.debts.map((debt) => ({
    tag: debt.tag,
    key: debt.key,
    label: debt.label,
    amountMinor: minor(
      easy ? round(debt.amount * tuning.debts, 500) : round(debt.amount * tuning.debts, 50),
    ),
  }));
}

export interface BuildContext {
  reserveProject: (lang: Lang, monthlyExpensesMinor: number) => CashflowDreamProject;
}

const GOAL = {
  dream: {
    en: 'Fund and complete the dream: every bucket of the project full',
    de: 'Finanziere und erfülle den Traum: jeder Topf des Projekts voll',
  },
  reserve: {
    en: 'Build the emergency reserve: three monthly expenses in the Mojo',
    de: 'Baue den Notgroschen auf: drei Monatsausgaben im Mojo',
  },
  independence: {
    en: 'Become financially independent: passive income covers all monthly expenses',
    de: 'Werde finanziell unabhängig: passives Einkommen deckt alle monatlichen Ausgaben',
  },
};

/**
 * What a difficulty does to what is left of a month. Hard takes a share of it away, but less from a character who has little to begin
 * with (the tight lives are hard enough: JFK, 2026-10-27, the simulation showed the surgeon unwinnable on Hard).
 */
function easeFactor(spec: ProfessionSpec, difficulty: Difficulty): number {
  const factor = VARIANT_TUNING[difficulty].ease;
  if (difficulty !== 'hard' || spec.ease >= 1) return factor;
  return Math.min(1, factor + (1 - spec.ease) * 0.2);
}

/** One character in one difficulty. */
export function buildProfession(
  spec: ProfessionSpec,
  difficulty: Difficulty,
  context: BuildContext,
): CashflowProfession {
  const tuning = VARIANT_TUNING[difficulty];
  const easy = difficulty === 'easy';
  const surplus = easy
    ? round(BASE_SURPLUS * spec.scale * spec.ease * easeFactor(spec, difficulty), 50)
    : round(BASE_SURPLUS * spec.scale * spec.ease * easeFactor(spec, difficulty), 5);
  const month = buildMonth(spec, spec.gross, surplus, easy);
  const debts = debtsOf(spec, tuning, easy);
  const monthlyExpensesMinor = month.expenses.reduce((sum, line) => sum + line.amountMinor, 0);
  const id = difficulty === 'medium' ? spec.id : `${spec.id}~${difficulty}`;
  const dreamTotal = spec.dream.buckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  const texts = Object.fromEntries(
    (['en', 'de'] as const).map((lang) => {
      const currency = lang === 'de' ? 'TT' : 'DT';
      const project = dreamProject(spec, lang, tuning.dream, easy);
      const text: CashflowProfileTexts = {
        name: spec.name[lang],
        tagline: spec.tagline[lang],
        background: spec.background[lang],
        values: spec.values.map((value) => value[lang]),
        goal:
          lang === 'de'
            ? 'Alles auf dieser Liste muss wahr werden:'
            : 'Everything on this list has to come true:',
        goalItems: [
          ...debts.map((debt) => ({
            id: `debt:${debt.key}` as const,
            text:
              lang === 'de'
                ? `Zahle ${debt.label.de} zurück (${fmt(debt.amountMinor / 100, lang)} ${currency})`
                : `Pay back the ${debt.label.en} (${fmt(debt.amountMinor / 100, lang)} ${currency})`,
          })),
          { id: 'dream' as const, text: GOAL.dream[lang] },
          { id: 'reserve' as const, text: GOAL.reserve[lang] },
          { id: 'independence' as const, text: GOAL.independence[lang] },
        ],
        dream: {
          title: spec.dream.title[lang],
          summary: spec.dream.summary?.[lang] ?? spec.dream.sub[lang],
          project,
        },
        reserve: {
          summary:
            lang === 'de'
              ? 'Jeder Charakter muss einen Notgroschen von drei Monatsausgaben aus eigener Kraft aufbauen. Er ist vom ersten Tag an ein Fire-Projekt: fülle ihn mit Zahlplänen, nutze ihn für Notfälle, lösche ihn nie.'
              : 'Every character has to build an emergency reserve of three monthly expenses on their own. It is a Fire project from the first day: fill it with payment plans, use it for emergencies, never delete it.',
          project: context.reserveProject(lang, monthlyExpensesMinor),
        },
      };
      return [lang, text];
    }),
  ) as { en: CashflowProfileTexts } & Record<string, CashflowProfileTexts>;
  void dreamTotal;
  return {
    id,
    title: spec.title,
    salaryMinor: month.salaryMinor,
    expenses: month.expenses,
    perChildExpenseMinor: minor(round(300 * spec.scale, easy ? 50 : 5)),
    savingsMinor: minor(
      easy ? round(spec.savings * tuning.savings, 100) : round(spec.savings * tuning.savings, 10),
    ),
    priceFactor: spec.scale,
    ...(easy ? { roundNumbers: true } : {}),
    ...(difficulty === 'medium' ? {} : { variantOf: spec.id }),
    ...(spec.ladder.length > 0 ? { career: buildCareer(spec, tuning, easy) } : {}),
    starterKit: {
      liabilities: debts.map(({ tag, key, amountMinor }) => ({ tag, key, amountMinor })),
    },
    profile: { texts },
  };
}

/** A hand-written ladder at another difficulty: the promotions are easier or harder to roll, and on Easy the amounts are round. */
function shiftCareer(track: CareerTrack, tuning: VariantTuning, easy: boolean): CareerTrack {
  const nice = (minorValue: number, step: number) => Math.round(minorValue / step) * step;
  return {
    start: track.start,
    stages: track.stages.map((stage) => ({
      ...stage,
      ...(easy
        ? {
            grossYearMinor: nice(stage.grossYearMinor, 100000),
            netMonthMinor: nice(stage.netMonthMinor, 1000),
            taxMonthMinor: nice(stage.taxMonthMinor, 1000),
            socialMonthMinor: nice(stage.socialMonthMinor, 1000),
            expensesDeltaMinor: nice(stage.expensesDeltaMinor, 5000),
          }
        : {}),
      next: stage.next
        ? {
            ...stage.next,
            rollFrom: Math.min(6, Math.max(2, stage.next.rollFrom + tuning.rollShift)),
          }
        : null,
    })),
  };
}

/**
 * A character that was written by hand (the Dual Student) at the other difficulties: the story, the dream and the ladder are the
 * hand-written ones, the month is built from the numbers of `spec`, the amounts follow the difficulty.
 */
export function buildVariantOf(
  base: CashflowProfession,
  spec: ProfessionSpec,
  difficulty: Difficulty,
  context: BuildContext,
): CashflowProfession {
  const built = buildProfession(spec, difficulty, context);
  const tuning = VARIANT_TUNING[difficulty];
  const easy = difficulty === 'easy';
  const texts = Object.fromEntries(
    Object.entries(base.profile?.texts ?? {}).map(([lang, text]) => {
      const mine = built.profile?.texts[lang];
      const project = text.dream.project;
      return [
        lang,
        {
          ...text,
          goalItems: mine?.goalItems ?? text.goalItems,
          dream: {
            ...text.dream,
            ...(project
              ? {
                  project: {
                    ...project,
                    buckets: project.buckets.map((bucket) => ({
                      ...bucket,
                      targetMinor: easy
                        ? Math.round((bucket.targetMinor * tuning.dream) / 10000) * 10000
                        : Math.round(bucket.targetMinor * tuning.dream),
                    })),
                  },
                }
              : {}),
          },
          reserve: mine?.reserve ?? text.reserve,
        },
      ];
    }),
  ) as { en: CashflowProfileTexts } & Record<string, CashflowProfileTexts>;
  return {
    ...built,
    ...(base.career ? { career: shiftCareer(base.career, tuning, easy) } : {}),
    profile: { texts },
  };
}

/** All three difficulties of a list of characters, the medium ones first. */
export function buildProfessions(
  specs: ProfessionSpec[],
  context: BuildContext,
): CashflowProfession[] {
  return (['medium', 'easy', 'hard'] as const).flatMap((difficulty) =>
    specs.map((spec) => buildProfession(spec, difficulty, context)),
  );
}
