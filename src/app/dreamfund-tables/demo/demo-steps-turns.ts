import type { DemoStep, DemoText } from './demo-steps';

/**
 * The first rounds of the guided demo game, turn by turn, with the places the person visits: the card, the Grow, Fire and Smile pages, the
 * Transactions and Subscriptions pages and the Menu. The coach is drawn on every page of the app, so it goes along. Every step waits until
 * the place it points at is on the screen (a card still being drawn, dice still rolling), and every `done` says something that has
 * happened - never that something is absent - so the coach cannot run ahead of the page.
 */

const OPEN = '[data-demo="open-card"]';
const ROLL = '.cf-solo-roll-row .btn--primary';
const DONE = '[data-demo="solo-done"]';
const MENU = '.desktop-nav-menu';
const DREAMFUND_ITEM = '.menu-item@@~Dreamfund';
const PAY = '#infoTransaction-Container #addbtn';
const GAME = 'game' as const;

function step(over: Partial<DemoStep> & Pick<DemoStep, 'id' | 'screen'>): DemoStep {
  return { chapter: 'turn', next: 'button', ...over };
}

/** A roll: the dice button lights up; done when the roll is made. */
const roll = (id: string, n: number): DemoStep =>
  step({
    id,
    screen: GAME,
    target: ROLL,
    next: 'event',
    done: (c) => c.turns >= n,
    assist: `click:${ROLL}`,
  });

/** "Open the card" after the dice have stopped. */
const open = (
  id: string,
  seen: (c: Parameters<NonNullable<DemoStep['done']>>[0]) => boolean,
): DemoStep =>
  step({ id, screen: GAME, target: OPEN, next: 'event', done: seen, assist: `click:${OPEN}` });

/** The way back to the game screen from any page: the Menu, then the Dreamfund entry. */
const backToGame = (prefix: string, screens: DemoStep['screen']): DemoStep[] => [
  step({
    id: `${prefix}-menu`,
    screen: screens,
    target: MENU,
    next: 'event',
    done: (c) => c.dom('.menu-item') || c.screen === GAME,
    assist: `click:${MENU}`,
  }),
  step({
    id: `${prefix}-back`,
    screen: screens,
    target: DREAMFUND_ITEM,
    next: 'event',
    done: (c) => c.screen === GAME,
    assist: 'click:.menu-item@@~Dreamfund',
  }),
];

/** The tabs of an info panel, explained one by one: click the tab, read, Next. */
const tab = (id: string, screen: DemoStep['screen'], label: string): DemoStep =>
  step({ id, screen, target: `.detail-tab@@~${label}` });

