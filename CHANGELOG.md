## [1.32.0] - 2026-11-07

### Features

- feat(stats): the charts call the Smile account Dream; the account charts of a Dreamer game mark Opportunity, Harvest, Life, Emergency and Career events beside the Bank loan and Doodad markers
- feat(ui): the Smile account and its projects are called Dream everywhere on screen, in all six languages; the game Dreamfund (Traumtopf) is renamed Dreamer (Träumer)
- feat(game): the person throws the career die themselves, with the same tumbling die as every other card (roll_career); the demo coach guides the throw
- feat(game): the coach follows the person through the whole app - Grow, Fire, Smile, Subscriptions, Menu - waits for the page, ends with Finish or one Stop
- feat(game): the manual's example projects are the real Grow, Fire and Smile info panels, read only, in the grid of their page; the bot list shows Coach last in one compact row; the demo overlay no longer takes touches (phone scrolling)
- feat(game): the manual shows example cards, two example projects to open and Jonas's career ladder, and explains emergencies and dreams more; the demo coach is lighter, lit places fit the screen, the bot panel closes by itself and has a Done button, and the first two turns highlight the real buttons
- feat(game): a new game account chooses between the normal welcome tour and the guided demo; the Demo button starts the guided demo for a game account; the lobby buttons stay in one row and shrink to their pictures
- feat(game): the coach of the guided Dreamfund demo - a lit-up walk through the lobby, the new-table panel, the waiting room (seat Coach), meeting Jonas, the game screen and the first rolls, with Do it for me, skip and Stop tutorial
- feat(game): the guided demo game on the server - Coach, a bot that turns a table of one person into a fixed, never ranked, never kept demo whose dice and cards come out the same every time
- feat(game): first full calibration - champions for the 13 types that gained, ratings of every bot, sapling the champion of the champions
- feat(game): a player's profile on the Dreamfund board shows how the rating moved from the start and a fact table of Grow, Fire, Smile and income
- feat(game): the Dreamfund bots know every capability and are tuned by a search that relearns from the last champion
- feat(mcp): an agent can guide and play a Dreamfund seat - advice with the next moves and why, every printed card, a strategy plays the seat for a while, the hand edits, a coach prompt and a strategy guide
- feat(game): a tax on the profit of a sale (a table setting, 26.375% by default, off with 0), pensions and employer benefits you pay into, courses and degrees that raise your pay, and windfalls in the Life stack
- feat(game): at a Dreamfund table a player can change what does not change the game - a booking's category, time and account, the account a payment is paid from, the phase of a project (back, any phase, forward) - and Done on an Opportunity nobody took is the same as passing
- feat(game): every Opportunity card gets how to invest, a tip with a do and a don't, its risk with the reason, checked links and tasks; Grow shows an open sell offer with its price and the turns left
- feat(game): every holding gets buyers on the Harvest cards, with dice for the price, offers that stay open for a table setting, and scams with a last exit before they close
- feat(game): the Yin Yang map - a circle with an S through it; every player walks a whole side (white: the S and the left half, black: the right half and the S the other way), the S and its Paydays are common ground, the two dots show the players of each side with their pictures; offered after the infinity
- feat(game): the map choice is one row that scrolls sideways, in the table setup and the solo setup, so more map types never make a second row
- feat(game): the Life stack grows from 27 to 75 cards and is balanced - love, family, work, money, home, pets, cars, study; as many lifts as blows, a way out of a job loss, and the money of a card is felt by the character's price level in both directions
- feat(game): a map for the life dream alone has one Emergency tile more in place of an Opportunity tile, so playing without the Smile tiles is not easier
- feat(game): the host of a table sees the map dealt and can deal the tiles again (Another layout), as in a solo game; the layout seed is a table setting and everybody plays that map
- feat(game): every die rolled for a card flies into the card: it lies on its number for a couple of seconds, then moves smoothly to a small die beside the result line and stays there while the card is open (also after Grow/Fire projects), for Emergency, Life, Career, Opportunity and Harvest, solo and at tables
- feat(game): the table setting has the currency (the game's own, or €, $, £, ¥, CHF) beside the language; it follows the table's language into the screen's currency
- feat(game): a solo game has the options and the full catalogue of a table: all eight insurances on offer (chosen for the start, or hopped in later; a game saved before is given them), the dream points goal (or the life dream alone, a map without dream tiles), one or two dreams at a landing, the Bank loan step; the insurance dialog before the start lists the choices
- feat(game): two more insurances - disability (40 a month) and travel (8) - with their cards (the Emergency stack has 114), more cards for the legal protection and the dental top-up, and a measure of what each premium saves: every insurance saves more than it costs for every life it applies to
- feat(game): the Emergency stack doubles to 100 cards: the first 50 get descriptions, bucket notes, links, actions and a tip, the insurances are corrected (dental, bike, tiers); 50 new cards for the car, the law, health, income and every kind of life - fixed, dice, choice and several costs, to pay at once or on a plan - with a fairness spec
- feat(game): the Mojo project names the finance books (Barefoot, Ramsey, Orman, Housel) and German advisers, with a note and a link for every month of the reserve
- feat(game): the Fire project of an Emergency card is filled in as the project of a dream (description, bucket notes and links, actions, a tip or fun fact), in the solo game and at a table; the card shows how its cost is found, when it is paid and which insurance limits it; a card can set its own deductible and cost more without its insurance
- feat(game): every one of the 96 dreams ends its notes with a tip against a known trap or a fun fact, in English and German
- feat(game): a Dreams block in the advanced settings of a table: dreams at a Smile tile moved there, and a new setting for how many dreams a player can have open at once (no limit, 1-6, 8, 10; default 3)
- feat(game): 48 more dreams (D49-D96) in all nine categories, from small to huge (up to 480,000), each with description, bucket notes and links, actions and notes in English and German; the deck has 96 dreams
- feat(game): all 48 dreams and the life dreams of all nine characters carry description, notes and links per bucket, links, action items and notes (English and German)
- feat(game): Add on the grid card of a Smile or Fire project prefills the remaining amount like Pay; the dream points badge sits in the upper left corner of the info panel
- feat(game): dream points shown on the info panel and the card of a project and as a badge of the character (points of the goal); the add button of a Smile or Fire project stays in a game with others; a project made from a dream card is filled in with description, notes and links per bucket, links, action items and notes (first eight dreams)
- feat(game): a game can be played for the life dream alone (no Smile tiles, the Opportunity tiles take their place) or for dream points as well (default 10, a lobby setting) which is a goal of the win; a landing offers one, two, or one or two by chance
- feat(game): where the character may be chosen the first decision is the list of characters of the game on its own (name, who, cashflow, lowest first); a click shows the details, Choose another character goes back to the list
- feat(game): the popup of another player's card is a small version of it (pile, the numbers that matter, the first sentence); the card that opens from it, the latest line or the history is the full card with the player's own costs, insurance and the chances of its dice; no month strip; player names with room for their frames
- feat(game): every player is dealt a character at the start and reads it first; another can be chosen there from a list (not where the characters are drawn), Back from the insurances always returns to it; no picking in the lobby; the insurances stand alone at the start
- feat(game): insurances as one list with details that open below (price before the switch, total, Done), only liability, household, legal, dental and the car covers offered to everybody; debug panel as a content-sized dialog with tile symbols, card grid with key facts, quick filters and stacks; loading a card cancels what is left of the card before; buttons of the new screens centred
- feat(game): insurances are a decision of their own (catalogue by priority with cost, cover and effect on cards; reopened any time from a button; hop in or out at once on the bill of the next Payday; one car insurance only); debug game loads any card from a button on the card or the debug button of the screen, mocks a Payday and a career step; a Harvest card holds the end of the turn until each affected player says Continue; lobby: debug last, Bank loan step 1000 default, no turn gate; centered briefing buttons
- feat(game): an active payment plan of a project is listed as an active subscription at a table and counts as saving; pausing or deleting the plan removes it
- feat(game): debug games where the host chooses the card of a tile; the player throws the dice of a bought card and of the job search; the Bank loan step and interest are settings and a refused repayment says why; emergencies become Fire projects only and the payment plans of the app run at a table; transparent popups and history links for the cards of others; shuffle at a table; life choices are sometimes forced
- feat(game): the card keeps its full text after it is taken, a card with a die waits for the throw, the Grow project carries what the card tells (type, risks, links, tasks, the saving) and its notes are worded in the language of the screen; cat and dog happen; no buying more from the balance sheet; the briefing follows the theme
- feat(game): every player reads their character and chooses the insurances before the first roll; tokens stay where they stand (a life that did not change is not sent again); payback button for debts at a table; Jonas starts without a car; badges Car and Study with a closable card and an insurance summary; the budget lines in the language of the screen
- feat(game): an emergency at a Dreamfund table can become a Fire project that is paid from its page, as alone; the turn waits for it in the guided and strict game
- feat(game): Dreamfund tables play like solo - investments are planned in Grow first and bought from there, every draw and decision of a player is told with its card (history and popups open the card), ranked comes before the rules
- feat(game): the life attributes and the insurances at a Dreamfund table - Jonas in a shared flat and in education (ends at career stage 2), per-character starts, five cards bound to children / partner / study, flat emergencies bound to the home, per-character insurance prices, car insurances offered with a car, the choice before the first roll, the attributes explained in the app and in the manual
- feat(game): Dreamfund table fixes - the die card shows what each number does and keeps the result, opponent tokens on the map, ranked is always strict, characters read before choosing, one Payday line per round, the money moves through the app's own pages instead of the money panel
- feat(game): one Dreamfund ranking for people and bots, the difficulty as the stake (gains x0.7 / x1 / x1.5), the leaderboard with the lobby's game switch and no difficulty tabs, the points explained in the manual; fix: the account picture at Dreamfund seats and in the lobby
- feat(game): the end of a Dreamfund table on the classic end screen - the ranking and what it meant for the rating, and the game filed in the saved games with the Mojo, the dreams and the reserve (slice R6)
- feat(game): the table things at a Dreamfund table - the other players' moves told in popups and the history, the right map for their tokens, trading and the Harvest options from the money panel (slice R5)
- feat(game): the player's own money at a Dreamfund table - fund the reserve and the dream, repay debts, plans per Payday, settle the month, from a panel on the table layer (slice R4f)
- feat(game): the Opportunity and Harvest tiles at a Dreamfund table on the solo screen - pile and cards, buying with the dice thrown by the table, the Harvest card drawn for everybody with what may be sold (slices R4d and R4e)
- feat(game): the Career and Dream tiles at a Dreamfund table on the solo screen - the die and the promotion, the branch to choose, the dreams on offer, a dream taken or left (slice R4c)
- feat(game): the Emergency and Life cards at a Dreamfund table on the solo screen - the table rolls the dice and keeps the choices, the card pays now or on a plan, a dealt card stays on screen with what came of it (slice R4b)
- feat(game): rolling at a Dreamfund table on the solo screen - the roll tells its dice and the token's way, the Dreamfund driver, the stack tiles on, the drawn card written into the turn (slice R4a)
- feat(game): a Dreamfund table opens on the solo screen - one room page for both games, the table followed in the classic shape, every seat's life on screen through the bridge (slice R3 of the Dreamfund on the solo screen)
- feat(game): the bridge from a Dreamfund life to the app - Mojo, the dream and the dreams taken as Smile projects, the reserve and the emergencies on a plan as Fire projects (slice R2 of the Dreamfund on the solo screen)
- feat(game): one multiplayer flow for both games - the classic lobby, create-table panel, waiting room and leaderboard now take the Dreamfund as a game choice; Dreamfund bots rated around 1500 with the best near 1700; profile pictures at Dreamfund seats
- feat(game): bot tournaments for the Dreamfund - headless tables of bots rated with the board's Elo, the starting rating of every strategy at every skill level and difficulty from 1300 tables each, bots known to the board at startup (slice 9 of the multiplayer)
- feat(game): the Dreamfund leaderboard - a board of its own with one rating per difficulty, bots seeded from the map, goals and dream points in the result (slice 8 of the multiplayer)
- feat(game): the Dreamfund tables screen - a lobby with the solo game's settings and the table's own, a waiting room with bots of four levels, the table with every life in numbers, your turn's decisions, your money, trades and the result (slice 7 of the multiplayer)
- feat(game): the four skill levels of a Dreamfund bot - master, strong, casual, beginner - as in the classic bots
- feat(game): an agent can watch a Dreamfund table on demand - a small review page (goals, pace against the simulation, what to watch), the table kinds in the API and the MCP, and a guide for agents (slice 6 of the multiplayer)
- feat(game): the Dreamfund as a room - the lobby, clock, log and live channel of the classic table serve both kinds, with the Dreamfund's commands, view, strategy bots and legal actions (slice 5 of the multiplayer)
- feat(game): trading at a Dreamfund table - an Opportunity card offered to the others for a fee, counter offers, a standing sale, and bots that answer and offer (slice 4 of the multiplayer)
- feat(game): bots at a Dreamfund table - the simulation's judgement is shared, a bot plays with the commands a person sends (slice 3 of the multiplayer)
- feat(game): the Dreamfund table - lobby, settings, seats, characters, turns on a clock, a shared Harvest market, goals and ranking (pure rules, slice 2 of the multiplayer)
- feat(game): the final map of the Dreamfund (200 games per strategy, character and difficulty), balanced characters, and the map as a topic for the MCP
- feat(game): nine new characters in three difficulties, a difficulty choice, the map of every character, strategy and difficulty, and an analyst that compares a game with its own character
- feat(game): a character's price level scales the Opportunity, Harvest and Dream cards, and the German pay of a salary is worked out from its gross
- feat(game): the character grid offers only the edition's own characters, the old test professions are gone from it

### Bug Fixes

- fix(game): on the Yin Yang map the tokens stay on their own side of the S all the way (white on the white side, black on the black side) instead of jumping from one side of the tiles to the other where the S bends
- fix(game): on the Yin Yang map the two players start on opposite sides, each on the first tile of their own half of the circle, walk it, and meet on the S
- fix(game): the Paydays of the Yin Yang map are spread evenly round each track (some on the common S, some on the own half), and the pictures in the two dots are 20% smaller so the colour shows
- fix(game): the buttons of a decision panel share the row by what is shown, so a single button (no Pass) uses the full width
- fix(game): a Life, Fire or Harvest card cannot be left without opening it: Done and End turn wait until it was opened (and dealt with)
- fix(game): money for a dream goes to the dream asked for and is booked under its name; a short account takes the Bank loan for dreams, emergencies and the reserve; paid projects stay as completed (planning, saving, completed); the Add dialog of a project never keeps the last amount; tile pictures cut to their circle
- fix(game): the insurance badge and its card count what the player has chosen; a chosen character goes straight to the insurances, only a drawn one is read first; debug symbol above the card
- fix(game): loading a card in a debug game puts the turn at the card of that tile (token on the tile, card open) so the screen jumps to it and no roll is asked for

### Performance

- perf(api): every query of the leaderboards, the audit trail, the community and the saved games is answered from an index or a view (boards and results by player as views, threads and posts and audit entries newest first from time indexes); a test fails on any query that reads every document
- perf(game): housekeeping of the game database runs on its own timer in small batches, not in a request; the history of finished tables is compacted after a while; every query of the game store is tested to use an index; debug symbol of a card at the height of the back button
- perf(game): an index for the rooms by phase: the clocks and bots and the count of open tables no longer scan the whole game database (2-3 s each, 30 s to create a table)
- perf(game): a move of a table no longer scans the whole database for seat markers (2 s to 40 ms): markers are indexed and only written when somebody sits down or leaves; pages and panels are preloaded at a table; the shuffle plays once per card; bank loan and time are advanced rules, bot speed fast; insurance as a small switch; no passing of Harvest, Life and Emergency cards
- perf(game): a Payday re-encrypts only the moved dates of the transactions, not every field of every row
- perf(game): a long Dreamfund game no longer chokes on its own history - a Payday's moved dates are stored once, the plan is kept as a list, steps are encoded once, the browser's copy is bounded and unchanged books are not encrypted again

## [1.31.0] - 2026-10-26

### Features

- feat(game): Settings in the solo game (notifications and map messages), the independence badge states the cost of living it compares, a Dreamfund game review for the analyst and the MCP, and the guide for agents
- feat(game): the notes of a project carry the facts and numbers - what a payment cost with the cash before and the loan, what a buyer or a window offers, every step of a hype, a sale with its payout and the cash after, a dream moment before and after
- feat(game): there is always a way to sell - the market price less a discount from the Sell button of Grow, when no market card offers a window or a buyer
- feat(game): the Dreamfund game guide in the app (English and German, with the statistics of Jonas), and selling what the cards made from Grow at the open offer of a market card
- feat(game): a win screen and the independence badge, Sapling businesses balanced down, twelve simulated ways of playing, and the Dreamfund game page with the statistics of Jonas
- feat(game): richer deals and a clear view of what runs on the account
- feat(game): Opportunity and Harvest cards share one look and the same words, a planned card opens in Grow and is only buyable for as many turns as the setting says, and the totem stands on the line through its tile
- feat(game): balance the Medium Dreamfund economy with the simulation - two offers per landing, three side-hustle slots, stronger business, hustle, rent and dividend numbers in a tuning layer, independence ignores salary-linked tax, bots plan with payment plans, dream moments and projects
- feat(game): an Opportunity card is planned as a Grow project first - the player chooses how many units to buy in Grow with no limit from the card, sees what they have in cash and would have to borrow in the notes, buys with Grow's Buy and sells with Grow's Sell; the Harvest cards make the offers a sale works with
- feat(game): the difficulty logic of the Dreamfund game (Easy, Medium and Hard, kept out of the setup until the numbers are tuned), the end of a Dreamfund game only by bankruptcy, and a simulation of whole games with six bot strategies, a command to run it and a report of wins, bankruptcies, the turn each goal was reached and what each card was worth
- feat(game): the Harvest tile with its 87 cards - markets with an index that drifts at every Payday, shares and assets priced by it, windows to sell in, buyers for shares, property, businesses and collectibles, hype ladders, scams revealed, and cash flow events for the businesses and properties from the Opportunity cards
- feat(game): the Opportunity tile with its 98 cards - a choice of Seed, Sapling or Tree, up to three offers, shares in units, savings applied to the expenses, properties and businesses with their loans, side hustles with a limit and a swap, traps that look like normal offers, and every card becoming a Grow project once it is paid in the Add dialog
- feat(game): stack tiles open from a small decision panel into one stable card view, card costs are paid in the Add dialog, strict mode lets dreams be declined, every card move is a History step, and the bank loan covers every payment with its interest as a setting
- feat(game): Custom JFK rules with free, guided and strict modes of its own, the card lying over the whole wheel with a shuffle, the reserve linked to the Mojo, start traits and insurances chosen with the character, new projects opened at once, a less likely first promotion, and the career tile can no longer trap the game
- feat(game): one card flow for every stack tile (open, find or shuffle, deal with it, seen dice), a career ladder card, dreams side by side, life events that may be refused or not by a game setting, the profile with how to win first, a live reserve of three months of expenses, and the life dream and reserve set apart in the Smile and Fire lists
- feat(game): the token stands inside the map beside its tile, the Payday lights up in the Latest line above the map instead of covering it, and one Career tile gives way to an Opportunity
- feat(game): emergencies become Fire projects settled with the app's own tools, and the Life, Career and Dream stacks play on their tiles (36 life cards, the Dual Student's nine career stages, 48 dreams and 8 moments), with a price level per character
- feat(game): the Emergency tile draws one of 45 cards (English and German) that is paid now or on a plan as a Fire project, with insurance that limits it to a deductible and can be hopped in and out at a Payday
- feat(game): the maps hold more Career chances and Opportunity as the most common tile, with Dream and Emergency a fifth of the map at most
- feat(game): maps never turn (an infinity stays an infinity), START is a pad above the map, tokens stand at the corner of their tile, fewer fire and smile tiles and one career tile, insurances paid from Fire and treats from Splurge, expenses shown red with a minus, and the game tag is #dreamfund (old #cashflow still read)
- feat(game): the emergency reserve of three monthly expenses is a protected Fire project and a condition of winning, the dream is checked off when full, characters are listed by monthly cashflow, and the lobby, setup and tables lists no longer lose clicks
- feat(game): Dreamfund maps - five shapes in three sizes with seeded layouts, the new tiles (Dream, Emergency, Opportunity, Harvest, Life, Career) with their colours, icons and a filler card each, and the board choice in the setup
- feat(game): the currency is chosen in the setup after the language (the money of the game by default), and the dream project cannot be deleted
- feat(game): the dream is a Smile project from the first day, looked at read-only before the game and opened in the Smile page during it, and payment plans in Paydays that are paid at every Payday
- feat(game): the game is Dreamfund / Traumtopf with Dream Taler / Traumtaler, one character view for the setup and the running game with a winning checklist, the income statement biggest first, the IOTA as 3.705 coins
- feat(game): the character grid and a chosen character with three financial panels, the advanced rules in the look of the table settings, and the dual student on a 34.000 gross salary with German tax and social lines, finer living costs, 500 a month
- feat(game): the game is offered in English and German only for now - one list to widen when the other four languages are done
- feat(game): a new-game setup in the groups of the table panel (language, how to play, edition, rules), then a character page - and the custom edition with its first character, a dual student with a story, a dream and a monthly budget
- feat(ui): a spinner while a card action or a subscription change is worked out - the card or the update window closes first
- feat(game): Payday popup steps aside for a Latest line, the dice action shows rolling with skip, the profession panel gets Cashflow, Income Statement and Balance Sheet sections with links to Grow, Smile and Fire
- feat(tables): a switch for the small pop-up messages while playing a table game
- feat(ui): redesigned table lobby and waiting room - open tables as cards with the players already seated, filters, settings visible to all and editable by the host, seat cards with picture and rating that open the leaderboard stats, a bot picker with skill levels
- feat(rooms): who sits at a table - seat previews in the lists, GET /seats, bot player ids and table-mates' pictures for the lobby
- feat(ui): the period of the shared filter as in the statistics (week, month, quarter, year, all, custom - dates only for custom); the rules of a new table behind Advanced; Lobby is just Lobby
- feat(cashflow): quick period filter (week, month, quarter, year, all) with arrows through the time series, on the Cashflow and the Income pages
- feat(game): every card in a message or a line of the history opens, to be read, with a way back; the Joker icon is gone
- feat(game): the Payday banner comes when the token gets there, and it is redesigned (coin header, income / expenses / cashflow tiles)
- feat(tokens): the token list is a list of cards on phones, with big buttons for revoke and delete
- feat(leaderboard): every game of a player opens at its table; finished tables stay readable for three months and for anyone with a game account at a public table
- feat(tables): a new table in a few taps - optional name with a dice, wheels for the numbers, one line for every setting, short bot ideas and plain skill levels
- feat(tables): every move at a table waits in one line, in the order it arrived, and is judged against the table as it is then
- feat(tables): a card on offer opens as a card for every player who may answer it, places and out-of-game marks on the player chips, a setting for free rounds when leaving
- feat(game): bots finish a game at full speed when only they are left, leaving a ranked game is a loss, a deeper tie-break, offers that cannot bankrupt anybody and bots that trade realistically

