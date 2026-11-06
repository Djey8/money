/**
 * The drawings and the longer explanations of the English Dreamfund manual (JFK, 2026-11-06): example cards of the three piles, two example
 * projects to open (an Emergency in Fire, a Dream in Smile - nothing in them works), and the first four career stages of Jonas. The numbers
 * are the printed ones (Normal level, price level 1.0 - Jonas): the cards S01, S10, P19 and T05, the emergency E108, the dream D64 and
 * Jonas's career C1-C4.
 */
const p = (text) => ({ type: 'p', text });
const h3 = (text) => ({ type: 'h3', text });
const list = (items) => ({ type: 'list', items });
const tip = (title, text) => ({ type: 'callout', kind: 'tip', title, text });
const note = (title, text) => ({ type: 'callout', kind: 'note', title, text });
const steps = (items) => ({ type: 'steps', items });

// ── Opportunity: what a card looks like ──
const opportunity = [
  h3('What an Opportunity card looks like'),
  p(
    'Four real cards, one of each kind you meet. The coloured bar is the pile (purple Seed, green Sapling, dark green Tree); the small word is the **kind** - Saving, Share, Asset or Investment. Below the story are the numbers that matter before you buy.',
  ),
  {
    type: 'cardfaces',
    caption:
      'Examples for looking at - the numbers are those of Jonas (price level 1.0) on Normal. In the game the card also carries its risk, tasks and links in its Grow project.',
    items: [
      {
        pile: 'seed',
        kind: 'Saving',
        title: 'AI Subscription Audit',
        text: 'You let an AI scan your bank statements. It finds three subscriptions you forgot you had.',
        facts: [
          { label: 'Costs', value: '0 DT' },
          { label: 'Risk', value: '0 of 5' },
          { label: 'Saves a month', value: '15 / 30 / 50 DT' },
        ],
        note: 'A die decides how much you find: 1-2 gives 15, 3-4 gives 30, 5-6 gives 50 DT a month. Free, and it lasts.',
      },
      {
        pile: 'seed',
        kind: 'Share',
        title: 'World ETF Savings Plan',
        text: 'Fifty euros a month into the whole world economy. Boring. Exactly the point.',
        facts: [
          { label: 'Price per unit', value: '100 DT' },
          { label: 'Units', value: 'up to 20' },
          { label: 'Pays a month', value: '1.95 DT per unit' },
          { label: 'Risk', value: '2 of 5' },
        ],
        note: 'You choose how many units to buy. The price moves with its market index (the Harvest cards move it); you can sell only when a window is open - or at the standing price less 5%.',
      },
      {
        pile: 'sapling',
        kind: 'Asset',
        title: 'Create an Online Course',
        text: "'SQL for Marketing People' - 40 videos recorded over three months.",
        facts: [
          { label: 'Costs', value: '3,000 DT' },
          { label: 'Takes', value: 'a side hustle slot' },
          { label: 'Ramps up', value: '3 Paydays' },
          { label: 'Risk', value: '3 of 5' },
        ],
        note: 'After the ramp a die decides what it earns a month: 1-3 gives 31, 4-5 gives 208, a 6 gives 832 DT. Only a few side hustles can run at once.',
      },
      {
        pile: 'tree',
        kind: 'Investment',
        title: 'Holiday Flat at the Baltic Sea',
        text: 'Two rooms, sea view, booked solid in summer and empty in February.',
        facts: [
          { label: 'Price', value: '240,000 DT' },
          { label: 'Deposit', value: '48,000 DT' },
          { label: 'Mortgage', value: '192,000 DT' },
          { label: 'Risk', value: '3 of 5' },
        ],
        note: 'A property with a mortgage: the rent comes in and the mortgage payment goes out every month, so the card shows the cash flow that is left. Several Harvest cards can cut the rent.',
      },
    ],
  },
  tip(
    'How to read a card in five seconds',
    'Look at the **cost** (can I pay it from cash without the Bank?), the **monthly cash flow or saving** (what does it add to my month?), the **risk** and the **die** (what can it be at worst?). A card that promises a lot for very little is the one to doubt.',
  ),
];

