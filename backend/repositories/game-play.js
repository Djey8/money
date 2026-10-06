'use strict';

const {
  systemClock,
  legalActions,
  playPayday,
  playBaby,
  playBankLoan,
  playCharityPaying,
  playDownsizedPaying,
  roundBooksOf,
  clearCashflowStatus,
  emptyEffects,
  applyEffectsToBooks,
  endIfOver,
  pickCashflowProfession,
  textOrFallback,
  nextSmartDate,
  gameSubscriptionDays,
  pushUndoSnapshot,
  popUndoSteps,
  keepSavedSlot,
  blankGameData,
  playTurn,
  settleDecision,
  CLASSIC_RAT_RACE_BOARD,
  systemRng,
  drawRandomCard,
  dealInputFromCard,
  takenDealLabels,
  planDeal,
  executeDeal,
  payCardExpense,
  doodadAccount,
  dealPlanText,
  doodadPaymentCategory,
  doodadPaymentTitle,
  buyAssetDeal,
  sellPosition,
  marketCardKind,
  playMarketBuyerCard,
  playShareSplitCard,
  playBoostCard,
  playMarketCostCard,
  updateSharePrice,
  buyerCardTypes,
  propertyCardTypes,
  businessCardLabels,
  MARKET_COST_ACCOUNT,
  openDecisions,
  resolveGamble,
  rollDie,
} = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptSettings } = require('./settings-repository');
const { decodeGameState } = require('../services/game-state-codec');
const { readBooks, applyEffectsToData } = require('../services/game-writer');
const { createGameText, createMoneyFormat } = require('../services/game-text');
const { createCardTextSource } = require('../services/game-card-text');
const {
  readSnapshot,
  writeSnapshot,
  readHistoryStack,
  buildHistoryDocument,
} = require('../services/game-snapshot');
const { getGame, loadGameSets } = require('./game-repository');

/**
 * Plays the live game (todo/cashflow-game-pro.md slice D2): every action is one document write that carries the books,
 * the game state and the history - so what an agent plays can be undone in the app and the other way round. The rules
 * are the domain's; each step that is undoable pushes the account as it was onto the history first, like the app does.
 */

const MAX_WRITE_RETRIES = 10;

class GameActionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function refuse(code, message) {
  return new GameActionError(code, message);
}

/** The starting position of a game: savings booked, the profession's subscriptions and starting positions created. */
function playStart(books, input, deps, gameSets) {
  const { gameSetId, professionId, mode = 'companion' } = input;
  const result = pickCashflowProfession(
    gameSets,
    gameSetId,
    professionId,
    deps.clock.todayIso(),
    mode,
  );
  const { text } = deps;
  const { profession } = result;
  const professionTitle = textOrFallback(
    text,
    `CashflowGame.profession.${profession.id}.title`,
    profession.title,
  );
  const salaryWord = text('CashflowGame.salary');
  const savingsWord = text('CashflowGame.savings');
  const lineTitle = (line) =>
    line.key
      ? textOrFallback(text, `CashflowGame.expenseLine.${line.key}`, line.title)
      : line.title;
  // result.subscriptions is [salary, ...the non-zero expense lines], in that order.
  const nonZeroExpenses = profession.expenses.filter((line) => line.amountMinor !== 0);
  const titles = result.subscriptions.map((_sub, index) =>
    index === 0
      ? text('CashflowGame.salarySubscriptionTitle', { profession: professionTitle })
      : lineTitle(nonZeroExpenses[index - 1]),
  );

  const usedDays = gameSubscriptionDays(books.subscriptions);
  const kit = result.starterKit;
  const effects = emptyEffects(
    { ...result.state, gameSubscriptionTitles: titles },
    { kind: 'start', detail: professionTitle },
  );
  effects.appendedTransactions = result.startingTransactions.map((record) => ({
    ...record,
    category: `@${savingsWord}`,
    comment: `${text('CashflowGame.savingsTransactionComment', { profession: professionTitle })}\n#cashflow`,
  }));
  effects.subscriptionUpserts = result.subscriptions.map((sub, index) => ({
    title: titles[index],
    account: sub.account,
    amountMinor: sub.amountMinor,
    startDate: nextSmartDate(usedDays, deps.clock.todayIso()),
    endDate: '',
    category: index === 0 ? `@${salaryWord}` : `@${titles[index]}`,
    comment: sub.comment ? `${sub.comment}\n#cashflow` : '#cashflow',
    frequency: sub.frequency,
  }));
  effects.assetUpserts = (kit.assets ?? []).map((asset) => ({
    tag: asset.tag,
    amountMinor: asset.amountMinor,
  }));
  effects.investmentUpserts = (kit.investments ?? []).map((investment) => ({
    tag: investment.tag,
    depositMinor: investment.depositMinor,
    amountMinor: investment.amountMinor,
  }));
  effects.shareUpserts = (kit.shares ?? []).map((share) => ({ ...share }));
  effects.liabilityUpserts = (kit.liabilities ?? []).map((liability) => ({
    tag: liability.key
      ? textOrFallback(text, `CashflowGame.liabilityTag.${liability.key}`, liability.tag)
      : liability.tag,
    amountMinor: liability.amountMinor,
    investment: false,
  }));
  return [effects];
}

