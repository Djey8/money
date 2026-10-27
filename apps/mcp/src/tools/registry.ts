/**
 * Hand-authored tool grouping (docs/adr/0008-mcp-server-design.md): one MCP
 * tool per operation group, not one per raw HTTP endpoint. Each action maps
 * to an operationId in the generated manifest (src/generated/operations.ts).
 *
 * Required scopes are noted in each tool's description for the agent's own
 * benefit (so it can call get_identity first and self-check) — they are not
 * enforced here. Enforcement is entirely server-side via `requireScope(...)`
 * in backend/routes/api.js, which this file's scope notes were read from
 * directly; scopes aren't present in openapi.yaml's `security` blocks (see
 * scripts/generate-operations.ts's header comment), so they can't be
 * generated and are transcribed by hand instead.
 *
 * `confirm: true` on a ToolAction means: per the ADR, any action that is a
 * delete or hits a `:bulk`-scoped endpoint requires the caller to pass
 * `confirm: true` in its arguments, checked independently by dispatch.ts
 * before the HTTP call is made at all — a safeguard that holds even if the
 * backend's own validation has a bug, and the only enforcement at all for
 * the plain entity deletes (transactions/smile/fire/balance/grow/
 * subscriptions/budget), whose underlying routes don't themselves require a
 * confirm field.
 */

export interface ToolAction {
  operationId: string;
  confirm: boolean;
  /**
   * Only set for the four operations whose request body is raw
   * newline-delimited JSON text, not a JSON object (transactions/
   * subscriptions import) — names the single flat arg that holds the raw
   * content to send verbatim as the request body.
   */
  ndjsonBodyArg?: string;
}

export interface SimpleTool {
  kind: 'simple';
  name: string;
  description: string;
  /** Action name -> action. A single-entry map makes `action` optional in the tool's schema (dispatch defaults to the sole key). */
  actions: Record<string, ToolAction>;
}

export interface EntityTool {
  kind: 'entity';
  name: string;
  description: string;
  /** The flat arg name selecting which entity map to use, e.g. "entityType". */
  entityParam: string;
  /** entity value -> action name -> action. */
  entities: Record<string, Record<string, ToolAction>>;
}

export interface ExplainTopic {
  title: string;
  content: string;
}

export interface ExplainTool {
  kind: 'explain';
  name: string;
  description: string;
  /** topic key -> topic. Built at startup from docs/domain/*.md (src/tools/explain.ts), not hand-authored here. */
  topics: Record<string, ExplainTopic>;
}

export type ToolDefinition = SimpleTool | EntityTool | ExplainTool;

const action = (operationId: string, confirm = false, ndjsonBodyArg?: string): ToolAction => ({
  operationId,
  confirm,
  ndjsonBodyArg,
});