// ── the two example projects ──
const projects = {
  type: 'mockprojects',
  caption:
    'Two example projects. Click one to open its info window - the same things you read in the game. Nothing here is real and nothing works.',
  banner: 'Example - for looking only. Nothing in this window works.',
  close: 'Close',
  open: 'Open the project',
  notesTitle: 'Notes of the project',
  bucketsTitle: { emergency: 'What the bill is made of', dream: 'Buckets of the dream' },
  items: [
    {
      id: 'emergency',
      kind: 'emergency',
      icon: '🔥',
      title: 'A Chronic Illness: Part Time Only',
      subtitle: 'Emergency · blaze · a Fire project',
      story:
        'The diagnosis has a long name. The treatment works, but it costs strength: you can work only 60 percent now, for the next year at least. You chose to spread the bill over 6 Paydays.',
      percent: 33,
      progress: '720 of 2,160 DT paid (2 of 6 Paydays)',
      facts: [
        { label: 'The bill', value: '1,800 DT' },
        { label: 'Plan surcharge', value: '+20% = 360 DT' },
        { label: 'In total', value: '2,160 DT' },
        { label: 'Insurance', value: 'disability: none held' },
      ],
      buckets: [
        {
          title: 'The income gap in the first year',
          amount: '1,300 DT',
          percent: 33,
          note: 'Working 60 percent of your hours means a loss of about 40 percent of the pay.',
        },
        {
          title: 'Treatment and aids',
          amount: '500 DT',
          percent: 33,
          note: 'Co-payments, medicines and aids add up over a year.',
        },
      ],
      plan: {
        title: 'Payment plan',
        per: '360 DT every Payday',
        left: '4 Paydays left · 1,440 DT to go',
        text: 'The plan pays itself at every Payday from your cash. A plan that is longer costs a larger surcharge: on Normal 10% for 3, 20% for 6 and 35% for 12 Paydays. If the cash is short, the Bank lends the rest.',
      },
      notes: [
        'Payday 1: 360 DT paid from cash. Cash before 1,080, after 720.',
        'Payday 2: 360 DT paid from cash. Cash before 1,210, after 850.',
        'The monthly cash flow is 360 DT lower until the plan ends.',
      ],
    },
    {
      id: 'dream',
      kind: 'dream',
      icon: '🪂',
      title: 'Paraglide Over the Alps',
      subtitle: 'Dream · adventure · little · 2 points · a Smile project',
      story:
        'Run off the mountain and the thermals lift you high above the valley, silent as a bird. A dream you take becomes a Smile project: you fill its buckets, and when every bucket is full, the dream is lived.',
      percent: 29,
      progress: '350 of 1,200 DT saved',
      facts: [
        { label: 'Total', value: '1,200 DT' },
        { label: 'Saved', value: '350 DT' },
        { label: 'Dream points', value: '2' },
        { label: 'Buckets full', value: '2 of 4' },
      ],
      buckets: [
        {
          title: 'Journey to the Alps',
          amount: '150 of 150 DT',
          percent: 100,
          note: 'By train or car to Interlaken, Lenggries or the Dolomites.',
        },
        {
          title: 'Tandem thermal flight',
          amount: '200 of 200 DT',
          percent: 100,
          note: 'Look for DHV or SHV licensed pilots.',
        },
        { title: 'Hotel and food, 3 nights', amount: '0 of 450 DT', percent: 0 },
        { title: 'Beginner course day', amount: '0 of 400 DT', percent: 0 },
      ],
      plan: {
        title: 'Payment plan',
        per: '50 DT every Payday',
        left: '17 Paydays left · 850 DT to go',
        text: 'The plan moves 50 DT from your free money into the dream at every Payday, the fullest bucket first. You can raise it, lower it or stop it with 0, and you can put in a lump sum at any time.',
      },
      notes: [
        'Dream taken on the Dream tile. Plan set: 50 DT a month.',
        'Payday: 50 DT into the dream. Saved so far: 350 DT.',
        'Points count when the dream is lived: 25 rating points each, and they may be a goal of the table.',
      ],
    },
  ],
};

