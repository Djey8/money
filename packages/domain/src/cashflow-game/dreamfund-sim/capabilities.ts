import type { DreamCommand } from '../dreamfund/table/types';
import type { DreamKnobs } from './policies';

/**
 * Everything a Dreamfund player can do (JFK, 2026-11-06): the test bed of the bots. A bot is only as good as the moves it knows - the first
 * strategies never sold a holding to step up, never touched an insurance, never weighed a course against a card - so the list is kept as
 * data, and a test fails when the game gets a command that is not in it. Each capability says who decides it:
 *
 *  - `strategy`  the policy decides, every time it comes up (which card, which pile, whether to sell into a window);
 *  - `knob`      a capability of its own that a strategy turns on and tunes (`knob` names it): the search tries it;
 *  - `engine`    the same for every bot, by the rules of the game (how an emergency is paid when it must be, the Payday);
 *  - `person`    bookkeeping or the table's business - it does not change the game, so a bot has no use for it;
 *  - `open`      a move that exists and that no bot makes yet - the next thing to teach them (kept visible on purpose).
 */

export type CapabilityStatus = 'strategy' | 'knob' | 'engine' | 'person' | 'open';

export interface Capability {
  id: string;
  group: 'cards' | 'money' | 'sell' | 'life' | 'table' | 'book';
  summary: string;
  status: CapabilityStatus;
  /** The commands of the table that do it. */
  commands: DreamCommand['type'][];
  /** The knobs of a strategy that switch it on or tune it. */
  knobs?: (keyof DreamKnobs)[];
  note?: string;
}

