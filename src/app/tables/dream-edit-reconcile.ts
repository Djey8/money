/**
 * What a player may change by hand at a Dreamfund table (JFK, 2026-11-05). The app's pages let a player edit what they see, and
 * write it; at a table nothing is written (the books are the table's), so the write is caught and worked out here: the parts that do
 * not change the game - a booking's category, time and account, the account a payment is paid from, the phase of a project - become
 * table commands; the parts that belong to the game (an amount, a date, a comment, a booking or a payment deleted) are refused and
 * the books are put back on screen. Pure: it compares what was written with what was shown.
 */

interface ShownTransaction {
  account: string;
  amount: number;
  date: string;
  time: string;
  category: string;
  comment: string;
}

interface ShownSubscription {
  title: string;
  account: string;
  amount: number;
  startDate: string;
  endDate: string;
  category: string;
  comment: string;
  frequency: string;
}

interface ShownProject {
  title: string;
  phase: string;
  dream?: boolean;
  reserve?: boolean;
  dreamCardId?: string;
  emergencyCardId?: string;
}

/** What was on screen when the player started to edit. */
export interface ShownBooks {
  transactions: ShownTransaction[];
  subscriptions: ShownSubscription[];
  grow: { title: string; phase: string }[];
  smile: ShownProject[];
  fire: ShownProject[];
  /** The title a payment is shown by (in the language of the screen) and the title the table knows it by. */
  subscriptionTitles: Record<string, string>;
}

export type EditCommand =
  | {
      type: 'edit_transaction';
      index: number;
      patch: { category?: string; account?: string; time?: string };
    }
  | { type: 'edit_subscription'; title: string; account: string }
  | { type: 'set_phase'; kind: 'grow' | 'smile' | 'fire'; id: string; phase: string };

export interface Reconciled {
  commands: EditCommand[];
  /** Something that belongs to the game was changed: the books are put back on screen. */
  refused: boolean;
}

const cents = (amount: unknown): number => Math.round(Number(amount ?? 0) * 100);

/** The tags of the writes that can carry an edit of the kinds above. */
export const EDITABLE_TAGS = ['transactions', 'subscriptions', 'grow', 'smile', 'fire'];

/** A copy of what is on screen, as little of it as the comparison needs. */
export function captureShown(
  state: {
    allTransactions: ShownTransaction[];
    allSubscriptions: ShownSubscription[];
    allGrowProjects: { title: string; phase: string }[];
    allSmileProjects: ShownProject[];
    allFireEmergencies: ShownProject[];
  },
  subscriptionTitles: Record<string, string>,
): ShownBooks {
  const project = (p: ShownProject): ShownProject => ({
    title: p.title,
    phase: p.phase,
    ...(p.dream ? { dream: true } : {}),
    ...(p.reserve ? { reserve: true } : {}),
    ...(p.dreamCardId ? { dreamCardId: p.dreamCardId } : {}),
    ...(p.emergencyCardId ? { emergencyCardId: p.emergencyCardId } : {}),
  });
  return {
    transactions: (state.allTransactions ?? []).map((tx) => ({
      account: tx.account,
      amount: tx.amount,
      date: tx.date,
      time: tx.time,
      category: tx.category,
      comment: tx.comment,
    })),
    subscriptions: (state.allSubscriptions ?? []).map((sub) => ({
      title: sub.title,
      account: sub.account,
      amount: sub.amount,
      startDate: sub.startDate,
      endDate: sub.endDate,
      category: sub.category,
      comment: sub.comment,
      frequency: sub.frequency,
    })),
    grow: (state.allGrowProjects ?? []).map((p) => ({ title: p.title, phase: p.phase })),
    smile: (state.allSmileProjects ?? []).map(project),
    fire: (state.allFireEmergencies ?? []).map(project),
    subscriptionTitles,
  };
}

/** The id the table knows a Smile or Fire project by. */
function projectId(kind: 'smile' | 'fire', p: ShownProject): string | null {
  if (kind === 'smile') return p.dream ? 'life' : (p.dreamCardId ?? null);
  return p.reserve ? 'mojo' : (p.emergencyCardId ?? null);
}

function phases(
  kind: 'grow' | 'smile' | 'fire',
  written: ShownProject[],
  shown: ShownProject[],
  out: Reconciled,
): void {
  for (const project of written) {
    const before = shown.find((entry) => entry.title === project.title);
    if (!before || before.phase === project.phase) continue;
    const id = kind === 'grow' ? project.title : projectId(kind, before);
    if (id) out.commands.push({ type: 'set_phase', kind, id, phase: project.phase });
  }
}

/** Works out what a write means: the commands to send, and whether something was changed that must be put back. */
export function reconcileEdit(tag: string, data: unknown, shown: ShownBooks): Reconciled {
  const out: Reconciled = { commands: [], refused: false };
  if (!Array.isArray(data)) return out;
  if (tag === 'transactions') {
    const written = data as ShownTransaction[];
    // a booking added is not an edit of one: nothing is done with it
    if (written.length < shown.transactions.length) {
      out.refused = true;
      return out;
    }
    shown.transactions.forEach((before, index) => {
      const now = written[index];
      if (!now) return;
      if (
        cents(now.amount) !== cents(before.amount) ||
        now.date !== before.date ||
        now.comment !== before.comment
      ) {
        out.refused = true;
        return;
      }
      const patch: { category?: string; account?: string; time?: string } = {};
      if (now.category !== before.category) patch.category = now.category;
      if (now.account !== before.account) patch.account = now.account;
      if (now.time !== before.time) patch.time = now.time;
      if (Object.keys(patch).length > 0)
        out.commands.push({ type: 'edit_transaction', index, patch });
    });
  } else if (tag === 'subscriptions') {
    const written = data as ShownSubscription[];
    for (const before of shown.subscriptions) {
      const now = written.find((entry) => entry.title === before.title);
      if (!now) {
        out.refused = true;
        continue;
      }
      if (
        cents(now.amount) !== cents(before.amount) ||
        now.startDate !== before.startDate ||
        now.endDate !== before.endDate ||
        now.frequency !== before.frequency ||
        now.comment !== before.comment ||
        now.category !== before.category
      ) {
        out.refused = true;
        continue;
      }
      if (now.account !== before.account) {
        out.commands.push({
          type: 'edit_subscription',
          title: shown.subscriptionTitles[before.title] ?? before.title,
          account: now.account,
        });
      }
    }
  } else if (tag === 'grow') {
    phases('grow', data as ShownProject[], shown.grow as ShownProject[], out);
  } else if (tag === 'smile') {
    phases('smile', data as ShownProject[], shown.smile, out);
  } else if (tag === 'fire') {
    phases('fire', data as ShownProject[], shown.fire, out);
  }
  return out;
}