/**
 * What one action plays over the books: the effects in order, the one History step they share when they carry none of
 * their own (a roll), and what the caller reports back (`result`).
 */
function playAction(action, input, { books, profession, deps, gameSets, gameSet }) {
  switch (action) {
    case 'start':
      return { effects: playStart(books, input, deps, gameSets) };
    case 'payday':
      return { effects: [playPayday(roundBooksOf(books), deps)] };
    case 'baby':
      return { effects: [playBaby(roundBooksOf(books), profession, deps)] };
    case 'charity':
      return { effects: playCharityPaying(books, deps).effects };
    case 'downsized':
      return { effects: playDownsizedPaying(books, deps).effects };
    case 'bank_loan':
      return { effects: [playBankLoan(books, input.amountMinor, deps)] };
    case 'clear_status':
      return { effects: [emptyEffects(clearCashflowStatus(books.state, input.status), null)] };
    case 'roll': {
      const turn = playTurn(
        books,
        { ...deps, board: CLASSIC_RAT_RACE_BOARD, profession, rng: deps.rng },
        { dice: input.dice },
      );
      return {
        effects: turn.effects,
        step: turn.step,
        result: {
          dice: turn.roll.dice,
          total: turn.roll.total,
          from: books.state.boardPosition,
          to: turn.move.to,
          landed: turn.move.landed.kind,
          paydays: turn.move.paydays + (turn.openingPayday ? 1 : 0),
          openingPayday: turn.openingPayday,
          autoLoansMinor: turn.autoLoansMinor,
        },
      };
    }
    case 'pass_card': {
      const settled = settleDecision(books.state, 'passed', books.subscriptions);
      return { effects: [emptyEffects(settled.state, settled.step)] };
    }
    case 'draw_card':
      return drawCard(books, input, deps, gameSet);
    case 'buy_deal':
      return buyDeal(books, input, deps, gameSet);
    case 'pay_doodad':
      return payDoodad(books, input, deps, gameSet);
    case 'play_market':
      return playMarket(books, input, deps, gameSet);
    case 'roll_decision':
      return rollDecision(books, input, deps);
    case 'sell_position':
      return sellHolding(books, input, deps);
    default:
      throw refuse('GAME_ACTION_UNKNOWN', `Unknown game action: ${action}`);
  }
}

const DECK_FOR_PENDING = { deal: ['dealSmall', 'dealBig'], market: ['market'], doodad: ['doodad'] };

function cardTextDeps(deps) {
  return { text: deps.text, cards: deps.cards, money: deps.money };
}

/** A card as the API shows it: its numbers, plus what it prints in the game's language. */
function describeCard(card, deps) {
  return {
    ...card,
    printed: deps.cards.textFor(card.id),
    label: deps.cards.symbolFor(card.symbol),
  };
}

function findDeck(gameSet, deckKind) {
  const deck = gameSet?.decks?.[deckKind];
  if (!deck) throw refuse('GAME_RULE_REFUSED', `This game set has no ${deckKind} cards.`);
  return deck;
}

