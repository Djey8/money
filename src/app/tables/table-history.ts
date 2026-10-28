import type { TableView } from '@money/domain';
import type { RemoteHistoryLine } from '../shared/services/remote-game';
import { tableInspectorTexts } from './table-inspector.texts';
import { tableLayerTexts } from './table-layer.texts';
import type { TableEventLine } from './table-session.service';
import { dreamEventDetail, dreamEventTitle } from '../dreamfund-tables/dream-event-texts';

/** What goes into the game's history. Bookkeeping events (turn changes, holds) are the screen's business, not history. */
const SHOWN = new Set([
  'rolled',
  'card_drawn',
  'card_passed',
  'card_played',
  'market_card_played',
  'market_effect',
  'hold_done',
  'dice_decided',
  'position_sold',
  'loan_changed',
  'liability_paid',
  'trade_offered',
  'trade_countered',
  'trade_declined',
  'trade_withdrawn',
  'trade_made',
  'player_escaped',
  'player_bankrupt',
  'turn_timeout',
  'player_away',
  'player_returned',
  'round_started',
  'undo_proposed',
  'undo_voted',
  'undo_approved',
  'undo_rejected',
  'rewound',
  'game_finished',
  'paused',
  'resumed',
  // the Dreamfund's own
  'payday',
  'emergency',
  'life',
  'career',
  'dream',
  'opportunity',
  'opportunity_taken',
  'harvest',
  'harvest_sold',
  'holding_sold',
  'goal_reached',
  'player_won',
]);

const money = (minor: unknown): string =>
  typeof minor === 'number'
    ? (minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '';

function cardName(data: Record<string, unknown> | undefined): string {
  const card = data?.['card'] as
    | {
        title?: string;
        label?: string;
        symbol?: string;
        id?: string;
        printed?: { title?: string };
      }
    | undefined;
  // the name in the language the table is played in (`printed`), not the card's own base title (German for many cards)
  return card?.printed?.title ?? card?.label ?? card?.title ?? card?.symbol ?? card?.id ?? '';
}

function cardIdOf(data: Record<string, unknown> | undefined): string | undefined {
  const card = data?.['card'] as { id?: string } | undefined;
  return card?.id;
}

function detailOf(line: TableEventLine): string {
  const data = line.data;
  switch (line.type) {
    case 'rolled': {
      const dice = (data?.['dice'] as number[] | undefined) ?? [];
      const landed = String(data?.['landed'] ?? '');
      const sum = dice.length > 1 ? ` = ${data?.['total']}` : '';
      return `🎲 ${dice.join(' + ')}${sum}${landed ? ` → ${landed}` : ''}`;
    }
    case 'liability_paid':
      return String(data?.['tag'] ?? '');
    case 'card_drawn':
    case 'market_card_played':
      return cardName(data) || String(data?.['cardId'] ?? '');
    case 'card_played': {
      const name = cardName(data);
      const cost = money(data?.['costMinor']);
      return [name, cost].filter(Boolean).join(' · ');
    }
    case 'dice_decided': {
      const roll = data?.['roll'];
      return [String(data?.['title'] ?? ''), roll === undefined ? '' : `🎲 ${roll}`]
        .filter(Boolean)
        .join(' · ');
    }
    case 'position_sold':
      return [String(data?.['title'] ?? ''), money(data?.['cashMinor'])]
        .filter(Boolean)
        .join(' · ');
    case 'round_started':
      return String(data?.['round'] ?? '');
    default:
      return '';
  }
}

/**
 * The game's history at a table, newest first, in the shape of the solo game's own history list: one line per thing that
 * happened, by whom, worded in the viewer's language. Built from the events the table streamed.
 */
export function historyLines(
  view: TableView,
  events: TableEventLine[],
  lang: string,
): RemoteHistoryLine[] {
  const words = tableInspectorTexts(lang).events;
  const verbs = tableLayerTexts(lang);
  const lines = events.filter((event) => SHOWN.has(event.type));
  // what each player has in hand, so that a pass or a tick-off says which card it was
  const inHand = new Map<number, { name: string; id: string }>();
  return lines
    .map((event, index): RemoteHistoryLine => {
      const player = event.seat === null ? undefined : view.players[event.seat];
      let title =
        words[event.type] ?? (dreamEventTitle(event.type, lang) || event.type.replace(/_/g, ' '));
      let detail = detailOf(event) || dreamEventDetail(event.type, event.data, lang);
      let cardId: string | undefined;
      if (event.type === 'card_drawn' && event.seat !== null) {
        cardId = cardIdOf(event.data);
        inHand.set(event.seat, { name: cardName(event.data), id: cardId ?? '' });
      }
      if (event.type === 'market_card_played') {
        cardId = String(event.data?.['cardId'] ?? '') || undefined;
      }
      if (event.type === 'market_effect') {
        // the Market card reached this player: what it did to them (an offer to sell, a price, a cost)
        title = verbs.stAffected;
        detail = [
          String(event.data?.['kind'] ?? ''),
          ...((event.data?.['matched'] as string[]) ?? []),
        ]
          .filter(Boolean)
          .join(' · ');
      }
      if (event.type === 'card_played') {
        cardId = cardIdOf(event.data);
        // what was done with the card, in plain words: planned it, bought it, paid it
        const action = String(event.data?.['action'] ?? '');
        title =
          action === 'pay_doodad'
            ? verbs.stPaid
            : action === 'plan_deal'
              ? verbs.stPlanned
              : verbs.stBought;
        detail = [
          String(event.data?.['title'] ?? cardName(event.data)),
          detail.split(' · ').slice(1).join(' · '),
        ]
          .filter(Boolean)
          .join(' · ');
      }
      if (event.type === 'card_passed') {
        const held = event.seat === null ? undefined : inHand.get(event.seat);
        cardId = held?.id || undefined;
        title = event.data?.['action'] === 'finish_card' ? verbs.stFinished : verbs.stPassed;
        detail = held?.name ?? '';
      }
      return {
        id: event.seq,
        number: index + 1,
        who: player?.name ?? '',
        color: player?.color ?? 'transparent',
        title,
        detail,
        at: event.at,
        ...(cardId ? { cardId } : {}),
      };
    })
    .reverse();
}