### Bug Fixes

- fix: patch brotli-libs CVE-2026-111497 in the frontend image
- fix(game): the effects badges in one scrollable row, the Payday banner over them instead of a permanent "latest" line, and one badge per card
- fix(game): the player throws every die of a bought card, tokens point to the middle of the map on a ring, the effects strip says "for good" with the currency, and a missing rules hint
- fix(game): card titles of several words in Grow trades, dice tables on every dice card, the German of all card texts, savings counted, the totem on its line
- fix(game): employment keeps its briefcase and the career chip uses the symbol of the Career tile
- fix(game): the character chips sit in one row (symbols only on a small screen, the insurance chip leads to the hop in and out), the career chip is called Career with its own symbol, and the first roll no longer makes the page scroll sideways
- fix(game): strict rules only let money into a project or the Mojo, the Bank loan is worked out from what is really paid, the infinity token stands inside its loop, and the History says in words what each card move did and lets every card be read again
- fix(game): paying into a Smile or Fire project or the Mojo is always allowed, the budget plan drops what earlier games left behind and plans only the subscriptions, more room above the shuffling text, and the way back from a card reads Back
- fix(game): payment plans count in the cashflow and the income statement, a paused plan shows as an ended subscription on the game's own calendar and a restarted one runs the Paydays it has left, finished plans end by themselves and deleted plans take their subscription along, and the reserve project is called Mojo and follows every payment into it
- fix(game): a life card never takes the monthly cashflow below a quarter, paying into a project of the game is allowed under strict rules and fills in the amount, a played stack tile only offers Done, fewer and better spread Career tiles, a card search, and no more notes about cards that went back
- fix(game): a saved Dreamfund game is read back whole (life, career, dreams, insurances, the card on the tile, the budget plan, the marks of the dream and reserve projects), the traits sit under the profession with a small card each, and the game money is on again after a reload
- fix(game): payment plans may only take what the month has free, so the cashflow never goes into the red
- fix(game): the character preview shows its numbers in Dream Taler or Traumtaler, as the game will
- fix(ui): the Latest line keeps its one-row place so the wheel never moves, and the table's short notices hang over the wheel with an x
- fix(game): the drawer of a stock price card can buy at its price as well as sell, at a table
- fix(settings): opening Personal Access Tokens closes the settings window
- fix(tables): the new-table panel keeps its rows short and the wheel's marker sits on the middle number
- fix(auth): a new account never shows an error for its first data, and a family behind one router can create accounts
- fix(tables): the offer panel reads the language through a public getter (the self-hosted build failed on a private field)
- fix(game): a player who left commands nothing, a game of bots has a round cap, only the rules' refusals mean cannot afford, the offer panel can be revised
- fix(game): the new management system helps only the player who drew the card

