import type { GameBooks } from '@money/domain';

/**
 * The lines of a Dreamfund character's budget in the language of the screen (JFK, 2026-11-03). The server makes the books with the
 * German titles of the character's card; the solo game translates them when it makes a game. A table shows a copy of the books, so the
 * copy is translated here - the title of a line, its key in `lineTitles`, the premium of an insurance, and the category of the
 * transactions filed under it - and the server's own books stay as they are.
 */
export function withShownLineTitles(
  books: GameBooks,
  translate: (key: string) => string | null,
  /** The starting debts of the character with their keys: shown by the word of the language, as the solo game names them. */
  debts: { tag: string; key?: string }[] = [],
): GameBooks {
  const lineTitles = books.state.lineTitles;
  if (!lineTitles) return books;
  const rename = new Map<string, string>();
  for (const debt of debts) {
    const text = debt.key ? translate(`CashflowGame.liabilityTag.${debt.key}`) : null;
    if (text && text !== debt.tag) rename.set(debt.tag, text);
  }
  for (const [key, title] of Object.entries(lineTitles)) {
    const text = translate(`CashflowGame.expenseLine.${key}`);
    if (text && text !== title) rename.set(title, text);
  }
  if (rename.size === 0) return books;
  const name = (title: string) => rename.get(title) ?? title;
  const insurance = books.state.insurance;
  return {
    ...books,
    liabilities: books.liabilities.map((debt) => ({ ...debt, tag: name(debt.tag) })),
    state: {
      ...books.state,
      gameSubscriptionTitles: books.state.gameSubscriptionTitles.map(name),
      lineTitles: Object.fromEntries(
        Object.entries(lineTitles).map(([key, title]) => [key, name(title)]),
      ),
      ...(insurance
        ? {
            insurance: {
              ...insurance,
              premiums: Object.fromEntries(
                Object.entries(insurance.premiums).map(([kind, title]) => [kind, name(title)]),
              ),
            },
          }
        : {}),
    },
    subscriptions: books.subscriptions.map((sub) => ({
      ...sub,
      title: name(sub.title),
      category: sub.category.startsWith('@') ? `@${name(sub.category.slice(1))}` : sub.category,
    })),
    transactions: books.transactions.map((transaction) =>
      transaction.category.startsWith('@') && rename.has(transaction.category.slice(1))
        ? { ...transaction, category: `@${name(transaction.category.slice(1))}` }
        : transaction,
    ),
  };
}

/** The word a debt is shown by, and the tag the server knows it by (the move to pay it off names the second). */
export function shownDebtTags(
  debts: { tag: string; key?: string }[],
  translate: (key: string) => string | null,
): Map<string, string> {
  const shown = new Map<string, string>();
  for (const debt of debts) {
    const text = debt.key ? translate(`CashflowGame.liabilityTag.${debt.key}`) : null;
    shown.set(text ?? debt.tag, debt.tag);
  }
  return shown;
}

const TAGGED = /(CashflowGame\.[A-Za-z0-9_.]+)(?:::(\{[^}]*\}))?/g;

/**
 * The words the game wrote into the notes of the Grow projects as keys (a table's books are made without a language: `key::{params}`)
 * in the language of the screen.
 */
export function withShownGameText(
  books: GameBooks,
  say: (key: string, params?: Record<string, string>) => string | null,
): GameBooks {
  if (
    !books.growProjects.some((project) =>
      project.notes.some((n) => n.text.includes('CashflowGame.')),
    )
  ) {
    return books;
  }
  const worded = (text: string) =>
    text.replace(TAGGED, (whole, key: string, params?: string) => {
      let parsed: Record<string, string> | undefined;
      try {
        parsed = params ? (JSON.parse(params) as Record<string, string>) : undefined;
      } catch {
        parsed = undefined;
      }
      return say(key, parsed) ?? whole;
    });
  return {
    ...books,
    growProjects: books.growProjects.map((project) => ({
      ...project,
      notes: project.notes.map((note) => ({ ...note, text: worded(note.text) })),
    })),
  };
}
