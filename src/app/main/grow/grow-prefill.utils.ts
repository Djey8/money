import { Grow } from 'src/app/interfaces/grow';

/**
 * Builds the Add-Transaction comment that the Grow page's Buy/Sell buttons
 * pre-fill. A project is linked to its balance-sheet position by
 * `tag === title` (exact match, the same rule add.component.ts applies
 * when the transaction is submitted), so a position that doesn't match
 * can't be sold: `buildSellComment` returns `null` then, instead of the
 * silent `0 x 0` the page used to pre-fill.
 */

export interface GrowBalancePositions {
  assets: { tag: string; amount: number }[];
  shares: { tag: string; quantity: number; price: number }[];
  investments: { tag: string; deposit: number; amount: number }[];
}

function positionFor<T extends { tag: string }>(entries: T[], title: string): T | undefined {
  return entries.find((entry) => entry.tag === title);
}

/**
 * Buy pre-fills the project's planned values. A share project whose plan is
 * still empty (e.g. created through the API as `share: true`) falls back to
 * the current balance-sheet price and one unit, rather than `0 x 0`.
 */
export function buildBuyComment(project: Grow, positions: GrowBalancePositions): string | null {
  const { title } = project;
  if (project.isAsset) {
    const total = (Number(project.amount) || 0) + (Number(project.liabilitie?.amount) || 0);
    return `Buy Asset ${title} 1 x ${total};`;
  }
  if (project.share) {
    const plannedQuantity = Number(project.share.quantity) || 0;
    const plannedPrice = Number(project.share.price) || 0;
    const quantity = plannedQuantity > 0 ? plannedQuantity : 1;
    const price =
      plannedPrice > 0 ? plannedPrice : Number(positionFor(positions.shares, title)?.price) || 0;
    return `Buy Share ${title} ${quantity} x ${price};`;
  }
  if (project.investment) {
    return `Buy Investment ${title} ${project.investment.deposit} ${project.investment.amount};`;
  }
  return null;
}

/** Sell pre-fills the full current balance-sheet position, or `null` when there is none to sell. */
export function buildSellComment(project: Grow, positions: GrowBalancePositions): string | null {
  const { title } = project;
  if (project.isAsset) {
    const asset = positionFor(positions.assets, title);
    return asset ? `Sell Asset ${title} 1 x ${asset.amount};` : null;
  }
  if (project.share) {
    const share = positionFor(positions.shares, title);
    return share ? `Sell Share ${title} ${share.quantity} x ${share.price};` : null;
  }
  if (project.investment) {
    const investment = positionFor(positions.investments, title);
    if (!investment) return null;
    const payback = project.liabilitie
      ? `Payback Liabilitie ${project.liabilitie.amount} ${project.liabilitie.credit}; `
      : '';
    return `${payback}Sell Investment ${title} ${investment.deposit} ${investment.amount};`;
  }
  return null;
}