### Performance

- perf(game): the totem moves smoothly - the roll is booked after the last step has settled, derived values are worked out once per change of the books, the wheel is not re-fitted while it walks, and Undo's copy in the browser is written when the page is quiet

## [1.30.0] - 2026-10-19

### Features

- feat(bots): champion search refresh (six professions got a new champion) and start ratings version 3

### Bug Fixes

- fix(game): the budget plan is set, not added, and shown at once; a rating is the base plus the games, also on the player card

## [1.29.0] - 2026-10-19

### Features

- feat(bots): new start ratings (version 2) after debt payoff and the debt-first bot
- feat(budget): the game plans its expenses into the budget; the chart shows income and both cashflows
- feat(game): every game starts with the location Bank - Main, which all its bookings use and which cannot be deleted
- feat(leaderboard): a base rating that can be set again without losing the games played
- feat(bots): every bot knows it can pay a starting debt off; a new debt-first bot (Debt-free Dana)
- feat(game): pay a starting debt off in one payment (mortgage, car loan, credit card, student loan)
- feat(tables): paying the bank back at any time, a table setting (default on)
- feat(bots): a bot may offer a Deal card to the table before it turns it down; the menu has one entry while a game is loaded

### Bug Fixes

- fix(budget): the game keeps its own plan per Payday, moves it back a month each Payday, and follows the current month
- fix(budget): the chart redraws on game and transaction changes; docs: repayOffTurn, pay_liability, base ratings
- fix(budget): the Paydays of a solo roll plan the budget, not only the Payday button
- fix(budget): a running game with no planned rows gets this and last month planned when the budget opens
- fix(game): budget rows are guarded on undo, reset, new and loaded games; the default location is tested and documented
- fix(budget): the game plans each Payday's expenses and moves the plan back a month with the transactions