function drawCard(books, input, deps, gameSet) {
  const deckKind = input.deck;
  const pending = books.state.turn?.pending;
  if (
    books.state.mode === 'solo' &&
    pending &&
    !DECK_FOR_PENDING[pending.kind].includes(deckKind)
  ) {
    throw refuse(
      'GAME_RULE_REFUSED',
      `This space asks for a ${pending.kind} card: draw from ${DECK_FOR_PENDING[pending.kind].join(' or ')}.`,
    );
  }
  const drawn = drawRandomCard(
    findDeck(gameSet, deckKind),
    books.state.drawnCardIds[deckKind],
    deps.rng,
  );
  const state = {
    ...books.state,
    drawnCardIds: { ...books.state.drawnCardIds, [deckKind]: drawn.drawnIds },
  };
  return {
    effects: [emptyEffects(state, null)],
    result: { deck: deckKind, reshuffled: drawn.reshuffled, card: describeCard(drawn.card, deps) },
  };
}

/** Plans a Deal card as a Grow project and buys it - the app's two steps, so Undo takes them back one at a time. */
function buyDeal(books, input, deps, gameSet) {
  const decks = [...findDeck(gameSet, 'dealSmall'), ...(gameSet.decks.dealBig ?? [])];
  const card = decks.find((candidate) => candidate.id === input.cardId);
  if (!card) throw refuse('GAME_RULE_REFUSED', `No Deal card with the id '${input.cardId}'.`);
  const symbol = card.symbol ?? card.title;
  const holds = books.shares.some((share) => share.tag === symbol && share.quantity > 0);
  if (card.assetKind === 'share' && holds) {
    // The market moves the price of a share already held; planning it again would double the position.
    const priced = updateSharePrice(
      books,
      card,
      { description: deps.cards.textFor(card.id).description },
      deps,
    );
    return {
      effects: [priced.effects],
      settle: true,
      result: { card: describeCard(card, deps), title: priced.title, kind: 'priceUpdate' },
    };
  }
  const dealInput = dealInputFromCard(
    card,
    dealPlanText(card, cardTextDeps(deps)),
    takenDealLabels(books),
  );
  const plan = planDeal(books, dealInput, deps);
  const planned = applyEffectsToBooks(books, plan);
  // A special-asset card (gold, the loan to a relative, MLM) is bought as an asset; a dice card then waits for its roll.
  const executed =
    card.assetKind === 'asset'
      ? buyAssetDeal(planned, dealInput.title, deps)
      : executeDeal(planned, dealInput.title, input.quantity, deps);
  return {
    effects: [plan, ...executed.steps],
    settle: true,
    result: { card: describeCard(card, deps), title: dealInput.title, kind: executed.kind },
  };
}

/** A Market or Doodad card's heading in the game's language (a star card is the jackpot of the pile). */
function cardHeading(card, deps) {
  const name = deps.cards.textFor(card.id).title ?? card.title;
  return card.star ? `${name} ★` : name;
}

/** Plays a Market card the way its kind asks; a card that does not apply to the player is still played (a History step). */
function playMarket(books, input, deps, gameSet) {
  const card = findDeck(gameSet, 'market').find((candidate) => candidate.id === input.cardId);
  if (!card) throw refuse('GAME_RULE_REFUSED', `No Market card with the id '${input.cardId}'.`);
  const title = cardHeading(card, deps);
  const label = (symbol) => deps.cards.symbolFor(symbol);
  const kind = marketCardKind(card);
  const described = describeCard(card, deps);
  switch (kind) {
    case 'buyer':
    case 'gold': {
      const played = playMarketBuyerCard(
        books,
        card,
        { title, types: buyerCardTypes(card, label) },
        deps,
      );
      return {
        effects: [played.effects],
        settle: true,
        result: { card: described, kind, matched: played.matched },
      };
    }
    case 'split': {
      const played = playShareSplitCard(books, card, { title, labels: [card.splits.symbol] }, deps);
      return {
        effects: [played.effects],
        settle: true,
        result: {
          card: described,
          kind,
          share: played.share ?? null,
          decisionOpen: played.effects.decisionNeeded,
        },
      };
    }
    case 'boost': {
      const played = playBoostCard(
        books,
        card,
        {
          title,
          businessLabels: card.boost.onlyBusinesses ? businessCardLabels(label) : undefined,
        },
        deps,
      );
      return {
        effects: [played.effects],
        settle: true,
        result: { card: described, kind, changed: played.changed },
      };
    }
    case 'cost': {
      const played = playMarketCostCard(books, card, { title, types: propertyCardTypes(label) });
      if (!played.property) {
        return {
          effects: [played.effects],
          settle: true,
          result: { card: described, kind, property: null },
        };
      }
      const flavor = (deps.cards.textFor(card.id).comment ?? '')
        .split('{property}')
        .join(played.property);
      const effects = payCardExpense(
        books,
        {
          kind: 'marketCost',
          title,
          flavor,
          category: played.property,
          costMinor: card.pays.costMinor,
          account: MARKET_COST_ACCOUNT,
        },
        deps,
      );
      return {
        effects,
        settle: true,
        result: {
          card: described,
          kind,
          property: played.property,
          costMinor: card.pays.costMinor,
        },
      };
    }
    default:
      return { effects: [], settle: true, result: { card: described, kind } };
  }
}