export const TOOLS: ToolDefinition[] = [
  {
    kind: 'simple',
    name: 'manage_transactions',
    description:
      'List, read, create, update, delete, copy, batch, export, or import transactions. ' +
      'Requires a PAT with transactions:r (list/get), transactions:w (create/update/delete/copy), ' +
      'or transactions:bulk (batch/export/import). Money is always an integer amountMinor plus an ISO-4217 ' +
      'currency; negative amounts are expenses. Optional locationId (an id from manage_locations) records where the ' +
      "money moved and updates that location's balance automatically in the same write (null clears it on an " +
      'update). To split a booking across locations (say 20 % of a salary to a savings sub-account) keep locationId as the ' +
      'MAIN location and add locationSplits: [{locationId, amountMinor}] for the others - the main one gets the rest. ' +
      'delete/batch/export/import require confirm: true.',
    actions: {
      list: action('listTransactions'),
      get: action('getTransaction'),
      create: action('createTransaction'),
      update: action('updateTransaction'),
      delete: action('deleteTransaction', true),
      copy: action('copyTransaction'),
      batch: action('batchTransactions', true),
      export: action('exportTransactions', true),
      import: action('importTransactions', true, 'ndjson'),
    },
  },
  {
    kind: 'simple',
    name: 'get_reports',
    description:
      'Read-only calculation reports: income statement, cashflow, balance sheet, KPIs, Fire coverage, or a ' +
      "single Grow project's P&L. Requires a PAT with reports:r. grow_pnl needs a growId argument. " +
      'To review finances or give advice, read explain_concept topic advisor_playbook first.',
    actions: {
      income_statement: action('getIncomeStatement'),
      cashflow: action('getCashflow'),
      balance_sheet: action('getBalanceSheet'),
      kpis: action('getKpis'),
      fire_coverage: action('getFireCoverage'),
      grow_pnl: action('getGrowPnl'),
    },
  },
  {
    kind: 'simple',
    name: 'manage_mojo',
    description:
      'Read explain_concept topic smile_fire_mojo_guide first. Read the Mojo long-term reserve, update its target, ' +
      'contribute to it, or list the transactions its balance is rebuilt from. The balance only ever comes from ' +
      'transactions (@Mojo contributions, capped at the target). Every write returns `effects`. Requires a PAT ' +
      'with mojo:r (get/list_transactions) or mojo:w (update_target/contribute).',
    actions: {
      get: action('getMojo'),
      update_target: action('updateMojoTarget'),
      contribute: action('contributeMojo'),
      list_transactions: action('listMojoTransactions'),
    },
  },
  {
    kind: 'simple',
    name: 'manage_smile',
    description:
      'Read explain_concept topic smile_fire_mojo_guide first — it explains buckets. Manage Smile (medium-term ' +
      'savings goal) projects: list, get, create, update (incl. bucketsAdd/Update/Remove by id and single list ' +
      'entries), delete; contribute money (the only way bucket amounts change — they are rebuilt from ' +
      'transactions, never set); list_transactions; settle_bucket when the real bill is paid (records only the difference to what was ' +
      'saved; unsettle_bucket reopens); and payment plans (create, update, activate, deactivate, delete — a ' +
      'plan owns its subscription and completes when its buckets are full). Every write returns `effects`. Removing money-holding buckets/projects needs force. Requires a ' +
      'PAT with smile:r (list/get/list_transactions) or smile:w (everything else). delete and ' +
      'delete_payment_plan require confirm: true.',
    actions: {
      list: action('listSmileProjects'),
      get: action('getSmileProject'),
      create: action('createSmileProject'),
      update: action('updateSmileProject'),
      delete: action('deleteSmileProject', true),
      create_payment_plan: action('createSmilePaymentPlan'),
      contribute: action('contributeSmile'),
      settle_bucket: action('settleSmileBucket'),
      unsettle_bucket: action('unsettleSmileBucket'),
      update_payment_plan: action('updateSmilePaymentPlan'),
      activate_payment_plan: action('activateSmilePaymentPlan'),
      deactivate_payment_plan: action('deactivateSmilePaymentPlan'),
      delete_payment_plan: action('deleteSmilePaymentPlan', true),
      list_transactions: action('listSmileTransactions'),
    },
  },
  {
    kind: 'simple',
    name: 'manage_fire',
    description:
      'Read explain_concept topic smile_fire_mojo_guide first — it explains buckets. Manage Fire (emergency fund, ' +
      'not retirement) projects: list, get, create, update (incl. bucketsAdd/Update/Remove by id and single list ' +
      'entries), delete; contribute money (the only way bucket amounts change — untagged money fills the first ' +
      'bucket; a fund auto-completes when every bucket is full); list_transactions; settle_bucket when the real bill is paid (records only the difference to what was ' +
      'saved; unsettle_bucket reopens); and payment plans (create, update, activate, deactivate, delete — a ' +
      'plan owns its subscription and completes when its buckets are full). Every write returns `effects`. Removing money-holding ' +
      'buckets/projects needs force. Requires a PAT with fire:r (list/get/list_transactions) or fire:w ' +
      '(everything else). delete and delete_payment_plan require confirm: true.',
    actions: {
      list: action('listFireProjects'),
      get: action('getFireProject'),
      create: action('createFireProject'),
      update: action('updateFireProject'),
      delete: action('deleteFireProject', true),
      create_payment_plan: action('createFirePaymentPlan'),
      contribute: action('contributeFire'),
      settle_bucket: action('settleFireBucket'),
      unsettle_bucket: action('unsettleFireBucket'),
      update_payment_plan: action('updateFirePaymentPlan'),
      activate_payment_plan: action('activateFirePaymentPlan'),
      deactivate_payment_plan: action('deactivateFirePaymentPlan'),
      delete_payment_plan: action('deleteFirePaymentPlan', true),
      list_transactions: action('listFireTransactions'),
    },
  },
  {
    kind: 'simple',
    name: 'manage_locations',
    description:
      'Locations are where the money physically sits: bank accounts (name + optional subName, e.g. N26 / Main and ' +
      'N26 / Instant Savings), cash, PayPal, a crypto exchange. They are separate from the Daily/Splurge/Smile/Fire/' +
      'Mojo buckets. List, get, create, update, or delete a location. Each has a live amountMinor balance that moves ' +
      'automatically whenever a transaction is booked with its locationId (manage_transactions), so to record money ' +
      'moving in or out book a transaction; updating amountMinor here is only a manual correction that overwrites the ' +
      'balance. kind is bank, savings, cash, crypto, wallet (PayPal / payment app), broker (cash at a broker), card (prepaid / gift card) or other. Deleting keeps the transactions and just unlinks ' +
      'them. Requires a PAT with locations:r (list/get) or locations:w (create/update/delete). delete requires ' +
      'confirm: true.',
    actions: {
      list: action('listLocations'),
      get: action('getLocation'),
      create: action('createLocation'),
      update: action('updateLocation'),
      delete: action('deleteLocation', true),
    },
  },
  {
    kind: 'simple',
    name: 'manage_transfers',
    description:
      "Move money between two of the user's own locations (an ATM withdrawal: bank -> cash; crypto exchange -> bank; " +
      '50 EUR into the shared account). List (optionally for one locationId), get, create, update, or delete a transfer: ' +
      '{fromLocationId, toLocationId, amountMinor (positive), date, time?, comment?}. The source location loses the amount and ' +
      'the destination gains it in the same write. A transfer is NOT a transaction - it never changes income, expenses, Cashflow ' +
      'or any fund, so never record the two sides with manage_transactions. Editing or deleting reverses and re-applies the ' +
      'balances. Requires a PAT with locations:r (list/get) or locations:w (create/update/delete). delete requires confirm: true.',
    actions: {
      list: action('listTransfers'),
      get: action('getTransfer'),
      create: action('createTransfer'),
      update: action('updateTransfer'),
      delete: action('deleteTransfer', true),
    },
  },
  {
    kind: 'simple',
    name: 'manage_recurring_transfers',
    description:
      "Repeat a transfer between two of the user's own locations on a schedule (50 EUR into the shared account every week). " +
      'List, get, create, update, delete a rule {title, fromLocationId, toLocationId, amountMinor (positive), startDate, endDate?, ' +
      'frequency: weekly|biweekly|monthly|quarterly|yearly, comment?}, or refresh to generate what is newly due. It is NOT a ' +
      'subscription: it never creates a transaction, only transfers, so it cannot change income, expenses, Cashflow or any fund. ' +
      'Creating a rule generates every transfer already due from startDate (use today as startDate to affect only the future); ' +
      'editing it moves the transfers it generated in place and never touches ones made by hand; delete keeps them unless ' +
      'deleteTransfers is true. Requires a PAT with locations:r (list/get) or locations:w (everything else). delete requires ' +
      'confirm: true.',
    actions: {
      list: action('listRecurringTransfers'),
      get: action('getRecurringTransfer'),
      create: action('createRecurringTransfer'),
      update: action('updateRecurringTransfer'),
      delete: action('deleteRecurringTransfer', true),
      refresh: action('refreshRecurringTransfers'),
    },
  },
  {
    kind: 'entity',
    name: 'manage_balance_sheet',
    description:
      'List, read, create, update, or delete a balance-sheet entity not wrapped in a Grow project — pick ' +
      'entityType: asset, liability, investment, or share. Requires a PAT with balance:r (list/get) or ' +
      'balance:w (create/update/delete). delete requires confirm: true.',
    entityParam: 'entityType',
    entities: {
      asset: {
        list: action('listAssets'),
        get: action('getAsset'),
        create: action('createAsset'),
        update: action('updateAsset'),
        delete: action('deleteAsset', true),
      },
      liability: {
        list: action('listLiabilities'),
        get: action('getLiability'),
        create: action('createLiability'),
        update: action('updateLiability'),
        delete: action('deleteLiability', true),
      },
      investment: {
        list: action('listInvestments'),
        get: action('getInvestment'),
        create: action('createInvestment'),
        update: action('updateInvestment'),
        delete: action('deleteInvestment', true),
      },
      share: {
        list: action('listShares'),
        get: action('getShare'),
        create: action('createShare'),
        update: action('updateShare'),
        delete: action('deleteShare', true),
      },
    },
  },
  {
    kind: 'entity',
    name: 'list_income_sources',
    description:
      'List revenue, interest, or property income sources — pick sourceType. Read-only, no write endpoints ' +
      'exist for these. Requires a PAT with income:r.',
    entityParam: 'sourceType',
    entities: {
      revenue: { list: action('listRevenues') },
      interest: { list: action('listInterests') },
      property: { list: action('listProperties') },
    },
  },
  {
    kind: 'simple',
    name: 'get_identity',
    description:
      "Returns the caller's userId, authentication type, and exact scope list. No extra scope required beyond " +
      'a valid token — call this first to self-check what this token is allowed to do before attempting other tools.',
    actions: {
      get: action('getCurrentIdentity'),
    },
  },
  {
    kind: 'simple',
    name: 'manage_grow',
    description:
      'Read explain_concept topic grow_guide first — it documents every field, the kind/plan/action model, and ' +
      'worked examples. ' +
      'List, read, create, update, delete a Grow (Rich-Dad-Poor-Dad-style) investment project, or record a ' +
      'typed action against one: buy, sell, dividend, payback, cashflow, deposit. Never write the comment DSL ' +
      'directly — these typed actions generate it server-side (the generic transactions tool rejects it). ' +
      "list_transactions shows a project's recorded trades; update_transaction edits one in place (undoing its " +
      'old effect and applying the new one); delete_transaction deletes one and undoes its effect. Every write ' +
      'returns `effects`: everything it changed (income statement, balance sheet, Smile/Fire, Mojo, Grow). ' +
      'Requires a PAT with grow:r (list/get/list_transactions) or grow:w (everything else). delete and ' +
      'delete_transaction require confirm: true.',
    actions: {
      list: action('listGrow'),
      get: action('getGrow'),
      create: action('createGrow'),
      update: action('updateGrow'),
      delete: action('deleteGrow', true),
      buy: action('buyGrow'),
      sell: action('sellGrow'),
      dividend: action('dividendGrow'),
      payback: action('paybackGrow'),
      cashflow: action('cashflowGrow'),
      deposit: action('depositGrow'),
      list_transactions: action('listGrowTransactions'),
      update_transaction: action('updateGrowTransaction'),
      delete_transaction: action('deleteGrowTransaction', true),
    },
  },
  {
    kind: 'simple',
    name: 'manage_subscriptions',
    description:
      'List, read, create, update, delete, batch, export, import, or refresh recurring subscriptions. ' +
      'Requires a PAT with subscriptions:r (list/get), subscriptions:w (create/update/delete/refresh), or ' +
      'subscriptions:bulk (batch/export/import). delete/batch/export/import require confirm: true.',
    actions: {
      list: action('listSubscriptions'),
      get: action('getSubscription'),
      create: action('createSubscription'),
      update: action('updateSubscription'),
      delete: action('deleteSubscription', true),
      batch: action('batchSubscriptions', true),
      export: action('exportSubscriptions', true),
      import: action('importSubscriptions', true, 'ndjson'),
      refresh: action('refreshSubscriptions'),
    },
  },
  {
    kind: 'simple',
    name: 'manage_budget',
    description:
      'List budget rows, upsert a (month, category) row, get/update/delete a single row, delete a whole ' +
      "month's rows, fill forward from the nearest prior populated month, copy a month, or seed a month from " +
      'active subscriptions. Rows hold the plan only; advisor_playbook explains rebuilding budget vs actual from ' +
      'transactions. Requires a PAT with budget:r (list/get_row) or budget:w (everything else). ' +
      'delete_month and delete_row require confirm: true.',
    actions: {
      list: action('listBudget'),
      upsert: action('upsertBudget'),
      delete_month: action('deleteBudgetMonth', true),
      get_row: action('getBudgetRow'),
      update_row: action('updateBudgetRow'),
      delete_row: action('deleteBudgetRow', true),
      fill_forward: action('fillForwardBudget'),
      copy: action('copyBudget'),
      from_subscriptions: action('fromSubscriptionsBudget'),
    },
  },
  {
    kind: 'simple',
    name: 'manage_settings',
    description:
      'Read or update display/allocation settings (username, currency, theme, language, date format, ' +
      'European number format, Daily/Splurge/Smile/Fire allocation ratios). Requires a PAT with settings:r ' +
      '(get) or settings:w (update).',
    actions: {
      get: action('getSettings'),
      update: action('updateSettings'),
    },
  },
  {
    kind: 'simple',
    name: 'get_encryption_config',
    description:
      'Read whether local/database encryption is enabled and whether a key is configured. Never returns the ' +
      'raw key — changing the key requires the `mm-admin rotate-encryption-key` CLI tool run by a server ' +
      'operator, not this MCP server. Requires a PAT with encryption:r.',
    actions: {
      get: action('getEncryptionConfig'),
    },
  },
  {
    kind: 'simple',
    name: 'manage_data',
    description:
      'Export the full account as JSON, replace it wholesale from a prior export, or force a full ' +
      'recalculation of derived state (income totals, Mojo amount, Smile/Fire bucket amounts) from the ' +
      'transaction history. Requires a PAT with data:bulk — the highest-blast-radius resource in this API. ' +
      'Every action here requires confirm: true, including export, since a full plaintext financial export is ' +
      'sensitive enough to warrant deliberate, not incidental, use.',
    actions: {
      export: action('exportData', true),
      import: action('importData', true),
      recalculate: action('recalculateData', true),
    },
  },
  {
    kind: 'simple',
    name: 'get_cashflow_game',
    description:
      'Read explain_concept topic cashflow_game_guide first (section "Playing as an agent"). Read-only view of the ' +
      'Cashflow game (game accounts only: an email containing "cashflow"; any other account gets 403 ' +
      'not_a_game_account). game: where the running game stands - state, cash, finances, the pending decision and ' +
      '`legalActions`, the only moves play_cashflow_game will accept right now (call this before every move). ' +
      'sets/set: the game sets, professions and the 24-space board. cards: browse or find cards of a pile (deck is ' +
      'required; query searches title, ticker and price). history: the step log of the running game. saves/save: ' +
      'the saved games, the account storage left (`storage`) and one saved game with its step log. review / review_save: ' +
      'the game analyst - judges the decisions of the running game or a saved game (best ... blunder, the turning ' +
      'point, a comparison with the strategy lab); read explain_concept topic cashflow_strategy_lab (the strategies), cashflow_card_lab (what each card is worth: which Deals help, which Doodads ruin you, what the dice cards cost) and cashflow_cards (every card by id - the history names picked cards by id) to turn it into ' +
      'advice. A DREAMFUND (Traumtopf) game - the game with a life, Opportunity and Harvest cards - is judged as a story (milestones, purchases, loans, missed chances, findings, compared with the simulation of its own character and difficulty - 200 games per strategy, ten characters, three levels): read explain_concept topics dreamfund_review_guide, dreamfund_map (the whole table of characters, difficulties and strategies) and dreamfund_game_en (or _de) for how to read it and what to say; the moves of a Dreamfund SOLO game cannot be played through this API (those of a Dreamfund TABLE can - see below). MULTIPLAYER TABLES: tables lists the public tables you can join (scope open, default), the tables you sit ' +
      'at (scope mine) or the ones that are over (scope recent); `kind` is classic (default), dreamfund or all - the Dreamfund tables are a list of their own; table reads ONE table as you may see it - every ' +
      "player's books and cards are open, with `version`, `youSeat`, `activeSeat`, the `clock` and YOUR `legalActions`, " +
      'the only moves play_cashflow_game action table_move will accept from you right now. WAITING FOR YOUR TURN COSTS ' +
      'ALMOST NOTHING: call table with `wait: "my_turn"`, `slim: true` and `timeoutSeconds: 25` - the call is held open ' +
      'and answers as soon as you have a move (your turn, your seat in `holdSeats`, something to sell, an undo vote) or ' +
      'the game is over; `timedOut: true` means nothing happened yet, so just call it again (never poll faster). ' +
      'Slim leaves the other books out; drop `slim` when you need to study them. `wait: "change"` with `since` (the ' +
      '`version` you saw) waits for any change instead. table_log pages through what happened (`after`). ' +
      'table_seats shows who sits at a table (rating, record, picture version of each seat). table_bots lists the bots a host can seat (id, name, difficulty, how it plays; `kind: dreamfund` lists the strategies of a Dreamfund table). DREAMFUND TABLES - WATCHING ONE: to follow a table (yours, or a public one) and tell the user how it goes, call table_review with the roomId: a small page with the goals of every player in percent, score and rank, cash, reserve, passive income against the cost of living, net worth, the pace against the simulation of their character and level, and what to watch. Call it ON DEMAND - when the user asks "how are we doing?" - and never in a loop; do not read `table` or `table_log` for that (they are the whole books and history and cost many tokens; every call re-reads everything before it). Read explain_concept topic dreamfund_table_guide first. DREAMFUND LEADERBOARD (a board of its own, one rating per difficulty): dream_leaderboard (difficulty easy|medium|hard, type all|human|bot, minGames, limit, after), dream_my_player (your ratings at the three difficulties and your last results). LEADERBOARD: leaderboard ' +
      '(type all|human|bot, minGames, limit, after) lists players by rating - humans who opted in, and each bot persona at ' +
      'each level as a player of its own; player (playerId) shows one with their last results; my_player is your own ' +
      'profile (rating, counters, whether you are listed). A finished table says in `rating` whether it counted. ' +
      'Requires a PAT with game:r.',
    actions: {
      game: action('getGame'),
      tables: action('listGameRooms'),
      table: action('getGameRoom'),
      table_log: action('getGameRoomLog'),
      table_seats: action('listGameRoomSeats'),
      table_bots: action('listGameBots'),
      table_review: action('getGameRoomReview'),
      dream_leaderboard: action('getDreamfundLeaderboard'),
      dream_my_player: action('getMyDreamfundPlayer'),
      leaderboard: action('getGameLeaderboard'),
      player: action('getGamePlayer'),
      my_player: action('getMyGamePlayer'),
      sets: action('listGameSets'),
      set: action('getGameSet'),
      cards: action('listGameCards'),
      history: action('getGameHistory'),
      saves: action('listGameSaves'),
      save: action('getGameSave'),
      review: action('getGameReview'),
      review_save: action('getGameSaveReview'),
    },
  },
  {
    kind: 'simple',
    name: 'play_cashflow_game',
    description:
      'Play the Cashflow game (game accounts only). Always read get_cashflow_game action game first and only do ' +
      'what its `legalActions` lists; every action returns the game afterwards, plus `result` (what the dice ' +
      'showed, which card was drawn...). A solo game: start (mode solo), then loop roll, and for the pending card ' +
      'draw_card + buy_deal / pay_doodad / play_market, or pass_card; roll_decision rolls a waiting dice card; ' +
      'sell_position sells shares, a property or gold you hold (see holdings in the game). ' +
      'A companion game is driven by payday, baby, charity, downsized, clear_status. bank_loan moves the Bank ' +
      'loan by amountMinor (positive borrows, negative repays). undo takes steps back; save, load_save, end_game, ' +
      'rename_save manage saved games - save a game in full (it keeps the undo history the analyst needs) and use compact: true only for a batch of games saved for statistics, check `storage` before a long ' +
      'run, and when a session is done clean up with prune_saves so at most 500 saves remain. Requires a PAT ' +
      'with game:w. reset, delete_save and prune_saves destroy data and require confirm: true - never without ' +
      "the user's say-so for games you did not create in this session. " +
      'DREAMFUND TABLE: table_create with `kind: dreamfund` opens a Dreamfund table (settings: difficulty, shape, size, mode, endCondition, ...; see explain_concept topic dreamfund_table_guide); everything below works on it, with its own moves (pay_emergency, answer_life, take_opportunity, fund_reserve, ... listed in your legalActions). Playing a whole table costs many calls and tokens - the usual use is to WATCH one with get_cashflow_game table_review. ' +
      'MULTIPLAYER (a table of several players, you as one seat; read explain_concept topic cashflow_game_guide, ' +
      'section "Playing at a table"): table_create opens a table (settings.name, ranked, ...; your name is your account nickname) and returns an invite ' +
      'code, table_join takes a seat (roomId or code), table_ready, table_start (host), table_profession ' +
      "(professionId or random), table_leave; table_kick / table_settings / table_close are the host's, and so is " +
      'table_add_bot (lobby only: policyId from get_cashflow_game table_bots, optional level master|strong|casual|beginner, name and professionId) which ' +
      'seats a bot the server plays by itself - remove it with table_kick of its seat. Then ' +
      'table_move plays ONE move: `command` is {type: roll | draw_card | buy_deal | pay_doodad | pay_market | roll_decision | ' +
      'pass_card | bank_loan | pay_liability | sell_position | offer_trade | counter_trade | accept_trade | decline_trade | ' +
      'withdraw_trade | pause | resume | back | away | done | propose_undo | vote_undo, ...its fields}. Call get_cashflow_game action table before EVERY move and ' +
      'send only a command type its `legalActions` lists; ALWAYS send a unique `clientCommandId` (a retry of the same ' +
      'call is then applied at most once) and `expectedVersion` (the table `version` you read). On your turn: roll, then ' +
      'what the space asks (draw_card then buy_deal or pass_card; pay_doodad; a Market card is drawn for you and hits ' +
      'every player). You can sell only into an offer a drawn card made for you (sell_position, on or off your turn); ' +
      'trades are for the Deal card in your hand, never a share. If the clock runs out the server plays the most ' +
      'passive turn for you. When a turn is over the table holds: if your seat is in `holdSeats`, finish what you want to do (sell; `roll_decision` for a card with a die) and send `done` so the next turn can start. my_player_visible (visible true|false) lists you on the leaderboard or not (off by default); table_save files your own finished game in your saved games; table_rewind (confirm) ' +
      'asks the table to undo the last turn - it happens when more than half of the people agree (vote_undo with yes true/false answers an open ask; it is in your legalActions then). Requires a PAT with game:w.',
    actions: {
      table_create: action('createGameRoom'),
      my_player_visible: action('setMyGamePlayer'),
      table_join: action('joinGameRoom'),
      table_leave: action('leaveGameRoom'),
      table_forget: action('forgetGameRoom'),
      table_ready: action('setGameRoomReady'),
      table_kick: action('kickFromGameRoom'),
      table_settings: action('updateGameRoomSettings'),
      table_add_bot: action('addGameRoomBot'),
      table_start: action('startGameRoom'),
      table_profession: action('pickGameRoomProfession'),
      table_move: action('playGameRoomCommand'),
      table_close: action('closeGameRoom', true),
      table_rewind: action('rewindGameRoom', true),
      table_save: action('fileGameRoomGame'),
      start: action('gameStart'),
      roll: action('gameTurn'),
      draw_card: action('gameDrawCard'),
      buy_deal: action('gameBuyDeal'),
      pay_doodad: action('gamePayDoodad'),
      play_market: action('gamePlayMarket'),
      roll_decision: action('gameRollDecision'),
      sell_position: action('gameSellPosition'),
      pass_card: action('gamePassCard'),
      payday: action('gamePayday'),
      baby: action('gameBaby'),
      charity: action('gameCharity'),
      downsized: action('gameDownsized'),
      clear_status: action('gameClearStatus'),
      bank_loan: action('gameBankLoan'),
      undo: action('gameUndo'),
      reset: action('gameReset', true),
      save: action('saveGame'),
      load_save: action('loadGameSave'),
      rename_save: action('renameGameSave'),
      delete_save: action('deleteGameSave', true),
      prune_saves: action('pruneGameSaves', true),
      end_game: action('endGame'),
    },
  },
  {
    kind: 'simple',
    name: 'get_account',
    description:
      "Read the account's email and creation date. Requires a PAT with account:r. Changing the email, " +
      'verifying the password, or deleting the account all require an authenticated browser session and can ' +
      'never be done with a PAT (structurally blocked server-side) — not available through this MCP server.',
    actions: {
      get: action('getAccount'),
    },
  },
];