## [1.28.0] - 2026-10-19

### Features

- feat(game): the roll button says Rolling... then Moving...; one or two dice only in your own turn

### Bug Fixes

- fix(game): a price card of another player lets you sell, never buy; the player card fits a phone
- fix(tables): equal buttons, one scrolling row of players, bots by rating, no "What happened" list
- fix(profile): a picture froze the page wherever the game board is drawn

## [1.27.0] - 2026-10-18

### Features

- feat(game): card shuffle, glowing token, Repay shows what is owed, Grow plan closes, Stats follow the table and the banner, Solo/Cashflow Game menu entry
- feat(profile): a profile picture for self-hosted accounts
- feat(tables): add-table panel, initials, open tables list, leaderboard player card and Latest line that waits for the story
- feat(backend): leaderboard, bot ratings in the lobby, token initials and the profile picture
- feat(domain): scoring v2, token initials, buying at a price card, closing a declined plan
- feat(bots): champions, characters and tournament searched again on the new rules; manual and docs updated
- feat(tables): a Doodad can no longer be passed at a table; counting-cards strategy knobs; the freshness fingerprint covers the forced rules
- feat(tables): a skill menu for bots in the lobby, the manual's bot chapter updated, a link to the manual
- feat(bots): skill levels, the champion book and the characters found by the long search
- feat(docs): the multiplayer chapter of the in-app Cashflow manual, in six languages, with the tournament and champion tables
- feat(bots): global champion search, characters by style, Doodad-passing knob, the champion book and the refresh loop
- feat(tables): add and remove bots in the lobby, bot markers at the table
- feat(mcp): table_bots and table_add_bot, and the bot endpoints in the OpenAPI spec
- feat(api): server-played bots at a table - driver, bot routes and tests
- feat(domain): tournament engine, race-aware strategies, bot seats and the bot catalog with a champion
- feat(tables): results screen, save to my games, and a menu entry for game accounts
- feat(tables): clock bar, time banks, turn alert and mobile layout; wire the inspector into the table screen
- feat(tables): look at any player - income statement, balance sheet, standings, live feed
- feat(tables): the table screen with live updates, tokens, turn and clock
- feat(tables): the card flows of a table - draw, buy, pay, sell into offers, trades
- feat(tables): a lobby for multiplayer Cashflow tables (self-hosted only)
- feat(game): the rat-race board can draw a token per player
- feat(mcp): an agent can hold a seat at a multiplayer Cashflow table
- feat(api): finish and archive multiplayer tables
- feat(api): server clocks, restart re-arming and rewind for multiplayer tables
- feat(domain): the host can rewind the last turn at a table
- feat(api): play a multiplayer table through the command endpoint
- feat(domain): what a player may do at a table right now
- feat(api): live channel for multiplayer tables
- feat(api): multiplayer table lobby for the Cashflow game
- feat(domain): trade the Deal card in hand between players at a table
- feat(domain): multiplayer table engine for the Cashflow game

### Bug Fixes

- fix(api): do not announce a table change twice to a client that just connected

## [1.26.0] - 2026-10-14

### Features

- feat(desktop): macOS universal DMG build alongside the Windows installer
- feat(desktop): Tauri thin-shell spike with per-user NSIS installer

## [1.25.0] - 2026-10-13

### Features

- feat(ui): locations page, transfers and recurring-transfer lists, location picker and split editor, and the Cashflow breakdown in the balance sheet
- feat(ui): icons for the eight location types
- feat(i18n): Locations, transfers and recurring-transfer texts in all six languages
- feat(api): locations, transfers and recurring-transfers endpoints, scopes and MCP tools, documented in the OpenAPI spec
- feat(backend): locations, transfers and recurring transfers with atomic balance writes, and location fields on transactions and subscriptions
- feat(domain): location balance, split and recurring-transfer rules, carried through transactions and subscriptions

