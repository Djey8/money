/**
 * The Dreamfund manual in English: the sections of the page, in order. `{ type: 'import', md: N }` is filled by scripts/dreamfund-manual.js
 * from docs/DREAMFUND_GAME.md (the rule tables and the statistics of the simulation). Everything else is written here, for a person who
 * has never seen the game: what it is, where to click, what every card does and why.
 */
const p = (text) => ({ type: 'p', text });
const h3 = (text) => ({ type: 'h3', text });
const list = (items, ordered = false) => ({ type: 'list', items, ...(ordered ? { ordered } : {}) });
const tip = (title, text) => ({ type: 'callout', kind: 'tip', title, text });
const note = (title, text) => ({ type: 'callout', kind: 'note', title, text });
const warn = (title, text) => ({ type: 'callout', kind: 'warning', title, text });
const example = (title, text) => ({ type: 'callout', kind: 'example', title, text });
const steps = (items) => ({ type: 'steps', items });
const cards = (items) => ({ type: 'cards', items });
const table = (head, rows, noteText) => ({
  type: 'table',
  head,
  rows,
  ...(noteText ? { note: noteText } : {}),
});
const imp = (md, sub, extra = {}) => ({
  type: 'import',
  md,
  ...(sub === undefined ? {} : { sub }),
  ...extra,
});

const shows = require('./en-shows.js');

