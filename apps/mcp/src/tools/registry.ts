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
      'currency; negative amounts are expenses. delete/batch/export/import require confirm: true.',
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
      "single Grow project's P&L. Requires a PAT with reports:r. grow_pnl needs a growId argument.",
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
      'Read the Mojo emergency-fund state or update its target amount. Requires a PAT with mojo:r (get) or ' +
      'mojo:w (update_target).',
    actions: {
      get: action('getMojo'),
      update_target: action('updateMojoTarget'),
    },
  },
  {
    kind: 'simple',
    name: 'manage_smile',
    description:
      'List, read, create, update, delete a Smile (short/medium-term savings) project, or attach a payment ' +
      'plan to one. Requires a PAT with smile:r (list/get) or smile:w (create/update/delete/create_payment_plan). ' +
      'delete requires confirm: true.',
    actions: {
      list: action('listSmileProjects'),
      get: action('getSmileProject'),
      create: action('createSmileProject'),
      update: action('updateSmileProject'),
      delete: action('deleteSmileProject', true),
      create_payment_plan: action('createSmilePaymentPlan'),
    },
  },
  {
    kind: 'simple',
    name: 'manage_fire',
    description:
      'List, read, create, update, delete a Fire (retirement) project, or attach a payment plan to one. ' +
      'Requires a PAT with fire:r (list/get) or fire:w (create/update/delete/create_payment_plan). delete ' +
      'requires confirm: true.',
    actions: {
      list: action('listFireProjects'),
      get: action('getFireProject'),
      create: action('createFireProject'),
      update: action('updateFireProject'),
      delete: action('deleteFireProject', true),
      create_payment_plan: action('createFirePaymentPlan'),
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
      'active subscriptions. Requires a PAT with budget:r (list/get_row) or budget:w (everything else). ' +
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