export const TURN_STEPS: DemoStep[] = [
  // ── turn 1: an Opportunity, a free saving, and the Grow project it makes ──
  roll('t1-roll', 1),
  open('t1-open', (c) => c.dom('.tc-pile') || c.dom('[data-card-id]') || c.turns >= 2),
  step({
    id: 't1-pile',
    screen: GAME,
    target: '.tc-pile[data-pile="seed"]',
    next: 'event',
    done: (c) => c.dom('[data-card-id]') || c.turns >= 2,
    assist: 'click:.tc-pile[data-pile="seed"]',
  }),
  step({ id: 't1-read', screen: GAME, target: '[data-card-id="S01"]' }),
  step({
    id: 't1-take',
    screen: GAME,
    target: '[data-card-id="S01"] .tc-btn--primary',
    next: 'event',
    done: (c) => c.dom('.tc-btn--gold') || c.turns >= 2,
    assist: 'click:[data-card-id="S01"] .tc-btn--primary',
  }),
  step({
    id: 't1-die',
    screen: GAME,
    target: '.tc-btn--gold',
    next: 'event',
    done: (c) => c.resolved === 'opportunity' || c.turns >= 2,
    assist: 'click:.tc-btn--gold',
  }),
  step({
    id: 't1-grow',
    screen: GAME,
    target: '.tc-btn--primary@@~Grow',
    next: 'event',
    done: (c) => c.screen === 'grow',
    assist: 'click:.tc-btn--primary@@~Grow',
  }),
  step({ id: 'g-overview', screen: 'grow', target: '.detail-tab@@~Overview' }),
  tab('g-actions', 'grow', 'Actions'),
  tab('g-notes', 'grow', 'Notes'),
  tab('g-financials', 'grow', 'Financials'),
  step({
    id: 'g-close',
    screen: 'grow',
    target: '#closebtn',
    next: 'event',
    done: (c) => !c.dom('#infoTransaction-Container'),
    assist: 'click:#closebtn',
  }),
  ...backToGame('g', 'grow'),
  step({
    id: 't1-done',
    screen: GAME,
    target: DONE,
    next: 'event',
    done: (c) => !c.myTurn || c.turns >= 2,
    assist: `click:${DONE}`,
  }),
  // ── turn 2: an Emergency, the Fire project, paying it from the Fire page ──
  roll('t2-roll', 2),
  open('t2-open', (c) => c.dom('.tc-btn--primary') || c.dom('.tc-done') || c.turns >= 3),
  step({
    id: 't2-create',
    screen: GAME,
    target: '.tc-btn--primary',
    next: 'event',
    done: (c) => c.dom('.tc-done') || c.turns >= 3,
    assist: 'click:.tc-btn--primary',
  }),
  step({
    id: 't2-fire',
    screen: GAME,
    target: '.tc-btn--primary@@~Fire',
    next: 'event',
    done: (c) => c.screen === 'fire',
    assist: 'click:.tc-btn--primary@@~Fire',
  }),
  step({ id: 'f-overview', screen: 'fire', target: '.detail-tab@@~Overview' }),
  tab('f-buckets', 'fire', 'Buckets'),
  tab('f-plans', 'fire', 'Payment Plans'),
  step({
    id: 'f-pay',
    screen: 'fire',
    target: PAY,
    next: 'event',
    done: (c) => c.dom('#addTransaction-Container') || c.bankLoanMinor > 0,
    assist: `click:${PAY}`,
  }),
  step({
    id: 'f-add',
    screen: 'fire',
    target: '#addTransaction-Container #addbtn',
    next: 'event',
    done: (c) => c.bankLoanMinor > 0 || c.cashMinor < 0,
    assist: 'click:#addTransaction-Container #addbtn',
  }),
  step({ id: 'f-paid', screen: 'fire' }),
  ...backToGame('f', 'fire'),
  step({ id: 't2-bank', screen: GAME, target: '.cf-loan-btn' }),
  step({
    id: 't2-done',
    screen: GAME,
    target: DONE,
    next: 'event',
    done: (c) => !c.myTurn || c.turns >= 3,
    assist: `click:${DONE}`,
  }),
  // ── turn 3: a Harvest card ──
  roll('t3-roll', 3),
  open('t3-open', (c) => c.dom('.tc-done') || c.turns >= 4),
  step({
    id: 't3-done',
    screen: GAME,
    target: '.tc-done',
    next: 'event',
    done: (c) => !c.myTurn || c.turns >= 4,
    assist: 'click:.tc-done',
  }),
  // ── turn 4: Payday - the books, the subscriptions, repaying the Bank ──
  roll('t4-roll', 4),
  step({ id: 't4-payday', screen: GAME }),
  step({
    id: 't4-close',
    screen: GAME,
    target: '.cf-panel-close',
    next: 'event',
    done: (c) => !c.dom('.cf-panel') && c.turns >= 4,
    assist: 'click:.cf-panel-close',
  }),
  step({
    id: 't4-tx',
    screen: ['home', 'other', 'fire', 'grow', 'smile', 'transactions', 'subs'],
    target: '.desktop-nav-item@@~Transactions',
    next: 'event',
    done: (c) => c.screen === 'transactions',
    assist: 'click:.desktop-nav-item@@~Transactions',
  }),
  step({ id: 't4-tx-read', screen: 'transactions' }),
  step({
    id: 't4-subs',
    screen: 'transactions',
    target: '.desktop-nav-item@@~Subscriptions',
    next: 'event',
    done: (c) => c.screen === 'subs',
    assist: 'click:.desktop-nav-item@@~Subscriptions',
  }),
  step({ id: 't4-subs-read', screen: 'subs' }),
  ...backToGame('t4', 'subs'),
  step({
    id: 't4-repay',
    screen: GAME,
    target: '.cf-loan-btn@@~Repay',
    next: 'event',
    done: (c) => c.dom('.cf-back-btn') || c.bankLoanMinor === 0,
    assist: 'click:.cf-loan-btn:last-of-type',
  }),
  step({
    id: 't4-repay-go',
    screen: GAME,
    target: '.btn--primary@@Repay',
    next: 'event',
    done: (c) => c.bankLoanMinor === 0 && c.turns >= 4,
    assist: 'click:.btn--primary',
  }),
  step({
    id: 't4-end',
    screen: GAME,
    target: ROLL,
    next: 'event',
    done: (c) => !c.myTurn || c.turns >= 5,
    assist: `click:${ROLL}`,
  }),
  // ── turn 5: a Dream and its Smile project and plan ──
  roll('t5-roll', 5),
  open('t5-open', (c) => c.dom('[data-card-id]') || c.turns >= 6),
  step({ id: 't5-dream', screen: GAME, target: '[data-card-id="D64"]' }),
  step({
    id: 't5-take',
    screen: GAME,
    target: '.tc-btn--primary',
    next: 'event',
    done: (c) => c.smileCount > 0 || c.turns >= 6,
    assist: 'click:.tc-btn--primary',
  }),
  step({
    id: 't5-smile',
    screen: GAME,
    target: '.tc-btn--primary@@~Smile',
    next: 'event',
    done: (c) => c.screen === 'smile',
    assist: 'click:.tc-btn--primary@@~Smile',
  }),
  step({ id: 's-overview', screen: 'smile' }),
  tab('s-plans', 'smile', 'Payment'),
  step({
    id: 's-plan',
    screen: 'smile',
    target: '.btn-inline-toggle@@~Plan',
    next: 'event',
    done: (c) => c.plans > 0,
    assist: 'click:.btn-inline-toggle@@~Plan',
  }),
  step({
    id: 's-subs',
    screen: ['smile', 'subs'],
    target: '.desktop-nav-item@@~Subscriptions',
    next: 'event',
    done: (c) => c.screen === 'subs',
    assist: 'click:.desktop-nav-item@@~Subscriptions',
  }),
  step({ id: 's-subs-read', screen: 'subs' }),
  ...backToGame('s', 'subs'),
  step({
    id: 't5-done',
    screen: GAME,
    target: DONE,
    next: 'event',
    done: (c) => !c.myTurn || c.turns >= 6,
    assist: `click:${DONE}`,
  }),
  // ── turn 6: a Life card ──
  roll('t6-roll', 6),
  open('t6-open', (c) => c.dom('.tc-btn--primary') || c.turns >= 7),
  step({
    id: 't6-life',
    screen: GAME,
    target: '.tc-btn--primary',
    next: 'event',
    done: (c) => c.dom('.tc-done') || c.turns >= 7,
    assist: 'click:.tc-btn--primary',
  }),
  step({
    id: 't6-done',
    screen: GAME,
    target: '.tc-done',
    next: 'event',
    done: (c) => !c.myTurn || c.turns >= 7,
    assist: 'click:.tc-done',
  }),
  // ── turn 7: the second Payday ──
  roll('t7-roll', 7),
  step({ id: 't7-payday', screen: GAME }),
  step({
    id: 't7-end',
    screen: GAME,
    target: ROLL,
    next: 'event',
    done: (c) => !c.myTurn || c.turns >= 8,
    assist: `click:${ROLL}`,
  }),
  // ── turn 8: the Career tile ──
  roll('t8-roll', 8),
  step({ id: 't8-career', screen: GAME }),
  step({
    id: 't8-die',
    screen: GAME,
    target: '.tc-btn--gold',
    next: 'event',
    done: (c) => c.resolved === 'career',
    assist: 'click:.tc-btn--gold',
  }),
  step({ id: 't8-result', screen: GAME }),
  // ── the character's sheet, the menu, and the end ──
  step({
    id: 'i-open',
    screen: GAME,
    target: '.cf-info-btn',
    next: 'button',
    chapter: 'finish',
    assist: 'click:.cf-info-btn',
  }),
  step({ id: 'i-sheet', screen: GAME, chapter: 'finish', place: 'corner' }),
  step({
    id: 'menu-hub',
    screen: ['game', 'home', 'grow', 'fire', 'smile', 'subs', 'transactions', 'other'],
    target: MENU,
    next: 'event',
    chapter: 'finish',
    done: (c) => c.dom('.menu-item'),
    assist: `click:${MENU}`,
  }),
  step({
    id: 'menu-explain',
    screen: ['game', 'home', 'grow', 'fire', 'smile', 'subs', 'transactions', 'other'],
    target: '.menu-item@@~Dreamfund',
    chapter: 'finish',
  }),
  step({
    id: 'end',
    screen: ['game', 'home', 'grow', 'fire', 'smile', 'subs', 'transactions', 'other'],
    chapter: 'finish',
    place: 'center',
  }),
];

