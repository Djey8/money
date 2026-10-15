import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CASHFLOW_GAME_SETS } from '../shared/cashflow-content';
import { cardOnTable, offersOf, TableCardsComponent } from './table-cards.component';

const set = CASHFLOW_GAME_SETS.find((s) => s.id === 'cashflow')!;
const deal = set.decks!.dealSmall![0];
const doodad = set.decks!.doodad![0];

const player = (seat: number, state: Record<string, unknown>) => ({
  seat,
  name: seat === 0 ? 'Ann' : 'Bob',
  books: { state },
});
const view = (over: Record<string, unknown>) =>
  ({
    id: 'r1',
    version: 1,
    phase: 'playing',
    settings: { gameSetId: 'cashflow' },
    youSeat: 0,
    activeSeat: 0,
    trade: null,
    players: [],
    ...over,
  }) as never;

describe('cardOnTable / offersOf', () => {
  it('finds the card the player on the move was offered, in the game set', () => {
    const v = view({
      players: [
        player(0, {
          turn: {
            phase: 'decide',
            pending: { kind: 'deal', offered: { deck: 'dealSmall', cardId: deal.id } },
          },
        }),
      ],
    });
    const shown = cardOnTable(v, set);
    expect(shown?.card.title).toBe(deal.title);
    expect(shown?.deck).toBe('dealSmall');
    expect(shown?.played).toBe(false);
  });

  it('is nothing before a card is drawn, and a played card is marked played', () => {
    expect(
      cardOnTable(
        view({ players: [player(0, { turn: { phase: 'decide', pending: { kind: 'deal' } } })] }),
        set,
      ),
    ).toBeNull();
    const played = cardOnTable(
      view({
        players: [
          player(0, {
            turn: {
              phase: 'decide',
              pending: {
                kind: 'doodad',
                played: true,
                offered: { deck: 'doodad', cardId: doodad.id },
              },
            },
          }),
        ],
      }),
      set,
    );
    expect(played?.played).toBe(true);
  });

  it('lists the offers open for a seat', () => {
    const offer = { title: 'EFH', salePriceMinor: 100, cardId: 'm', label: '+20%' };
    const v = view({ players: [player(0, { marketOffers: [offer] }), player(1, {})] });
    expect(offersOf(v, 0)).toEqual([offer]);
    expect(offersOf(v, 1)).toEqual([]);
    expect(offersOf(v, null)).toEqual([]);
  });
});

describe('TableCardsComponent', () => {
  let fixture: ComponentFixture<TableCardsComponent>;
  let emitted: Record<string, unknown>[];

  function render(v: unknown, allowed: string[]) {
    fixture.componentRef.setInput('view', v);
    fixture.componentRef.setInput('allowed', allowed);
    fixture.componentRef.setInput('gameSets', CASHFLOW_GAME_SETS);
    fixture.detectChanges();
  }
  /** Types into the number field like a player (so the OnPush view notices). */
  const type = async (value: number) => {
    const input = fixture.nativeElement.querySelector('input[type=number]') as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (text: string) =>
    Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLElement).textContent!.includes(text),
    ) as HTMLButtonElement | undefined;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TableCardsComponent] }).compileComponents();
    fixture = TestBed.createComponent(TableCardsComponent);
    emitted = [];
    fixture.componentInstance.move.subscribe((c) => emitted.push(c));
  });

  it('shows the drawn card to everyone, with buy and pass only for the player it is offered to', () => {
    const v = view({
      youSeat: 1,
      players: [
        player(0, {
          turn: {
            phase: 'decide',
            pending: { kind: 'deal', offered: { deck: 'dealSmall', cardId: deal.id } },
          },
        }),
        player(1, {}),
      ],
    });
    render(v, []); // Bob is not on the move: nothing legal
    expect(fixture.nativeElement.textContent).toContain(deal.title);
    expect(button('Buy')).toBeUndefined();
    expect(button('Pass')).toBeUndefined();
  });

  it('on my move: buy sends the card, with the share count for a share', () => {
    const share = set.decks!.dealSmall!.find((c) => c.assetKind === 'share') ?? deal;
    const v = view({
      players: [
        player(0, {
          turn: {
            phase: 'decide',
            pending: { kind: 'deal', offered: { deck: 'dealSmall', cardId: share.id } },
          },
        }),
      ],
    });
    render(v, ['buy_deal', 'pass_card']);
    fixture.componentInstance.quantity = 3;
    button('Buy')!.click();
    expect(emitted[0]).toEqual(
      share.assetKind === 'share'
        ? { type: 'buy_deal', cardId: share.id, quantity: 3 }
        : { type: 'buy_deal', cardId: share.id },
    );
    button('Pass')!.click();
    expect(emitted[1]).toEqual({ type: 'pass_card' });
  });

  it('on a card space with nothing drawn, offers the piles of that space', () => {
    const v = view({
      players: [player(0, { turn: { phase: 'decide', pending: { kind: 'deal' } } })],
    });
    render(v, ['draw_card']);
    button('Small Deal')!.click();
    button('Big Deal')!.click();
    expect(emitted).toEqual([
      { type: 'draw_card', deck: 'dealSmall' },
      { type: 'draw_card', deck: 'dealBig' },
    ]);
  });

  it('sells into an open offer on any turn, by title only', () => {
    const offer = { title: 'EFH', salePriceMinor: 5000000, cardId: 'm', label: '+20%' };
    const v = view({
      activeSeat: 1,
      players: [player(0, { marketOffers: [offer] }), player(1, {})],
    });
    render(v, ['sell_position']);
    expect(fixture.nativeElement.textContent).toContain('EFH');
    button('Sell')!.click();
    expect(emitted[0]).toEqual({ type: 'sell_position', input: { title: 'EFH' } });
  });

  it('offers a trade price in whole currency as minor units, and answers an offer', async () => {
    const base = { players: [player(0, {}), player(1, {})] };
    render(view(base), ['offer_trade']);
    await type(125);
    button('Offer this card to the others')!.click();
    expect(emitted[0]).toEqual({ type: 'offer_trade', priceMinor: 12500 });

    const trade = {
      sellerSeat: 1,
      cardId: deal.id,
      deck: 'dealSmall',
      toSeat: null,
      priceMinor: 20000,
      counters: [],
      declinedSeats: [],
    };
    render(view({ ...base, trade }), ['accept_trade', 'counter_trade', 'decline_trade']);
    button('Take it at this price')!.click();
    await type(150);
    button('Propose this price')!.click();
    button('Decline')!.click();
    expect(emitted.slice(1)).toEqual([
      { type: 'accept_trade' },
      { type: 'counter_trade', priceMinor: 15000 },
      { type: 'decline_trade' },
    ]);
  });

  it('the seller accepts a buyer by seat', () => {
    const trade = {
      sellerSeat: 0,
      cardId: deal.id,
      deck: 'dealSmall',
      toSeat: null,
      priceMinor: 20000,
      counters: [{ seat: 1, priceMinor: 15000 }],
      declinedSeats: [],
    };
    render(view({ players: [player(0, {}), player(1, {})], trade }), [
      'accept_trade',
      'withdraw_trade',
    ]);
    button('Accept')!.click();
    expect(emitted[0]).toEqual({ type: 'accept_trade', fromSeat: 1 });
    expect(button('Take it at this price')).toBeUndefined();
  });
});
