/**
 * The words of one Grow trade statement - `Buy Asset <title> 1 x 150;` - with a title of several words kept as one: the Add dialog
 * reads the statement by position (`[kind, what, title, ...numbers]`), and the Dreamfund cards have titles like "Sell Digital
 * Templates" (JFK, 2026-10-26: a card with a title of three words booked an amount of ∞). The statement is the one that holds
 * `keyword` (`Buy Asset`, `Sell Share`...); the last `tail` words are its numbers.
 */
export function splitTrade(comment: string, keyword: string, tail: number): string[] {
  const statement =
    comment
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.includes(keyword)) ?? comment;
  const words = statement.split(' ').filter((word) => word !== '');
  const start = words.findIndex((_, i) => `${words[i]} ${words[i + 1]}` === keyword);
  if (start < 0 || words.length <= start + 2 + tail) return statement.split(' ');
  const title = words.slice(start + 2, words.length - tail).join(' ');
  return [...words.slice(start, start + 2), title, ...words.slice(words.length - tail)];
}