### Bug Fixes

- fix(domain): keep the Markdown renderers out of the package barrel so the Firebase bundle stays free of Pro text

## [1.24.0] - 2026-10-11

### Features

- feat(cashflow-game): a dice action tells what it rolled in its own panel
- feat(cashflow-game): the dice action of a card looks different from the roll of a new round
- feat(cashflow-game): an open dice action rolls its own die in place of the roll panel; the payment hint uses the whole row
- feat(cashflow-game): selling to a friend or declining uses the card up; the decision buttons share the whole row
- feat(cashflow-game): a card that was played is only read afterwards; fix: the Market cost payment was refused while the game waited for it
- feat(cashflow-game): a card buys once, MLM is never sold, GOLD-II belongs to the GOLD card
- feat(cashflow-game): cost cards are payments the game waits for, held cards are the only offers, rule refusals in six languages; fix: no payment lock on Deals
- feat(cashflow-game): stricter turn order and buying - a card is bought with the card in hand, a played card is not passed, open dice come first, only the app's roll counts
- feat(cashflow-game): a rule for passing Doodads - under Strict a Doodad has to be paid and the game waits for it
- feat(cashflow-game): choose the game rules at the start; the app hides what they forbid
- feat(cashflow-game): game rules chosen at the start - card choice, selling, free transactions, loans - enforced by the engine and the API
- feat(subscriptions): the app edits a subscription's transactions in place too
- feat(domain,backend): editing a subscription changes its transactions in place instead of replacing them
- feat(backend): editing a subscription keeps its generated transactions in line
- feat(domain): one rule for which transactions a subscription generated and which go when it changes
- feat(backend): every saved Cashflow game is a document of its own, so the account is no longer limited to eight long games
- feat(cashflow-game): the analyst judges every card that was picked and left, an unplayed boost, and the log says what a boost did

### Bug Fixes

- fix: patch libtiff CVE-2026-4775 in the frontend image
- fix(cashflow-game): a long game no longer fills the browser storage; the undo history keeps 2000 steps
- fix(cashflow-game): in a solo game the MLM result shows only in the dice panel; the separate banner is gone
- fix(cashflow-game): rolling a dice action no longer marks the card of the space as played; a payment still open is never only read
- fix(cashflow-game): a dice action shows exactly one die, also after a two-dice roll under Charity
- fix(app): the home counters and the remaining plain amounts use the app's number format
- fix(cashflow-game): the Buy button follows the project a card became, and a card is played only once
- fix(cashflow-game): a bought property is recognised after a reload, so its Buy button is gone; Guided buys with the card too
- fix(app): logging out no longer crashes when the profile panel has not loaded yet; cashflow game: the dice wait for loading and saving and for open dice actions
- fix(subscriptions): edits keep generated transactions in line, the saved message tells the truth, sums and budget fill respect the frequency

## [1.23.0] - 2026-10-08

### Features

- feat(mcp): the explain agent - teach_cashflow prompt, a teaching guide and the manual in six languages for agents
- feat(cashflow-game): the manual in all six languages, and the last hard-coded game texts translated
- feat(cashflow-game): the card lab - what each card is worth, measured, in the manual and for the analyst
- feat(cashflow-game): only a card that was opened counts; a pass without looking and an offer not taken are judged
- feat(cashflow-game): a card reference for the player (manual section 20) and for agents
- feat(cashflow-game): picking a card is a History step with the exact card id

### Bug Fixes

- fix(backend): key rotation rolls back when the re-read data cannot even be decoded

## [1.22.0] - 2026-10-07

### Features

- feat(cashflow-game): a card that was drawn and left is remembered in the History and judged by the analyst
- feat(cashflow-game): the analyst shares its time between the decisions, says when it is incomplete, and judges a high salary by the rolls saved

## [1.21.1] - 2026-10-07

### Bug Fixes

- fix(cashflow-game): the analyst no longer fails on a sale or loan made while a card waits

## [1.21.0] - 2026-10-07

### Features

- feat(mcp): choose which permissions to grant on the MCP login page
- feat(mcp): the Cashflow game scope is offered on the MCP login page and in the token form

## [1.20.0] - 2026-10-07

### Features

- feat(cashflow-game): repaying the bank can never take the account below zero
- feat: the strategy lab and what it measured, in the Cashflow manual
- feat(api): the game analyst - GET /game/review and /game/saves/{id}/review, and MCP review actions
- feat(domain): a strategy lab, a position evaluator and a game analyst
- feat(api): special-asset cards and selling positions - the whole game is playable
- feat(domain): buy special assets and sell every kind of position as pure rules
- feat(mcp): get_cashflow_game and play_cashflow_game, with the guide's section for agents
- feat(api): saved games - save, list, read, continue, end, rename, delete, prune - with a storage budget
- feat(domain): how many saved games an agent leaves behind
- feat(api): play Market cards and roll waiting dice decisions
- feat(domain): play_market and roll_decision join legalActions
- feat(api): the solo turn and card decisions (turn, draw, buy a Deal, pay a Doodad, pass)
- feat(domain): card text composer and card actions in legalActions
- feat(api): start, undo and reset the Cashflow game, with a history shared with the app
- feat(domain): undo joins legalActions while there is a step to take back
- feat(api): companion game actions (payday, baby, charity, downsized, status clear, bank loan)
- feat(domain): clear_status joins legalActions while a reminder is showing
- feat(api): read surface for the Cashflow game (GET /game, /game/sets) behind a game-account guard
- feat(domain): legalActions - what the game allows right now
- feat(cashflow-game): paired dashboard rows and a ring that shrinks with the window height
- feat: dropdown quick filters on phones, cash on the loan screens, a slimmer wide layout, a fitting Subscriptions table
- feat(cashflow-game): a responsive layout - phone sheet, tablet and wide dashboard
- feat(cashflow-game): open dice decisions wait for the totem; tile symbol on the right of card headings
- feat(cashflow-game): solo feedback round - start look, tile symbols, no landing wait, Charity default, MLM info box
- feat(cashflow-game): a red Reset game button on the dashboard; red delete in the games list
- feat(cashflow-game): loan messages, Payday popup, thrown dice and a bin on every saved game
- feat(cashflow-game): the games played so far sit behind a button below Start
- feat(cashflow-game): solo playtest feedback - reveal order, START label, Payday banner, friend sale
- feat(domain): the first solo roll starts the game and pays the opening Payday
- feat(cashflow-game): play solo in the app - dice, walking token, card turns and the end screen
- feat(cashflow-game): the rat-race ring and token as an SVG component
- feat(cashflow-game): roll a solo turn and settle its card through the service
- feat(domain): the end of a solo game - escaping the rat race or going bankrupt
- feat(cashflow-game): read a solo game's token and turn back from the account
- feat(domain): a solo turn - roll, move, pay Paydays, resolve the landing
- feat(domain): dice, token movement and Payday passing for solo play
- feat(domain): the rat-race board for solo play
- feat(cashflow-game): write the live game's history to the account
- feat(domain): the live game's history as a document the account can hold
- feat(domain): the game's history, undo stack and snapshots as pure functions
- feat(domain): the Doodad and Market-cost payments as pure rules
- feat(domain): special assets, dice cards, coins and the split roll as pure rules
- feat(domain): the deal lifecycle as pure rules
- feat(domain): the full books, and applying effects to them
- feat(domain): the bank loan and the automatic purchase loan as pure rules
- feat(domain): classify a game trade and price its purchase through the typed parser
- feat(domain): the Market cards as pure functions
- feat(domain): Payday, Baby, Charity and Downsized as pure functions
- feat(domain): clock and text ports, and the game's date scheduling
- feat(domain): shared cash on hand and bank-loan arithmetic for the game

### Bug Fixes