export const CAPABILITIES: Capability[] = [
  // ── cards ──
  {
    id: 'choose-pile',
    group: 'cards',
    summary:
      'Pick the Opportunity pile to draw from (Seed, Sapling or Tree) by what the money allows.',
    status: 'strategy',
    commands: ['choose_pile'],
    knobs: ['treeFromMinor'],
  },
  {
    id: 'buy-card',
    group: 'cards',
    summary:
      'Take an Opportunity card (a business, a property, shares, a side hustle, a saving) with its lots or steps - or pass.',
    status: 'strategy',
    commands: ['take_opportunity', 'skip', 'roll_opportunity'],
    knobs: ['riskTolerance', 'unitsShare', 'minScore'],
  },
  {
    id: 'buy-pension',
    group: 'cards',
    summary:
      'Sign an employer savings plan or a pension (S37-S39, P33, T32): pay in for a time, get it back with a bonus.',
    status: 'knob',
    commands: ['take_opportunity'],
    knobs: ['pensionBoost'],
  },
  {
    id: 'buy-course',
    group: 'cards',
    summary:
      'Pay for a course or a degree (S40, P34, P35, T31): the pay rises a few Paydays later by a die.',
    status: 'knob',
    commands: ['take_opportunity'],
    knobs: ['courseBoost'],
  },
  {
    id: 'swap-hustle',
    group: 'cards',
    summary: 'Give up the weakest side hustle for a clearly better card when the hustles are full.',
    status: 'engine',
    commands: ['take_opportunity'],
  },
  {
    id: 'plan-purchase',
    group: 'cards',
    summary:
      'Plan a card now and buy it later when the money is there (plan_opportunity, buy_planned).',
    status: 'open',
    commands: ['plan_opportunity', 'buy_planned'],
    note: 'Bots buy at once or pass; saving up for one particular card is not tried yet.',
  },
  {
    id: 'take-dream',
    group: 'cards',
    summary:
      'Take a dream on the Dream tile (it costs money and gives dream points), up to two open at once.',
    status: 'strategy',
    commands: ['take_dream'],
    knobs: ['takeDreams'],
  },
  {
    id: 'answer-life',
    group: 'life',
    summary:
      'Accept or decline a Life card (a baby, a car, a wedding, a windfall), roll its die, or choose one of its options.',
    status: 'strategy',
    commands: ['answer_life'],
    knobs: ['lifeAcceptChance'],
  },
  {
    id: 'career',
    group: 'life',
    summary: 'The career tile: the promotion die and, where the ladder forks, the branch.',
    status: 'engine',
    commands: ['choose_career_branch', 'throw_job_search'],
    note: 'The branch is always the first; the job search die is thrown for the bot.',
  },
  // ── money ──
  {
    id: 'pay-emergency',
    group: 'money',
    summary:
      'Pay an Emergency now from cash and reserve, or on a plan of 3, 6 or 12 Paydays with a surcharge.',
    status: 'strategy',
    commands: [
      'pay_emergency',
      'emergency_choose',
      'emergency_roll',
      'emergency_reroll',
      'fund_emergency',
    ],
    knobs: ['bufferMonths'],
    note: 'Choices and dice of an emergency are taken as the card suggests; extra payments on an open plan are not made early.',
  },
  {
    id: 'insurance',
    group: 'money',
    summary:
      'Hold or drop each insurance: a premium every month against the cost of an emergency it covers.',
    status: 'knob',
    commands: ['set_insurance'],
    knobs: ['insure'],
  },
  {
    id: 'payday-plans',
    group: 'money',
    summary:
      'Set the payment plans of a Payday: reserve, the life dream, the dreams on the Dream tile, in the order and share of the strategy.',
    status: 'strategy',
    commands: ['set_plan', 'settle_payday'],
    knobs: ['planShare', 'planMonths', 'dreamShare', 'dreamAfterPassiveShare'],
  },
  {
    id: 'fund-reserve',
    group: 'money',
    summary: 'Put free cash into the reserve (three months of living costs).',
    status: 'strategy',
    commands: ['fund_reserve'],
    knobs: ['bufferMonths'],
  },
  {
    id: 'fund-dream',
    group: 'money',
    summary: 'Put free cash into the life dream or a dream project.',
    status: 'strategy',
    commands: ['fund_dream'],
    knobs: ['dreamShare'],
  },
  {
    id: 'repay-debt',
    group: 'money',
    summary: 'Repay one of the starting debts, or part of the Bank loan (10% a month).',
    status: 'strategy',
    commands: ['repay_debt', 'repay_bank_loan'],
  },
  // ── selling ──
  {
    id: 'sell-window',
    group: 'sell',
    summary:
      'Sell a share lot, a coin or a collection into an open market of a Harvest card at its index.',
    status: 'strategy',
    commands: ['harvest_sell', 'harvest_continue'],
    knobs: ['sellProfit'],
  },
  {
    id: 'sell-buyer',
    group: 'sell',
    summary:
      'Accept a buyer a Harvest card brings for a property, a business or a block of shares, at the price the die gave.',
    status: 'strategy',
    commands: ['harvest_accept'],
  },
  {
    id: 'ride-hype',
    group: 'sell',
    summary:
      'Ride a hype step by step for a multiple of the stake, or cash out - and know when it closes.',
    status: 'strategy',
    commands: ['harvest_ladder'],
    knobs: ['ride'],
  },
  {
    id: 'sell-step-up',
    group: 'sell',
    summary:
      'Sell a holding that has gained and pays little at the standing price, to put the money to work in a bigger card (sell, step up, repeat).',
    status: 'knob',
    commands: ['sell_holding'],
    knobs: ['stepUpGain', 'stepUpYield', 'stepUpHold'],
  },
  {
    id: 'sell-to-clear-loan',
    group: 'sell',
    summary:
      'Sell a holding to clear a Bank loan at once: the loan costs 10% a month, nothing earns that.',
    status: 'knob',
    commands: ['sell_holding', 'repay_bank_loan'],
    knobs: ['clearLoanBySale'],
  },
  {
    id: 'tax-aware-sale',
    group: 'sell',
    summary:
      'Weigh the tax on the profit of a sale (a table setting) against the gain before selling.',
    status: 'knob',
    commands: ['sell_holding', 'harvest_sell', 'harvest_accept'],
    knobs: ['stepUpGain'],
  },
  {
    id: 'trade',
    group: 'sell',
    summary: 'Offer a holding to another player at a price, answer an offer, counter, withdraw.',
    status: 'strategy',
    commands: ['offer_trade', 'accept_trade', 'decline_trade', 'counter_trade', 'withdraw_trade'],
    note: 'A bot short of cash offers at 15% over a standing sale, and buys what its strategy would take; it never counters.',
  },
  // ── table and book ──
  {
    id: 'turn',
    group: 'table',
    summary: 'Roll the die and end the turn.',
    status: 'engine',
    commands: ['roll', 'end_turn'],
  },
  {
    id: 'table-business',
    group: 'table',
    summary:
      'Join, leave, seat bots, settings, start, pick a character, confirm the briefing, pause, away, close, kick.',
    status: 'person',
    commands: [
      'join',
      'leave',
      'add_bot',
      'set_ready',
      'kick',
      'update_settings',
      'start',
      'pick_profession',
      'confirm_briefing',
      'close',
      'pause',
      'resume',
      'away',
      'back',
    ],
  },
  {
    id: 'debug',
    group: 'table',
    summary: 'The debug game: load a card, a Payday or a career stage by hand.',
    status: 'person',
    commands: ['debug_load', 'debug_payday', 'debug_career'],
  },
  {
    id: 'bookkeeping',
    group: 'book',
    summary:
      'Change a booking’s category or time, a subscription’s account, the phase of a project: it does not change the game.',
    status: 'person',
    commands: ['edit_transaction', 'edit_subscription', 'set_phase'],
  },
];