export const TURN_EN: Record<string, DemoText> = {
  't1-roll': {
    title: 'Roll the dice',
    text: 'Time for the first roll. In this demo the dice are fixed, so I know exactly where you will land. Press **Roll the dice**.',
  },
  't1-open': {
    title: 'An Opportunity',
    text: 'You landed on 🌱 **Opportunity**. A card was drawn for you - press **Open the card** to read it.',
  },
  't1-pile': {
    title: 'Choose a pile',
    text: 'Three piles: **Seed** (small, savings and first steps), **Sapling** (hundreds to thousands) and **Tree** (properties, with a mortgage). Take **Seed**.',
  },
  't1-read': {
    title: 'Read the card first',
    text: 'Two cards are offered. Look at **AI Subscription Audit**: what it costs (nothing), its risk, and what the die decides - 15, 30 or 50 DT a month saved. Scroll if you like, then press **Next**.',
  },
  't1-take': {
    title: 'Take the saving',
    text: 'It costs nothing and lowers a monthly bill - an easy first step. Press **Take this card**.',
  },
  't1-die': {
    title: 'A die decides',
    text: 'Every die in the game is yours to throw: the card shows what each number does. Press **Throw the die**.',
  },
  't1-grow': {
    title: 'It is a Grow project now',
    text: 'Every card you take becomes a **Grow project** with its numbers, notes and tasks. Press **Open the project in Grow** and have a look.',
  },
  'g-overview': {
    title: 'The project: Overview',
    text: 'This is the real Grow panel. The **Overview** says what the project is, its strategy and its risk, and what it saves or earns. Nothing is booked from here by hand: the game moves a project on.',
  },
  'g-actions': {
    title: 'Actions',
    text: 'The **Actions** tab is the to-do list of the project - here: cancel the forgotten subscriptions. Click the tab and read it.',
  },
  'g-notes': {
    title: 'Notes',
    text: 'Everything that happens to the project is written into its **Notes**, with the numbers: the die you threw, a sale, a market effect. Click the tab.',
  },
  'g-financials': {
    title: 'Financials',
    text: '**Financials** show the money of the project: what it costs, what it pays a month, what it is worth. Click the tab, then close the panel.',
  },
  'g-close': { title: 'Close the project', text: 'Close the panel with the **x**.' },
  'g-menu': {
    title: 'Back to the game: the Menu',
    text: 'The game screen is a window of its own. To go back to it from any page, open the **Menu**.',
  },
  'g-back': {
    title: 'Dreamfund',
    text: 'The entry **Dreamfund** brings you back to the game screen. Press it.',
  },
  't1-done': { title: 'Done', text: 'Your turn is played - press **Done**. Coach plays next.' },
  't2-roll': {
    title: 'The next roll',
    text: 'Coach has played. Roll again - the next tile is a 🔥 **Emergency**.',
  },
  't2-open': { title: 'Something broke', text: 'Open the card to see what happened.' },
  't2-create': {
    title: 'An Emergency: 1,800 DT',
    text: '🔥 **A Chronic Illness: Part Time Only**. No insurance covers it, and Jonas has almost no cash and no reserve. Press **Create the Fire project**: the bill becomes a project in your **Fire** page, where you pay it.',
  },
  't2-fire': {
    title: 'To the Fire project',
    text: 'The project is made. Press **Open the Fire project** - we pay the bill there.',
  },
  'f-overview': {
    title: 'The emergency as a project',
    text: 'The real **Fire** panel: the bill, what is paid so far, the target date. An emergency is not paid by magic - it is a project with buckets, plans and notes.',
  },
  'f-buckets': {
    title: 'Buckets',
    text: 'The bill is made of **buckets**: the income gap (1,300) and treatment (500). Click the tab to see them.',
  },
  'f-plans': {
    title: 'Payment plans',
    text: '**Payment Plans** spread a bill over Paydays - for an emergency 3, 6 or 12, with a surcharge. A plan is created here; we will pay at once, so the Bank has to help. Click the tab.',
  },
  'f-pay': {
    title: 'Pay',
    text: 'Press **Pay**: the payment dialog opens with the whole bill filled in.',
  },
  'f-add': {
    title: 'Book the payment',
    text: 'Jonas has too little cash: the **Bank lends the rest** (1,000 DT, 10% a month). Press **add** to book the payment.',
  },
  'f-paid': {
    title: 'Paid',
    text: 'The project is **completed**. Back to the game: open the **Menu** and press **Dreamfund**.',
  },
  'f-menu': { title: 'Back to the game: the Menu', text: 'Open the **Menu**.' },
  'f-back': { title: 'Dreamfund', text: 'Press **Dreamfund** to come back to the game screen.' },
  't2-bank': {
    title: 'You owe the Bank',
    text: 'The loan costs **10% a month**: 100 DT less every Payday until you repay it. The Bank button shows it, and a **Repay** button.',
  },
  't2-done': {
    title: 'Done',
    text: 'The emergency is dealt with. Press **Done** to end your turn.',
  },
  't3-roll': {
    title: 'A Harvest card',
    text: 'Roll. The next tile is 🌾 **Harvest**: the markets move for everybody.',
  },
  't3-open': {
    title: 'Markets move',
    text: 'Open the card: it says what happened and whether it touches something **you own**. If it did, Done would take you to Grow, where the project is marked.',
  },
  't3-done': { title: 'Done', text: 'Jonas owns nothing the card touches. Press **Done**.' },
  't4-roll': {
    title: 'Payday!',
    text: 'Roll - the next tile is 💰 **Payday**: your salary comes in, the bills go out.',
  },
  't4-payday': {
    title: 'A month has passed',
    text: 'The Payday booked your **salary** and every **subscription** as new transactions. Let us look at where: first the **Transactions**, then the **Subscriptions**.',
  },
  't4-close': {
    title: 'Close the game window',
    text: 'The pages of the app are behind the game window. Close it for a moment with the **x** - the **Menu** brings it back.',
  },
  't4-tx': { title: 'Transactions', text: 'Open **Transactions** in the bottom bar.' },
  't4-tx-read': {
    title: 'Your bookings',
    text: 'Every booking of the game is here: the salary, the bills, the saving of the first card. Look at the newest lines - they came with the Payday.',
  },
  't4-subs': { title: 'Subscriptions', text: 'Now open **Subscriptions**.' },
  't4-subs-read': {
    title: 'How subscriptions work',
    text: 'A **subscription** is a payment that repeats: your salary, the rent, every bill - and the **payment plans** you set up. At every Payday each one is added as a **new transaction**. What is left of the month is your **cashflow**.',
  },
  't4-menu': { title: 'Back to the game: the Menu', text: 'Open the **Menu**.' },
  't4-back': { title: 'Dreamfund', text: 'Press **Dreamfund**.' },
  't4-repay': {
    title: 'Repay the Bank',
    text: 'You have money from the Payday. Press **Repay Outstanding** to pay the Bank back.',
  },
  't4-repay-go': {
    title: 'Repay',
    text: 'Press **Repay** (or **Settle all**): the 1,000 are repaid and the 100 a month stop.',
  },
  't4-end': { title: 'End your turn', text: 'Press **End turn**.' },
  't5-roll': { title: 'A Dream tile', text: 'Roll: 😊 a **Dream** tile.' },
  't5-open': {
    title: 'A dream card',
    text: 'Open the card: dream cards are offered, each worth **points**.',
  },
  't5-dream': {
    title: 'Paraglide Over the Alps',
    text: 'Read the dream: a small one, 2 points, four **buckets** (journey, flight, hotel, course) of 1,200 DT in all. Then press **Next**.',
  },
  't5-take': {
    title: 'Take the dream',
    text: 'Take the small one, **Paraglide Over the Alps** (1,200 DT). If the other dream is shown, press **Choose again** first. It becomes a **Smile project**.',
  },
  't5-smile': { title: 'To the Smile project', text: 'Press **Open the Smile project**.' },
  's-overview': {
    title: 'The dream as a project',
    text: 'The real **Smile** panel: buckets, progress, tasks and notes - like the Fire project, for something you want.',
  },
  's-plans': {
    title: 'Payment plans',
    text: 'A dream is filled by a **payment plan**. Open the **Payment Plans** tab.',
  },
  's-plan': {
    title: 'Create a plan',
    text: 'Press **Create Payment Plan**, choose **50 a month** and save it. Money then moves into the dream at every Payday by itself. (Use **Skip this step** if you only want to look.)',
  },
  's-subs': {
    title: 'The plan is a subscription',
    text: 'A payment plan is a **subscription**: open **Subscriptions** and find the plan you just made.',
  },
  's-subs-read': {
    title: 'Your plan, as a subscription',
    text: 'There it is: **50 a month into the dream**. At every Payday it is booked as a new transaction, and the dream fills up.',
  },
  's-menu': { title: 'Back to the game: the Menu', text: 'Open the **Menu**.' },
  's-back': { title: 'Dreamfund', text: 'Press **Dreamfund**.' },
  't5-done': { title: 'Done', text: 'Press **Done** to end your turn.' },
  't6-roll': { title: 'A Life card', text: 'Roll: the next tile is ❤ **Life**.' },
  't6-open': { title: 'Life happens', text: 'Open the card.' },
  't6-life': {
    title: 'Gym Membership',
    text: 'Accept it: it leaves a **line** - 35 a month for a while. Life cards can be fate, a choice, a die or giving.',
  },
  't6-done': { title: 'Done', text: 'Press **Done**.' },
  't7-roll': { title: 'A second Payday', text: 'Roll to the next 💰 Payday.' },
  't7-payday': {
    title: 'Plans pay in',
    text: 'The Payday booked the subscriptions again: your **plan** moved 50 into the dream, and the gym membership 35 out.',
  },
  't7-end': { title: 'End your turn', text: 'Press **End turn**.' },
  't8-roll': {
    title: 'The Career tile',
    text: 'Roll: the 🎓 **Career** tile - a promotion may wait.',
  },
  't8-career': {
    title: 'A promotion',
    text: 'A die decides if Jonas climbs a stage. His salary rises, and so do his living costs. Careers are, next to cards, the other way to raise your income.',
  },
  't8-die': {
    title: 'Throw it yourself',
    text: 'Press the gold button and throw the career die. Your own luck decides - a high number climbs a stage.',
  },
  't8-result': {
    title: 'The promotion',
    text: 'Here is what the die said, with the salary before and after. More salary means more cashflow every month. Press **Next**.',
  },
  'i-open': {
    title: 'Who Jonas is: the info button',
    text: 'Press **ⓘ** to open the sheet of your character any time.',
  },
  'i-sheet': {
    title: 'The sheet of a character',
    text: 'The sheet has everything: **who he is**, **what matters to him**, **his dream**, his **reserve** (the Mojo), and **How to win** - the **missions**: repay the two debts, fund the dream, build the reserve, become independent. It also shows his numbers: **cashflow**, income statement, balance sheet. A round ends when every player has played a turn; the **Table round** in the header counts them. Press **Next** when you have read it.',
  },
  'menu-hub': { title: 'The Menu: your hub', text: 'One more place: the **Menu**. Open it.' },
  'menu-explain': {
    title: 'Everything is here',
    text: 'The Menu is the **hub**: every page of the app - Transactions, the accounts, Subscriptions, Grow, the Income Statement, the Balance Sheet, Budget - and **Dreamfund** to jump back into the game. Use it to go from page to page. Close it with the x when you are done.',
  },
  end: {
    title: 'That is the loop',
    text: 'Roll, read the card, decide, settle the month, repeat - until your reserve, debts, dream and independence are done. The tutorial ends here; **play on against Coach** until you resign or the game is over. The manual explains every card.',
  },
};

