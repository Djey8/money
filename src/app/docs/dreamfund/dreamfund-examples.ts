import type { Fire } from '../../interfaces/fire';
import type { Grow } from '../../interfaces/grow';
import type { PlannedSubscription } from '../../interfaces/planned-subscription';
import type { Smile } from '../../interfaces/smile';

/**
 * The example projects of the Dreamfund manual (JFK, 2026-11-06): six real projects - two Grow, two Fire (emergencies) and two Smile
 * (dreams) - as the game would put them in the books, in a planned phase. The manual draws them in the grid of their page and opens the
 * REAL info panel of the app on them (`openPreview`: read only, not in the account, nothing can be changed or saved).
 */
const THEN = '2026-11-15T10:00:00.000Z';
const DAY = '2026-11-15';

function plan(
  over: Partial<PlannedSubscription> &
    Pick<PlannedSubscription, 'id' | 'title' | 'projectType' | 'projectTitle' | 'amount'>,
): PlannedSubscription {
  return {
    status: 'active',
    account: 'Fire',
    startDate: DAY,
    endDate: '2027-04-15',
    category: `@${over.projectTitle}`,
    comment: '',
    frequency: 'monthly',
    targetDate: '2027-04-15',
    targetBucketIds: [],
    originalCalculatedAmount: over.amount,
    manuallyAdjusted: false,
    createdAt: THEN,
    updatedAt: THEN,
    activatedAt: THEN,
    ...over,
  };
}

export const EXAMPLE_FIRE: Fire[] = [
  {
    title: 'A Chronic Illness: Part Time Only',
    sub: 'Emergency · blaze · paid by a plan of 6 Paydays',
    phase: 'saving',
    description:
      "The diagnosis has a long name. The treatment works, but it costs strength: you can work only 60 percent now, for the next year at least. The bill is spread over 6 Paydays, with the plan's surcharge.",
    targetDate: '2027-04-15',
    buckets: [
      {
        id: 'b1',
        title: 'The income gap in the first year',
        target: 1300,
        amount: 433.33,
        notes: 'Working 60 percent of your hours means a loss of about 40 percent of the pay.',
      },
      {
        id: 'b2',
        title: 'Treatment and aids',
        target: 500,
        amount: 166.67,
        notes: 'Co-payments, medicines and aids add up over a year: about 300-800.',
      },
      { id: 'b3', title: 'Surcharge of the plan (20%)', target: 360, amount: 120 },
    ],
    links: [
      { label: 'Federal Ministry of Health', url: 'https://www.bundesgesundheitsministerium.de/' },
    ],
    actionItems: [
      {
        text: 'Ask your employer about part-time work and your rights',
        done: true,
        priority: 'high',
      },
      {
        text: 'Apply for the degree of disability: it brings tax and leave benefits',
        done: false,
        priority: 'medium',
      },
    ],
    notes: [
      { text: 'Payday 1: 360 paid from cash (cash before 1,080, after 720).', createdAt: THEN },
      { text: 'Payday 2: 360 paid from cash (cash before 1,210, after 850).', createdAt: THEN },
    ],
    createdAt: THEN,
    updatedAt: THEN,
    emergencyCardId: 'E108',
    plannedSubscriptions: [
      plan({
        id: 'example-plan-1',
        title: 'Chronic illness - plan of 6 Paydays',
        projectType: 'fire',
        projectTitle: 'A Chronic Illness: Part Time Only',
        amount: 360,
        surchargeAmount: 360,
        surchargePercent: 20,
      }),
    ],
  },
  {
    title: 'Burglary',
    sub: 'Emergency · wildfire · household insurance pays all but the deductible',
    phase: 'planning',
    description:
      'Somebody was in the flat while you were away. The household insurance pays the rest - you carry the deductible (at most 500 on Normal) and the new lock.',
    buckets: [
      {
        id: 'b1',
        title: 'The deductible',
        target: 500,
        amount: 0,
        notes: 'What the insurance leaves to you.',
      },
      { id: 'b2', title: 'A new lock and a safe', target: 150, amount: 0 },
    ],
    links: [],
    actionItems: [
      {
        text: 'Report it to the police and to the insurance within a week',
        done: false,
        priority: 'high',
      },
    ],
    notes: [],
    createdAt: THEN,
    updatedAt: THEN,
    emergencyCardId: 'E26',
    plannedSubscriptions: [
      plan({
        id: 'example-plan-2',
        title: 'Burglary - plan of 3 Paydays',
        status: 'planned',
        projectType: 'fire',
        projectTitle: 'Burglary',
        amount: 238,
        activatedAt: undefined,
      }),
    ],
  },
];