- fix(cashflow-game): a sale price must be a non-negative whole amount; reviews are capped and stopped on time
- fix(cashflow-game): arrows mirror in right-to-left; a normal game is saved in full
- fix(cashflow-game): landing no longer greys the screen; what the player earns is booked as Income
- fix(docs): a wide manual table scrolls inside the page instead of widening it
- fix(cashflow-game): the walking totem has a layer of its own, so the ring is not repainted on every step
- fix(cashflow-game): a solo game ends the moment the books say so
- fix(grow): a market sale of a property no longer pays the deposit twice
- fix(domain): the bonus of a kept MLM card is Income, not Daily
- fix(add): tell the pages underneath when a transaction was saved
- fix(cashflow-game): a solo roll takes effect only once the totem has settled
- fix(cashflow-game): the loan steps field starts at 1 each time and after a settle
- fix(domain): Charity and Downsized take the bank loan first when cash is short
- fix(domain): a share card cannot be sold to a friend
- fix(cashflow-game): write the card-sale comment in the game's language
- fix(mobile): restore the iOS input-zoom and pull-to-refresh protections
- fix(deploy): wait for the rollout, not for pods by label

## [1.19.2] - 2026-10-05

### Performance

- perf(k8s): stop throttling the app, give CouchDB and the backend more memory
- perf(selfhosted): only re-encrypt transactions that changed
- perf(backend): read the user document only when ids need backfilling

## [1.19.1] - 2026-10-05

### Performance

- perf(selfhosted): send a stable id with every transaction
- perf(domain): use native AES-256-CBC and HMAC in EncryptionSession

## [1.19.0] - 2026-10-05

### Features

- feat(auth): require the game password to register a Cashflow game account
- feat(docs): add the Cashflow game manual to the self-hosted docs
- feat(cashflow-game): game panel with Payday, cards, dice, Market, loans and My games
- feat(stats): mark game events in the charts
- feat(cashflow-game): Grow trades, Market offers and gold deals from the dialogs
- feat(cashflow-game): saved games that keep their whole undo history
- feat(cashflow-game): game engine service with a full, reloadable undo history
- feat(cashflow-game): card texts in six languages and a language per game
- feat(domain): add Classic Cashflow card catalogs, saved-game model and content split
- feat(cashflow-game): add all 12 Classic professions + new Custom JFK set
- feat(cashflow-game): translate profession content into all 6 languages
- feat(subscription): add a Category column to the Subscriptions page
- feat(cashflow-game): persist the undo stack to localStorage, clear it on logout
- feat(cashflow-game): general undo for any action; fix missing categories and dates
- feat(cashflow-game): add Passive Income back to the mini cashflow box
- feat(cashflow-game): defer Salary/Expenses to the first Payday, spread its dates across the month
- feat(cashflow-game): profession card becomes an Income Statement/Balance Sheet, live during the game
- feat(cashflow-game): itemize starting cash into real transactions; reload after reset
- feat(cashflow-game): board-space color-coded selector, quiet monthly-cashflow stat, single Menu link
- feat(cashflow-game): hide the placeholder fixture from players, complete the View Card stats, move reset to Settings
- feat(cashflow-game): turn the game into an overlay panel, with profession shuffle and card view
- feat(cashflow-game): categorize expense lines, compute starting cash, add the real Hausmeister profession
- feat(cashflow-game): a reset button — wipe the whole account, start over
- feat(cashflow-game): find or draw a card, from any of the four decks
- feat(cashflow-game): Deal cards as Grow plans, reuse the app's own views
- feat(cashflow-game): companion-mode space resolutions and bank loans
- feat(cashflow-game): MVP of the Cashflow board game companion

### Bug Fixes

- fix(docker): patch pcre2 in the frontend image
- fix(cashflow-game): Live scenario Salary always showing 0; lowercase reset button
- fix(i18n): translate Smile/Fire bucket names in the Chinese locale
- fix(cashflow-game): correct stat row order, add space-button effect hints
- fix(cashflow-game): bank loan borrow/repay now actually moves cash
- fix(cashflow-game): dashboard spacing, redesigned loan/menu buttons, hide History
- fix(cashflow-game): date Payday transactions from each Subscription's own date
- fix(cashflow-game): remove the rat-race bars, size the mini cashflow box to its amount pills
- fix(cashflow-game): reliably detect an active game, disable subscription auto-add everywhere
- fix(cashflow-game): notify pages instead of reloading the page after every action
- fix(cashflow-game): categories on Payday/Downsized, itemize Downsized, step-by-step dashboard, reload after start
- fix(cashflow-game): stop Start Game from silently no-opping at app bootstrap
- fix(cashflow-game): add the missing menu entry to reach the page
- fix(cashflow-game): remove a sold property's cashflow Subscription
- fix(cashflow-game): Payday is unconditional; Deal cards are just Grow

### Performance

- perf(backend): cache encryption sessions and use native PBKDF2

## [1.18.0] - 2026-09-24

### Features

- feat(mcp): point agents at the app overview and advisor playbook
- feat(ui): settle smile/fire buckets and show completed payment plans
- feat(api): keep smile/fire payment plans in line with their subscriptions
- feat(api): settle and unsettle smile/fire buckets
- feat(domain): settle a smile/fire bucket with its actual cost
- feat(api): manage smile/fire payment plans after creation
- feat(api): edit single smile/fire buckets and list items, and guard saved money
- feat(api): carry smile/fire project and bucket renames over to their money
- feat(api): contribute to smile, fire and mojo through a typed action
- feat(reports): add cost basis and realized/unrealized gain to the grow P&L
- feat(api): edit single grow action items, notes and links
- feat(api): keep balance-sheet edits in sync with linked grow projects
- feat(api): keep grow trades consistent on every transaction write and report effects
- feat(domain): undo a recorded grow trade exactly
- feat(api): carry a grow project rename over to everything linked by its title
- feat(api): buy or sell a grow asset by quantity x unit price
- feat(api): set and edit a grow project's kind and plan via create/PATCH

### Bug Fixes

- fix(ui): rebuild smile/fire buckets and mojo with the shared fund engine
- fix(domain): stop funded fire plans from generating zero-amount transactions
- fix(api): rebuild smile/fire buckets and mojo on every write, never store amounts
- fix(api): reject a grow riskScore outside 0-5
- fix(grow): pre-fill Buy/Sell from the loaded balance sheet, never 0 x 0
- fix(ui): keep a grow project's id through load and save
- fix(ui): refuse to save over newer data, and stop sending every save twice
- fix(backend): stop legacy app saves from clobbering newer data and re-keying ids
- fix(mcp): accept every action's shape for a shared tool argument
- fix(api): allow cash-only grow investments without a mortgage
- fix(domain): round fractional share amounts to whole minor units

## [1.17.3] - 2026-09-14

### Bug Fixes

- fix(settings): close profile and settings overlays when opening PAT page
- fix(mcp): merge path-item-level OpenAPI parameters into each operation

## [1.17.2] - 2026-09-14

### Bug Fixes

- fix(api): make legacy collection writes self-healing for stable ids
- fix(reports): round fractional share cents, fix balance data displaying 100x too small

## [1.17.1] - 2026-09-14

### Bug Fixes

- fix(k8s): raise backend CPU/memory limits and health-check tolerance

## [1.17.0] - 2026-09-14

### Features

- feat(settings): split token creation into its own toggleable panel, add delete
- feat(api): add endpoint to permanently delete a revoked personal access token

### Bug Fixes

- fix(ci): update stale MCP operation count, fix unbounded PAT list query
- fix(api): stop legacy empty-time transactions from 500ing GET /transactions

## [1.16.0] - 2026-09-13

### Features

- feat(settings): add Personal Access Tokens page (Pro, self-hosted only)

### Bug Fixes

- fix(oauth): replace the final cross-origin redirect with a meta-refresh page

## [1.15.2] - 2026-09-13

### Bug Fixes

- fix(docs): correct prettier formatting in the Treasury plan doc
- fix(docs): match Pro API page header and layout to the rest of the site
- fix(oauth): redesign the login page to match the app's Sign In screen
- fix(oauth): allow the login form's own same-origin POST under CSP