export const TURN_DE: Record<string, DemoText> = {
  't1-roll': {
    title: 'Würfle',
    text: 'Zeit für den ersten Wurf. In dieser Demo sind die Würfel fest, ich weiß genau, wo du landest. Drücke **Würfeln**.',
  },
  't1-open': {
    title: 'Eine Chance',
    text: 'Du bist auf einer 🌱 **Chance** gelandet. Eine Karte wurde für dich gezogen - drücke **Karte öffnen**.',
  },
  't1-pile': {
    title: 'Wähle einen Stapel',
    text: 'Drei Stapel: **Samen** (klein), **Setzling** (hunderte bis tausende) und **Baum** (Immobilien, mit Hypothek). Nimm **Samen**.',
  },
  't1-read': {
    title: 'Lies zuerst die Karte',
    text: 'Zwei Karten werden angeboten. Sieh dir den **KI-Abo-Check** an: Kosten (nichts), Risiko und was der Würfel entscheidet - 15, 30 oder 50 TT im Monat gespart. Blättere, dann **Weiter**.',
  },
  't1-take': {
    title: 'Nimm die Ersparnis',
    text: 'Sie kostet nichts und senkt eine Monatsrechnung. Drücke **Diese Karte nehmen**.',
  },
  't1-die': {
    title: 'Ein Würfel entscheidet',
    text: 'Jeder Würfel im Spiel gehört dir. Drücke **Würfel werfen**.',
  },
  't1-grow': {
    title: 'Jetzt ein Grow-Projekt',
    text: 'Jede Karte, die du nimmst, wird ein **Grow-Projekt**. Drücke **Projekt in Grow öffnen** und sieh es dir an.',
  },
  'g-overview': {
    title: 'Das Projekt: Übersicht',
    text: 'Das ist das echte Grow-Fenster. Die **Übersicht** sagt, was das Projekt ist, seine Strategie, sein Risiko und was es spart oder bringt. Nichts wird von Hand gebucht: das Spiel führt ein Projekt weiter.',
  },
  'g-actions': {
    title: 'Aufgaben',
    text: 'Die **Aufgaben** sind die To-do-Liste des Projekts. Klicke den Reiter.',
  },
  'g-notes': {
    title: 'Notizen',
    text: 'Alles, was dem Projekt geschieht, steht in den **Notizen**, mit den Zahlen. Klicke den Reiter.',
  },
  'g-financials': {
    title: 'Finanzen',
    text: 'Die **Finanzen** zeigen das Geld des Projekts. Klicke den Reiter und schließe dann das Fenster.',
  },
  'g-close': { title: 'Projekt schließen', text: 'Schließe das Fenster mit dem **x**.' },
  'g-menu': {
    title: 'Zurück zum Spiel: das Menü',
    text: 'Der Spielbildschirm ist ein eigenes Fenster. Zurück kommst du von jeder Seite über das **Menü**.',
  },
  'g-back': {
    title: 'Dreamfund',
    text: 'Der Eintrag **Dreamfund** bringt dich zurück ins Spiel. Drücke ihn.',
  },
  't1-done': {
    title: 'Fertig',
    text: 'Dein Zug ist gespielt - drücke **Fertig**. Dann spielt Coach.',
  },
  't2-roll': {
    title: 'Der nächste Wurf',
    text: 'Coach hat gespielt. Würfle - das nächste Feld ist ein 🔥 **Notfall**.',
  },
  't2-open': { title: 'Etwas ist kaputt', text: 'Öffne die Karte.' },
  't2-create': {
    title: 'Ein Notfall: 1.800 TT',
    text: '🔥 **Eine chronische Krankheit: nur noch Teilzeit**. Keine Versicherung deckt es, Jonas hat kaum Bargeld und keinen Notgroschen. Drücke **Fire-Projekt anlegen**: die Rechnung wird ein Projekt auf deiner **Fire**-Seite, wo du sie bezahlst.',
  },
  't2-fire': {
    title: 'Zum Fire-Projekt',
    text: 'Das Projekt ist angelegt. Drücke **Fire-Projekt öffnen** - dort bezahlen wir.',
  },
  'f-overview': {
    title: 'Der Notfall als Projekt',
    text: 'Das echte **Fire**-Fenster: die Rechnung, was bezahlt ist, das Zieldatum. Ein Notfall wird nicht von allein bezahlt - er ist ein Projekt mit Eimern, Plänen und Notizen.',
  },
  'f-buckets': {
    title: 'Eimer',
    text: 'Die Rechnung besteht aus **Eimern**: der Einkommenslücke (1.300) und der Behandlung (500). Klicke den Reiter.',
  },
  'f-plans': {
    title: 'Zahlungspläne',
    text: '**Zahlungspläne** verteilen eine Rechnung auf Zahltage - bei einem Notfall 3, 6 oder 12, mit Aufschlag. Wir zahlen sofort, also muss die Bank helfen. Klicke den Reiter.',
  },
  'f-pay': {
    title: 'Bezahlen',
    text: 'Drücke **Bezahlen**: der Zahlungsdialog öffnet sich mit der ganzen Rechnung.',
  },
  'f-add': {
    title: 'Die Zahlung buchen',
    text: 'Jonas hat zu wenig Bargeld: die **Bank leiht den Rest** (1.000 TT, 10 % im Monat). Drücke **hinzufügen**.',
  },
  'f-paid': {
    title: 'Bezahlt',
    text: 'Das Projekt ist **abgeschlossen**. Zurück zum Spiel: öffne das **Menü** und drücke **Dreamfund**.',
  },
  'f-menu': { title: 'Zurück zum Spiel: das Menü', text: 'Öffne das **Menü**.' },
  'f-back': { title: 'Dreamfund', text: 'Drücke **Dreamfund**.' },
  't2-bank': {
    title: 'Du schuldest der Bank',
    text: 'Der Kredit kostet **10 % im Monat**: 100 TT weniger bei jedem Zahltag. Die Bank-Schaltfläche zeigt ihn und eine **Zurückzahlen**-Schaltfläche.',
  },
  't2-done': { title: 'Fertig', text: 'Der Notfall ist erledigt. Drücke **Fertig**.' },
  't3-roll': {
    title: 'Eine Ernte-Karte',
    text: 'Würfle. Das nächste Feld ist eine 🌾 **Ernte**: die Märkte bewegen sich für alle.',
  },
  't3-open': {
    title: 'Die Märkte bewegen sich',
    text: 'Öffne die Karte: sie sagt, was passiert ist und ob es etwas betrifft, das **du besitzt**.',
  },
  't3-done': {
    title: 'Fertig',
    text: 'Jonas besitzt nichts, was die Karte trifft. Drücke **Fertig**.',
  },
  't4-roll': {
    title: 'Zahltag!',
    text: 'Würfle - das nächste Feld ist ein 💰 **Zahltag**: das Gehalt kommt, die Rechnungen gehen.',
  },
  't4-payday': {
    title: 'Ein Monat ist vergangen',
    text: 'Der Zahltag hat dein **Gehalt** und jedes **Abo** als neue Buchungen eingetragen. Sehen wir wo: zuerst die **Transaktionen**, dann die **Abos**.',
  },
  't4-close': {
    title: 'Das Spielfenster schließen',
    text: 'Hinter dem Spielfenster liegen die Seiten der App. Schließe es kurz mit dem **x** - das **Menü** holt es zurück.',
  },
  't4-tx': { title: 'Transaktionen', text: 'Öffne **Transaktionen** in der unteren Leiste.' },
  't4-tx-read': {
    title: 'Deine Buchungen',
    text: 'Jede Buchung des Spiels steht hier: Gehalt, Rechnungen, die Ersparnis der ersten Karte. Sieh dir die neuesten Zeilen an - sie kamen mit dem Zahltag.',
  },
  't4-subs': { title: 'Abos', text: 'Öffne jetzt **Abos**.' },
  't4-subs-read': {
    title: 'So funktionieren Abos',
    text: 'Ein **Abo** ist eine Zahlung, die sich wiederholt: Gehalt, Miete, jede Rechnung - und die **Zahlungspläne**, die du anlegst. Bei jedem Zahltag wird jedes als **neue Transaktion** gebucht. Was vom Monat bleibt, ist dein **Cashflow**.',
  },
  't4-menu': { title: 'Zurück zum Spiel: das Menü', text: 'Öffne das **Menü**.' },
  't4-back': { title: 'Dreamfund', text: 'Drücke **Dreamfund**.' },
  't4-repay': {
    title: 'Die Bank zurückzahlen',
    text: 'Du hast Geld vom Zahltag. Drücke **Offenen Betrag zurückzahlen**.',
  },
  't4-repay-go': {
    title: 'Zurückzahlen',
    text: 'Drücke **Zurückzahlen** (oder **Alles begleichen**): die 1.000 sind zurück, die 100 im Monat entfallen.',
  },
  't4-end': { title: 'Zug beenden', text: 'Drücke **Zug beenden**.' },
  't5-roll': { title: 'Ein Traum-Feld', text: 'Würfle: ein 😊 **Traum**-Feld.' },
  't5-open': {
    title: 'Eine Traumkarte',
    text: 'Öffne die Karte: Traumkarten werden angeboten, jede **Punkte** wert.',
  },
  't5-dream': {
    title: 'Mit dem Gleitschirm über die Alpen',
    text: 'Lies den Traum: ein kleiner, 2 Punkte, vier **Eimer** zusammen 1.200 TT. Dann **Weiter**.',
  },
  't5-take': { title: 'Nimm den Traum', text: 'Nimm ihn: er wird ein **Smile-Projekt**.' },
  't5-smile': { title: 'Zum Smile-Projekt', text: 'Drücke **Smile-Projekt öffnen**.' },
  's-overview': {
    title: 'Der Traum als Projekt',
    text: 'Das echte **Smile**-Fenster: Eimer, Fortschritt, Aufgaben, Notizen - wie das Fire-Projekt, für etwas, das du willst.',
  },
  's-plans': {
    title: 'Zahlungspläne',
    text: 'Ein Traum füllt sich durch einen **Zahlungsplan**. Öffne den Reiter **Zahlungspläne**.',
  },
  's-plan': {
    title: 'Einen Plan anlegen',
    text: 'Drücke **Zahlungsplan erstellen**, wähle **50 im Monat** und speichere. Dann fließt Geld bei jedem Zahltag von selbst in den Traum. (Mit **Schritt überspringen** schaust du nur.)',
  },
  's-subs': {
    title: 'Der Plan ist ein Abo',
    text: 'Ein Zahlungsplan ist ein **Abo**: öffne **Abos** und finde den neuen Plan.',
  },
  's-subs-read': {
    title: 'Dein Plan als Abo',
    text: 'Da ist er: **50 im Monat in den Traum**. Bei jedem Zahltag wird er als neue Transaktion gebucht, und der Traum füllt sich.',
  },
  's-menu': { title: 'Zurück zum Spiel: das Menü', text: 'Öffne das **Menü**.' },
  's-back': { title: 'Dreamfund', text: 'Drücke **Dreamfund**.' },
  't5-done': { title: 'Fertig', text: 'Drücke **Fertig**.' },
  't6-roll': { title: 'Eine Lebenskarte', text: 'Würfle: das nächste Feld ist ❤ **Leben**.' },
  't6-open': { title: 'Das Leben passiert', text: 'Öffne die Karte.' },
  't6-life': {
    title: 'Fitnessstudio',
    text: 'Nimm es an: es hinterlässt eine **Zeile** - 35 im Monat für eine Weile.',
  },
  't6-done': { title: 'Fertig', text: 'Drücke **Fertig**.' },
  't7-roll': { title: 'Ein zweiter Zahltag', text: 'Würfle zum nächsten 💰 Zahltag.' },
  't7-payday': {
    title: 'Pläne zahlen ein',
    text: 'Der Zahltag hat die Abos wieder gebucht: dein **Plan** hat 50 in den Traum geschoben, das Fitnessstudio 35 abgezogen.',
  },
  't7-end': { title: 'Zug beenden', text: 'Drücke **Zug beenden**.' },
  't8-roll': {
    title: 'Das Karriere-Feld',
    text: 'Würfle: das 🎓 **Karriere**-Feld - vielleicht wartet eine Beförderung.',
  },
  't8-career': {
    title: 'Eine Beförderung',
    text: 'Ein Würfel entscheidet, ob Jonas eine Stufe aufsteigt. Sein Gehalt steigt, seine Lebenshaltungskosten auch.',
  },
  't8-die': {
    title: 'Wirf selbst',
    text: 'Drücke den goldenen Knopf und wirf den Karriere-Würfel. Dein eigenes Glück entscheidet - eine hohe Zahl bringt dich eine Stufe weiter.',
  },
  't8-result': {
    title: 'Die Beförderung',
    text: 'Das sagt der Würfel, mit dem Gehalt davor und danach. Mehr Gehalt heißt jeden Monat mehr Cashflow. Drücke **Weiter**.',
  },
  'i-open': {
    title: 'Wer Jonas ist: der Info-Knopf',
    text: 'Drücke **ⓘ**, um jederzeit das Blatt deiner Figur zu öffnen.',
  },
  'i-sheet': {
    title: 'Das Blatt einer Figur',
    text: 'Das Blatt hat alles: **wer er ist**, **was ihm wichtig ist**, **sein Traum**, sein **Notgroschen** (der Mojo) und **So gewinnst du** - die **Aufträge**: die zwei Schulden zurückzahlen, den Traum füllen, den Notgroschen aufbauen, unabhängig werden. Dazu seine Zahlen: **Cashflow**, Einkommen, Bilanz. Eine Runde endet, wenn jeder Spieler am Zug war; die **Tischrunde** oben zählt sie. Drücke **Weiter**.',
  },
  'menu-hub': {
    title: 'Das Menü: dein Knotenpunkt',
    text: 'Noch ein Ort: das **Menü**. Öffne es.',
  },
  'menu-explain': {
    title: 'Alles ist hier',
    text: 'Das Menü ist der **Knotenpunkt**: jede Seite der App - Transaktionen, die Konten, Abos, Grow, Einkommen, Bilanz, Budget - und **Dreamfund**, um ins Spiel zurückzuspringen. Schließe es mit dem x.',
  },
  end: {
    title: 'Das ist die Schleife',
    text: 'Würfeln, Karte lesen, entscheiden, Monat abrechnen, wiederholen - bis Notgroschen, Schulden, Traum und Unabhängigkeit erledigt sind. Das Tutorial endet hier; **spiele gegen Coach weiter**, bis du aufgibst oder das Spiel vorbei ist.',
  },
};