export const EXAMPLE_SMILE: Smile[] = [
  {
    title: 'Paraglide Over the Alps',
    sub: 'Dream · adventure · little · 2 points',
    dreamCardId: 'D64',
    points: 2,
    phase: 'saving',
    description:
      'Run off the mountain and the thermals lift you high above the valley, silent as a bird. When every bucket is full, the dream is lived.',
    targetDate: '2028-03-15',
    buckets: [
      {
        id: 'b1',
        title: 'Journey to the Alps',
        target: 150,
        amount: 150,
        notes: 'By train or car to Interlaken, Lenggries or the Dolomites.',
      },
      {
        id: 'b2',
        title: 'Tandem thermal flight',
        target: 200,
        amount: 200,
        notes: 'Look for DHV or SHV licensed pilots.',
      },
      { id: 'b3', title: 'Hotel and food, 3 nights', target: 450, amount: 0 },
      { id: 'b4', title: 'Beginner course day', target: 400, amount: 0 },
    ],
    links: [],
    actionItems: [{ text: 'Pick the date with the best thermals', done: false, priority: 'low' }],
    notes: [{ text: 'Dream taken on the Dream tile. Plan set: 50 a month.', createdAt: THEN }],
    createdAt: THEN,
    updatedAt: THEN,
    plannedSubscriptions: [
      plan({
        id: 'example-plan-3',
        title: 'Paraglide - 50 a month',
        account: 'Smile',
        projectType: 'smile',
        projectTitle: 'Paraglide Over the Alps',
        amount: 50,
        endDate: '2028-03-15',
        targetDate: '2028-03-15',
      }),
    ],
  } as Smile,
  {
    title: 'Certified mountain guide',
    sub: 'The life dream of Jonas',
    points: 0,
    phase: 'planning',
    description:
      'Become a state-certified mountain and ski guide (VDBS, Germany): a training of about three years with rock, ice, ski and avalanche courses, an entrance exam, equipment and a lot of tours. In the game it is his first Smile project.',
    buckets: [
      { id: 'b1', title: 'Course fees', target: 17000, amount: 0 },
      { id: 'b2', title: 'Equipment', target: 4000, amount: 0 },
      { id: 'b3', title: 'Entrance exam and tours', target: 3500, amount: 0 },
    ],
    links: [],
    actionItems: [],
    notes: [],
    createdAt: THEN,
    updatedAt: THEN,
    plannedSubscriptions: [],
  } as Smile,
];

export const EXAMPLE_GROW: Grow[] = [
  {
    title: 'AI Subscription Audit',
    sub: 'Seed · savings',
    phase: 'execute',
    type: 'subscription-action',
    description:
      'You let an AI scan your bank statements. It finds three subscriptions you forgot you had.',
    strategy:
      'List every recurring payment, cancel what you do not use, downgrade what you use rarely.',
    riskScore: 0,
    risks: 'None: you lose only what you did not use.',
    links: [],
    actionItems: [
      { text: 'Cancel the three forgotten subscriptions', done: true, priority: 'high' },
    ],
    notes: [
      {
        text: 'The die found 30 a month: it counts as what you have saved so far.',
        createdAt: THEN,
      },
    ],
    cashflow: 30,
    amount: 0,
    isAsset: false,
    share: undefined as never,
    investment: undefined as never,
    liabilitie: undefined as never,
    monthlySavings: 30,
    annualSavings: 360,
    category: 'Subscriptions',
    createdAt: THEN,
    updatedAt: THEN,
  },
  {
    title: 'World ETF Savings Plan',
    sub: 'Seed · conservative',
    phase: 'monitor',
    type: 'income-growth',
    description: 'Fifty euros a month into the whole world economy. Boring. Exactly the point.',
    strategy:
      'Keep it for years and add every month. Do not sell in a crash because the news is loud.',
    riskScore: 2,
    risks:
      'The price moves with the market index; you can sell only when a Harvest card opens a window - or at the standing price less 5%.',
    links: [],
    actionItems: [
      { text: 'Add units whenever the month has money left', done: false, priority: 'medium' },
    ],
    notes: [{ text: 'Bought 5 units at 100.', createdAt: THEN }],
    cashflow: 9.75,
    amount: 500,
    isAsset: true,
    share: { tag: 'WORLD', quantity: 5, price: 100 },
    investment: undefined as never,
    liabilitie: undefined as never,
    createdAt: THEN,
    updatedAt: THEN,
  },
];

/** What a card of the grid shows. */
export interface ExampleCard {
  kind: 'fire' | 'smile' | 'grow';
  index: number;
  title: string;
  sub: string;
  phase: string;
  badge?: string;
  description: string;
  progress?: number;
  buckets?: string;
  metrics: { label: string; value: string }[];
}

const sum = (list: { target?: number; amount: number }[], key: 'target' | 'amount') =>
  list.reduce(
    (total, bucket) => total + ((key === 'target' ? bucket.target : bucket.amount) ?? 0),
    0,
  );

const money = (value: number) => value.toLocaleString('en', { maximumFractionDigits: 0 });

function buckets(kind: 'fire' | 'smile', project: Fire | Smile, index: number): ExampleCard {
  const target = sum(project.buckets, 'target');
  const amount = sum(project.buckets, 'amount');
  const full = project.buckets.filter((b) => b.amount >= b.target).length;
  return {
    kind,
    index,
    title: project.title,
    sub: project.sub,
    phase: project.phase,
    ...(kind === 'smile' && (project as Smile).points
      ? { badge: `🌟 ${(project as Smile).points} points` }
      : {}),
    description: project.description,
    progress: target > 0 ? (amount / target) * 100 : 0,
    buckets: `${full}/${project.buckets.length} buckets full`,
    metrics: [
      { label: 'Target', value: `${money(target)} DT` },
      { label: 'Amount', value: `${money(amount)} DT` },
    ],
  };
}

export function exampleCards(kind: 'fire' | 'smile' | 'grow'): ExampleCard[] {
  if (kind === 'fire') return EXAMPLE_FIRE.map((p, i) => buckets('fire', p, i));
  if (kind === 'smile') return EXAMPLE_SMILE.map((p, i) => buckets('smile', p, i));
  return EXAMPLE_GROW.map((p, i) => ({
    kind: 'grow' as const,
    index: i,
    title: p.title,
    sub: p.sub,
    phase: p.phase,
    description: p.description,
    metrics: [
      ...(p.share
        ? [
            { label: 'Quantity', value: String(p.share.quantity) },
            { label: 'Price', value: `${p.share.price} DT` },
          ]
        : []),
      ...(p.amount > 0 ? [{ label: 'Value', value: `${money(p.amount)} DT` }] : []),
      {
        label: p.type === 'subscription-action' ? 'Saves a month' : 'Cash flow a month',
        value: `${p.cashflow} DT`,
      },
    ],
  }));
}