/** Rolls the die for a waiting card: a stock split doubles on 1-3, every other card wins on a high roll. */
function rollDecision(books, input, deps) {
  const waiting = openDecisions(books.state);
  const deal = input.title
    ? waiting.find((candidate) => candidate.title === input.title)
    : waiting[0];
  if (!deal) throw refuse('GAME_RULE_REFUSED', 'There is no dice decision waiting.');
  const roll = rollDie(deps.rng);
  const won = deal.split ? roll <= 3 : roll >= (deal.successOn ?? 6);
  const settled = resolveGamble(books, deal.title, { won, roll }, deps);
  return {
    effects: [settled.effects],
    result: { title: deal.title, kind: settled.kind, roll, won },
  };
}

/** Sells a position the player holds: shares, a property to a market buyer, gold by the coin. */
function sellHolding(books, input, deps) {
  const sold = sellPosition(
    books,
    {
      title: input.title,
      quantity: input.quantity,
      priceMinor: input.priceMinor,
      salePriceMinor: input.salePriceMinor,
    },
    deps,
  );
  return {
    effects: sold.steps,
    result: { title: input.title, kind: sold.kind, cashMinor: sold.cashMinor },
  };
}

function payDoodad(books, input, deps, gameSet) {
  const card = findDeck(gameSet, 'doodad').find((candidate) => candidate.id === input.cardId);
  if (!card) throw refuse('GAME_RULE_REFUSED', `No Doodad card with the id '${input.cardId}'.`);
  const textDeps = cardTextDeps(deps);
  const effects = payCardExpense(
    books,
    {
      kind: 'doodad',
      title: doodadPaymentTitle(card, textDeps),
      flavor: deps.cards.textFor(card.id).comment,
      category: doodadPaymentCategory(card, textDeps),
      costMinor: card.costMinor,
      account: doodadAccount(card),
    },
    deps,
  );
  return {
    effects,
    settle: true,
    result: { card: describeCard(card, deps), costMinor: card.costMinor },
  };
}

/** What an action needs to run: the stored data, the encryption session, the account's settings and the game's words. */
async function loadContext(deps, userId) {
  let userDoc;
  try {
    userDoc = await deps.usersDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    userDoc = { _id: userId, data: {} };
  }
  const data = userDoc.data || {};
  const session = await getEncryptionSession(deps.authDb, userId);
  const settings = decryptSettings(data.settings, session);
  const state = decodeGameState(data.cashflowGame, session);
  const text = createGameText(settings.language);
  const money = createMoneyFormat(settings);
  return {
    userDoc,
    data,
    session,
    settings,
    state,
    gameDeps: {
      clock: systemClock,
      text,
      money,
      plainMoney: money,
      rng: deps.rng ?? systemRng,
      cards: createCardTextSource(settings.language),
    },
    history: readHistoryStack(data, session),
  };
}

/** Writes the history document for `stack` (the account as it is now is the "live" end of it). */
function withHistory(data, stack, context) {
  const live = readSnapshot(data, context.session);
  return {
    ...data,
    cashflowGameHistory: buildHistoryDocument(
      stack,
      live,
      { text: context.gameDeps.text, money: context.gameDeps.money },
      systemClock.nowIso(),
      context.session,
    ),
  };
}

function pushStep(stack, data, step, context) {
  return pushUndoSnapshot(stack, {
    step: { ...step, at: systemClock.nowIso() },
    ...readSnapshot(data, context.session),
  });
}