// ── Emergencies: more explained ──
const emergency = [
  h3('What an Emergency is'),
  p(
    'Something breaks or goes wrong, and money has to be found. The 50 cards come in five **tiers** - **spark** (a bike grip), **flame**, **blaze**, **wildfire** and **inferno** (the flat burns down) - and in a few **kinds**: a fixed bill, a die that decides the bill, a card with a choice (repair or replace), or a card made of several parts. Some cards need a life you have (a car, a pet, children, a flat of your own); a card for something you do not have is told, put back, and another is drawn.',
  ),
  h3('Who pays first'),
  steps([
    {
      title: 'Insurance',
      text: 'If an insurance you hold covers the card, you pay only the **deductible** - at most 500 DT on Normal (300 on Easy, 750 on Hard).',
    },
    { title: 'Your cash', text: 'What is left is paid from your **cash**.' },
    {
      title: 'Your reserve',
      text: 'If the cash is not enough, the **Mojo** - your emergency reserve - pays the rest. This is what it is for.',
    },
    {
      title: 'The Bank',
      text: 'Only when cash and reserve are empty does the **Bank** lend what is missing, in steps of 1,000 DT, at 10% a month.',
    },
  ]),
  h3('Three ways to pay'),
  {
    type: 'table',
    head: ['Way', 'What happens', 'When to use it'],
    rows: [
      [
        '**Pay now**',
        'The whole bill leaves your cash today.',
        'When your cash and reserve can carry it. The only way for a fine or a fee that must be paid at once.',
      ],
      [
        '**A plan of 3, 6 or 12 Paydays**',
        'The bill is split in equal parts, one at every Payday, with a **surcharge**: on Normal 10%, 20% or 35% (Easy 5/10/20, Hard 15/30/50).',
        'When the cash would run dry and you would rather not borrow. It costs less than the Bank (10% **a month**) for a plan up to 12 Paydays.',
      ],
      [
        '**Create the Fire project**',
        'Nothing is paid yet. The emergency opens as a project on the Fire page and you put money into it from there, step by step.',
        'When you want to pay it with money that comes in over the next turns. In the guided and strict rules the turn is not over until it is paid or planned.',
      ],
    ],
  },
  h3('How it looks in the books'),
  p(
    'An emergency that is not paid at once lives as a **Fire project**: its parts (what the bill is made of), what is paid, the plan and the notes of every payment. The example below is a real card (**A Chronic Illness: Part Time Only**) paid by a plan of 6 Paydays, next to a dream in Smile. Click either one.',
  ),
  projects,
  tip(
    'Why the reserve is the first goal',
    'In the example the player held no disability insurance and the reserve was empty, so the bill had to be spread. With a full reserve (three months of costs) the same card is paid on the spot and forgotten.',
  ),
];

