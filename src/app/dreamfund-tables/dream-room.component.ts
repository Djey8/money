import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppComponent } from '../app.component';
import { LanguageService } from '../shared/services/language.service';
import {
  DreamApiService,
  DreamSessionService,
  type DreamBotCatalog,
  type DreamPlayerView,
} from './dream-session.service';
import {
  cardText,
  characterName,
  characters,
  choicesOf,
  dreamMoney,
  dreamTexts,
  eventText,
  lifeCardOf,
  type DreamTexts,
} from './dream-texts';

/**
 * One Dreamfund table (todo/dreamfund-multiplayer.md, slice 7): the waiting room (players, characters, bots, the host's start), the
 * game (every player's life in numbers, your own turn - the roll, the card's decisions, your money, the market, trades) and the result.
 * Everything shown comes from the server's view; a button is there only when the server's `legalActions` lists the move.
 */
@Component({
  selector: 'app-dream-room',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  providers: [DreamSessionService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../tables/tables.css', '../app.component.css'],
  template: `
    <div class="toolbar" role="banner">
      <div
        id="heading"
        role="button"
        tabindex="0"
        (click)="app.openNavBar()"
        (keydown.enter)="app.openNavBar()"
      >
        {{ v()?.settings?.name ?? t().title }}
      </div>
      <div class="spacer"></div>
      <a class="tx-btn tx-btn--small" routerLink="/dreamfund">{{ t().back }}</a>
    </div>

    <div class="dr-page" *ngIf="v() as view">
      <p class="dr-problem" *ngIf="session.problem() as problem">{{ problem }}</p>
      <p class="tx-muted" *ngIf="session.connection() === 'reconnecting'">{{ t().reconnecting }}</p>

      <!-- header -->
      <section class="tx-card dr-head">
        <div>
          <strong>{{ view.settings.name }}</strong>
          <small>
            {{ t()[phaseKey(view.phase)] }} · {{ t()[view.settings.difficulty] }} ·
            {{ view.settings.shape }} {{ view.settings.size }} · {{ view.settings.mode }}
            <ng-container *ngIf="view.phase === 'playing'">
              · {{ t().round }} {{ view.tableRound }}</ng-container
            >
          </small>
        </div>
        <small *ngIf="session.room()?.inviteCode as code"
          >{{ t().invite }}: <strong>{{ code }}</strong></small
        >
      </section>

      <!-- the waiting room -->
      <ng-container *ngIf="view.phase === 'lobby' || view.phase === 'picking'">
        <section class="tx-card">
          <h3>{{ t().seats }} {{ view.players.length }}/{{ view.settings.maxSeats }}</h3>
          <div class="dr-seat" *ngFor="let p of view.players">
            <span class="dr-dot" [style.background]="p.color"></span>
            <strong>{{ p.name }}</strong>
            <small *ngIf="p.bot">{{ t().bot }} · {{ p.bot.policyId }}</small>
            <small *ngIf="p.seat === view.hostSeat">{{ t().host }}</small>
            <small>{{ p.ready ? t().ready : t().notReady }}</small>
            <small *ngIf="p.pick && view.phase === 'picking'">{{ pickName(p.pick) }}</small>
            <button
              class="tx-btn tx-btn--small"
              *ngIf="session.can('kick') && p.seat !== view.hostSeat"
              (click)="kick(p.seat)"
            >
              {{ t().kick }}
            </button>
          </div>
          <div class="tx-actions">
            <button
              class="tx-btn"
              *ngIf="session.can('set_ready') && me() as mine"
              (click)="setReady(!mine.ready)"
            >
              {{ me()?.ready ? t().notReady : t().ready }}
            </button>
            <button class="tx-btn tx-btn--primary" *ngIf="session.can('start')" (click)="start()">
              {{ t().start }}
            </button>
            <button class="tx-btn" *ngIf="session.can('leave')" (click)="leave()">
              {{ t().leave }}
            </button>
            <button class="tx-btn" *ngIf="session.can('close')" (click)="close()">
              {{ t().closeTable }}
            </button>
          </div>
        </section>

        <section class="tx-card" *ngIf="session.can('add_bot')">
          <h3>{{ t().addBot }}</h3>
          <div class="dr-row">
            <select [(ngModel)]="botStrategy">
              <option *ngFor="let b of bots()?.items ?? []" [value]="b.id">{{ b.name }}</option>
            </select>
            <select [(ngModel)]="botLevel">
              <option *ngFor="let l of bots()?.levels ?? []" [value]="l.id">
                {{ levelText(l.id) }}
              </option>
            </select>
            <select [(ngModel)]="botCharacter">
              <option value="">{{ t().random }}</option>
              <option *ngFor="let c of chars()" [value]="c.id">{{ c.name }}</option>
            </select>
            <button class="tx-btn tx-btn--primary" (click)="addBot()">{{ t().addBot }}</button>
          </div>
          <small class="tx-muted">{{ t().levelHint }}</small>
        </section>

        <section class="tx-card" *ngIf="view.phase === 'picking' && session.can('pick_profession')">
          <h3>{{ t().pickCharacter }}</h3>
          <div class="dr-chars">
            <button
              type="button"
              class="dr-char"
              *ngFor="let c of chars()"
              [class.on]="me()?.pick === c.id"
              (click)="pick(c.id)"
            >
              <strong>{{ c.name }}</strong>
              <small>{{ c.tagline }}</small>
            </button>
            <button
              type="button"
              class="dr-char"
              [class.on]="me()?.pick === 'random'"
              (click)="pick('random')"
            >
              <strong>{{ t().random }}</strong>
            </button>
          </div>
        </section>
      </ng-container>

      <!-- the game -->
      <ng-container *ngIf="view.phase === 'playing' || view.phase === 'finished'">
        <section class="tx-card dr-players">
          <div
            class="dr-player"
            *ngFor="let p of ranked(); trackBy: trackSeat"
            [class.active]="p.seat === view.activeSeat"
            [class.you]="p.you"
          >
            <div class="dr-player-head">
              <span class="dr-dot" [style.background]="p.color"></span>
              <strong>{{ p.name }}</strong>
              <small>{{ pickName(p.professionId) }}</small>
              <small *ngIf="p.bot">{{ t().bot }}</small>
              <small *ngIf="p.away">{{ t().away }}</small>
              <small *ngIf="p.seat === view.activeSeat">▶ {{ t().onTheMove }}</small>
              <small *ngIf="outcomeOf(p.seat) as o">{{ t()[o] }}</small>
            </div>
            <ng-container *ngIf="p.summary as s">
              <div class="dr-goals">
                <div class="dr-goal" *ngFor="let g of goalKeys">
                  <span>{{ t()[g] }}</span>
                  <div class="dr-bar"><div [style.width.%]="s.goals[g] * 100"></div></div>
                  <small>{{ pct(s.goals[g]) }}</small>
                </div>
              </div>
              <div class="dr-nums">
                <span>{{ t().month }} {{ s.months }}</span>
                <span>{{ t().cash }} {{ m(s.cashMinor) }}</span>
                <span>{{ t().passive }} {{ m(s.passiveMinor) }} / {{ m(s.livingMinor) }}</span>
                <span>{{ t().netWorth }} {{ m(s.netWorthMinor) }}</span>
                <span *ngIf="s.bankLoanMinor">{{ t().bankLoan }} {{ m(s.bankLoanMinor) }}</span>
                <span>{{ t().points }} {{ s.dreamPoints }}</span>
              </div>
            </ng-container>
          </div>
          <div class="dr-markets" *ngIf="marketRows().length">
            <small>{{ t().markets }}:</small>
            <span
              *ngFor="let row of marketRows()"
              [class.up]="row.index > 1"
              [class.down]="row.index < 1"
              >{{ row.name }} {{ row.index | number: '1.2-2' }}</span
            >
          </div>
        </section>

        <!-- my turn -->
        <section class="tx-card dr-turn" *ngIf="view.phase === 'playing' && me() as mine">
          <h3 *ngIf="view.activeSeat === mine.seat">{{ t().yourTurn }}</h3>
          <h3 *ngIf="view.activeSeat !== mine.seat && activeName()">
            {{ activeName() }} {{ t().onTheMove }}
          </h3>

          <!-- the decision -->
          <ng-container *ngIf="view.activeSeat === mine.seat">
            <ng-container [ngSwitch]="pendingKind()">
              <div *ngSwitchCase="'emergency'">
                <h4>{{ card('emergency', pendingId()).title }}</h4>
                <p>{{ card('emergency', pendingId()).story }}</p>
                <p *ngIf="mine.pendingInfo?.emergency as e">
                  <ng-container *ngIf="e.payMinor !== null"
                    >{{ t().cost }} {{ m(e.payMinor) }}</ng-container
                  >
                </p>
                <div class="dr-row" *ngIf="emergencyChoices().length">
                  <small>{{ t().chooseHow }}:</small>
                  <button
                    type="button"
                    class="tx-btn tx-btn--small"
                    *ngFor="let c of emergencyChoices()"
                    [class.tx-btn--primary]="emergencyChoice === c.id"
                    (click)="emergencyChoice = c.id"
                  >
                    {{ c.label }}
                  </button>
                </div>
                <div class="tx-actions">
                  <button class="tx-btn tx-btn--primary" (click)="payEmergency('now')">
                    {{ t().payNow }}
                  </button>
                  <ng-container *ngIf="mine.pendingInfo?.emergency as e">
                    <button
                      class="tx-btn"
                      *ngFor="let plan of e.plans"
                      [disabled]="e.mustPayNow"
                      (click)="payEmergency(plan.months)"
                    >
                      {{ t().payPlan }} {{ plan.months }} {{ t().payDay }} ({{ m(plan.perMinor) }})
                    </button>
                  </ng-container>
                </div>
              </div>

              <div *ngSwitchCase="'life'">
                <h4>{{ life().title }}</h4>
                <p>{{ life().story }}</p>
                <div class="tx-actions">
                  <ng-container *ngIf="life().options.length; else plainLife">
                    <button
                      class="tx-btn tx-btn--primary"
                      *ngFor="let o of life().options"
                      (click)="answerLife({ option: o.id })"
                    >
                      {{ o.label }}
                    </button>
                  </ng-container>
                  <ng-template #plainLife>
                    <ng-container *ngIf="life().type === 'dice'">
                      <button class="tx-btn tx-btn--primary" (click)="answerLife('roll')">
                        {{ t().roll }}
                      </button>
                      <button class="tx-btn" *ngIf="life().optional" (click)="answerLife('pass')">
                        {{ t().pass }}
                      </button>
                    </ng-container>
                    <ng-container *ngIf="life().type === 'giving'">
                      <button class="tx-btn tx-btn--primary" (click)="answerLife('give')">
                        {{ t().accept }}
                      </button>
                      <button class="tx-btn" (click)="answerLife('lend')">{{ t().option }}</button>
                      <button class="tx-btn" (click)="answerLife('pass')">{{ t().pass }}</button>
                    </ng-container>
                    <ng-container *ngIf="life().type !== 'dice' && life().type !== 'giving'">
                      <button class="tx-btn tx-btn--primary" (click)="answerLife('accept')">
                        {{ t().accept }}
                      </button>
                      <button class="tx-btn" (click)="answerLife('decline')">
                        {{ t().decline }}
                      </button>
                    </ng-container>
                  </ng-template>
                </div>
              </div>

              <div *ngSwitchCase="'career_branch'">
                <h4>{{ t().chooseBranch }}</h4>
                <div class="tx-actions">
                  <button
                    class="tx-btn tx-btn--primary"
                    *ngFor="let o of branchOptions(); let i = index"
                    (click)="play({ type: 'choose_career_branch', index: i })"
                  >
                    {{ o }}
                  </button>
                </div>
              </div>

              <div *ngSwitchCase="'dream'">
                <h4>{{ t().chooseDream }}</h4>
                <div class="dr-offer" *ngFor="let d of mine.pendingInfo?.dreams ?? []">
                  <div>
                    <strong>{{ card('dream', d.id).title }}</strong>
                    <small>{{ m(d.totalMinor) }} · {{ d.points }} {{ t().points }}</small>
                    <small>{{ card('dream', d.id).story }}</small>
                  </div>
                  <button
                    class="tx-btn tx-btn--small tx-btn--primary"
                    (click)="play({ type: 'take_dream', cardId: d.id })"
                  >
                    {{ t().take }}
                  </button>
                </div>
                <button class="tx-btn" (click)="play({ type: 'skip' })">{{ t().skip }}</button>
              </div>

              <div *ngSwitchCase="'opportunity_pile'">
                <h4>{{ t().choosePile }}</h4>
                <div class="tx-actions">
                  <button
                    class="tx-btn tx-btn--primary"
                    *ngFor="let pile of piles"
                    (click)="play({ type: 'choose_pile', pile: pile })"
                  >
                    {{ t()[pile] }} · {{ t()[pile + 'Hint'] }}
                  </button>
                  <button class="tx-btn" (click)="play({ type: 'skip' })">{{ t().skip }}</button>
                </div>
              </div>

              <div *ngSwitchCase="'opportunity'">
                <div class="dr-offer" *ngFor="let o of mine.pendingInfo?.offers ?? []">
                  <div>
                    <strong>{{ card('opportunity', o.id).title }}</strong>
                    <small
                      >{{ t().cost }} {{ m(o.costMinor) }} · ≈ {{ m(o.monthlyMinor) }}
                      {{ t().perMonth }}</small
                    >
                    <small>{{ card('opportunity', o.id).story }}</small>
                  </div>
                  <button
                    class="tx-btn tx-btn--small tx-btn--primary"
                    [disabled]="!o.ok"
                    [title]="o.reason ?? ''"
                    (click)="play({ type: 'take_opportunity', cardId: o.id })"
                  >
                    {{ t().take }}
                  </button>
                </div>
                <button class="tx-btn" (click)="play({ type: 'skip' })">{{ t().skip }}</button>
              </div>

              <div *ngSwitchDefault class="tx-actions">
                <button
                  class="tx-btn tx-btn--primary"
                  *ngIf="session.can('roll')"
                  (click)="play({ type: 'roll' })"
                >
                  🎲 {{ t().roll }}
                </button>
                <button
                  class="tx-btn tx-btn--primary"
                  *ngIf="session.can('end_turn')"
                  (click)="play({ type: 'end_turn' })"
                >
                  {{ t().endTurn }}
                </button>
              </div>
            </ng-container>
          </ng-container>

          <!-- the market moved: anybody may sell into it -->
          <div class="dr-harvest" *ngIf="mine.harvest as h">
            <h4>{{ t().harvest }}</h4>
            <div class="tx-actions">
              <button
                class="tx-btn tx-btn--small"
                *ngFor="let title of h.sellable"
                (click)="play({ type: 'harvest_sell', holding: title })"
              >
                {{ t().sellIntoMarket }}: {{ title }}
              </button>
              <button
                class="tx-btn tx-btn--small"
                *ngFor="let s of h.sales"
                (click)="play({ type: 'harvest_accept', holding: s.holding })"
              >
                {{ t().buyerOffers }}: {{ s.holding }} {{ m(s.grossMinor) }}
              </button>
              <ng-container *ngFor="let l of h.ladders">
                <button
                  class="tx-btn tx-btn--small"
                  (click)="play({ type: 'harvest_ladder', holding: l.holding, action: 'ride' })"
                >
                  {{ t().ride }}: {{ l.holding }}
                </button>
                <button
                  class="tx-btn tx-btn--small"
                  (click)="play({ type: 'harvest_ladder', holding: l.holding, action: 'cash' })"
                >
                  {{ t().cashOut }}
                </button>
              </ng-container>
            </div>
          </div>

          <!-- a card offered to the others -->
          <div class="dr-trade" *ngIf="view.trade as tr">
            <h4>{{ tr.holding }} · {{ m(tr.priceMinor) }}</h4>
            <div class="tx-actions" *ngIf="tr.sellerSeat !== mine.seat">
              <button
                class="tx-btn tx-btn--primary"
                *ngIf="session.can('accept_trade')"
                (click)="play({ type: 'accept_trade' })"
              >
                {{ t().accept }}
              </button>
              <input
                type="number"
                class="dr-amount"
                [(ngModel)]="counterPrice"
                [placeholder]="t().price"
                *ngIf="session.can('counter_trade')"
              />
              <button
                class="tx-btn"
                *ngIf="session.can('counter_trade')"
                (click)="play({ type: 'counter_trade', priceMinor: minor(counterPrice) })"
              >
                {{ t().counter }}
              </button>
              <button
                class="tx-btn"
                *ngIf="session.can('decline_trade')"
                (click)="play({ type: 'decline_trade' })"
              >
                {{ t().decline }}
              </button>
            </div>
            <div class="tx-actions" *ngIf="tr.sellerSeat === mine.seat">
              <button class="tx-btn" (click)="play({ type: 'withdraw_trade' })">
                {{ t().withdraw }}
              </button>
              <button
                class="tx-btn tx-btn--small"
                *ngFor="let c of tr.counters"
                (click)="play({ type: 'accept_trade', from: c.seat })"
              >
                {{ names()[c.seat] }}: {{ m(c.priceMinor) }}
              </button>
            </div>
          </div>
        </section>

        <!-- my money -->
        <section class="tx-card dr-money" *ngIf="view.phase === 'playing' && me() as mine">
          <h3>{{ t().money }}</h3>
          <ng-container *ngIf="mine.summary as s">
            <p class="dr-nums">
              <span>{{ t().cash }} {{ m(s.cashMinor) }}</span>
              <span>{{ t().reserve }} {{ m(s.reserveMinor) }} / {{ m(s.reserveTargetMinor) }}</span>
              <span>{{ t().dream }} {{ m(s.dreamSavedMinor) }} / {{ m(s.dreamTargetMinor) }}</span>
              <span>{{ t().cashflow }} {{ m(s.cashflowMinor) }}</span>
            </p>
            <ng-container *ngIf="view.activeSeat === mine.seat">
              <div class="dr-row">
                <input
                  type="number"
                  class="dr-amount"
                  [(ngModel)]="amount"
                  [placeholder]="t().amount"
                />
                <button
                  class="tx-btn tx-btn--small"
                  (click)="play({ type: 'fund_reserve', amountMinor: minor(amount) })"
                >
                  {{ t().putInReserve }}
                </button>
                <button
                  class="tx-btn tx-btn--small"
                  (click)="play({ type: 'fund_dream', amountMinor: minor(amount) })"
                >
                  {{ t().putInDream }}
                </button>
                <button
                  class="tx-btn tx-btn--small"
                  *ngIf="s.bankLoanMinor"
                  (click)="play({ type: 'repay_bank_loan', amountMinor: minor(amount) })"
                >
                  {{ t().repayBank }}
                </button>
              </div>
              <div class="dr-row" *ngIf="s.debts.length">
                <small>{{ t().debts }}:</small>
                <button
                  class="tx-btn tx-btn--small"
                  *ngFor="let d of s.debts"
                  (click)="play({ type: 'repay_debt', tag: d.tag })"
                >
                  {{ t().repay }} {{ d.tag }} ({{ m(d.amountMinor) }})
                </button>
              </div>
            </ng-container>
            <div *ngIf="s.holdings.length">
              <small>{{ t().holdings }}:</small>
              <div class="dr-holding" *ngFor="let h of s.holdings">
                <span>{{ h.title }} · {{ m(h.monthlyMinor) }} {{ t().perMonth }}</span>
                <span class="dr-row" *ngIf="view.activeSeat === mine.seat">
                  <button
                    class="tx-btn tx-btn--small"
                    (click)="play({ type: 'sell_holding', holding: h.title })"
                  >
                    {{ t().sell }}
                  </button>
                  <ng-container *ngIf="!view.trade && session.can('offer_trade')">
                    <input
                      type="number"
                      class="dr-amount"
                      [(ngModel)]="tradePrice"
                      [placeholder]="t().price"
                    />
                    <button
                      class="tx-btn tx-btn--small"
                      (click)="
                        play({
                          type: 'offer_trade',
                          holding: h.title,
                          priceMinor: minor(tradePrice),
                        })
                      "
                    >
                      {{ t().offerTrade }}
                    </button>
                  </ng-container>
                </span>
              </div>
            </div>
            <div *ngIf="s.plans.length">
              <small>{{ t().plans }}:</small>
              <small *ngFor="let plan of s.plans">
                {{ plan.kind }} {{ m(plan.perMinor) }} → {{ m(plan.leftMinor) }}</small
              >
            </div>
            <div class="tx-actions" *ngIf="mine.paydayDue && session.can('settle_payday')">
              <button class="tx-btn" (click)="play({ type: 'settle_payday' })">
                {{ t().settleMonth }}
              </button>
            </div>
          </ng-container>
        </section>

        <!-- the result -->
        <section class="tx-card" *ngIf="view.result as r">
          <h3>{{ t().result }}</h3>
          <div class="dr-rank" *ngFor="let row of r.ranking">
            <strong>{{ row.rank }}.</strong>
            <span>{{ names()[row.seat] }}</span>
            <small>{{
              t()[
                row.outcome === 'won'
                  ? 'won'
                  : row.outcome === 'bankrupt'
                    ? 'bankrupt'
                    : row.outcome === 'left'
                      ? 'left'
                      : 'playing'
              ]
            }}</small>
            <small
              >{{ t().score }} {{ row.score }} · {{ t().points }} {{ row.dreamPoints }} ·
              {{ row.goalsMet }}/4</small
            >
          </div>
        </section>

        <section class="tx-card dr-log">
          <h3>{{ t().history }}</h3>
          <div class="dr-log-line" *ngFor="let line of lines()">{{ line }}</div>
        </section>
      </ng-container>
    </div>
  `,
  styles: [
    `
      .dr-page {
        max-width: 820px;
        margin: 0 auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .dr-problem {
        color: var(--color-danger, #c62828);
      }
      .dr-head {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: baseline;
        flex-wrap: wrap;
      }
      .dr-head small,
      .dr-seat small,
      .dr-player-head small {
        color: var(--color-text-secondary, #666);
        margin-left: 0.4rem;
      }
      .dr-seat,
      .dr-row,
      .dr-player-head,
      .dr-rank,
      .dr-holding,
      .dr-offer {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .dr-offer {
        justify-content: space-between;
        padding: 0.5rem 0;
        border-top: 1px solid var(--color-border);
      }
      .dr-offer > div {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 200px;
      }
      .dr-dot {
        width: 0.8rem;
        height: 0.8rem;
        border-radius: 50%;
        display: inline-block;
        flex: none;
      }
      .dr-players {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
      }
      .dr-player {
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 0.6rem;
      }
      .dr-player.active {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 1px var(--color-primary);
      }
      .dr-player.you {
        background: var(--color-primary-soft, rgba(25, 118, 210, 0.06));
      }
      .dr-goals {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.4rem 0.8rem;
        margin-top: 0.4rem;
      }
      .dr-goal {
        display: grid;
        grid-template-columns: 1fr 2fr auto;
        gap: 0.4rem;
        align-items: center;
        font-size: 0.8rem;
      }
      .dr-bar {
        height: 0.5rem;
        background: var(--color-border);
        border-radius: 4px;
        overflow: hidden;
      }
      .dr-bar > div {
        height: 100%;
        background: var(--color-primary);
      }
      .dr-nums {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem 1rem;
        font-size: 0.85rem;
        margin-top: 0.4rem;
      }
      .dr-markets {
        display: flex;
        gap: 0.8rem;
        flex-wrap: wrap;
        font-size: 0.85rem;
      }
      .dr-markets .up {
        color: #2e7d32;
      }
      .dr-markets .down {
        color: #c62828;
      }
      .dr-chars {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.5rem;
      }
      .dr-char {
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 0.5rem;
        background: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
      }
      .dr-char.on {
        border-color: var(--color-primary);
        background: var(--color-primary-soft, rgba(25, 118, 210, 0.12));
      }
      .dr-amount {
        width: 8rem !important;
      }
      .dr-log {
        max-height: 280px;
        overflow: auto;
      }
      .dr-log-line {
        font-size: 0.85rem;
        padding: 0.1rem 0;
      }
    `,
  ],
})
export class DreamRoomComponent implements OnInit, OnDestroy {
  readonly session = inject(DreamSessionService);
  private readonly api = inject(DreamApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);

  readonly app = AppComponent;
  readonly goalKeys = ['reserve', 'debts', 'dream', 'independence'] as const;
  readonly piles = ['seed', 'sapling', 'tree'] as const;

  readonly v = this.session.view;
  readonly me = computed<DreamPlayerView | null>(
    () => this.v()?.players.find((player) => player.you) ?? null,
  );
  readonly bots = signal<DreamBotCatalog | null>(null);
  readonly names = computed(() => (this.v()?.players ?? []).map((p) => p.name));
  readonly ranked = computed(() => {
    const view = this.v();
    if (!view) return [];
    const rank = new Map((view.result?.ranking ?? []).map((r) => [r.seat, r.rank]));
    return [...view.players].sort(
      (a, b) => (rank.get(a.seat) ?? a.seat) - (rank.get(b.seat) ?? b.seat),
    );
  });
  readonly lines = computed(() =>
    this.session
      .events()
      .map((line) => eventText(line, this.names(), this.lang, (minor) => this.m(minor)))
      .filter((text) => text !== '')
      .slice(-40)
      .reverse(),
  );

  botStrategy = 'expert';
  botLevel = 'master';
  botCharacter = '';
  emergencyChoice = '';
  amount: number | null = null;
  tradePrice: number | null = null;
  counterPrice: number | null = null;

  get lang(): string {
    return this.language.current;
  }
  readonly t = computed<DreamTexts>(() => dreamTexts(this.lang));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.session.open(id);
    this.api
      .bots()
      .subscribe({ next: (catalog) => this.bots.set(catalog), error: () => undefined });
  }

  ngOnDestroy(): void {
    this.session.close();
  }

  chars = () => characters(this.lang);
  trackSeat = (_: number, p: DreamPlayerView) => p.seat;

  phaseKey(phase: string): 'lobby' | 'picking' | 'playing' | 'finished' | 'closed' {
    return phase === 'abandoned' ? 'closed' : (phase as 'lobby');
  }
  levelText(id: string): string {
    return this.t()[id as 'master'] ?? id;
  }
  pickName(id: string | null): string {
    return id === 'random' ? this.t().random : id ? characterName(id, this.lang) : '';
  }
  m(minor: number): string {
    return dreamMoney(minor, this.lang);
  }
  minor(units: number | null): number {
    return Math.round((Number(units) || 0) * 100);
  }
  pct(share: number): string {
    return `${Math.round(share * 100)}%`;
  }
  card(deck: 'emergency' | 'life' | 'dream' | 'opportunity', id: string) {
    return cardText(deck, id, this.lang);
  }
  outcomeOf(seat: number): 'won' | 'bankrupt' | 'left' | null {
    const view = this.v();
    if (!view) return null;
    const finisher = view.finishers.find((f) => f.seat === seat);
    if (finisher) return finisher.outcome;
    return view.players[seat]?.status === 'left' ? 'left' : null;
  }
  activeName(): string {
    const view = this.v();
    return view && view.activeSeat !== null ? (view.players[view.activeSeat]?.name ?? '') : '';
  }
  marketRows(): { name: string; index: number }[] {
    return Object.entries(this.v()?.markets ?? {})
      .map(([name, index]) => ({ name, index }))
      .filter((row) => Math.abs(row.index - 1) >= 0.05);
  }

  pendingKind(): string {
    return this.me()?.pending?.kind ?? '';
  }
  pendingId(): string {
    return (this.me()?.pending as { cardId?: string } | null)?.cardId ?? '';
  }
  life() {
    return lifeCardOf(this.pendingId(), this.lang);
  }
  emergencyChoices() {
    return choicesOf(this.pendingId(), this.lang);
  }
  branchOptions(): string[] {
    return (this.me()?.pending as { options?: string[] } | null)?.options ?? [];
  }

  async play(command: Record<string, unknown>): Promise<void> {
    await this.session.play(command);
  }
  payEmergency(pay: 'now' | number): Promise<void> {
    return this.play({
      type: 'pay_emergency',
      pay,
      ...(this.emergencyChoice ? { choiceId: this.emergencyChoice } : {}),
    });
  }
  answerLife(decision: string | { option: string }): Promise<void> {
    return this.play({ type: 'answer_life', decision });
  }

  setReady(ready: boolean): void {
    void this.session.lobby('ready', { ready });
  }
  start(): void {
    void this.session.lobby('start');
  }
  kick(seat: number): void {
    void this.session.lobby('kick', { seat });
  }
  leave(): void {
    void this.session.lobby('leave').then(() => this.router.navigate(['/dreamfund']));
  }
  pick(professionId: string): void {
    void this.session.lobby('profession', { professionId });
  }
  addBot(): void {
    void this.session.lobby('bots', {
      policyId: `dream:${this.botStrategy}`,
      level: this.botLevel,
      ...(this.botCharacter ? { professionId: this.botCharacter } : {}),
    });
  }
  close(): void {
    if (!window.confirm(this.t().confirmClose)) return;
    this.api.remove(this.session.tableId).subscribe({
      next: () => void this.router.navigate(['/dreamfund']),
      error: () => undefined,
    });
  }
}