## [1.15.1] - 2026-09-13

### Bug Fixes

- fix(pwa): exclude OAuth/MCP server routes from service worker navigation interception
- fix(docs): match the Pro API docs page header to every other public page
- fix(ci): make auto-release's changelog generator emit blank lines after headers

## [1.15.0] - 2026-09-13

### Features

- feat(deploy): wire the MCP server into docker-compose and k8s
- feat(mcp): add OAuth 2.1 authorization server for the HTTP transport
- feat(mcp): add Streamable HTTP transport for remote MCP clients
- feat(docs): add Pro API & AI assistant connection guide (selfhosted only)
- feat(routing): gate Pro routes via fileReplacements, not a runtime ternary
- feat: add environment.edition build-time constant

### Bug Fixes

- fix(changelog): add missing blank lines after v1.14.0 section headers

## [1.14.0] - 2026-09-13

### Features

- feat(frontend): scale money fields to minor units on write for schemaVersion-2 accounts
- feat(domain): add convertDocumentFromMinorUnits

### Bug Fixes

- fix(frontend): make CrypticService.decrypt tolerant of non-string input

## [1.13.0] - 2026-09-09

### Features

- feat(mcp): add MCP server exposing the Pro API as agent tools
- feat(api): add GET/PATCH/DELETE /account, POST /account/verify-password
- feat(api): add POST /data/import
- feat(api): add GET /data/export
- feat(api): add POST /data/recalculate
- feat(cli): add mm-admin rotate-encryption-key
- feat(api): add GET/PUT /encryption-config
- feat(api): add GET/PATCH /settings, starting Slice 6
- feat(api): add POST /budget/from-subscriptions, completing Slice 5
- feat(api): add POST /budget/{fill-forward,copy} and DELETE /budget?month=
- feat(api): add GET/POST /budget and GET/PATCH/DELETE /budget/{id}
- feat(api): add POST /subscriptions/batch, GET /subscriptions/export, POST /subscriptions/import
- feat(api): add POST /subscriptions/refresh
- feat(api): add GET/POST /subscriptions and GET/PATCH/DELETE /subscriptions/{id}
- feat(api): add subscription repository CRUD
- feat(domain): add subscription due-transaction generation engine
- feat(domain): add subscription frequency-occurrence calculators
- feat(api): add GET /reports/grow/{id}/pnl, closing out Slice 4
- feat(api): add Grow CRUD and typed actions, completing Slice 4
- feat(domain): add pure calculators for Grow's typed actions
- feat(domain): add regex-based Grow comment-DSL parser/generator
- feat(api): add read-only GET /income/{revenues,interests,properties}
- feat(api): add GET/POST /balance/shares and GET/PATCH/DELETE /balance/shares/{id}, completing Slice 4
- feat(api): add GET/POST /balance/investments and GET/PATCH/DELETE /balance/investments/{id}
- feat(api): add GET/POST /balance/liabilities and GET/PATCH/DELETE /balance/liabilities/{id}
- feat(api): add GET/POST /balance/assets and GET/PATCH/DELETE /balance/assets/{id}, starting Slice 4
- feat(api): add POST /{smile,fire}/{id}/payment-plan, completing Slice 3
- feat(api): add GET /reports/fire-coverage, completing Slice 3's Smile/Fire/Mojo work
- feat(api): add GET/POST /fire and GET/PATCH/DELETE /fire/{id}
- feat(api): add GET/PATCH/DELETE /smile/{id}
- feat(api): add GET/POST /smile
- feat(domain): add fund project totals aggregate
- feat(cli): add mm-admin migrate-fund-project-ids
- feat(api): add GET/PUT /mojo, starting Slice 3
- feat(api): add GET /reports/kpis, completing Slice 2
- feat(api): add GET /reports/balance-sheet
- feat(api): add GET /reports/cashflow
- feat(api): add GET /reports/income-statement
- feat(api): add transactions export/import, complete Slice 1
- feat(api): add POST /transactions/batch
- feat(api): add POST /transactions/{id}/copy
- feat(api): add PATCH/DELETE for transactions
- feat(backend): create transactions and persist derived fund state
- feat(backend): map transaction derived state
- feat(domain): rebuild transaction derived state
- feat(domain): classify transaction income
- feat(domain): rebuild transaction fund state
- feat(domain): apply transaction fund allocations
- feat(domain): summarize transaction accounting
- feat(api): filter transaction reads
- feat(api): add transaction detail reads
- feat(api): add paginated transaction reads
- feat(backend): add transaction ID backfill command
- feat(domain): map transactions to API money format
- feat(domain): add transaction identity normalization
- feat(api): add v1 identity and token foundation
- feat(backend): add mm-admin user/token commands (slice 1 groundwork)
- feat(backend): add the audit log database and write/query helpers
- feat(frontend): refuse a write when the server data changed underneath it
- feat(backend): add mm-admin migrate CLI for the money minor-units migration
- feat(domain): add money minor-units conversion for the migration tool
- feat(backend): link @money/domain via workspace file dependency
- feat(domain): scaffold packages/domain workspace and port CrypticService crypto

### Bug Fixes

- fix(docker): eliminate container-scan HIGH-severity findings
- fix(migrate): compare rounded, not raw, sums in migration verification
- fix(deps): declare @types/crypto-js at root so a clean npm ci installs it
- fix(deploy): build packages/domain into the backend image instead of a dangling symlink
- fix(backend): add subscriptions/budget to migrate-balance-entity-ids
- fix(domain): use non-empty time for generated subscription transactions
- fix(domain): reuse EncryptionSession's salt by default
- fix(domain): allow empty transaction comments
- fix(landing): repair malformed opacity declaration
- fix(splurge): use splurge ratio instead of daily ratio on refresh

## [1.12.0] - 2026-08-03

### Features

- feat(community): add public Community section with guest/admin support

### Bug Fixes

- fix(backend): bump brace-expansion to 2.1.4 (CVE-2026-69152 bypass)
- fix(backend): resolve 7 container CVEs (axios, form-data, brace-expansion, tar, sigstore)
- fix(docker): patch c-ares, curl, libcurl and libexpat CVEs in frontend image
- fix(ci): resolve fast-uri audit finding, grant gitleaks PR read access

## [1.11.3] - 2026-06-07

### Bug Fixes

- fix(add): update amount input to use text inputmode with autocorrect disabled

## [1.11.2] - 2026-06-01

### Bug Fixes

- fix(backup): recreate daily, weekly and monthly backup

## [1.11.1] - 2026-06-01

### Bug Fixes

- fix(frontend): patch libxml2 CVE-2026-6732
- fix(backup): patch libxml2 CVE-2026-6732
- fix(backup): rerun daily, weekly or monthly when missing
- fix(add): remove placeholder for amount
- fix(input): allow negative decimals for amount input (iOS-friendly, comma→dot)

## [1.11.0] - 2026-05-31

### Features

- feat(backup): add hash comparison to skip redundant backups for daily and hourly jobs
- feat(scripts): add weekly and monthly backup promotions

### Bug Fixes

- fix(ui): adjust font size for input and textarea to prevent iOS zoom on focus

## [1.10.0] - 2026-05-10

### Features

- feat(auth): extend session lifetime to prioritize UX (24h access, 1y sliding refresh)

### Bug Fixes

- fix(release): base bumps on highest existing tag
- fix(docker): upgrade nghttp2-libs in frontend runtime image
- fix(deps): resolve backend axios high severity vulnerability
- fix(deps): resolve fast-uri high severity vulnerability
- fix(backup): use configurable European timezone for backup age display
- fix(backup): harden restore flow and add freshness checks
- fix(auth): keep session alive across cold starts and transient errors

## [1.7.0] - 2026-04-27

### Features

- feat(auth): show spinner and disable buttons while login/register is in flight
- feat(stats): redesign financial statement with period selector and key ratios
- feat(docs): add in-app documentation hub with self-hosted setup guide

### Bug Fixes