/** Every command of the table, with the capability that does it (the type checks that none is left out). */
export const COMMAND_CAPABILITY: Record<DreamCommand['type'], string> = (() => {
  const map: Partial<Record<DreamCommand['type'], string>> = {};
  for (const capability of CAPABILITIES) {
    for (const command of capability.commands) map[command] ??= capability.id;
  }
  return map as Record<DreamCommand['type'], string>;
})();

/** Every command type of the table (an exhaustive record: a new command is a type error until it is listed here, and then in a capability). */
const ALL_COMMANDS: Record<DreamCommand['type'], true> = {
  join: true,
  leave: true,
  add_bot: true,
  set_ready: true,
  kick: true,
  update_settings: true,
  start: true,
  pick_profession: true,
  confirm_briefing: true,
  throw_job_search: true,
  debug_load: true,
  debug_payday: true,
  debug_career: true,
  close: true,
  pause: true,
  resume: true,
  away: true,
  back: true,
  roll: true,
  pay_emergency: true,
  fund_emergency: true,
  emergency_choose: true,
  emergency_roll: true,
  emergency_reroll: true,
  answer_life: true,
  choose_career_branch: true,
  take_dream: true,
  choose_pile: true,
  take_opportunity: true,
  plan_opportunity: true,
  buy_planned: true,
  roll_opportunity: true,
  skip: true,
  end_turn: true,
  settle_payday: true,
  fund_reserve: true,
  edit_transaction: true,
  edit_subscription: true,
  set_phase: true,
  fund_dream: true,
  repay_debt: true,
  repay_bank_loan: true,
  set_insurance: true,
  set_plan: true,
  sell_holding: true,
  offer_trade: true,
  withdraw_trade: true,
  counter_trade: true,
  decline_trade: true,
  accept_trade: true,
  harvest_continue: true,
  harvest_sell: true,
  harvest_accept: true,
  harvest_ladder: true,
};

/** The commands no capability lists (the test expects none). */
export const unlistedCommands = (): string[] =>
  Object.keys(ALL_COMMANDS).filter((command) => !(command in COMMAND_CAPABILITY));

/** The capabilities a policy can exercise (the knob ones need their knob set), by id. */
export const capabilityById = (id: string) => CAPABILITIES.find((c) => c.id === id);