// ── Dreams: more explained ──
const dreams = [
  h3('What a dream is'),
  p(
    'Your character has one **life dream** from the start (Jonas: a certified mountain guide). It is the first Smile project and the dream goal of the game. Besides it, the Dream tiles offer **dream cards**: small and big wishes you can add to your Smile page - **48 cards** in tiers from **little** to **legendary**, in categories like travel, adventure, vehicles, home, learning, creating and giving. Every dream card is worth **points**; the bigger the dream, the more points and the higher the price.',
  ),
  h3('How a dream is paid'),
  steps([
    {
      title: 'You take it',
      text: 'On a Dream tile you are offered cards. You can take one (it becomes a Smile project), pass, or - where the table allows it - decline all. On Normal you are offered 2 cards, and up to 3 dreams can be open at once.',
    },
    {
      title: 'It is made of buckets',
      text: 'Every dream has **buckets**: the journey, the hotel, the equipment, the course. Each has a price and a note of what it is for. You fill them one by one.',
    },
    {
      title: 'You pay by plan',
      text: 'A **payment plan** moves a fixed amount into the dream at every Payday - for the example below, 50 DT. You may also put in a lump sum at any time. The plan never forces you; it shows what is due.',
    },
    {
      title: 'It is lived',
      text: 'When every bucket is full, the dream is **lived**: it pays out its points and the project closes. For the life dream this ticks the dream goal of the game.',
    },
  ]),
  h3('Dream moments'),
  p(
    'Some Dream tiles bring a **moment** instead of cards: an early-bird offer, a gift from the family, a last-minute deal, a travel buddy, a stroke of inspiration, money from a side project, points for patience, or a swap of one dream for another. They make a dream cheaper or closer - the project notes say by how much.',
  ),
  h3('A dream in the books'),
  projects,
  note(
    'Dreams and the order of a game',
    'Dreams are the reason to play, but the simulation shows that a player who funds the dream before any income rarely wins. Take the small dreams for the points when a plan of 50 a month does not hurt; keep the big money for cards that pay every month.',
  ),
];

// ── Career: the first four stages of Jonas ──
const career = [
  h3('The career of Jonas: the first four stages'),
  p(
    "Every character has a ladder of their own. This is the beginning of Jonas's: he starts as a **dual student** and climbs to a **senior data engineer** - the pay in the example is his net a month on Normal.",
  ),
  {
    type: 'ladder',
    character: 'Jonas',
    stageWord: 'Stage',
    caption:
      'For looking at: the printed stages C1 to C4 of Jonas. Stage C2 ends his studies (the Education badge goes away) and costs 300 DT once for the new job.',
    more: 'From stage 4 the ladder splits into a technical path (Staff Data Engineer, Chief Data Architect) and a management path (Data Team Lead, Head of Data, Director of Data), where the climb is harder: roll 6 and 6 to 8 Paydays between steps.',
    stages: [
      {
        stage: 1,
        title: 'Dual Student',
        story:
          'Three days at the company, two at university. A real salary while you study - and a thesis waiting at the end.',
        net: '1,955 DT a month',
        gross: '34,000 a year',
        living: 'living costs ×1.0',
        next: 'To stage 2: at least 3 Paydays, then roll 4 or more. A failed roll (1-2) costs an exam retake of 150 DT.',
      },
      {
        stage: 2,
        title: 'Junior Data Analyst',
        story:
          'Your bachelor thesis got a 1.3, and your team wants to keep you. First full-time contract!',
        net: '2,952 DT a month',
        gross: '56,000 a year',
        living: 'living costs ×1.1 (+200)',
        oneTime: 'Once: 300 DT for the move.',
        next: 'To stage 3: at least 4 Paydays, then roll 4 or more.',
      },
      {
        stage: 3,
        title: 'Data Engineer',
        story:
          "You automated half the team's reports. Your manager offers you the move into data engineering.",
        net: '3,768 DT a month',
        gross: '75,000 a year',
        living: 'living costs ×1.2 (+250)',
        next: 'To stage 4: at least 4 Paydays, then roll 5 or more.',
      },
      {
        stage: 4,
        title: 'Senior Data Engineer',
        story:
          "You own the data platform, review everyone's code and mentor two juniors. Five years in, you're senior.",
        net: '4,618 DT a month',
        gross: '95,000 a year',
        living: 'living costs ×1.35 (+300)',
        next: 'To stage 5: at least 5 Paydays, then roll 5 or more - and choose the technical or the management path.',
      },
    ],
  },
  tip(
    'A raise is not all profit',
    'Every step raises your **living costs** too, so the reserve target grows with it (three months of the new costs). Climb when you can, but look at what is left of the month, not at the salary.',
  ),
];

module.exports = { opportunity, emergency, dreams, career };