- fix(backup): prevent CronJob pile-up with concurrency and deadline guards
- fix(home): refresh home amounts when transactions are added (e.g. subscription auto-load after login)
- fix(stats): derive page title from active view so it updates on switch
- fix(selfhosted): add GitHub API and avatar CDN to CSP whitelist

## [1.6.7] - 2026-04-20

### Bug Fixes

- fix(selfhosted): add OCR API to CSP connect-src for receipt scanning

## [1.6.6] - 2026-04-20

### Bug Fixes

- fix(backend): increase body size to 100mb and rate limit to 10000/15min for normal use

## [1.6.5] - 2026-04-20

### Bug Fixes

- fix(selfhosted): disable beasties CSS inlining to avoid CSP-blocked onload handler
- fix(nginx): add unsafe-inline to CSP script-src for Firebase Auth handlers
- fix(encryption): return empty string for encrypted data when key unavailable

### Performance

- perf(encryption): cache key in sessionStorage for instant decrypt on refresh

## [1.6.4] - 2026-04-20

### Bug Fixes

- fix(selfhosted): fix CSP connect-src and skip localStorage parse before encryption key loaded

## [1.6.3] - 2026-04-20

### Bug Fixes

- fix(nginx): increase client_max_body_size to 5m for encrypted batch writes

## [1.6.2] - 2026-04-20

### Bug Fixes

- fix(k8s): remove capabilities drop that blocks curl in backup cronjobs

## [1.6.1] - 2026-04-20

### Bug Fixes

- fix(k8s): switch backup cronjobs to alpine with curl+gnupg for encryption support
- fix(profile): fetch email from database to avoid encrypted display

## [1.6.0] - 2026-04-20

### Features

- feat(registration): add live password rules with i18n support (6 languages)

### Bug Fixes

- fix(auth): restore uploaded encryption config after selfhosted login
- fix(security): preserve encryption flags during localStorage-to-server migration
- fix(security): add Firebase Auth and Google domains to CSP headers

## [1.5.2] - 2026-04-20

### Bug Fixes

- fix(security): add migration path for encryption key from localStorage to server-side storage

## [1.5.1] - 2026-04-20

### Bug Fixes

- fix(docker): pin multi-arch manifest digests for arm64 CI compatibility

## [1.5.0] - 2026-04-20

### Features

- feat(receipt): add structured receipt parser with store-specific readers
- feat(ci): add SBOM generation job for frontend and backend
- feat(security): add webhook-based security alerting for high-severity events (M8)

### Bug Fixes

- fix(ci): use POSIX-compatible redirect in pre-commit gitleaks check
- fix(security): patch Alpine CVEs and picomatch ReDoS in backend Docker image
- fix(security): patch Alpine CVEs in frontend Docker image (libcrypto3, libpng, musl, zlib)
- fix(auth): center password toggle eye icon in registration input field
- fix(security): move encryption key to server-side storage with mode-aware config and clean logout
- fix(security): add Google Fonts origins to CSP header (M10)
- fix(security): pin Docker image digests for reproducible builds (M7)
- fix(security): upgrade cryptic service to PBKDF2-SHA256 key derivation with HMAC auth (M5)
- fix(backup): add encryption support to restore, fix .gpg extension in promotions, add NAS timeout
- fix(auth): move inject() calls to synchronous interceptor context (NG0203)
- fix(security): move encryption key from localStorage to sessionStorage (M4)
- fix(security): add gitleaks secret scanning to pre-commit hook
- fix(security): add npm audit, container scanning, and secret scanning to CI
- fix(security): add Content-Security-Policy header to nginx (M10)
- fix(security): fix vulnerable dependencies via npm audit fix (M9)

## [1.4.1] - 2026-04-19

### Bug Fixes

- fix(settings): align auth button colors with login button style
- fix(auth): replace PNG eye icons with inline SVG and fix password toggle layout
- fix(balance): refine section add button size and border thickness
- fix(grow): center empty state button
- fix(income-statement): remove duplicate fire expense entries in recalculate
- fix(filters): add missing idea phase to smile and fire filter tabs
- fix(ux): add spinner and toast feedback to all write operations
- fix(add-fire): navigate to fireemergencies after successful add

## [1.4.0] - 2026-04-19

### Features

- feat(info-mojo): add mojo info panel component with responsive design
- feat(app): add global saving spinner overlay with isSaving state

### Bug Fixes

- fix(fire): responsive mojo display with container query font sizes
- fix(ui): center textarea and responsive font sizes for info panels
- fix(info-fire): add editable completionDate and spinner on update/delete
- fix(info): show spinner on update/delete with toast error handling
- fix(add): close panel and show spinner on write operations
- fix(add-smile): collapse sections by default and support tour expansion

## [1.3.3] - 2026-04-19

### Bug Fixes

- fix(security): increase global rate limit to 500/15min, add strict 10/15min auth limiter
- fix(security): sanitize D3 innerHTML with escapeHtml for user data (M1)
- fix(security): implement refresh tokens and httpOnly cookie auth (H3, H4)
- fix(security): add NetworkPolicy, pod security contexts, non-root backups (L5, L6, L7)
- fix(security): enable TLS with cert-manager, HSTS, and HTTP-to-HTTPS redirect (H6)
- fix(security): add account lockout after 10 failed login attempts (H5)

## [1.3.2] - 2026-04-19

### Bug Fixes

- fix(deploy): correct backup cronjob name and add graceful fallback in migration script

## [1.3.1] - 2026-04-19

### Bug Fixes

- fix(security): move Grafana admin password to env template and secrets.yaml
- fix(deploy): apply secrets.yaml in deploy script and add one-time migration helper
- fix(security): restrict trust proxy to 1 hop and remove CORS wildcard fallback
- fix(auth): add password policy, email validation, generic errors, and crypto UUIDs (C4, L1, L2, M2)
- fix(security): remove CouchDB proxy, CORS wildcard headers, and add security headers to nginx (C3, L4)
- fix(security): remove hardcoded default encryption key from cryptic service (C2)
- fix(security): move secrets to gitignored templates and harden k8s config (C1, H1, H2, M5)

## [1.3.0] - 2026-04-18

### Features

- feat(changelog): add GitHub API enrichment with per-version PR links, author avatars, and view toggle
- feat(tour): add interactive guided tour with spotlight overlay and i18n

### Bug Fixes

- fix(i18n): update ar, cn, de, es, and fr translations
- fix(landing): remove lock emoji from AI showcase heading
- fix(settings): use translate service as source of truth for language selection
- fix(data): add tier guards to all write paths preventing data loss

## [1.2.0] - 2026-04-16

### Features

- feat(backup): add NAS catch-up sync and shift daily schedule to 8:30AM
- feat(backup): add NAS redundancy, hourly local backups, and granular deploy flags
- feat(profile): add about page route with nav menu toggle and i18n support
- feat(landing): interactive income allocation with click-to-animate, editable amounts, flow lines and i18n
- feat(settings): add allocation editor with reset to default percentages

### Bug Fixes

- fix(auth): skip landing page flash on login and recalculate home amounts after data load

## [1.1.1] - 2026-04-16

### Bug Fixes

- fix(auth): block login on wrong decryption settings and show error
- fix(changelog): add bottom padding for bottom nav bar visibility
- fix(auth): block login on wrong decryption settings and show error
- fix(auth): clear all caches on logout to prevent stale data on re-login

## [1.1.0] - 2026-04-16

### Features

- feat(changelog): add changelog page with GitHub API integration
- feat(landing): add public landing page with demo mode and bucket showcase

### Bug Fixes

- fix(landing): use dynamic currency, translate bucket names, scroll to smile panels, preserve settings on logout
- fix(ui): detect system theme preference and fix profile z-index

## [1.0.1] - 2026-04-13

### Bug Fixes

- fix(build): update budgets and upgrade jest-preset-angular for Angular 19

# Changelog

## [1.0.0] - 2026-04-10

### Features

- feat: initial release — Angular 19 PWA, Node.js backend, Firebase + selfhosted deployments
