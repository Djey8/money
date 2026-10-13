import { LocationKind } from '../interfaces/location';

/** One icon per location type (files in src/assets/icons/). `wallet` is the PayPal / payment-app type. */
/** The picture of the "recurring transfers" button on the Locations toolbar: the Subscriptions icon. */
export const RECURRING_TRANSFER_ICON = 'assets/icons/subscription.jpg';

/** The picture of the Locations page and of the buttons that go back to it. */
export const LOCATIONS_PAGE_ICON = 'assets/icons/wallet.png';

export const LOCATION_KIND_ICONS: Record<LocationKind, string> = {
  bank: 'assets/icons/bank.png',
  savings: 'assets/icons/savings.png',
  cash: 'assets/icons/cash.png',
  crypto: 'assets/icons/crypto.png',
  wallet: 'assets/icons/paypal.png',
  broker: 'assets/icons/broker.png',
  card: 'assets/icons/cards.png',
  other: 'assets/icons/wallet.png',
};

/** Accent colour per type, used for the badge and the distribution bar. */
export const LOCATION_KIND_COLORS: Record<LocationKind, string> = {
  bank: '#74b9ff',
  savings: '#00cec9',
  cash: '#55efc4',
  crypto: '#fdcb6e',
  wallet: '#a29bfe',
  broker: '#fab1a0',
  card: '#fd79a8',
  other: '#b2bec3',
};

export function locationIcon(kind: LocationKind | undefined): string {
  return LOCATION_KIND_ICONS[kind ?? 'other'] ?? LOCATION_KIND_ICONS.other;
}

export function locationColor(kind: LocationKind | undefined): string {
  return LOCATION_KIND_COLORS[kind ?? 'other'] ?? LOCATION_KIND_COLORS.other;
}

/**
 * Each location's share of the money held (0-100). Negative balances count as 0 so the shares always add up
 * to 100 % of what is actually there.
 */
export function locationShares(amounts: number[]): number[] {
  const total = amounts.reduce((sum, a) => sum + Math.max(a, 0), 0);
  return amounts.map((a) => (total > 0 ? (Math.max(a, 0) / total) * 100 : 0));
}

/** True when the locations total and the app's Cashflow disagree by a cent or more. */
export function cashflowMismatch(locationsTotal: number, cashflow: number): boolean {
  return Math.abs(locationsTotal - cashflow) >= 0.01;
}