/** Plays effects in order: each undoable one first pushes how the account stood, then changes it. */
function applyEffectsList(effectsList, context, startData, startStack, sharedStep) {
  let data = startData;
  let stack = startStack;
  if (sharedStep) stack = pushStep(stack, data, sharedStep, context);
  for (const effects of effectsList) {
    if (effects.step) stack = pushStep(stack, data, effects.step, context);
    data = applyEffectsToData(data, effects, {
      session: context.session,
      nowIso: systemClock.nowIso(),
    });
  }
  return { data, stack };
}

async function playGameAction(deps, userId, action, input = {}) {
  // `deps.rng` is for tests and the scripted agent harness; the API itself always rolls with the system's dice.
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    const context = await loadContext(deps, userId);
    const { userDoc, data, session, settings, state, history } = context;
    const canUndo = history.stack.length > 0;
    if (action !== 'start' && !state.professionId) {
      throw refuse('GAME_NOT_STARTED', 'No game is running.');
    }
    const legal = legalActions(state, { canUndo }).map((candidate) => candidate.action);
    if (!legal.includes(action)) {
      throw refuse(
        'GAME_ACTION_NOT_ALLOWED',
        `'${action}' is not allowed now. Allowed: ${legal.join(', ')}.`,
      );
    }

    let nextData;
    let result;
    try {
      ({ data: nextData, result } = runAction(action, input, context, {
        settings,
        state,
        data,
        session,
        history,
      }));
    } catch (error) {
      if (error instanceof GameActionError) throw error;
      throw refuse('GAME_RULE_REFUSED', error.message);
    }

    try {
      await deps.usersDb.insert({ ...userDoc, data: nextData, updatedAt: systemClock.nowIso() });
      const game = await getGame(deps, userId);
      return result ? { ...game, result } : game;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw refuse('GAME_WRITE_CONFLICT', 'The game kept changing; try again.');
}

function runAction(action, input, context, { settings, state, data, session, history }) {
  if (action === 'undo') {
    const count = input.count ?? 1;
    const { snapshot, stack } = popUndoSteps(history.stack, count);
    if (!snapshot) throw refuse('GAME_RULE_REFUSED', 'Nothing to undo.');
    const restored = writeSnapshot(data, keepSavedSlot(snapshot, state), session);
    return { data: withHistory(restored, stack, context) };
  }
  if (action === 'reset') {
    const blank = writeSnapshot(data, blankGameData(), session);
    return { data: withHistory(blank, [], context) };
  }

  const gameSets = loadGameSets();
  const gameSet = gameSets.find(
    (candidate) => candidate.id === (input.gameSetId ?? state.gameSetId),
  );
  const profession = gameSet?.professions.find(
    (candidate) => candidate.id === (input.professionId ?? state.professionId),
  );
  const books = readBooks(data, session, { state, allocation: settings.allocation, gameSet });
  const played = playAction(action, input, {
    books,
    profession,
    deps: context.gameDeps,
    gameSets,
    gameSet,
  });

  const effectsList = played.effects;
  // A new game has a new history: whatever an earlier game left behind is dropped.
  const startStack = action === 'start' ? [] : history.stack;
  const applied = applyEffectsList(effectsList, context, data, startStack, played.step);
  let { data: nextData } = applied;
  let nextBooks = books;
  for (const effects of effectsList) nextBooks = applyEffectsToBooks(nextBooks, effects);

  // Dealing with the card closes the solo turn's decision (the app's Done); a companion game has none open.
  if (
    played.settle &&
    nextBooks.state.mode === 'solo' &&
    nextBooks.state.turn?.phase === 'decide'
  ) {
    const settled = settleDecision(nextBooks.state, 'done', nextBooks.subscriptions);
    nextBooks = { ...nextBooks, state: settled.state };
    nextData = applyEffectsToData(nextData, emptyEffects(settled.state, null), {
      session,
      nowIso: systemClock.nowIso(),
    });
  }

  // A solo game ends the moment the books say so (escaped / bankrupt).
  const ended = endIfOver(nextBooks.state, nextBooks.subscriptions);
  if (ended !== nextBooks.state) {
    nextData = applyEffectsToData(nextData, emptyEffects(ended, null), {
      session,
      nowIso: systemClock.nowIso(),
    });
  }
  const stored =
    applied.stack === history.stack && action !== 'start'
      ? nextData
      : withHistory(nextData, applied.stack, context);
  return { data: stored, result: played.result };
}

module.exports = { playGameAction, GameActionError, loadContext };