const sections = {
  welcome: {
    nav: 'Welcome',
    title: 'Welcome to Dreamfund',
    intro:
      'Dreamfund (Traumtopf in German) is a money game you play on a map, with dice and cards, **inside your own books**: a salary is a real booking, a share is a real Grow project, a dream is a real Smile project. You live a character through years of money decisions - and when the game is over you know what a reserve, a loan, an index or a payment plan does, because you made them do it.',
    blocks: [
      cards([
        {
          icon: '🎯',
          title: 'The aim',
          text: 'Build a life you can afford: repay what you owe, keep a reserve, **live your dream** and let your money work for you until **passive income pays your bills**. When all five goals of your character are true, you have won.',
        },
        {
          icon: '🎲',
          title: 'How it is played',
          text: 'You roll the dice, your **totem** walks a map of tiles, and every tile is a pile of cards: Opportunities to invest in, Harvest cards that move the markets, Emergencies, Life, Career, Dreams and Paydays.',
        },
        {
          icon: '👥',
          title: 'Alone or together',
          text: 'You always play at a **table**: against bots (as many as you like) or against other people. Everybody lives their own life in parallel; the markets are shared. **The first to reach every goal wins.**',
        },
        {
          icon: '🏆',
          title: 'A rating',
          text: 'Ranked games move your **rating** (everybody starts at 1500) on one leaderboard with people and bots. Unranked games are for learning and for fun.',
        },
      ]),
      note(
        'Who can read this and play',
        'The game and this manual are for **game accounts** on the self-hosted edition: an account whose email contains the word `cashflow`. Nothing in such an account is real money, and nothing you do reaches a normal account.',
      ),
      h3('The fastest way to understand it'),
      p(
        'Do not read this page from the top first. Start the **guided demo game**: a table against a friendly bot with a fixed die and fixed cards, where a coach shows you every place of the screen and every move in about fifteen minutes. You can stop it at any moment and play for real. You find it in four places:',
      ),
      list([
        'the **Demo** button at the top right of every page of the app, while you are signed in with a game account (without an account, or with a normal one, it starts the normal demo of the Money Manager);',
        'the **Dreamfund lobby**, on the entry **Learn the game**;',
        '**the demo bot**: when you add the bot called **Coach** to a table, the table is the demo;',
      ]),
      h3('How this manual is built'),
      p(
        'It goes from the top of the screen to the bottom of the game: **the screen**, **your money**, **your life**, **the map and a turn**, then **every card type** one by one, **selling**, **playing together**, **ratings**, **the bots**, **strategy**, a **FAQ** and a **glossary**. The last section holds the numbers of thousands of simulated games. Every section stands on its own: use the list on the left (or the menu at the top on a phone) to jump.',
      ),
      tip(
        'Words in this manual',
        'Money is counted in **Dream Taler** (DT, in German **Traumtaler**, TT) unless the table chose a real currency sign. A **Payday** is a month: your salary comes in and your bills go out. **Fire**, **Smile**, **Grow** and **Mojo** are the places your money lives; the section "Your money" explains each.',
      ),
    ],
  },

  firstgame: {
    nav: 'Your first game',
    title: 'Your first game, step by step',
    intro:
      'From the lobby to the first Payday. Nothing here can go wrong: the first game is a game against a bot, and you can leave it any time.',
    blocks: [
      steps([
        {
          title: 'Open the lobby',
          text: 'In the menu choose **Tables**, and at the top of the lobby switch from **Classic** to **Dreamfund**. You see the open tables, your own tables, the leaderboard and the **Join with a code** field.',
        },
        {
          title: 'Open a table',
          text: 'Press the round **+**. Give the table a name (or take the suggestion), choose the **difficulty** (start on **Normal**; Easy is gentler), leave **Ranked** off for a first game, and press **Open the table**. Every setting is explained in "Playing together".',
        },
        {
          title: 'Seat a bot',
          text: 'In the waiting room press **Add bot**. Choose a strategy and a level, or the bot **Coach** for the guided demo. A table needs at least two seats.',
        },
        {
          title: 'Meet your character',
          text: 'Everybody first reads **who they are**: the story, the goals, the income, the bills and the debts. Choose your insurances (they count at once) and press **I am ready**. Until then you may go back and take another character, unless the table deals the characters.',
        },
        {
          title: 'Start and roll',
          text: 'When everybody is ready the host presses **Start**. On your turn press the golden **dice**. The totem walks and the card of the tile opens.',
        },
        {
          title: 'Decide, then press Done',
          text: 'Read the card, decide (the buttons say what each choice costs) and press **Done**. If a market card touched something you own, Done takes you to **Grow** and marks what changed.',
        },
        {
          title: 'Settle the month',
          text: 'Passing a **Payday** tile pays your salary and takes your bills. What is left is yours: put it into the reserve, a payment plan for the dream, or a card you planned.',
        },
        {
          title: 'Keep going until the goals are true',
          text: 'About **90 turns** make a normal game. You win when your reserve, your debts, your dream and your independence are all done.',
        },
      ]),
      example(
        'A first Payday, in numbers',
        'Jonas, the dual student, earns about 1,955 DT net and has bills for the rest; about **500 DT** are left over. He puts 100 into the reserve, plans 50 a month into his dream, and keeps the rest as cash for the next card. After a month or two his **free saving cards** (a cheaper phone plan, cheaper electricity) lift that sum without costing anything.',
      ),
      tip(
        'Where to look when you do not know what to do',
        'The row of **goals** shows what is still missing, the **strip above the map** shows what is running on your money, and the **info of your character** lists everything again. The demo game and the section "Strategy" tell you what to do first.',
      ),
    ],
  },

  screen: {
    nav: 'The game screen',
    title: 'The game screen, from top to bottom',
    intro:
      'Everything on the screen has one job. This is the whole tour; the demo game walks you through the same places while you play.',
    blocks: [
      cards([
        {
          icon: '🗺️',
          title: 'The map',
          text: "A closed track of tiles. Your **totem** stands next to the tile you are on and points at it; the other players' totems wear their initials or pictures. A tile is coloured by its kind (gold Payday, purple Opportunity, amber Harvest, green Dream, red Emergency, pink Life, blue Career).",
        },
        {
          icon: '🏷️',
          title: 'The badges of your life',
          text: 'Small badges (relationship, children, home, place, job, pet, car, education, insurances, career). **Tap one** and a card tells what it means. They decide which cards can happen to you.',
        },
        {
          icon: '📊',
          title: 'The strip: what is running',
          text: 'Above the map: every effect that works on your money right now and **how many Paydays are left** - a cost that runs for a while, a pause, a gain, a job search.',
        },
        {
          icon: '🎯',
          title: 'The goals',
          text: 'The five goals of your character as bars in percent: **debts**, **reserve**, **dream**, **independence** (and dream points where the table asks). A bar turns gold when done.',
        },
        {
          icon: '💶',
          title: 'The money panel',
          text: 'Cash, reserve, passive income against the cost of living, monthly cash flow, net worth, the Bank loan. Put money into the reserve or the dream, repay a debt or the loan, here.',
        },
        {
          icon: '🌱',
          title: 'Grow, Smile and Fire',
          text: 'The three project pages: **Grow** (your investments), **Smile** (your dreams with their buckets) and **Fire** (what must be paid: the reserve, emergencies). The project pages are the normal pages of the Money Manager.',
        },
        {
          icon: '🧾',
          title: 'The balance',
          text: 'The income statement and the balance sheet of your character: income, expenses, assets, liabilities. Every card you take changes them.',
        },
        {
          icon: '📜',
          title: 'History and feed',
          text: 'The feed tells what everybody does ("Anna rolls the dice", "Coach buys ..."). A line opens the card it is about. The history keeps every step; **Undo** takes back the last action of your turn.',
        },
        {
          icon: '👥',
          title: 'The players',
          text: 'The queue of players shows who is on the move, who is a bot, who is away, and the clock. Tap a player to **look at their books** (read only) and go back with **Back to my books**.',
        },
        {
          icon: '⚙️',
          title: 'The table menu',
          text: "Settings (pop-ups and messages on or off), **pause**, **autoplay while I am away**, the table's rules, **Resign** and, in the demo, **Stop the tutorial**.",
        },
      ]),
      h3('The buttons you press most'),
      table(
        ['Button', 'What it does'],
        [
          [
            '**Roll** (golden dice)',
            'Starts your turn. Every die of the game is yours to throw: when a card says "a die decides", you throw it.',
          ],
          [
            '**Done**',
            'Finishes the card you are on. A planned investment stays open until the end of your turn.',
          ],
          [
            '**End turn**',
            'Gives the move to the next player. The table may ask you to settle the month or an emergency first.',
          ],
          [
            '**Plan this card**',
            'Opens the investment as a project in Grow with all its numbers. Nothing is bought yet.',
          ],
          [
            '**Buy / Sell**',
            "In Grow: books a purchase or sells at the standing price. Selling next to a Harvest offer uses the offer's price.",
          ],
          [
            '**Pay now / 3 / 6 / 12 Paydays**',
            "How an emergency is paid: at once, or spread over Paydays (with the plan's surcharge).",
          ],
          [
            '**Undo**',
            'Takes back the last action of your turn (not a die that was thrown for a card).',
          ],
          ['**Resign**', 'Gives up your seat. You lose against everybody who stays.'],
        ],
      ),
      note(
        'You cannot cheat the game',
        'The server decides everything. The screen only offers what the rules allow, and a move that is not allowed is refused with a sentence that says why.',
      ),
    ],
  },

  aim: {
    nav: 'The aim and the goals',
    title: 'The aim: five goals, one win',
    intro:
      'A game ends when somebody wins, goes bankrupt, resigns or runs out of turns. This is what "winning" means.',
    blocks: [
      imp(10, undefined),
      h3('The goals in plain words'),
      table(
        ['Goal', 'What has to be true', 'How you get there'],
        [
          [
            '**Debts**',
            'The starting debts of your character are repaid (a loan from the parents, a car loan, a credit card).',
            'Repay from cash when you can; a debt that costs interest first.',
          ],
          [
            '**Reserve**',
            'Three months of living costs sit in the **Mojo**.',
            'A payment plan from the first Paydays; the reserve is the first goal to finish.',
          ],
          [
            '**Dream**',
            'The life dream of your character is funded in every bucket and **lived**.',
            'A payment plan per Payday; fund it with what is left, not first.',
          ],
          [
            '**Independence**',
            'Your passive income is at least your cost of living.',
            'Cards that pay every month: this is the bottleneck of the game.',
          ],
          [
            '**Dream points**',
            'Only where the table asks: a number of points from the dreams you took.',
            'Take dreams on the Dream tiles, but only when your income is on its way.',
          ],
        ],
      ),
      tip(
        'The honest truth about the order',
        'In thousands of simulated games the reserve and the dream were reached long before the income. A player who funded the dream before there was any income has rarely won. **Income is the bottleneck.**',
      ),
    ],
  },

  money: {
    nav: 'Your money',
    title: 'Your money: five accounts, Grow, plans and the Bank',
    intro:
      'The game uses the five accounts of the Barefoot Investor method plus an investment tracker called Grow. If you know the Money Manager you know them already; if not, this section is the whole idea.',
    blocks: [
      imp(2, undefined),
      h3('Smile: your dream, with buckets'),
      p(
        'A dream is a **Smile project**. It has **buckets** (the flights, the hotel, the equipment ...) and each bucket has a price. Money goes into a bucket by hand or, much better, by a **payment plan**: "50 a month into the dream" moves 50 at every Payday until the bucket is full. A dream you have fully funded is **lived** - it pays out its dream points and ticks the dream goal.',
      ),
      h3('Mojo and Fire: the reserve and what must be paid'),
      p(
        'The **Mojo** is your reserve: three months of living costs. It is a **Fire project** from the first day and may only be used for emergencies. **Fire** is the account of everything that has to be paid - an emergency, the reserve, a debt, an investment you booked.',
      ),
      h3('Grow: where your investments live'),
      p(
        'Every card you take becomes a **Grow project** with its numbers, its notes, its tasks and its risk. A share has units and a price, a property has a deposit and a mortgage, a business has a monthly cash flow. In Grow you **buy** and **sell** with the normal buttons; every dice roll, sale and market effect is written into the **notes** of the project with the numbers.',
      ),
      h3('Payment plans'),
      p(
        "A big goal is never paid at once. A **plan** moves part of every Payday's free money into a project: the reserve, a dream bucket, an emergency you spread over 3, 6 or 12 Paydays. The game never forces a plan; it shows what is **due**. A plan can be raised, lowered or stopped at any time (`0` stops it).",
      ),
      h3('The Bank loan'),
      p(
        'If a payment is bigger than your cash the **Bank** lends you the missing amount automatically. It costs **10% of the loan every month** (a table setting). A loan is an emergency tool, not a way to invest: **repay it as soon as the cash allows**. A bot that keeps a loan open when it could repay it loses points in the simulation.',
      ),
      warn(
        'Why 10% a month matters',
        'Nothing in the game earns 10% a month. Selling a card to repay the Bank is almost always right - the bots do it too (the capability **sell to clear a loan**).',
      ),
      h3('Insurance'),
      p(
        'You start with liability and household insurance, paid at every Payday. When an insured emergency hits, you pay only the **deductible** (at most 500 DT on Normal, 300 on Easy, 750 on Hard). Before the first roll a change counts at once; later it counts from the **next Payday**, so nobody insures just before the fire. See "Your life" for the car insurances.',
      ),
    ],
  },

  characters: {
    nav: 'Characters and levels',
    title: 'The ten characters and the three difficulties',
    intro:
      "Ten lives from 23 to 57, from an apprentice's pay to a surgeon's. Everybody plays the same game, but the debts, the dream and what is left of a month differ - and so does the difficulty.",
    blocks: [imp(15, undefined)],
  },

  life: {
    nav: 'Your life',
    title: 'Your life: attributes and insurances',
    intro:
      'A character is not only a salary: it is a life with a partner or not, children or not, a car or not. The life decides which cards can find you.',
    blocks: [imp(6, undefined)],
  },

  map: {
    nav: 'The map',
    title: 'The map: shapes, sizes and tiles',
    blocks: [
      imp(3, undefined),
      h3('Shapes and sizes at a glance'),
      table(
        ['Setting', 'Choices', 'What it changes'],
        [
          [
            '**Shape**',
            'Ring, infinity, yin yang, rectangle, square, mountain',
            'Only the look of the track and where the Paydays sit; the number of tiles is the size.',
          ],
          [
            '**Size**',
            'Small 24, medium 36, large 48 tiles',
            'A larger map has more Paydays and more tiles between them; a game takes more turns.',
          ],
          [
            '**Layout seed**',
            'A number',
            'The same number always gives the same map, so friends can play the same board again.',
          ],
        ],
      ),
      tip(
        'Which map first?',
        'Start on a **medium ring**: 36 tiles, four Paydays, about two and a half rolls to a month. The demo game uses a fixed one.',
      ),
    ],
  },

  turn: {
    nav: 'A turn',
    title: 'A turn, from the roll to the last decision',
    blocks: [
      imp(4, undefined),
      imp(5, undefined),
      h3('Dice rules at a glance'),
      list([
        '**Every die is yours to throw.** The golden dice on a card is a button; before you throw, the card shows what each number does (green good, red bad, grey nothing).',
        'The **move** is one or two dice (some cards say which). Passing a Payday tile pays; landing on a tile opens its card.',
        'Harvest cards roll their own dice the moment they are drawn; the draw is your action, the dice are shown on the card.',
        '**Undo** takes back the last action of your turn.',
      ]),
    ],
  },

  opportunity: {
    nav: 'Opportunity cards',
    title: '🌱 Opportunity: things to invest in',
    intro:
      'The tile that builds your income. You choose a pile, one to three cards are offered, and you **plan** the one you want in Grow.',
    blocks: [
      imp(7, 0),
      ...shows.opportunity,
      h3('Which pile when?'),
      table(
        ['Situation', 'Pile', 'Why'],
        [
          [
            'Your first turns, little cash',
            '🌱 Seed',
            'Free saving cards, a hustle for a few hundred, a first share.',
          ],
          [
            'A reserve and a first income',
            '🌿 Sapling',
            'Businesses, bigger shares and hustles; the best pile of the simulation.',
          ],
          [
            'Money and a track record',
            '🌳 Tree',
            'Rented flats, shops, franchises; a mortgage is part of the deal.',
          ],
        ],
      ),
      tip(
        'The card shows its own answers',
        'Every Opportunity card in Grow carries **how to invest**, **what to do**, **what not to do**, its **risk** from 1 to 5 with the reason, tasks and checked links. Read the risk text before you buy: a scam looks like a normal card, and only the numbers give it away.',
      ),
    ],
  },

  harvest: {
    nav: 'Harvest cards',
    title: '🌾 Harvest: the markets',
    intro:
      'The market moves, every Harvest card says how, and it tells you if it touches something **you own**.',
    blocks: [imp(7, 1)],
  },

  emergency: {
    nav: 'Emergencies',
    title: '🔥 Emergencies',
    blocks: [imp(7, 2), ...shows.emergency],
  },

  lifecards: {
    nav: 'Life cards',
    title: '❤ Life',
    blocks: [imp(7, 3)],
  },

  career: {
    nav: 'Career',
    title: '🎓 Career',
    blocks: [imp(7, 4), ...shows.career],
  },

  dreams: {
    nav: 'Dreams',
    title: '😊 Dreams and Dream moments',
    blocks: [imp(7, 5), ...shows.dreams],
  },

  notes: {
    nav: 'Notes and effects',
    title: 'The notes of a project and what is running',
    blocks: [imp(8, undefined), imp(9, undefined)],
  },

  selling: {
    nav: 'Selling',
    title: 'Selling: three exits and a tax',
    intro:
      'Everything you own can be sold except savings, plans and courses. There are three ways, best first - and a tax on the profit that you should count before you press Sell.',
    blocks: [
      table(
        ['Exit', 'Price', 'When'],
        [
          [
            '**A Harvest offer**',
            'An open market: every share or coin of that market at its price. A buyer: a die decides (a property 0.85-1.3 times its value, a business 24-36 months of its profit, a block of shares +1% to +20%). A hype: ride it or cash out.',
            "The offer stays open for the table's number of **your own turns** (default 2), even after Done and across a Payday.",
          ],
          [
            '**The standing sale**',
            'The market price less a discount: 5% for a share, 15% for a coin, a collection or a property (the mortgage is paid from the proceeds), a year of the profit for a business or a hustle.',
            'Any time. Use it when you must have cash.',
          ],
          [
            '**A trade with a player**',
            'The price you both accept.',
            'You offer a card in hand to the table; the first to take it gets it.',
          ],
        ],
      ),
      h3('Selling to step up'),
      p(
        'The strongest move of the bots is **sell, step up, repeat**: sell a card that has gained and now pays little for what it is worth, and put the money into a bigger card. A small salary reaches a four-figure passive income this way. Count the tax first.',
      ),
      h3('Selling to clear a loan'),
      p(
        'A Bank loan costs 10% a month. Selling the card that pays least and repaying the loan at once is nearly always better than waiting.',
      ),
      h3('Tax on the profit'),
      p(
        'A table setting (default **26.375%**, the German flat tax with the solidarity surcharge; `0` switches it off) takes a share of the **profit** of a sale: what the sale brings after its costs and what is owed on it, less what you paid for the part you sell. A sale at a loss pays nothing; pensions pay out untaxed. The Grow project notes the tax.',
      ),
      warn(
        'Scams have a last exit',
        'One card says the price of a scam has fallen by 80% while the market stays open one more turn; a claims buyer pays cents on the euro. What you do with the last chance is yours - and a later card closes it for good.',
      ),
    ],
  },

  tables: {
    nav: 'Playing together',
    title: 'Tables: opening, joining and playing with others',
    intro: 'A Dreamfund table is a game with two to eight seats, people and bots in any mix.',
    blocks: [
      h3('Finding a table'),
      list([
        '**Open tables** lists public tables with who sits there (picture and rating; tap a face for their profile) and filters: language, ranked or friendly, with or without a clock, characters, how the game ends.',
        '**My tables** are the tables you sit at; **Finished tables** are the last ones you played.',
        '**Join with a code** opens a private table: the host gives you an invite code.',
      ]),
      h3('The settings of a new table'),
      table(
        ['Setting', 'What it does'],
        [
          ['**Table name**', 'Shown in the lobby. Leave it empty and a funny one is chosen.'],
          ['**Players**', 'How many seats (bots take a seat too).'],
          ['**Who can find it**', 'Everybody, or only people with the invite code.'],
          [
            '**Difficulty**',
            'Easy, Normal or Hard: the numbers of the characters and the cards (see "The characters"). The difficulty is also the stake of the rating.',
          ],
          [
            '**Ranked**',
            'The result counts for the leaderboard. A ranked table is played under the strict rules, the same for everybody.',
          ],
          [
            '**Rules: guided or strict**',
            'Guided: one random card per tile, buying only with the card in hand. Strict: dice only from the app, no free transactions.',
          ],
          ['**Map: shape, size, seed**', 'See "The map".'],
          ['**Characters**', 'Free (the same one twice is fine), unique, or dealt by the table.'],
          ['**Turn order**', 'Random, or by seat.'],
          [
            '**The game ends**',
            '**First escape** (the first to reach every goal wins), **all escape** (everybody plays until out or bankrupt) or **after rounds**.',
          ],
          [
            '**Dream points**',
            'How many points the table asks for, 0 to 60 (0 turns the goal off).',
          ],
          [
            '**Time limit**',
            'None, per move or a time bank for the whole game. Time out and your turn is played passively.',
          ],
          ['**Bot speed**', 'Fast, normal or slow: how long the bots wait between moves.'],
          ['**Spectators**', 'People who are not seated may watch.'],
          ['**Currency**', 'Dream Taler or a real sign (the numbers do not change).'],
          [
            '**Advanced rules**',
            "Tax on the profit of a sale, how long a sell offer stays open (1-5 turns), how many turns a planned card stays buyable (1-3), the Bank loan's interest, undo by vote, leaving, repaying off turn.",
          ],
        ],
      ),
      h3('The waiting room'),
      p(
        'The host sees every seat: a person, a bot (with its strategy and level) or empty. The host can add and remove bots, kick a player, change the settings until the game starts and press **Start**. Everybody picks a character and reads the briefing; the game starts when all are ready.',
      ),
      h3('Playing: the queue, the clock and what you see of the others'),
      list([
        'The **queue of players** shows who is on the move, the clock, and who the table waits for.',
        'Everything another player draws and decides is told to the table, with the card. A history line opens the card.',
        "You can look at another player's books (read only) at any time.",
        "If you do not move in time, or lose the connection, your turn is played **passively**. Two missed turns in a row (a setting) mark you **away**; press **I'm back** to return.",
        '**Autoplay while I am away** lets a bot of your strategy play your turns while you are gone. Switch it off in the table menu.',
        'The host may **pause** the game and **close** the table.',
      ]),
      h3('Trading cards'),
      p(
        'Any holding in hand can be offered to the table at a price. The offer panel shows the other players the card, the price per share, the down payment, the mortgage, the cash flow and what it would do to **their** cash and monthly cash flow. They can **buy at the price**, **make a counter offer**, **decline** or **look later**. The first to take it gets it. You can withdraw your offer and accept a counter offer.',
      ),
      h3('Leaving and ending'),
      list([
        'A table with a game that has begun that you **leave** counts as a loss against everybody who stayed (a few free rounds can be set).',
        'A game ends when somebody wins (in first-escape tables), when everybody is done, after the set rounds, or when everybody left.',
        'The end screen shows the trophy, the ranking, the goals ticked and what the game did to your rating.',
      ]),
    ],
  },

  modes: {
    nav: 'Rules and modes',
    title: 'Rules and settings in detail',
    blocks: [imp(12, undefined)],
  },

  ranking: {
    nav: 'Ranking and rating',
    title: 'Your rating and the leaderboard',
    blocks: [imp(11, undefined)],
  },

  profile: {
    nav: 'Profiles and fact table',
    title: 'The profile of a player and the fact table',
    intro: 'Every person and every bot on the leaderboard has a profile. Tap a name to open it.',
    blocks: [
      cards([
        {
          icon: '📈',
          title: 'The rating line',
          text: "How the rating moved: **from 1500** (or the bot's base rating) over every ranked game, with the place and the change of each game.",
        },
        {
          icon: '🔢',
          title: 'The counters',
          text: 'Games, table wins, average place, goals reached, bankruptcies, best rating.',
        },
        {
          icon: '🧮',
          title: 'The fact table',
          text: 'What the games came to in the four places of the method, as a **total** and an **average per game**.',
        },
      ]),
      table(
        ['Place', 'What it counts'],
        [
          [
            '**Grow**',
            'Cards bought and sold, holdings at the end, share lots, properties, businesses and hustles, pension plans, courses and degrees, money put into cards.',
          ],
          [
            '**Fire**',
            'Whether the reserve was full and how much it was, debts repaid and left, the Bank loan, emergencies paid and what they cost.',
          ],
          [
            '**Smile**',
            'Life dream lived, dreams lived and their money, dreams still open, money saved for dreams, dream points.',
          ],
          [
            '**Income**',
            'Independent or not, passive income, salary, cash flow, living costs, what the cards earned, net worth.',
          ],
        ],
        'Games played before the fact table existed have none and are not counted in it.',
      ),
      tip(
        'Use it',
        'Open the profile of the best bot and compare its fact table with yours: it shows what a winning life looks like - how many cards, how early a full reserve, how much the cards earned.',
      ),
    ],
  },

  bots: {
    nav: 'The bots',
    title: 'The bots: who they are and how they were made',
    intro:
      'The bots are not scripted. Each one is a **strategy** at a **skill level**, its numbers were found by simulation, and it is rated like a person.',
    blocks: [
      h3('Strategies'),
      table(
        ['Strategy', 'In one line'],
        [
          [
            '**Expert**',
            'Reserve first, then cards that pay every month, sells into good windows. The best all-rounder.',
          ],
          [
            '**Sapling**',
            'Lives on businesses and hustles from the middle pile; never property. The champion of the champions of the first calibration.',
          ],
          [
            '**Tree**',
            'Free savings first, then only Trees. Slow but strong at the top of the tournament.',
          ],
          ['**ETF**', 'A world ETF and bonds for the steady part.'],
          ['**Property**', 'Rented flats and a mortgage.'],
          ['**Dividend**', 'Dividend shares from all piles, reinvested.'],
          ['**Hustler**', 'One side hustle after the other, reinvesting every month.'],
          ['**Steady**', 'Three months of cash, no risky card.'],
          ['**Dreamer**', 'Puts the dream and its points first.'],
          ['**Saver**', "Savings and the employer's money; few risks."],
          [
            '**Gambler**',
            'Crypto, hype and hot tips. Almost never wins, but it makes the table lively.',
          ],
          ['**Passive**', 'Takes almost no decision. A baseline for the others.'],
          [
            '**Flipper**',
            '**Sell, step up, repeat**: sells what has gained to buy something bigger, and clears a loan by selling.',
          ],
          ['**Scholar**', "The employer's money, the pension and the courses first."],
          [
            '**Coach**',
            'The demo bot: plays a fixed, friendly game so the guided tour is always the same.',
          ],
        ],
      ),
      h3('Skill levels'),
      p(
        'The same strategy at four levels: **master** (plays it cleanly), **strong** (slips 10% of the decisions), **casual** (25%) and **beginner** (45%). A bot is called `strategy` or `strategy--level`. A beginner sits low on the leaderboard, a master near the top.',
      ),
      h3('Everything the bots can do'),
      p(
        'The bots know **every capability of the game**: choosing a pile and a card, planning and buying, taking free savings and pensions, courses, funding the reserve and dreams, payment plans, insurances, repaying debts and the Bank loan, selling into market windows, to buyers and on hypes, riding or cashing out a hype, selling to step up, selling to clear a loan, trading with other players, and emergencies and life cards. One capability, **planning a purchase for later**, no bot uses yet.',
      ),
      h3('How the strategies were found'),
      steps([
        {
          title: 'Capabilities',
          text: 'A list of everything a player can do is checked by a test: a new move cannot be forgotten.',
        },
        {
          title: 'Relearn',
          text: 'For every strategy a search moves one to three knobs at a time (how much cash to keep, how fast to plan, how much to risk, when to sell ...) and plays thousands of solo games on random characters, difficulties and maps. A change is kept only when it is better **by a clear margin on fresh games**, so a run that finds nothing leaves everything as it was.',
        },
        {
          title: 'Tournament',
          text: 'All bots, every strategy at every level, play thousands of tables of four against each other on each difficulty and are rated with the same Elo as the leaderboard. A new bot starts at 1500 and travels to its place.',
        },
        {
          title: 'Gauntlet',
          text: 'The six best masters meet again on fresh seeds; the one that wins most tables is the **champion of the champions**.',
        },
      ]),
      note(
        'The first full calibration (2026-11-06)',
        '183 minutes; 13 of 14 strategies found a stronger version (ETF 27% to 66% wins, Tree 22% to 50%, Dreamer 32% to 57%, Saver 7% to 31%). On the tables the top was Tree, Sapling and Expert; **Sapling** is the champion of the champions with 33% of the gauntlet tables. The numbers are in the last section.',
      ),
    ],
  },

  strategy: {
    nav: 'Strategy',
    title: 'Strategy: how the game is won',
    intro: 'The knowledge of the simulation, in the order a game goes.',
    blocks: [
      steps([
        {
          title: 'The first months: free money and a reserve',
          text: "Take the **Seed saving cards** (a cheaper phone plan, electricity, a job ticket, an audit of subscriptions): they cost nothing and lift the month. Take the employer's savings plan and a company pension when the month can carry them. Put free money into the **reserve** until it covers three months.",
        },
        {
          title: 'A first income',
          text: 'A side hustle or a small business (Seed and Sapling), a world ETF or dividend shares, a room rented out. Only a few side hustles can run at a time. A card that pays every month beats one that only might rise.',
        },
        {
          title: 'The debts',
          text: 'Repay the starting debts when the cash allows; a debt with interest first.',
        },
        {
          title: 'Step up',
          text: 'Sell a card at a good price and buy a bigger one from the Sapling or Tree pile. **Sell, step up, repeat.**',
        },
        {
          title: 'Raise the pay',
          text: 'A course or a diploma costs now and raises the pay after a few Paydays by a die. Worth it early; keep the reserve.',
        },
        {
          title: 'The dream',
          text: 'Fund it with what is left, with a plan per Payday. Take dreams for the points only when the income carries part of it.',
        },
      ]),
      cards([
        {
          icon: '✅',
          title: 'Take',
          text: 'Free savings, employer and state benefits, ETFs and dividend funds for the steady part, businesses and properties whose cash flow covers their loan, anything with a payment you can check.',
        },
        {
          icon: '🚫',
          title: 'Leave',
          text: 'A **fixed high return** (a weekly interest), a **hot tip**, a **pre-IPO** share, a **timeshare**, a **trading-signals course**, a coin nobody knows. They look like any card but are scams; the more it promises for how little, the less true it is.',
        },
        {
          icon: '⚠️',
          title: 'Be careful with',
          text: 'Crypto, collectibles and hype (they swing and pay nothing monthly), and a Tree card bought with a Bank loan.',
        },
        { icon: '⛔', title: 'Never', text: 'Keep a Bank loan open when the cash could repay it.' },
      ]),
      imp(13, undefined),
      tip(
        'Judge in the light of the character',
        'A surgeon on Hard wins about 3 in 100 simulated games; a bus driver on Easy over 80. A score is not comparable across characters, a **pace** is. See "The characters".',
      ),
    ],
  },

  agents: {
    nav: 'Agents and the API',
    title: 'For agents: coaching and playing through the API and MCP',
    intro:
      'An AI agent connected to your account (through the MCP server or the API) can watch a table, guide you, explain cards and, if you ask, play your seat.',
    blocks: [
      table(
        ['Job', 'Tool', 'What you get'],
        [
          [
            'Watch',
            '`table_review`',
            'A small page: who leads, goals in percent, pace against the simulation, dangers, markets that moved.',
          ],
          [
            'Guide',
            '`table_advice`',
            'Your goals, your money, the moves a strategy would make now and why, what to keep in mind.',
          ],
          ['Explain', '`dream_cards`', 'Every printed card of every pile.'],
          [
            'Play',
            '`table_autoplay`, `table_move`',
            'A strategy plays your seat for a while, or one move you choose, through the rules.',
          ],
          [
            'Leaderboard',
            '`dream_leaderboard`, `dream_my_player`',
            'The board and your rating and recent games.',
          ],
        ],
      ),
      warn(
        'You stay in charge',
        'An agent plays only when you ask it to. Everything it sends is a normal move that the table sees as yours, and the server refuses what the rules do not allow. Ask it to tell you what it played.',
      ),
    ],
  },

  faq: {
    nav: 'FAQ',
    title: 'Questions and answers',
    blocks: [
      {
        type: 'glossary',
        items: [
          {
            term: 'I am stuck. What should I do now?',
            text: 'Look at the goals: the lowest bar is your task. Without a reserve, fund the reserve. Without income, take free savings and a first hustle. Then ask for the **demo game** or an agent for advice.',
          },
          {
            term: 'Why did the card say "lucky" and draw another?',
            text: 'The card needed something your life does not have (a car, a child, a partner). It is told, put back, and the next one is drawn.',
          },
          {
            term: 'Why can I not sell this?',
            text: 'Savings, plans and courses cannot be sold. A scam can be sold only at the last exit its card gives. Everything else sells at any time at the standing price.',
          },
          {
            term: 'I planned a card and lost it.',
            text: 'A planned card is only buyable while it is in hand: the offer is gone when your turn ends (a setting allows up to 3 turns). The project closes with a note "Chance missed".',
          },
          {
            term: 'My cash flow went negative.',
            text: 'A negative monthly cash flow means **bankruptcy**: the game ends for you. Watch the money panel before a card that adds a cost.',
          },
          {
            term: 'Why did my rating not change?',
            text: 'The game was not ranked, had no person at the table, ended before 8 rounds without a winner, or was not finished. The end screen says why.',
          },
          {
            term: 'Can I play without other people?',
            text: 'Yes: open a table with bots only (a table needs two seats). Pick the bot **Coach** for the guided demo.',
          },
          {
            term: 'Where is the demo game?',
            text: 'The **Demo** button at the top right (signed in with a game account), the entry **Learn the game** in the Dreamfund lobby, and the bot **Coach** (seat it at any table of one person). It is never ranked and never kept in your history.',
          },
          {
            term: 'Can I change a booking?',
            text: 'The category, the time and the account of a booking and the account a payment is paid from can be edited any time; the amount, the date and the comment belong to the game.',
          },
        ],
      },
    ],
  },

  glossary: {
    nav: 'Glossary',
    title: 'Glossary',
    blocks: [
      {
        type: 'glossary',
        items: [
          {
            term: 'Bank loan',
            text: 'Money the Bank lends automatically when a payment is bigger than your cash: 10% a month.',
          },
          {
            term: 'Bucket',
            text: 'One price of a Smile project (flights, hotel ...) that you fill.',
          },
          {
            term: 'Cash flow',
            text: 'Income minus expenses per month. Negative means bankruptcy.',
          },
          {
            term: 'Cost of living',
            text: 'The expenses that do not stop with the salary (without income tax and social insurance); independence compares the passive income with it.',
          },
          { term: 'Dream Taler (DT) / Traumtaler (TT)', text: 'The money of the game.' },
          {
            term: 'Fire',
            text: 'The account of what must be paid; home of the reserve and the emergencies.',
          },
          { term: 'Grow', text: 'Your investments: every card you take is a Grow project.' },
          {
            term: 'Harvest',
            text: 'The market cards: indices, windows to sell, buyers, hypes, scams.',
          },
          {
            term: 'Index',
            text: "A market's price level, 1.00 at the start, drifting at every Payday. A holding is worth its card price times the index.",
          },
          { term: 'Mojo', text: 'Your reserve of three months of living costs.' },
          { term: 'Passive income', text: 'What your cards pay every month without work.' },
          { term: 'Payday', text: 'A month: salary in, bills out.' },
          { term: 'Plan', text: 'A monthly payment into a project; stopped with 0.' },
          {
            term: 'Rating',
            text: 'Your Elo-style rating: 1500 at the start, one list with the bots.',
          },
          { term: 'Smile', text: 'Your dreams: every dream is a Smile project.' },
          { term: 'Totem', text: 'Your token on the map.' },
          {
            term: 'Window',
            text: 'A Harvest card that opens a market for selling for some turns.',
          },
        ],
      },
    ],
  },

  numbers: {
    nav: 'The numbers',
    title: 'The numbers: statistics of the simulated games',
    intro:
      'Written by the simulation itself after every run. Everything on this page is for the Normal level unless it says otherwise.',
    blocks: [imp(14, undefined)],
  },
};

module.exports = {
  title: 'Dreamfund (Traumtopf) - the manual',
  subtitle:
    'The whole game from the screen to the bots: every move, every card, every setting - and a guided demo game that plays the first rounds with you.',
  order: [
    'welcome',
    'firstgame',
    'screen',
    'aim',
    'money',
    'characters',
    'life',
    'map',
    'turn',
    'opportunity',
    'harvest',
    'emergency',
    'lifecards',
    'career',
    'dreams',
    'notes',
    'selling',
    'tables',
    'modes',
    'ranking',
    'profile',
    'bots',
    'strategy',
    'agents',
    'faq',
    'glossary',
    'numbers',
  ],
  sections,
};
