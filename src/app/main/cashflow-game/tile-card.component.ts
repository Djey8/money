import { gameError } from 'src/app/shared/game-error-text';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type {
  AssetKind,
  HarvestCard,
  HarvestFactorBand,
  HarvestHolderEffect,
  HarvestTopics,
  OpportunityCard,
  OpportunityChoice,
  OpportunityPile,
} from '@money/domain';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  assetKindOf,
  cardText,
  dreamsForMoment,
  fromMinorUnits,
  keywordsOfCard,
  type DreamMomentId,
  type LifeCard,
  type LifeDecision,
  type LifeEffect,
  type LifeOutcome,
} from '@money/domain';
import { AppNumberPipe } from '../../shared/pipes/app-number.pipe';
import { AppStateService } from '../../shared/services/app-state.service';
import { CashflowGameService } from '../../shared/services/cashflow-game.service';
import { ToastService } from '../../shared/services/toast.service';

/** One card of a stack in the grid of the free rules. */
interface PickerItem {
  id: string;
  title: string;
  tag: string;
}

/** How long the pile is shuffled before a card is shown (shorter for a card that was picked). */
const SHUFFLE_MS = 800;
const SHUFFLE_PICKED_MS = 350;

/** How long the die tumbles before the result is shown. */
const ROLL_MS = 1000;

/** One row of a dice table: the numbers on the die, and what they do. */
export interface DiceRowView {
  range: string;
  lines: string[];
  tone: 'good' | 'bad' | 'neutral';
}

interface OpportunityRollLike {
  cashflowMinor?: number;
  monthlySavingsMinor?: number;
  oneTimeMinor?: number;
  assetValueMinor?: number;
  extraCostPercent?: number;
  laterCost?: { afterPaydays: number; minor: number };
  rentCutPercent?: number;
  paydays?: number;
  capitalLossPercent?: number;
}

interface OpportunityBandLike extends OpportunityRollLike {
  rollAgain?: { from: number; to: number; value: OpportunityRollLike }[];
}

/**
 * The body of a Dreamfund tile that has a stack of cards (JFK, 2026-10-26): Emergency, Life, Career, Dream. The flow is the same on all of
 * them. First the card is opened (the only choice where it cannot be refused; a dream can be declined). Under the free rules the
 * card is searched in a small grid with quick filters - or shuffled; under the others it is drawn at once. Then the card is read and
 * dealt with; a die is always seen rolling, then its result is told. What the card decides is kept in the game; money is settled with
 * the app's own components (the Fire and the Smile project), which the buttons open.
 */
@Component({
  selector: 'app-tile-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="tc" [attr.data-tile]="tile">
      <!-- the dice of this tile, tumbling and then at rest -->
      <div class="tc-dice" *ngIf="faces.length" aria-live="polite">
        <span
          class="tc-die"
          *ngFor="let face of faces; trackBy: trackIndex"
          [class.tc-die--tumbling]="rolling"
          role="img"
          [attr.aria-label]="'CashflowGame.diceRolled' | translate: { roll: face }"
        >
          <i
            class="tc-pip"
            *ngFor="let on of dieCells(face); trackBy: trackIndex"
            [class.tc-pip--on]="on"
          ></i>
        </span>
      </div>

      <ng-container [ngSwitch]="tile">
        <!-- ───────────── EMERGENCY ───────────── -->
        <ng-container *ngSwitchCase="'emergency'">
          <ng-container *ngIf="emergency as e; else emergencyClosed">
            <h4 class="tc-title">
              {{ e.card.title[lang] }}
              <small class="tc-tag tc-tag--{{ e.card.tier }}">{{
                'CashflowGame.emergency.tier.' + e.card.tier | translate
              }}</small>
            </h4>
            <p>{{ e.card.story[lang] }}</p>

            <div class="tc-choices" *ngIf="e.card.type === 'choice' && !e.projectTitle">
              <button
                *ngFor="let option of e.card.choices; trackBy: trackId"
                type="button"
                class="tc-choice"
                [class.tc-choice--on]="e.selection.choiceId === option.id"
                (click)="chooseEmergency(option.id)"
              >
                <span>{{ option.label[lang] }}</span>
                <strong>{{ amount(option.amountMinor) }}</strong>
              </button>
            </div>

            <button
              *ngIf="!e.projectTitle && !rolling && e.quote.needsRolls[0] as key"
              type="button"
              class="tc-btn tc-btn--primary tc-btn--wide"
              [disabled]="busy"
              (click)="rollEmergency(key)"
            >
              🎲 {{ 'CashflowGame.emergency.rollFor' | translate }}
            </button>
            <button
              *ngIf="!e.projectTitle && !rolling && e.quote.canReroll && e.card.reroll"
              type="button"
              class="tc-btn tc-btn--wide"
              [disabled]="busy"
              (click)="rerollEmergency()"
            >
              {{ e.card.reroll.label[lang] }}:
              {{
                'CashflowGame.emergency.rerollOffer'
                  | translate: { cost: amount(e.card.reroll.costMinor) }
              }}
            </button>

            <ng-container *ngIf="e.quote.ready && !rolling">
              <ul class="tc-lines">
                <li *ngFor="let bucket of e.quote.buckets; trackBy: trackId">
                  <span>{{ bucket.title[lang] }}</span>
                  <strong>{{ amount(bucket.amountMinor) }} {{ currency }}</strong>
                </li>
              </ul>
              <p class="tc-good" *ngIf="e.quote.insured && e.quote.savedMinor > 0">
                {{
                  'CashflowGame.emergency.insuredSaved'
                    | translate: { saved: amount(e.quote.savedMinor), currency: currency }
                }}
              </p>
              <p class="tc-bad" *ngIf="!e.quote.insured && e.card.insurance">
                {{ 'CashflowGame.emergency.notInsured' | translate }}
              </p>
              <p class="tc-note" *ngIf="e.card.insuranceNote">{{ e.card.insuranceNote[lang] }}</p>
              <ng-container *ngIf="!e.projectTitle">
                <p class="tc-bad">{{ 'CashflowGame.emergency.cannotDecline' | translate }}</p>
                <button
                  type="button"
                  class="tc-btn tc-btn--primary tc-btn--wide"
                  [disabled]="busy"
                  (click)="createEmergency()"
                >
                  {{ 'CashflowGame.emergency.createProject' | translate }}
                </button>
              </ng-container>
              <ng-container *ngIf="e.projectTitle">
                <p class="tc-good">
                  ✓ {{ 'CashflowGame.emergency.created' | translate: { project: e.projectTitle } }}
                </p>
                <button
                  type="button"
                  class="tc-btn tc-btn--primary tc-btn--wide"
                  (click)="openFire.emit(e.projectTitle)"
                >
                  {{ 'CashflowGame.emergency.openProject' | translate }} ›
                </button>
              </ng-container>
            </ng-container>
          </ng-container>
          <ng-template #emergencyClosed>
            <ng-container
              *ngTemplateOutlet="
                closed;
                context: { text: 'CashflowGame.emergency.intro', canDecline: false }
              "
            ></ng-container>
          </ng-template>
        </ng-container>

        <!-- ───────────── LIFE ───────────── -->
        <ng-container *ngSwitchCase="'life'">
          <ng-container *ngIf="life as l; else lifeClosed">
            <h4 class="tc-title">{{ l.card.title[lang] }}</h4>
            <p>{{ l.card.story[lang] }}</p>
            <section class="tc-dice-table" *ngIf="lifeDiceRows(l.card) as rows">
              <ng-container *ngIf="rows.length > 0 && !l.outcome && !rolling">
                <h5>{{ 'CashflowGame.dice.title' | translate }}</h5>
                <div class="tc-dice-row" *ngFor="let row of rows" [attr.data-tone]="row.tone">
                  <strong class="tc-dice-range">{{ row.range }}</strong>
                  <span>
                    <span
                      *ngFor="let line of row.lines; trackBy: trackValue"
                      class="tc-dice-line"
                      >{{ line }}</span
                    >
                  </span>
                </div>
              </ng-container>
            </section>
            <ng-container *ngIf="!l.outcome && !rolling">
              <ul class="tc-bullets" *ngIf="preview(l.card) as effect">
                <li *ngFor="let line of effectLines(effect)">{{ line }}</li>
              </ul>
              <div class="tc-actions">
                <button
                  *ngIf="l.card.type === 'fate'"
                  type="button"
                  class="tc-btn tc-btn--primary tc-btn--wide"
                  [disabled]="busy"
                  (click)="decideLife({ kind: 'fate' })"
                >
                  {{ 'CashflowGame.life.letItHappen' | translate }}
                </button>
                <ng-container *ngIf="l.card.type === 'choice' && !l.card.options">
                  <button
                    type="button"
                    class="tc-btn tc-btn--primary"
                    [disabled]="busy"
                    (click)="decideLife({ kind: 'accept' })"
                  >
                    {{ 'CashflowGame.life.accept' | translate }}
                  </button>
                  <button
                    *ngIf="lifeCanDecline"
                    type="button"
                    class="tc-btn"
                    [disabled]="busy"
                    (click)="decideLife({ kind: 'decline' })"
                  >
                    {{ 'CashflowGame.life.decline' | translate }}
                  </button>
                </ng-container>
                <button
                  *ngFor="let option of l.card.options ?? []; trackBy: trackId"
                  type="button"
                  class="tc-btn tc-btn--primary tc-btn--wide"
                  [disabled]="busy"
                  (click)="decideLife({ kind: 'option', id: option.id })"
                >
                  {{ option.label[lang] }}
                  <small *ngFor="let line of effectLines(option.effect)"> · {{ line }}</small>
                </button>
                <ng-container *ngIf="l.card.type === 'dice'">
                  <button
                    type="button"
                    class="tc-btn tc-btn--primary"
                    [disabled]="busy"
                    (click)="decideLife({ kind: 'roll' })"
                  >
                    🎲 {{ 'CashflowGame.life.rollForIt' | translate }}
                  </button>
                  <button
                    *ngIf="l.card.optional && lifeCanDecline"
                    type="button"
                    class="tc-btn"
                    [disabled]="busy"
                    (click)="decideLife({ kind: 'pass' })"
                  >
                    {{ 'CashflowGame.life.pass' | translate }}
                  </button>
                </ng-container>
                <ng-container *ngIf="l.card.type === 'giving'">
                  <button
                    type="button"
                    class="tc-btn tc-btn--primary"
                    [disabled]="busy"
                    (click)="decideLife({ kind: 'give' })"
                  >
                    {{ 'CashflowGame.life.give' | translate }}
                  </button>
                  <button
                    *ngIf="l.card.lend"
                    type="button"
                    class="tc-btn"
                    [disabled]="busy"
                    (click)="decideLife({ kind: 'lend' })"
                  >
                    {{ 'CashflowGame.life.lend' | translate }}
                  </button>
                  <button
                    type="button"
                    class="tc-btn"
                    [disabled]="busy"
                    (click)="decideLife({ kind: 'pass' })"
                  >
                    {{ 'CashflowGame.life.pass' | translate }}
                  </button>
                </ng-container>
              </div>
            </ng-container>
            <ul class="tc-bullets tc-bullets--done" *ngIf="l.outcome && !rolling">
              <li *ngFor="let line of outcomeLines(l.outcome)">{{ line }}</li>
            </ul>
            <p class="tc-note" *ngIf="l.outcome?.softened && !rolling">
              {{ 'CashflowGame.life.softened' | translate }}
            </p>
          </ng-container>
          <ng-template #lifeClosed>
            <ng-container
              *ngTemplateOutlet="
                closed;
                context: { text: 'CashflowGame.life.intro', canDecline: false }
              "
            ></ng-container>
          </ng-template>
        </ng-container>

        <!-- ───────────── CAREER ───────────── -->
        <ng-container *ngSwitchCase="'career'">
          <ng-container *ngIf="career as c">
            <div class="tc-ladder">
              <div class="tc-ladder-now">
                <span class="tc-ladder-icon" aria-hidden="true">💼</span>
                <span>
                  <small>{{ 'CashflowGame.career.now' | translate }}</small>
                  <strong>{{ c.title }}</strong>
                  <small
                    >{{ 'CashflowGame.career.stage' | translate }} {{ c.stageNumber }}
                    {{
                      c.branch === 'technical' ? '🔧' : c.branch === 'management' ? '👥' : ''
                    }}</small
                  >
                </span>
              </div>
              <ng-container *ngIf="next as n; else atTop">
                <div class="tc-ladder-arrow" aria-hidden="true">↓</div>
                <div class="tc-ladder-next">
                  <small>{{ 'CashflowGame.career.next' | translate }}</small>
                  <strong *ngFor="let option of n.stages; trackBy: trackId">
                    {{
                      option.branch === 'technical'
                        ? '🔧'
                        : option.branch === 'management'
                          ? '👥'
                          : ''
                    }}
                    {{ option.title }} · {{ option.grossYear | appNumber: '1.0-0' : false }}
                    {{ currency }} / {{ 'CashflowGame.career.year' | translate }}
                  </strong>
                  <div
                    class="tc-progress"
                    role="progressbar"
                    [attr.aria-valuenow]="n.paydaysIn"
                    [attr.aria-valuemax]="n.minPaydays"
                  >
                    <span [style.width.%]="progress(n)"></span>
                  </div>
                  <small>
                    {{
                      'CashflowGame.career.paydaysIn'
                        | translate: { now: n.paydaysIn, min: n.minPaydays }
                    }}
                    ·
                    {{ 'CashflowGame.career.needs' | translate: { roll: n.rollFrom } }}
                  </small>
                </div>
              </ng-container>
              <ng-template #atTop>
                <p class="tc-good">{{ 'CashflowGame.career.topText' | translate }}</p>
              </ng-template>
            </div>

            <ng-container *ngIf="careerResult as r; else careerOpen">
              <ng-container *ngIf="!rolling">
                <p
                  class="tc-result"
                  [class.tc-result--good]="
                    r.kind === 'promoted' || r.kind === 'branch' || r.kind === 'moment'
                  "
                  [ngSwitch]="r.kind"
                >
                  <ng-container *ngSwitchCase="'promoted'"
                    >🎉 {{ 'CashflowGame.career.promoted' | translate }}</ng-container
                  >
                  <ng-container *ngSwitchCase="'branch'"
                    >🎉 {{ 'CashflowGame.career.promotedBranch' | translate }}</ng-container
                  >
                  <ng-container *ngSwitchCase="'failed'">{{
                    'CashflowGame.career.failed' | translate
                  }}</ng-container>
                  <ng-container *ngSwitchCase="'moment'">{{
                    momentKey($any(r).moment) | translate
                  }}</ng-container>
                  <ng-container *ngSwitchCase="'waiting'">{{
                    'CashflowGame.career.waiting' | translate: { count: $any(r).paydaysLeft }
                  }}</ng-container>
                  <ng-container *ngSwitchCase="'top'">{{
                    'CashflowGame.career.topText' | translate
                  }}</ng-container>
                </p>
                <p class="tc-bad" *ngIf="r.kind === 'failed' && $any(r).retakeMinor">
                  {{ $any(r).retakeLabel?.[lang] }}: {{ amount($any(r).retakeMinor) }}
                  {{ currency }}
                </p>
                <div class="tc-actions" *ngIf="r.kind === 'branch' && careerView">
                  <button
                    *ngFor="let option of careerView.options; trackBy: trackId"
                    type="button"
                    class="tc-btn tc-btn--primary tc-btn--wide"
                    [disabled]="busy"
                    (click)="chooseBranch(option.id)"
                  >
                    {{ option.branch === 'technical' ? '🔧' : '👥' }} {{ option.title[lang] }}
                  </button>
                </div>
                <div
                  class="tc-woohoo"
                  *ngIf="careerView?.reached && careerView?.before && careerView?.after as _ok"
                >
                  <h4>🎉 Woohoo! {{ careerView!.reached!.title[lang] }}</h4>
                  <p>{{ careerView!.reached!.story[lang] }}</p>
                  <table>
                    <tr>
                      <th></th>
                      <th>{{ 'CashflowGame.career.before' | translate }}</th>
                      <th>{{ 'CashflowGame.career.after' | translate }}</th>
                    </tr>
                    <tr>
                      <td>{{ 'CashflowGame.career.salary' | translate }}</td>
                      <td>{{ amount(careerView!.before!.salaryMinor) }}</td>
                      <td>{{ amount(careerView!.after!.salaryMinor) }}</td>
                    </tr>
                    <tr>
                      <td>{{ 'CashflowGame.career.net' | translate }}</td>
                      <td>{{ amount(careerView!.before!.netMinor) }}</td>
                      <td>{{ amount(careerView!.after!.netMinor) }}</td>
                    </tr>
                    <tr>
                      <td>{{ 'CashflowGame.career.expenses' | translate }}</td>
                      <td>{{ amount(careerView!.before!.expensesMinor) }}</td>
                      <td>{{ amount(careerView!.after!.expensesMinor) }}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>{{ 'CashflowGame.career.monthly' | translate }}</strong>
                      </td>
                      <td>{{ amount(careerView!.before!.cashflowMinor) }}</td>
                      <td>
                        <strong>{{ amount(careerView!.after!.cashflowMinor) }}</strong>
                      </td>
                    </tr>
                  </table>
                </div>
              </ng-container>
            </ng-container>
            <ng-template #careerOpen>
              <button
                *ngIf="next?.eligible"
                type="button"
                class="tc-btn tc-btn--gold tc-btn--wide"
                [disabled]="busy || rolling"
                (click)="rollCareer()"
              >
                {{ 'CashflowGame.career.roll' | translate }}
              </button>
              <p class="tc-note" *ngIf="next && !next.eligible">
                {{
                  'CashflowGame.career.tooEarly'
                    | translate: { count: next.minPaydays - next.paydaysIn }
                }}
              </p>
            </ng-template>
          </ng-container>
        </ng-container>

        <!-- ───────────── HARVEST ───────────── -->
        <ng-container *ngSwitchCase="'harvest'">
          <ng-container *ngIf="harvest as h">
            <ng-container *ngIf="h.card as c; else harvestClosed">
              <header class="tc-card-head">
                <span class="tc-kind tc-kind--harvest">{{
                  'CashflowGame.harvest.group.' + c.group | translate
                }}</span>
                <span
                  class="tc-involve"
                  [class.tc-involve--me]="h.involved.length > 0"
                  *ngIf="h.topics"
                >
                  {{
                    (h.involved.length > 0
                      ? 'CashflowGame.harvest.touchesYou'
                      : 'CashflowGame.harvest.notYou'
                    ) | translate
                  }}
                </span>
              </header>
              <h4 class="tc-card-title">{{ c.title[lang] }}</h4>
              <div class="tc-keys" *ngIf="h.topics as topics">
                <span
                  class="tc-key"
                  *ngFor="let key of harvestKeys(topics); trackBy: trackValue"
                  [class.tc-key--mine]="mineOf(key, h)"
                >
                  {{ keywordLabel(key) }}
                </span>
              </div>
              <p class="tc-card-story">{{ c.story[lang] }}</p>

              <!-- what the card does to everybody -->
              <ul class="tc-effects" *ngIf="h.told.length">
                <li
                  class="tc-effect"
                  *ngFor="let line of h.told; trackBy: trackValue"
                  [attr.data-tone]="toneOf(line)"
                >
                  {{ line }}
                </li>
              </ul>

              <!-- what it means for what you own -->
              <section class="tc-mine" *ngIf="h.topics">
                <h5>{{ 'CashflowGame.harvest.aboutYou' | translate }}</h5>
                <p class="tc-note" *ngIf="h.involved.length === 0">
                  {{ 'CashflowGame.harvest.noneOfYours' | translate }}
                </p>
                <div class="tc-hold" *ngFor="let own of h.involved; trackBy: trackInvolved">
                  <span class="tc-kind" [attr.data-kind]="own.kind">{{
                    'CashflowGame.kind.' + own.kind | translate
                  }}</span>
                  <strong>{{ own.label }}</strong>
                </div>
                <button
                  type="button"
                  class="tc-btn tc-btn--wide"
                  *ngIf="h.involved.length > 0"
                  (click)="openGrow.emit(h.involved[0].title)"
                >
                  {{ 'CashflowGame.harvest.seeInGrow' | translate }} ›
                </button>
              </section>

              <ng-container *ngFor="let table of harvestDiceTables(c); trackBy: trackTable">
                <section class="tc-dice-table">
                  <h5>
                    {{ 'CashflowGame.dice.title' | translate
                    }}<ng-container *ngIf="table.title"> · {{ table.title }}</ng-container>
                  </h5>
                  <div
                    class="tc-dice-row"
                    *ngFor="let row of table.rows"
                    [attr.data-tone]="row.tone"
                  >
                    <strong class="tc-dice-range">{{ row.range }}</strong>
                    <span>
                      <span
                        *ngFor="let line of row.lines; trackBy: trackValue"
                        class="tc-dice-line"
                        >{{ line }}</span
                      >
                    </span>
                  </div>
                </section>
              </ng-container>
              <p class="tc-note" *ngIf="c.realWorld">{{ cardText(c.realWorld, lang) }}</p>

              <!-- a window to sell in: what you own in an open market -->
              <section class="tc-market" *ngIf="h.window.length">
                <h5>{{ 'CashflowGame.harvest.windowOpen' | translate }}</h5>
                <div class="tc-sale" *ngFor="let w of h.window; trackBy: trackHoldingTitle">
                  <span>
                    {{ w.label }} · {{ w.units }} × {{ amount(w.unitMinor) }} {{ currency }}
                  </span>
                  <input
                    *ngIf="w.isShare && w.units > 1"
                    type="number"
                    min="1"
                    [max]="w.units"
                    [value]="soldUnits(w.holding, w.units)"
                    (input)="setSoldUnits(w.holding, $any($event.target).value)"
                  />
                  <button
                    type="button"
                    class="tc-btn tc-btn--primary"
                    [disabled]="busy"
                    (click)="sell(w)"
                  >
                    {{ 'CashflowGame.harvest.sell' | translate }}
                  </button>
                </div>
              </section>

              <!-- a buyer: what is offered -->
              <section class="tc-market" *ngIf="h.sales.length">
                <h5>{{ 'CashflowGame.harvest.buyer' | translate }}</h5>
                <div class="tc-sale" *ngFor="let sale of h.sales; trackBy: trackHoldingTitle">
                  <span>
                    {{ sale.label }}: {{ amount(sale.grossMinor) }} {{ currency }}
                    <small *ngIf="sale.costsMinor || sale.owedMinor">
                      ({{
                        'CashflowGame.harvest.costsOwed'
                          | translate
                            : { costs: amount(sale.costsMinor), owed: amount(sale.owedMinor) }
                      }})
                    </small>
                    <strong>= {{ amount(sale.netMinor) }} {{ currency }}</strong>
                  </span>
                  <button
                    type="button"
                    class="tc-btn tc-btn--primary"
                    [disabled]="busy"
                    (click)="acceptSale(sale.holding)"
                  >
                    {{ 'CashflowGame.harvest.sell' | translate }}
                  </button>
                </div>
              </section>

              <!-- a hype to ride -->
              <section
                class="tc-market"
                *ngFor="let ladder of h.ladders; trackBy: trackHoldingTitle"
              >
                <h5>{{ 'CashflowGame.harvest.hype' | translate }}: {{ ladder.label }}</h5>
                <p>
                  {{
                    'CashflowGame.harvest.stake'
                      | translate
                        : {
                            stake: amount(ladder.stakeMinor),
                            at:
                              ladder.steps < 0 ? 0 : amount(ladder.stakeMinor * ladder.multiplier),
                          }
                  }}
                  ·
                  {{
                    'CashflowGame.harvest.needs'
                      | translate: { from: ladder.successFrom, step: ladder.step }
                  }}
                </p>
                <ul class="tc-bullets tc-bullets--done" *ngIf="ladder.told.length">
                  <li *ngFor="let line of ladder.told; trackBy: trackValue">{{ line }}</li>
                </ul>
                <div class="tc-actions" *ngIf="ladder.state !== 'done'">
                  <button
                    type="button"
                    class="tc-btn tc-btn--primary"
                    [disabled]="busy"
                    (click)="ride(ladder.holding)"
                  >
                    🎲
                    {{
                      (ladder.state === 'riding'
                        ? 'CashflowGame.harvest.rollAgain'
                        : 'CashflowGame.harvest.ride'
                      ) | translate
                    }}
                  </button>
                  <button
                    type="button"
                    class="tc-btn"
                    *ngIf="ladder.state === 'riding'"
                    [disabled]="busy"
                    (click)="cashOut(ladder.holding)"
                  >
                    {{ 'CashflowGame.harvest.cashOut' | translate }}
                  </button>
                </div>
              </section>
            </ng-container>
            <ng-template #harvestClosed>
              <ng-container
                *ngTemplateOutlet="
                  closed;
                  context: { text: 'CashflowGame.harvest.intro', canDecline: false }
                "
              ></ng-container>
            </ng-template>
          </ng-container>
        </ng-container>

        <!-- ───────────── OPPORTUNITY ───────────── -->
        <ng-container *ngSwitchCase="'opportunity'">
          <ng-container *ngIf="opportunity as o">
            <!-- the three piles -->
            <ng-container *ngIf="!o.pile">
              <p>{{ 'CashflowGame.opportunity.choosePile' | translate }}</p>
              <div class="tc-piles">
                <button
                  *ngFor="let pile of piles; trackBy: trackValue"
                  type="button"
                  class="tc-pile"
                  [disabled]="busy"
                  (click)="choosePile(pile)"
                >
                  <span class="tc-pile-icon" aria-hidden="true">{{ pileIcon(pile) }}</span>
                  <strong>{{ 'CashflowGame.opportunity.pile.' + pile | translate }}</strong>
                  <small>{{ 'CashflowGame.opportunity.pileHint.' + pile | translate }}</small>
                </button>
              </div>
            </ng-container>

            <!-- the cards offered from the pile -->
            <ng-container *ngIf="o.pile && !o.taken && !o.passed">
              <article
                class="tc-offer tc-offer--card"
                *ngFor="let offer of o.offers; trackBy: trackOffer"
                [attr.data-kind]="kindOf(offer.card)"
              >
                <header class="tc-card-head">
                  <span class="tc-kind" [attr.data-kind]="kindOf(offer.card)">{{
                    kindLabel(offer.card) | translate
                  }}</span>
                  <small class="tc-pile-mark">
                    {{ pileIcon(offer.card.pile) }}
                    {{ 'CashflowGame.opportunity.pile.' + offer.card.pile | translate }}
                  </small>
                </header>
                <h4 class="tc-card-title">{{ offer.card.title[lang] }}</h4>
                <div class="tc-keys">
                  <span
                    class="tc-key"
                    *ngFor="let key of keywords(offer.card); trackBy: trackValue"
                  >
                    {{ keywordLabel(key) }}
                  </span>
                </div>
                <p class="tc-card-story">{{ offer.card.story[lang] }}</p>
                <div class="tc-facts">
                  <div
                    class="tc-fact"
                    *ngFor="let fact of keyFacts(offer.card); trackBy: trackFact"
                    [attr.data-tone]="fact.tone"
                  >
                    <span class="tc-fact-label">{{ fact.label | translate }}</span>
                    <strong class="tc-fact-value">{{ fact.value }}</strong>
                  </div>
                </div>
                <ul class="tc-benefits" *ngIf="moreFacts(offer.card).length">
                  <li *ngFor="let fact of moreFacts(offer.card); trackBy: trackValue">
                    {{ fact }}
                  </li>
                </ul>
                <p class="tc-note" *ngIf="offer.card.estimate">
                  {{ 'CashflowGame.opportunity.estimate' | translate }}
                </p>
                <ng-container
                  *ngFor="let table of opportunityDiceTables(offer.card); trackBy: trackTable"
                >
                  <section class="tc-dice-table">
                    <h5>
                      {{ 'CashflowGame.dice.title' | translate
                      }}<ng-container *ngIf="table.title"> · {{ table.title }}</ng-container>
                    </h5>
                    <div
                      class="tc-dice-row"
                      *ngFor="let row of table.rows"
                      [attr.data-tone]="row.tone"
                    >
                      <strong class="tc-dice-range">{{ row.range }}</strong>
                      <span>
                        <span
                          *ngFor="let line of row.lines; trackBy: trackValue"
                          class="tc-dice-line"
                          >{{ line }}</span
                        >
                      </span>
                    </div>
                  </section>
                </ng-container>
                <!-- the side hustles are full: one has to go -->
                <ng-container *ngIf="quoteOf(offer.card) as quote">
                  <div class="tc-swap" *ngIf="quote.needsSwap">
                    <p class="tc-bad">
                      {{ 'CashflowGame.opportunity.sideHustleFull' | translate }}
                    </p>
                    <button
                      *ngFor="let hustle of quote.sideHustles; trackBy: trackHolding"
                      type="button"
                      class="tc-chip"
                      [class.tc-chip--on]="choiceOf(offer.card).swapOut === hustle.cardId"
                      (click)="setSwap(offer.card, hustle.cardId)"
                    >
                      {{ hustle.title }}
                    </button>
                  </div>
                  <p class="tc-bad" *ngIf="!quote.ok && !quote.needsSwap">
                    {{ 'CashflowGame.opportunity.cannot.' + quote.reason | translate }}
                  </p>
                  <button
                    type="button"
                    class="tc-btn tc-btn--primary tc-btn--wide"
                    [disabled]="busy || !quote.ok"
                    (click)="take(offer.card)"
                  >
                    {{
                      (offer.card.growType === 'income-growth'
                        ? 'CashflowGame.opportunity.planCard'
                        : quote.costMinor > 0
                          ? 'CashflowGame.opportunity.takeFor'
                          : 'CashflowGame.opportunity.take'
                      ) | translate: { cost: amount(quote.costMinor), currency: currency }
                    }}
                  </button>
                </ng-container>
              </article>
              <button
                type="button"
                class="tc-btn tc-btn--wide"
                [disabled]="busy"
                (click)="passOpportunity()"
              >
                {{ 'CashflowGame.opportunity.decline' | translate }}
              </button>
            </ng-container>

            <!-- a card was taken: it is paid, then it is a project -->
            <ng-container *ngIf="o.taken as taken">
              <h4 class="tc-title">{{ pileIcon(taken.pile) }} {{ taken.title[lang] }}</h4>
              <p class="tc-note" *ngIf="o.paymentOpen">
                {{ 'CashflowGame.opportunity.payFirst' | translate }}
              </p>
              <ng-container *ngIf="o.projectTitle as project">
                <p class="tc-good" *ngIf="!o.planned">
                  ✓ {{ 'CashflowGame.opportunity.created' | translate: { project: project } }}
                </p>
                <p class="tc-good" *ngIf="o.planned">
                  ✓ {{ 'CashflowGame.opportunity.planned' | translate: { project: project } }}
                </p>
                <ul class="tc-bullets tc-bullets--done" *ngIf="o.told.length">
                  <li *ngFor="let line of o.told; trackBy: trackValue">{{ line }}</li>
                </ul>
                <button
                  type="button"
                  class="tc-btn tc-btn--primary tc-btn--wide"
                  (click)="openGrow.emit(project)"
                >
                  {{ 'CashflowGame.opportunity.openProject' | translate }} ›
                </button>
              </ng-container>
            </ng-container>
            <p *ngIf="o.passed">{{ 'CashflowGame.opportunity.passed' | translate }}</p>
          </ng-container>
        </ng-container>

        <!-- ───────────── DREAM ───────────── -->
        <ng-container *ngSwitchCase="'dream'">
          <ng-container *ngIf="dream as d; else dreamClosed">
            <!-- a moment -->
            <ng-container *ngIf="d.moment as moment">
              <h4 class="tc-title">{{ moment.title[lang] }}</h4>
              <p>{{ moment.story[lang] }}</p>
              <p class="tc-good" *ngIf="d.applied">✓ {{ d.applied[lang] }}</p>
              <ng-container *ngIf="!d.applied">
                <button
                  *ngIf="moment.id === 'M05'"
                  type="button"
                  class="tc-btn tc-btn--primary tc-btn--wide"
                  [disabled]="busy"
                  (click)="drawDreamOffers(3)"
                >
                  {{ 'CashflowGame.dream.threeOffers' | translate }}
                </button>
                <button
                  *ngIf="moment.id === 'M07'"
                  type="button"
                  class="tc-btn tc-btn--primary tc-btn--wide"
                  [disabled]="busy"
                  (click)="applyMoment()"
                >
                  {{ 'CashflowGame.dream.claim' | translate }}
                </button>
                <ng-container *ngIf="moment.id !== 'M05' && moment.id !== 'M07'">
                  <p *ngIf="momentTargets.length === 0">
                    {{ 'CashflowGame.dream.noDreamForMoment' | translate }}
                  </p>
                  <button
                    *ngIf="momentTargets.length === 0 && moment.id === 'M02'"
                    type="button"
                    class="tc-btn tc-btn--primary tc-btn--wide"
                    [disabled]="busy"
                    (click)="applyMoment()"
                  >
                    {{ 'CashflowGame.dream.takeGift' | translate }}
                  </button>
                  <div class="tc-actions" *ngIf="momentTargets.length > 0">
                    <button
                      *ngFor="let entry of momentTargets; trackBy: trackProject"
                      type="button"
                      class="tc-btn tc-btn--primary tc-btn--wide"
                      [disabled]="busy"
                      (click)="applyMoment(entry.project.title)"
                    >
                      {{ entry.project.title }} · {{ progressOf(entry) }}%
                    </button>
                  </div>
                </ng-container>
              </ng-container>
            </ng-container>

            <!-- offers, side by side: choosing one takes the other away -->
            <ng-container *ngIf="d.offers.length > 0">
              <p *ngIf="d.swapping">{{ 'CashflowGame.dream.swapIntro' | translate }}</p>
              <p *ngIf="!d.swapping && !d.taken && !d.declined">
                {{ 'CashflowGame.dream.offersIntro' | translate }}
              </p>
              <p class="tc-bad" *ngIf="!d.canTake && !d.taken">
                {{ 'CashflowGame.dream.tooMany' | translate: { max: maxOpen } }}
              </p>
              <div class="tc-offers" [class.tc-offers--one]="shownOffers(d).length === 1">
                <article
                  class="tc-offer"
                  *ngFor="let offer of shownOffers(d); trackBy: trackId"
                  [class.tc-offer--picked]="selectedOffer === offer.id || !!d.taken"
                >
                  <h4>{{ offer.title[lang] }}</h4>
                  <small>
                    {{ 'CashflowGame.dream.tier.' + offer.tier | translate }} · {{ offer.points }}
                    {{ 'CashflowGame.dream.points' | translate }}
                  </small>
                  <p>{{ offer.story[lang] }}</p>
                  <ul class="tc-lines">
                    <li *ngFor="let bucket of offer.buckets; trackBy: trackId">
                      <span>{{ bucket.title[lang] }}</span>
                      <strong>{{ amount(bucket.amountMinor) }}</strong>
                    </li>
                    <li>
                      <strong>{{ 'CashflowGame.total' | translate }}</strong>
                      <strong>{{ amount(offer.totalMinor) }} {{ currency }}</strong>
                    </li>
                  </ul>
                  <button
                    *ngIf="!d.taken && !d.declined && selectedOffer !== offer.id"
                    type="button"
                    class="tc-btn tc-btn--primary tc-btn--wide"
                    [disabled]="busy"
                    (click)="selectedOffer = offer.id"
                  >
                    {{ 'CashflowGame.dream.choose' | translate }}
                  </button>
                </article>
              </div>
              <div class="tc-actions" *ngIf="selectedOffer && !d.taken && !d.declined">
                <button
                  type="button"
                  class="tc-btn tc-btn--primary"
                  [disabled]="busy || !d.canTake"
                  (click)="takeDream(selectedOffer)"
                >
                  {{ 'CashflowGame.dream.take' | translate }}
                </button>
                <button
                  type="button"
                  class="tc-btn"
                  [disabled]="busy"
                  (click)="selectedOffer = null"
                >
                  {{ 'CashflowGame.dream.chooseAgain' | translate }}
                </button>
              </div>
              <button
                *ngIf="!selectedOffer && !d.taken && !d.declined && !d.swapping && dreamMayDecline"
                type="button"
                class="tc-btn tc-btn--wide"
                [disabled]="busy"
                (click)="declineDreams()"
              >
                {{ 'CashflowGame.dream.declineAll' | translate }}
              </button>
            </ng-container>
            <ng-container *ngIf="d.taken">
              <p class="tc-good">
                ✓ {{ 'CashflowGame.dream.taken' | translate: { project: d.taken } }}
              </p>
              <button
                type="button"
                class="tc-btn tc-btn--primary tc-btn--wide"
                (click)="openSmile.emit(d.taken)"
              >
                {{ 'CashflowGame.dream.openProject' | translate }} ›
              </button>
            </ng-container>
            <p *ngIf="d.declined">{{ 'CashflowGame.dream.declined' | translate }}</p>
            <p *ngIf="d.moment && !d.applied && momentNothing">
              {{ 'CashflowGame.dream.nothingHappens' | translate }}
            </p>
          </ng-container>
          <ng-template #dreamClosed>
            <ng-container
              *ngTemplateOutlet="
                closed;
                context: { text: 'CashflowGame.dream.intro', canDecline: dreamMayDecline }
              "
            ></ng-container>
          </ng-template>
        </ng-container>
      </ng-container>

      <!-- the card is closed: open it (or, where nobody has to, leave it) -->
      <ng-template #closed let-text="text" let-canDecline="canDecline">
        <!-- the pile is shuffled and a card is drawn -->
        <div class="tc-shuffle" *ngIf="shuffling" aria-live="polite">
          <span class="tc-back tc-back--1"></span>
          <span class="tc-back tc-back--2"></span>
          <span class="tc-back tc-back--3"></span>
          <p>{{ 'CashflowGame.tile.shuffling' | translate }}</p>
        </div>
        <ng-container *ngIf="!shuffling && !opening; else pickerOrNothing">
          <p>{{ text | translate }}</p>
          <div class="tc-actions">
            <button
              type="button"
              class="tc-btn tc-btn--primary tc-btn--wide"
              [disabled]="busy"
              (click)="open()"
            >
              {{ 'CashflowGame.tile.openCard' | translate }}
            </button>
            <button
              *ngIf="canDecline"
              type="button"
              class="tc-btn tc-btn--wide"
              [disabled]="busy"
              (click)="declineTile()"
            >
              {{ 'CashflowGame.tile.decline' | translate }}
            </button>
          </div>
        </ng-container>
      </ng-template>

      <ng-template #pickerOrNothing>
        <ng-container *ngIf="!shuffling">
          <ng-container *ngTemplateOutlet="picker"></ng-container>
        </ng-container>
      </ng-template>
      <!-- the free rules: any card of the stack, found in a small grid with quick filters - or shuffled -->
      <ng-template #picker>
        <div class="tc-picker">
          <input
            type="search"
            class="tc-search"
            [value]="query"
            (input)="query = $any($event.target).value"
            [placeholder]="'CashflowGame.tile.search' | translate"
            [attr.aria-label]="'CashflowGame.tile.search' | translate"
          />
          <div class="tc-chips">
            <button
              type="button"
              class="tc-chip"
              [class.tc-chip--on]="filter === null"
              (click)="filter = null"
            >
              {{ 'CashflowGame.tile.all' | translate }}
            </button>
            <button
              *ngFor="let tag of pickerTags; trackBy: trackValue"
              type="button"
              class="tc-chip"
              [class.tc-chip--on]="filter === tag"
              (click)="filter = filter === tag ? null : tag"
            >
              {{ tagLabel(tag) }}
            </button>
          </div>
          <div class="tc-grid">
            <button
              *ngFor="let item of pickerItems; trackBy: trackId"
              type="button"
              class="tc-grid-item"
              [disabled]="busy"
              (click)="pick(item.id)"
            >
              <small>{{ item.id }}</small>
              <span>{{ item.title }}</span>
            </button>
          </div>
          <div class="tc-actions">
            <button
              type="button"
              class="tc-btn tc-btn--primary tc-btn--wide"
              [disabled]="busy"
              (click)="shuffle()"
            >
              {{ 'CashflowGame.tile.shuffle' | translate }}
            </button>
          </div>
        </div>
      </ng-template>

      <!-- what the card asks to be paid is paid in the Add dialog, by the player -->
      <div class="tc-due" *ngFor="let due of dues; trackBy: trackId" role="alert">
        <span>{{ 'CashflowGame.pay.due' | translate: { title: due.title } }}</span>
        <strong>{{ amount(due.costMinor) }} {{ currency }}</strong>
        <button type="button" class="tc-btn tc-btn--primary" (click)="pay.emit(due.id)">
          {{ 'CashflowGame.pay.button' | translate }}
        </button>
      </div>

      <button
        *ngIf="canFinish"
        type="button"
        class="tc-done tc-btn tc-btn--primary tc-btn--wide"
        [disabled]="busy"
        (click)="finish.emit()"
      >
        {{ 'CashflowGame.solo.done' | translate }}
      </button>
    </div>
  `,
  styles: [
    `
      .tc {
        display: block;
        font-size: 0.92rem;
        line-height: 1.4;
      }
      .tc p {
        margin: 6px 0;
      }
      .tc-title {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin: 4px 0;
        font-size: 1.02rem;
      }
      .tc-tag {
        padding: 1px 8px;
        border-radius: 999px;
        background: var(--tc, #d9362b);
        color: #fff;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .tc-lucky {
        font-weight: 600;
      }
      .tc-good {
        color: var(--color-success, #2e7d32);
        font-weight: 600;
      }
      .tc-bad {
        color: var(--color-danger, #c0392b);
        font-weight: 600;
      }
      .tc-note {
        opacity: 0.8;
        font-size: 0.84rem;
      }
      .tc-bullets {
        margin: 8px 0;
        padding-inline-start: 1.1em;
      }
      .tc-bullets--done {
        list-style: none;
        padding-inline-start: 0;
        font-weight: 600;
      }
      .tc-lines {
        margin: 8px 0 4px;
        padding: 0;
        list-style: none;
      }
      .tc-lines li {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 3px 0;
        border-bottom: 1px solid var(--color-border-light, #eee);
        font-size: 0.88rem;
      }
      /* buttons: they use the whole width of the card when they are alone, and share a row when they are two */
      .tc-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: 8px;
        margin: 10px 0 4px;
      }
      .tc-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 44px;
        padding: 8px 14px;
        border: 2px solid var(--color-border, #d9dde3);
        border-radius: var(--radius-md, 10px);
        background: var(--color-surface, #fff);
        color: inherit;
        font: inherit;
        font-weight: 600;
        text-align: center;
        cursor: pointer;
      }
      .tc-btn--wide {
        width: 100%;
        margin-top: 8px;
      }
      .tc-actions .tc-btn--wide {
        grid-column: 1 / -1;
        margin-top: 0;
      }
      .tc-btn--primary {
        border-color: var(--color-primary, #1976d2);
        background: var(--color-primary, #1976d2);
        color: #fff;
      }
      .tc-btn--gold {
        border-color: #d9a400;
        background: linear-gradient(100deg, #f0b323, #ffd966);
        color: #4a3500;
        font-size: 1.05rem;
      }
      .tc-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .tc-done {
        margin-top: 18px;
      }
      .tc-choices {
        display: grid;
        gap: 6px;
        margin: 8px 0;
      }
      .tc-choice {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        border: 2px solid var(--color-border, #d9dde3);
        border-radius: var(--radius-md, 10px);
        background: var(--color-surface, #fff);
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .tc-choice--on {
        border-color: var(--tc, #d9362b);
      }
      /* dice: seen tumbling, then at rest */
      .tc-dice {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin: 8px 0 10px;
      }
      .tc-die {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(3, 1fr);
        place-items: center;
        width: 68px;
        height: 68px;
        padding: 9px;
        border-radius: 14px;
        background: #fff;
        box-shadow:
          0 4px 12px rgba(0, 0, 0, 0.25),
          inset 0 -3px 0 rgba(0, 0, 0, 0.08);
      }
      .tc-die--tumbling {
        animation: tc-tumble 0.5s linear infinite;
      }
      .tc-pip {
        width: 11px;
        height: 11px;
        border-radius: 50%;
      }
      .tc-pip--on {
        background: #1b1b1f;
      }
      @keyframes tc-tumble {
        from {
          transform: rotate(0deg) scale(0.92);
        }
        50% {
          transform: rotate(180deg) scale(1.06);
        }
        to {
          transform: rotate(360deg) scale(0.92);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .tc-die--tumbling {
          animation: none;
        }
      }
      /* the career: a small ladder, the next rung and what it asks */
      .tc-ladder {
        display: grid;
        gap: 6px;
        margin: 4px 0 10px;
      }
      .tc-ladder-now,
      .tc-ladder-next {
        display: grid;
        gap: 3px;
        padding: 10px 12px;
        border-radius: var(--radius-md, 10px);
        background: var(--color-surface, #fff);
        border: 2px solid var(--tc, #3f51b5);
      }
      .tc-ladder-now {
        grid-auto-flow: column;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 10px;
      }
      .tc-ladder-now > span:last-child {
        display: grid;
      }
      .tc-ladder-icon {
        font-size: 1.6rem;
      }
      .tc-ladder-next {
        border-style: dashed;
        background: color-mix(in srgb, var(--tc, #3f51b5) 8%, var(--color-surface, #fff));
      }
      .tc-ladder-arrow {
        text-align: center;
        font-size: 1.2rem;
        line-height: 1;
        opacity: 0.6;
      }
      .tc-progress {
        height: 8px;
        border-radius: 999px;
        background: var(--color-border, #dfe3e8);
        overflow: hidden;
      }
      .tc-progress span {
        display: block;
        height: 100%;
        background: var(--tc, #3f51b5);
      }
      .tc-result {
        margin: 10px 0 4px;
        padding: 12px;
        border-radius: var(--radius-md, 10px);
        background: var(--color-surface-alt, #eef1f5);
        font-size: 1.05rem;
        font-weight: 700;
        text-align: center;
      }
      .tc-result--good {
        background: #e7f6ea;
        color: #1b5e20;
      }
      .tc-woohoo {
        margin: 10px 0 4px;
        padding: 8px 10px;
        border-radius: var(--radius-md, 10px);
        background: color-mix(in srgb, var(--tc, #3f51b5) 14%, var(--color-surface, #fff));
      }
      .tc-woohoo table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.88rem;
      }
      .tc-woohoo th,
      .tc-woohoo td {
        padding: 3px 4px;
        text-align: right;
      }
      .tc-woohoo th:first-child,
      .tc-woohoo td:first-child {
        text-align: left;
      }
      /* the dream: the offers side by side */
      .tc-offers {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        align-items: start;
      }
      .tc-offers--one {
        grid-template-columns: minmax(0, 1fr);
      }
      .tc-offer {
        padding: 8px 10px;
        border: 2px solid var(--color-border, #d9dde3);
        border-radius: var(--radius-md, 10px);
        background: var(--color-surface, #fff);
        font-size: 0.84rem;
      }
      .tc-offer h4 {
        margin: 0 0 2px;
        font-size: 0.95rem;
      }
      .tc-offer--picked {
        border-color: var(--tc, #2e9e5b);
      }
      @media (max-width: 340px) {
        .tc-offers {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      /* the grid of the free rules */
      .tc-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 6px 0;
      }
      .tc-chip {
        padding: 4px 10px;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 999px;
        background: var(--color-surface, #fff);
        color: inherit;
        font: inherit;
        font-size: 0.8rem;
        cursor: pointer;
      }
      .tc-chip--on {
        border-color: var(--color-primary, #1976d2);
        background: var(--color-primary, #1976d2);
        color: #fff;
      }
      .tc-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(7.2rem, 1fr));
        gap: 6px;
        max-height: 11rem;
        overflow-y: auto;
        margin: 6px 0;
      }
      .tc-grid-item {
        display: grid;
        gap: 1px;
        padding: 6px 8px;
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: 8px;
        background: var(--color-surface, #fff);
        color: inherit;
        font: inherit;
        font-size: 0.78rem;
        text-align: start;
        cursor: pointer;
      }
      .tc-due {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin: 8px 0;
        padding: 8px 10px;
        border: 2px solid var(--color-danger, #c0392b);
        border-radius: var(--radius-md, 8px);
      }
      .tc-due span {
        flex: 1 1 140px;
        font-weight: 600;
      }
      .tc-search {
        box-sizing: border-box;
        width: 100%;
        margin-bottom: 8px;
        padding: 8px 10px;
        border: 1px solid var(--color-border, #ccc);
        border-radius: var(--radius-md, 8px);
        font: inherit;
        background: var(--color-surface, #fff);
        color: inherit;
      }
      .tc-piles {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin: 8px 0;
      }
      .tc-pile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 12px 6px;
        border: 2px solid var(--tc, #888);
        border-radius: var(--radius-md, 8px);
        background: color-mix(in srgb, var(--tc, #888) 10%, var(--color-surface, #fff));
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .tc-pile-icon {
        font-size: 2rem;
      }
      .tc-pile small {
        font-size: 0.72rem;
        text-align: center;
        opacity: 0.75;
      }
      /* the cards of the Opportunity and Harvest tiles: one look - the kind, the words, the numbers that matter (JFK, 2026-10-26) */
      .tc-card-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        margin-bottom: 4px;
      }
      .tc-kind {
        padding: 2px 9px;
        border-radius: 999px;
        background: var(--tc-kind, #607d8b);
        color: #fff;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .tc-kind[data-kind='share'] {
        --tc-kind: #1e88e5;
      }
      .tc-kind[data-kind='investment'] {
        --tc-kind: #8e44ad;
      }
      .tc-kind[data-kind='asset'] {
        --tc-kind: #00897b;
      }
      .tc-kind[data-kind='saving'] {
        --tc-kind: #2e9e5b;
      }
      .tc-kind--harvest {
        --tc-kind: #c9871c;
      }
      .tc-pile-mark {
        opacity: 0.75;
        font-weight: 600;
      }
      .tc-card-title {
        margin: 2px 0 6px;
        font-size: 1.15rem;
      }
      .tc-card-story {
        margin: 6px 0 4px;
      }
      .tc-keys {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin: 2px 0 4px;
      }
      .tc-key {
        padding: 1px 8px;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 6px;
        font-size: 0.74rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.85;
      }
      .tc-key--mine {
        border-color: #d9362b;
        background: #d9362b;
        color: #fff;
        opacity: 1;
      }
      .tc-facts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 12px;
        margin: 10px 0 4px;
        padding-top: 10px;
        border-top: 1px solid var(--color-border, #ddd);
      }
      .tc-fact {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }
      .tc-fact:nth-child(even) {
        align-items: flex-end;
        text-align: right;
      }
      .tc-fact-label {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        opacity: 0.7;
      }
      .tc-fact-value {
        font-size: 1.15rem;
        font-variant-numeric: tabular-nums;
      }
      .tc-fact[data-tone='income'] .tc-fact-value {
        color: var(--color-success, #2e7d32);
      }
      .tc-fact[data-tone='cost'] .tc-fact-value {
        color: var(--color-danger, #c0392b);
      }
      .tc-benefits {
        margin: 6px 0 0;
        padding-inline-start: 1.1em;
        font-size: 0.82rem;
        opacity: 0.85;
      }
      .tc-effects {
        margin: 8px 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 5px;
      }
      .tc-effect {
        padding: 7px 10px;
        border-inline-start: 5px solid var(--color-border, #999);
        border-radius: 6px;
        background: var(--color-surface-alt, #eef1f5);
        font-weight: 700;
      }
      .tc-effect[data-tone='up'] {
        border-inline-start-color: #2e9e5b;
        background: #e7f6ea;
        color: #1b5e20;
      }
      .tc-effect[data-tone='down'] {
        border-inline-start-color: #d9362b;
        background: #fdeceb;
        color: #8c1d14;
      }
      .tc-involve {
        padding: 2px 9px;
        border-radius: 999px;
        border: 1px solid var(--color-border, #bbb);
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        opacity: 0.8;
      }
      .tc-involve--me {
        border-color: #d9362b;
        background: #d9362b;
        color: #fff;
        opacity: 1;
      }
      .tc-mine {
        margin: 10px 0 4px;
        padding: 8px 10px;
        border: 2px dashed var(--color-border, #ccc);
        border-radius: var(--radius-md, 8px);
      }
      .tc-mine h5 {
        margin: 0 0 4px;
        font-size: 0.8rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .tc-hold {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 3px 0;
      }
      .tc-dice-table {
        margin: 8px 0;
        padding: 8px 10px;
        border: 1px solid var(--color-border, #ccc);
        border-radius: var(--radius-md, 8px);
      }
      .tc-dice-table h5 {
        margin: 0 0 4px;
        font-size: 0.8rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .tc-dice-row {
        display: grid;
        grid-template-columns: 3.2em minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        padding: 4px 6px;
        margin: 3px 0;
        border-inline-start: 5px solid var(--color-border, #999);
        border-radius: 6px;
        font-size: 0.86rem;
      }
      .tc-dice-range {
        font-variant-numeric: tabular-nums;
      }
      .tc-dice-line {
        display: block;
      }
      .tc-dice-row[data-tone='good'] {
        border-inline-start-color: #2e9e5b;
        background: #e7f6ea;
        color: #1b5e20;
      }
      .tc-dice-row[data-tone='bad'] {
        border-inline-start-color: #d9362b;
        background: #fdeceb;
        color: #8c1d14;
      }
      .tc-offer--card {
        border-width: 2px;
        border-left-width: 6px;
      }
      .tc-offer--card[data-kind='share'] {
        border-left-color: #1e88e5;
      }
      .tc-offer--card[data-kind='investment'] {
        border-left-color: #8e44ad;
      }
      .tc-offer--card[data-kind='asset'] {
        border-left-color: #00897b;
      }
      .tc-offer--card[data-kind='saving'] {
        border-left-color: #2e9e5b;
      }
      .tc-offer {
        margin: 8px 0;
        padding: 10px 12px;
        border: 1px solid var(--color-border, #ccc);
        border-radius: var(--radius-md, 8px);
        background: var(--color-surface, #fff);
      }
      .tc-units {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin: 6px 0;
      }
      .tc-units input {
        width: 80px;
        padding: 6px;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 6px;
        font: inherit;
      }
      .tc-swap {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 6px 0;
      }
      .tc-shuffle {
        position: relative;
        min-height: 175px;
        margin: 8px 0;
      }
      .tc-shuffle p {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        margin: 0;
        text-align: center;
        font-weight: 600;
      }
      .tc-back {
        position: absolute;
        top: 8px;
        left: calc(50% - 38px);
        width: 76px;
        height: 108px;
        border-radius: 10px;
        border: 3px solid #fff;
        background: repeating-linear-gradient(
          45deg,
          var(--tc, #3f51b5),
          var(--tc, #3f51b5) 8px,
          color-mix(in srgb, var(--tc, #3f51b5) 70%, #fff) 8px,
          color-mix(in srgb, var(--tc, #3f51b5) 70%, #fff) 16px
        );
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
        animation: tc-shuffle 0.8s ease-in-out infinite;
      }
      .tc-back--2 {
        animation-delay: 0.15s;
      }
      .tc-back--3 {
        animation-delay: 0.3s;
      }
      @keyframes tc-shuffle {
        0%,
        100% {
          transform: translateX(0) rotate(0deg);
        }
        25% {
          transform: translateX(-48px) rotate(-14deg);
        }
        75% {
          transform: translateX(48px) rotate(14deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .tc-back {
          animation: none;
        }
      }
      .tc-grid-item small {
        opacity: 0.6;
      }
    `,
  ],
})
export class TileCardComponent implements OnInit, OnDestroy {
  private readonly service = inject(CashflowGameService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) tile = '';
  @Input() currency = '';
  /** The card is opened as the view appears (the player already chose "open the card" on the tile). */
  @Input() autoOpen = false;
  /** The turn can go on. */
  @Output() finish = new EventEmitter<void>();
  @Output() openFire = new EventEmitter<string>();
  @Output() openSmile = new EventEmitter<string>();
  /** The player wants to pay a payment due (its id): the Add dialog opens. */
  @Output() pay = new EventEmitter<string>();
  /** The project an Opportunity card became: open it in Grow. */
  @Output() openGrow = new EventEmitter<string>();

  busy = false;
  opening = false;
  shuffling = false;
  filter: string | null = null;
  query = '';
  selectedOffer: string | null = null;
  faces: number[] = [];
  rolling = false;
  private timer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    // an Opportunity tile starts with the choice of a pile, not with a card
    if (!this.autoOpen || this.tile === 'opportunity') return;
    const shown =
      this.tile === 'emergency'
        ? this.service.emergencyView
        : this.tile === 'life'
          ? this.service.lifeView
          : this.tile === 'dream'
            ? this.service.dreamView
            : this.tile === 'harvest'
              ? this.service.harvestView?.card
              : null;
    if (!shown) this.open();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private readonly callbacks = {
    onSuccess: () => {
      this.busy = false;
      this.cdr.markForCheck();
    },
    onError: (message: string) => {
      this.busy = false;
      this.toast.show(gameError(message, this.translate.currentLang), 'error');
      this.cdr.markForCheck();
    },
  };

  get lang(): 'en' | 'de' {
    return this.translate.currentLang === 'de' ? 'de' : 'en';
  }

  amount(minor: number): string {
    return Math.abs(fromMinorUnits(minor)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  trackId = (_i: number, item: { id: string }): string => item.id;
  trackValue = (_i: number, value: string): string => value;
  trackIndex = (i: number): number => i;
  trackProject = (_i: number, item: { project: { title: string } }): string => item.project.title;

  dieCells(face: number): boolean[] {
    const pips: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    const on = new Set(pips[face] ?? []);
    return Array.from({ length: 9 }, (_, cell) => on.has(cell));
  }

  // ── the dice ──

  /**
   * A roll that is seen: the die tumbles for a moment, the rule is run (what it decides is already in the game), then the faces are
   * shown still and the result is told. `run` returns the dice that were rolled.
   */
  private async roll(run: () => number[]): Promise<void> {
    this.busy = true;
    this.rolling = true;
    const random = () => 1 + Math.floor(Math.random() * 6);
    this.faces = [random()];
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.faces = this.faces.map(random);
      this.cdr.markForCheck();
    }, 90);
    let rolled: number[] = [];
    try {
      rolled = run();
    } catch (error) {
      this.toast.show(error instanceof Error ? error.message : String(error), 'error');
    }
    this.cdr.markForCheck();
    await new Promise((resolve) => setTimeout(resolve, ROLL_MS));
    clearInterval(this.timer);
    this.faces = rolled;
    this.rolling = false;
    this.busy = false;
    this.cdr.markForCheck();
  }

  // ── opening the card ──

  /** Under the free rules a card is searched in the grid; otherwise it is drawn at once. */
  open(): void {
    // the market is not searched: its card is turned
    if (this.service.cardChoiceFree && this.tile !== 'harvest') {
      this.opening = true;
      return;
    }
    this.draw();
  }

  shuffle(): void {
    this.draw();
  }

  pick(id: string): void {
    this.draw(id);
  }

  private async draw(id?: string): Promise<void> {
    this.opening = false;
    this.filter = null;
    this.query = '';
    this.faces = [];
    // the pile is shuffled for a moment before the card is shown; a card that was picked needs less of it
    this.shuffling = true;
    this.cdr.markForCheck();
    await new Promise((resolve) => setTimeout(resolve, id ? SHUFFLE_PICKED_MS : SHUFFLE_MS));
    this.shuffling = false;
    switch (this.tile) {
      case 'emergency':
        this.service.drawEmergency(this.callbacks, id);
        break;
      case 'life':
        this.service.drawLife(this.callbacks, id);
        break;
      case 'dream':
        this.service.drawDream(this.callbacks, id ? { cardId: id } : {});
        break;
      case 'harvest':
        this.service.drawHarvest(this.callbacks);
        break;
    }
    this.cdr.markForCheck();
  }

  /** Nobody has to take a dream: the card is left closed. */
  declineTile(): void {
    if (this.tile === 'dream') this.service.declineDreams(this.callbacks);
  }

  get pickerItems(): PickerItem[] {
    const items = this.allPickerItems;
    const byTag = this.filter ? items.filter((item) => item.tag === this.filter) : items;
    const needle = this.query.trim().toLowerCase();
    return needle
      ? byTag.filter((item) =>
          `${item.id} ${item.title} ${this.tagLabel(item.tag)}`.toLowerCase().includes(needle),
        )
      : byTag;
  }

  private get allPickerItems(): PickerItem[] {
    const lang = this.lang;
    switch (this.tile) {
      case 'emergency':
        return this.service.emergencyCards.map((card) => ({
          id: card.id,
          title: card.title[lang],
          tag: card.tier,
        }));
      case 'life':
        return this.service.lifeCards.map((card) => ({
          id: card.id,
          title: card.title[lang],
          tag: card.type,
        }));
      case 'dream':
        return this.service.dreamCards.map((card) => ({
          id: card.id,
          title: card.title[lang],
          tag: card.category,
        }));
      default:
        return [];
    }
  }

  get pickerTags(): string[] {
    return [...new Set(this.allPickerItems.map((item) => item.tag))];
  }

  tagLabel(tag: string): string {
    switch (this.tile) {
      case 'emergency':
        return this.translate.instant(`CashflowGame.emergency.tier.${tag}`);
      case 'dream':
        return this.translate.instant(`CashflowGame.dream.category.${tag}`);
      default:
        return this.translate.instant(`CashflowGame.life.type.${tag}`);
    }
  }

  // ── harvest ──

  get harvest() {
    return this.service.harvestView;
  }

  trackHoldingTitle = (_i: number, item: { holding: string }): string => item.holding;
  private sold: Record<string, number> = {};

  soldUnits(holding: string, max: number): number {
    return Math.min(this.sold[holding] ?? max, max);
  }

  setSoldUnits(holding: string, value: string): void {
    this.sold = { ...this.sold, [holding]: Math.max(1, Math.floor(Number(value) || 1)) };
  }

  sell(window: { holding: string; units: number; isShare: boolean }): void {
    this.busy = true;
    this.service.sellInWindow(
      window.holding,
      window.isShare ? this.soldUnits(window.holding, window.units) : undefined,
      this.callbacks,
    );
  }

  acceptSale(holding: string): void {
    this.busy = true;
    this.service.acceptHarvestSale(holding, this.callbacks);
  }

  ride(holding: string): void {
    this.busy = true;
    this.service.rideHarvestLadder(holding, this.callbacks);
  }

  cashOut(holding: string): void {
    this.busy = true;
    this.service.cashOutHarvestLadder(holding, this.callbacks);
  }

  // ── opportunity ──

  readonly piles: OpportunityPile[] = ['seed', 'sapling', 'tree'];
  private choices: Record<string, OpportunityChoice> = {};

  get opportunity() {
    return this.service.opportunityView;
  }

  pileIcon(pile: string): string {
    return pile === 'seed' ? '🌱' : pile === 'sapling' ? '🌿' : '🌳';
  }

  trackOffer = (_i: number, offer: { card: { id: string } }): string => offer.card.id;
  trackHolding = (_i: number, holding: { cardId: string }): string => holding.cardId;

  choiceOf(card: OpportunityCard): OpportunityChoice {
    return this.choices[card.id] ?? {};
  }

  quoteOf(card: OpportunityCard) {
    return this.service.quoteOpportunityChoice(card, this.choiceOf(card));
  }

  setUnits(card: OpportunityCard, value: string): void {
    this.choices = {
      ...this.choices,
      [card.id]: { ...this.choiceOf(card), units: Math.max(1, Math.floor(Number(value) || 1)) },
    };
  }

  setSteps(card: OpportunityCard, value: string): void {
    this.choices = {
      ...this.choices,
      [card.id]: { ...this.choiceOf(card), steps: Math.max(1, Math.floor(Number(value) || 1)) },
    };
  }

  setSwap(card: OpportunityCard, cardId: string): void {
    this.choices = { ...this.choices, [card.id]: { ...this.choiceOf(card), swapOut: cardId } };
  }

  choosePile(pile: OpportunityPile): void {
    this.busy = true;
    this.service.drawOpportunity(pile, this.callbacks);
  }

  take(card: OpportunityCard): void {
    this.busy = true;
    // a planned card lives in Grow: the project opens there as soon as it is made (JFK, 2026-10-26)
    this.service.takeOpportunity(card.id, this.choiceOf(card), {
      onSuccess: () => {
        this.callbacks.onSuccess();
        const view = this.opportunity;
        if (view?.planned && view.projectTitle) this.openGrow.emit(view.projectTitle);
      },
      onError: this.callbacks.onError,
    });
  }

  passOpportunity(): void {
    this.busy = true;
    this.service.passOpportunity(this.callbacks);
  }

  readonly cardText = cardText;
  trackTable = (_i: number, table: { title: string }): string => table.title;
  trackFact = (_i: number, fact: { label: string }): string => fact.label;
  trackInvolved = (_i: number, own: { title: string }): string => own.title;

  /** What the card becomes in Grow, as the word Grow uses: Share, Investment, Asset (or a saving). */
  kindOf(card: OpportunityCard): AssetKind {
    return assetKindOf(card);
  }

  kindLabel(card: OpportunityCard): string {
    const kind = assetKindOf(card);
    return kind === 'saving' ? 'CashflowGame.kind.saving' : `CashflowGame.kind.${kind}`;
  }

  keywords(card: OpportunityCard): string[] {
    return keywordsOfCard(card);
  }

  /** The word of a market or group: its translation, or the tag itself when there is none. */
  keywordLabel(key: string): string {
    const id = `CashflowGame.keyword.${key}`;
    const text = this.translate.instant(id);
    return text === id ? key : text;
  }

  /** The words a Harvest card names: its markets and groups. */
  harvestKeys(topics: HarvestTopics): string[] {
    return topics.allMarkets ? ['ALL', ...topics.targets] : topics.targets;
  }

  /** Whether the player owns something the word is about. */
  mineOf(key: string, view: { involved: { title: string }[]; topics?: HarvestTopics }): boolean {
    if (view.involved.length === 0) return false;
    const holdings = this.service.heldKeywords();
    return key === 'ALL' ? holdings.size > 0 : holdings.has(key);
  }

  /** The tone of a line of what a card did: a rise, a fall. */
  toneOf(line: string): 'up' | 'down' | 'flat' {
    if (/[−-]\d/.test(line) || /\bfall|Rückgang|lost|verlor/i.test(line)) return 'down';
    if (/\+\d|recover|rise|bonus/i.test(line)) return 'up';
    return 'flat';
  }

  /** The key numbers of a card, laid out like the classic cards: what it costs, what it pays each month. */
  keyFacts(
    card: OpportunityCard,
  ): { label: string; value: string; tone: 'cost' | 'income' | 'neutral' }[] {
    const money = (minor: number) => `${this.amount(minor)} ${this.currency}`;
    const signed = (minor: number) => `${minor < 0 ? '−' : '+'}${money(minor)}`;
    const out: { label: string; value: string; tone: 'cost' | 'income' | 'neutral' }[] = [];
    if (card.share) {
      out.push({
        label: 'CashflowGame.card.price',
        value: money(card.share.unitPriceMinor),
        tone: 'cost',
      });
      out.push({
        label: 'CashflowGame.card.dividend',
        value:
          card.share.dividendMonthPerUnitMinor > 0
            ? signed(card.share.dividendMonthPerUnitMinor)
            : money(0),
        tone: card.share.dividendMonthPerUnitMinor > 0 ? 'income' : 'neutral',
      });
    } else if (card.property) {
      out.push({
        label: 'CashflowGame.dealCost',
        value: money(card.property.priceMinor),
        tone: 'cost',
      });
      out.push({
        label: 'CashflowGame.dealMortgage',
        value: money(card.property.mortgageMinor),
        tone: 'neutral',
      });
      out.push({
        label: 'CashflowGame.dealDeposit',
        value: money(card.property.cashNeededMinor),
        tone: 'cost',
      });
      out.push({
        label: 'CashflowGame.cardCashflow',
        value: signed(card.cashflowMinor ?? card.property.rentMonthMinor),
        tone: 'income',
      });
    } else {
      if (card.costMinor !== undefined) {
        out.push({ label: 'CashflowGame.dealCost', value: money(card.costMinor), tone: 'cost' });
      }
      if (card.loan) {
        out.push({
          label: 'CashflowGame.dealMortgage',
          value: money(card.loan.loanMinor),
          tone: 'neutral',
        });
      }
      if (card.cashflowMinor !== undefined) {
        out.push({
          label: 'CashflowGame.cardCashflow',
          value: signed(card.cashflowMinor),
          tone: card.cashflowMinor >= 0 ? 'income' : 'cost',
        });
      } else if (card.dice) {
        out.push({ label: 'CashflowGame.cardCashflow', value: '🎲', tone: 'neutral' });
      }
      if (card.savings && card.savings.monthlySavingsMinor > 0) {
        out.push({
          label: 'CashflowGame.card.saves',
          value: signed(card.savings.monthlySavingsMinor),
          tone: 'income',
        });
      }
    }
    return out;
  }

  /** What else the card tells: when it pays, what locks the money, the risk. */
  moreFacts(card: OpportunityCard): string[] {
    const t = (key: string, params?: Record<string, unknown>) =>
      this.translate.instant(key, params);
    const out: string[] = [];
    if (card.share && card.share.dividendMonthPerUnitMinor > 0) {
      out.push(t('CashflowGame.opportunity.fact.yield', { year: card.share.yieldYearPercent }));
    }
    if (card.rampPaydays)
      out.push(t('CashflowGame.opportunity.fact.ramp', { paydays: card.rampPaydays }));
    if (card.lockedPaydays)
      out.push(t('CashflowGame.opportunity.fact.locked', { paydays: card.lockedPaydays }));
    if (card.sideHustle) out.push(t('CashflowGame.opportunity.fact.sideHustle'));
    out.push(t('CashflowGame.opportunity.fact.risk', { score: card.riskScore }));
    return out;
  }

  // ── dice: what each number does, before the die is thrown (JFK, 2026-10-26) ──

  private diceRange(from: number, to: number): string {
    return from === to ? `${from}` : `${from}–${to}`;
  }

  private dt(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(`CashflowGame.dice.${key}`, params);
  }

  private signedPercent(factor: number): string {
    return `${factor >= 1 ? '+' : '−'}${Math.abs(Math.round((factor - 1) * 100))}%`;
  }

  /** The bands of a dice card of the Life stack: each number, what it brings. */
  lifeDiceRows(card: LifeCard): DiceRowView[] {
    const rows: DiceRowView[] = [];
    for (const band of card.dice ?? []) {
      const effect = band.value;
      const lines = this.effectLines(effect);
      if (effect?.schedule) {
        const scheduled = this.service.lifeCards.find((c) => c.id === effect.schedule!.cardId);
        lines.push(
          this.translate.instant('CashflowGame.life.schedule', {
            title: scheduled ? scheduled.title[this.lang] : effect.schedule.cardId,
            count: effect.schedule.afterPaydays,
          }),
        );
      }
      rows.push({
        range: this.diceRange(band.from, band.to),
        lines: lines.length ? lines : [this.dt('nothing')],
        tone: !effect
          ? 'neutral'
          : (effect.monthlyMinor ?? 0) > 0 || (effect.oneTimeMinor ?? 0) < 0
            ? 'bad'
            : (effect.incomeMonthlyMinor ?? 0) > 0 || (effect.oneTimeMinor ?? 0) > 0
              ? 'good'
              : 'neutral',
      });
    }
    if (card.declineRoll) {
      const follows = this.service.lifeCards.find((c) => c.id === card.declineRoll!.triggers);
      rows.push({
        range: `1–${card.declineRoll.upTo}`,
        lines: [
          this.dt('declineRoll', {
            upTo: card.declineRoll.upTo,
            title: follows ? follows.title[this.lang] : card.declineRoll.triggers,
          }),
        ],
        tone: 'bad',
      });
    }
    return rows;
  }

  private rollLines(roll: OpportunityRollLike): string[] {
    const money = (minor: number) => `${this.amount(minor)} ${this.currency}`;
    const lines: string[] = [];
    if (roll.cashflowMinor !== undefined)
      lines.push(this.dt('cashflow', { amount: money(roll.cashflowMinor) }));
    if (roll.monthlySavingsMinor !== undefined)
      lines.push(this.dt('savings', { amount: money(roll.monthlySavingsMinor) }));
    if (roll.oneTimeMinor)
      lines.push(
        this.dt('once', {
          amount: `${roll.oneTimeMinor < 0 ? '−' : '+'}${money(roll.oneTimeMinor)}`,
        }),
      );
    if (roll.assetValueMinor !== undefined)
      lines.push(this.dt('value', { amount: money(roll.assetValueMinor) }));
    if (roll.extraCostPercent) lines.push(this.dt('extraCost', { percent: roll.extraCostPercent }));
    if (roll.laterCost)
      lines.push(
        this.dt('laterCost', {
          amount: money(roll.laterCost.minor),
          count: roll.laterCost.afterPaydays,
        }),
      );
    if (roll.rentCutPercent)
      lines.push(this.dt('rentCut', { percent: roll.rentCutPercent, count: roll.paydays ?? 1 }));
    if (roll.capitalLossPercent)
      lines.push(this.dt('capitalLoss', { percent: roll.capitalLossPercent }));
    return lines;
  }

  /** What each number does on an Opportunity card: the dice of the card, of the purchase, of every Payday. Never for a trap. */
  opportunityDiceTables(card: OpportunityCard): { title: string; rows: DiceRowView[] }[] {
    if (card.trap) return [];
    const toRows = (
      bands: readonly { from: number; to: number; value: OpportunityBandLike }[],
    ): DiceRowView[] =>
      bands.map(({ from, to, value }) => {
        const lines = this.rollLines(value);
        for (const inner of value.rollAgain ?? []) {
          lines.push(
            `${this.dt('again')} ${this.diceRange(inner.from, inner.to)}: ${this.rollLines(inner.value).join(', ')}`,
          );
        }
        const bad =
          (value.cashflowMinor ?? 1) <= 0 ||
          (value.oneTimeMinor ?? 0) < 0 ||
          !!value.rentCutPercent ||
          !!value.capitalLossPercent ||
          !!value.extraCostPercent ||
          !!value.laterCost;
        return {
          range: this.diceRange(from, to),
          lines: lines.length ? lines : [this.dt('nothing')],
          tone: bad ? 'bad' : lines.length ? 'good' : 'neutral',
        };
      });
    const tables: { title: string; rows: DiceRowView[] }[] = [];
    if (card.dice) tables.push({ title: '', rows: toRows(card.dice as never) });
    if (card.onBuy)
      tables.push({ title: this.dt('whenBought'), rows: toRows(card.onBuy as never) });
    if (card.eachPayday)
      tables.push({ title: this.dt('eachPayday'), rows: toRows(card.eachPayday as never) });
    return tables;
  }

  /** The dice of a Harvest card: what each number does to the market and to what you hold. */
  harvestDiceTables(card: HarvestCard): { title: string; rows: DiceRowView[] }[] {
    const tables: { title: string; rows: DiceRowView[] }[] = [];
    const factorRows = (
      bands: readonly HarvestFactorBand[],
      key: 'factorMarket' | 'factorCashflow',
      targets: string,
    ): DiceRowView[] =>
      bands.map((band) => {
        const parts =
          typeof band.value === 'number'
            ? [band.value]
            : band.value.rollAgain.map((inner) => inner.value as number);
        const percents = parts.map((factor) => this.signedPercent(factor));
        const first = parts[0];
        return {
          range: this.diceRange(band.from, band.to),
          lines: [
            this.dt(key, {
              targets,
              percent:
                typeof band.value === 'number'
                  ? percents[0]
                  : `${this.dt('again')} ${percents.join(' / ')}`,
            }),
          ],
          tone: first >= 1 ? 'good' : 'bad',
        };
      });
    for (const op of card.ops) {
      if (op.op === 'indexDice') {
        tables.push({
          title: '',
          rows: factorRows(op.bands, 'factorMarket', op.markets.join(', ')),
        });
      } else if (op.op === 'cashflowDice') {
        tables.push({
          title: '',
          rows: factorRows(op.bands, 'factorCashflow', op.groups.join(', ')),
        });
      } else if (op.op === 'holderDice') {
        tables.push({
          title: op.targets.join(', '),
          rows: op.bands.map((band) => ({
            range: this.diceRange(band.from, band.to),
            lines: this.holderLines(band.value),
            tone:
              band.value.none || band.value.depositBack || (band.value.oneTimeMinor ?? 0) > 0
                ? 'neutral'
                : 'bad',
          })),
        });
      }
    }
    return tables;
  }

  private holderLines(effect: HarvestHolderEffect): string[] {
    const money = (minor: number) => `${this.amount(minor)} ${this.currency}`;
    const lines: string[] = [];
    const h = (key: string, params?: Record<string, unknown>) => this.dt(`holder.${key}`, params);
    if (effect.none) lines.push(h('none'));
    if (effect.pausePayoutsPaydays) lines.push(h('pause', { count: effect.pausePayoutsPaydays }));
    if (effect.loseCapitalPercent)
      lines.push(h('loseCapital', { percent: effect.loseCapitalPercent }));
    if (effect.endsProject) lines.push(h('ends'));
    if (effect.loseUnitsPercent) lines.push(h('loseUnits', { percent: effect.loseUnitsPercent }));
    if (effect.noRentPaydays) lines.push(h('noRent', { count: effect.noRentPaydays }));
    if (effect.legalCostMinor) lines.push(h('legal', { amount: money(effect.legalCostMinor) }));
    if (effect.repairPercentOfPrice)
      lines.push(h('repair', { percent: effect.repairPercentOfPrice }));
    if (effect.noCashflowPaydays) lines.push(h('noCashflow', { count: effect.noCashflowPaydays }));
    if (effect.cashflowFactor !== undefined)
      lines.push(h('cashflow', { percent: this.signedPercent(effect.cashflowFactor) }));
    if (effect.oneTimeMinor)
      lines.push(
        h('once', {
          amount: `${effect.oneTimeMinor < 0 ? '−' : '+'}${money(effect.oneTimeMinor)}`,
        }),
      );
    if (effect.valueFactor !== undefined)
      lines.push(h('value', { percent: this.signedPercent(effect.valueFactor) }));
    if (effect.sellAtFactor !== undefined) lines.push(h('sellAt', { factor: effect.sellAtFactor }));
    if (effect.worthless) lines.push(h('worthless'));
    if (effect.depositLost) lines.push(h('depositLost'));
    if (effect.depositBack) lines.push(h('depositBack'));
    if (effect.fakeItem) lines.push(h('fake'));
    return lines.length ? lines : [this.dt('nothing')];
  }

  /** The numbers of a card, each as one short line: what it costs, what it pays, what it risks. */
  facts(card: OpportunityCard): string[] {
    const t = (key: string, params?: Record<string, unknown>) =>
      this.translate.instant(key, params);
    const money = (minor: number) => `${this.amount(minor)} ${this.currency}`;
    const signed = (minor: number) => `${minor < 0 ? '−' : '+'}${money(minor)}`;
    const out: string[] = [];
    if (card.share) {
      out.push(
        t('CashflowGame.opportunity.fact.unit', {
          price: money(card.share.unitPriceMinor),
          max: card.share.maxUnits,
        }),
      );
      if (card.share.dividendMonthPerUnitMinor > 0) {
        out.push(
          t('CashflowGame.opportunity.fact.dividend', {
            month: money(card.share.dividendMonthPerUnitMinor),
            year: card.share.yieldYearPercent,
          }),
        );
      }
    } else if (card.property) {
      out.push(
        t('CashflowGame.opportunity.fact.property', {
          price: money(card.property.priceMinor),
          rent: money(card.property.rentMonthMinor),
        }),
      );
      out.push(
        t('CashflowGame.opportunity.fact.cashNow', {
          cash: money(card.property.cashNeededMinor),
          mortgage: money(card.property.mortgageMinor),
        }),
      );
    } else if (card.costMinor !== undefined) {
      out.push(t('CashflowGame.opportunity.fact.cost', { cost: money(card.costMinor) }));
    }
    if (card.loan && !card.property) {
      out.push(
        t('CashflowGame.opportunity.fact.loan', {
          loan: money(card.loan.loanMinor),
          payment: money(card.loan.paymentMonthMinor),
        }),
      );
    }
    if (card.cashflowMinor !== undefined) {
      out.push(t('CashflowGame.opportunity.fact.cashflow', { amount: signed(card.cashflowMinor) }));
    } else if (card.dice) {
      out.push(t('CashflowGame.opportunity.fact.dice'));
    }
    if (card.savings && card.savings.monthlySavingsMinor > 0) {
      out.push(
        t('CashflowGame.opportunity.fact.saving', {
          amount: money(card.savings.monthlySavingsMinor),
        }),
      );
    }
    if (card.rampPaydays)
      out.push(t('CashflowGame.opportunity.fact.ramp', { paydays: card.rampPaydays }));
    if (card.lockedPaydays)
      out.push(t('CashflowGame.opportunity.fact.locked', { paydays: card.lockedPaydays }));
    if (card.sideHustle) out.push(t('CashflowGame.opportunity.fact.sideHustle'));
    out.push(t('CashflowGame.opportunity.fact.risk', { score: card.riskScore }));
    return out;
  }

  // ── what is finished ──

  /** What the cards asked to be paid and is still open. */
  get dues() {
    return this.service.paymentsDue;
  }

  get canFinish(): boolean {
    // a payment is made before the turn goes on (the free game is for trying things out)
    if (this.service.cannotRollBecause === 'PAYMENT_DUE') return false;
    switch (this.tile) {
      case 'harvest': {
        const h = this.harvest;
        // a hype that is being ridden is cashed out or rolled on first
        return !!h?.card && !h.ladders.some((ladder) => ladder.state === 'riding');
      }
      case 'opportunity': {
        const o = this.opportunity;
        if (!o) return false;
        if (o.passed) return true;
        return !!o.projectTitle && (o.planned || !o.paymentOpen);
      }
      case 'emergency':
        return !!this.emergency?.projectTitle;
      case 'life':
        return !!this.life?.outcome && !this.rolling;
      case 'career': {
        if (this.rolling) return false;
        const view = this.service.careerView;
        if (view) return view.done;
        // nothing to roll for (too early, or at the top of the ladder): the turn goes on
        const next = this.service.careerNext;
        // a due promotion may be left unrolled only where the rules allow it
        return !next || !next.eligible || !this.service.careerMustRoll;
      }
      case 'dream': {
        const view = this.service.dreamView;
        if (!view || view.swapping) return false;
        return !!view.taken || view.declined || !!view.applied || this.momentNothing;
      }
      default:
        return true;
    }
  }

  // ── emergency ──

  get emergency() {
    return this.service.emergencyView;
  }

  chooseEmergency(id: string): void {
    this.service.chooseEmergencyOption(id, this.callbacks);
  }

  rollEmergency(key: string): void {
    void this.roll(() => {
      this.service.rollEmergencyDie(key, this.callbacks);
      return Object.values(this.service.emergencyView?.selection.rolls ?? {});
    });
  }

  rerollEmergency(): void {
    this.service.rerollEmergency(this.callbacks);
  }

  createEmergency(): void {
    this.busy = true;
    this.service.createEmergencyProject(this.callbacks);
    // the project opens at once, to be paid or planned
    const title = this.service.emergencyView?.projectTitle;
    if (title) this.openFire.emit(title);
  }

  // ── life ──

  get life() {
    return this.service.lifeView;
  }

  get dreamMayDecline(): boolean {
    return this.service.dreamMayDecline;
  }

  get lifeCanDecline(): boolean {
    return this.service.lifeCanDecline;
  }

  preview(card: LifeCard): LifeEffect | undefined {
    const life = AppStateService.instance.cashflowGame.life;
    return (
      card.effects ??
      (life ? card.effectsByState?.[life.relationship] : undefined) ??
      card.accept ??
      card.give
    );
  }

  decideLife(decision: LifeDecision): void {
    if (decision.kind === 'roll') {
      void this.roll(() => {
        this.service.decideLife(decision, this.callbacks);
        return this.service.lifeView?.outcome?.rolls ?? [];
      });
      return;
    }
    this.busy = true;
    this.faces = [];
    this.service.decideLife(decision, this.callbacks);
    // a card that rolled on its own (a proposal declined, a partner who may leave) shows its dice
    const rolls = this.service.lifeView?.outcome?.rolls ?? [];
    if (rolls.length) this.faces = rolls.slice(0, 3);
  }

  effectLines(effect: LifeEffect | null | undefined): string[] {
    if (!effect) return [];
    const money = (minor: number) => `${this.amount(minor)} ${this.currency}`;
    const t = (key: string, params?: Record<string, unknown>) =>
      this.translate.instant(`CashflowGame.life.${key}`, params);
    const lines: string[] = [];
    if (effect.oneTimeMinor) {
      lines.push(
        t(effect.oneTimeMinor < 0 ? 'oncePay' : 'onceGet', { amount: money(effect.oneTimeMinor) }),
      );
    }
    if (effect.oneTimePercentOfNet) {
      lines.push(t('oncePayPercent', { percent: Math.abs(effect.oneTimePercentOfNet) }));
    }
    const span = effect.durationPaydays ? t('forPaydays', { count: effect.durationPaydays }) : '';
    if (effect.monthlyMinor) {
      lines.push(
        t(effect.monthlyMinor > 0 ? 'monthlyCost' : 'monthlySave', {
          amount: money(effect.monthlyMinor),
        }) + span,
      );
    }
    if (effect.incomeMonthlyMinor) {
      lines.push(t('monthlyIncome', { amount: money(effect.incomeMonthlyMinor) }) + span);
    }
    if (effect.incomePercentOfNet !== undefined) {
      lines.push(
        t(effect.incomePercentOfNet < 0 ? 'incomeCut' : 'incomeRise', {
          percent: Math.abs(effect.incomePercentOfNet),
        }) + span,
      );
    }
    if (effect.expensesPercent) {
      lines.push(
        t(effect.expensesPercent > 0 ? 'expensesRise' : 'expensesCut', {
          percent: Math.abs(effect.expensesPercent),
        }),
      );
    }
    if (effect.child) lines.push(t('child'));
    if (effect.temporary) {
      lines.push(
        t('leave', {
          percent: Math.abs(effect.temporary.incomePercentOfNet),
          count: effect.temporary.durationPaydays,
        }),
      );
    }
    if (effect.rewardTurns) lines.push(t('reward', { count: effect.rewardTurns }));
    if (effect.ongoingReward) lines.push(t('rewardOngoing'));
    if (effect.jobSearch) {
      lines.push(
        t('jobSearch', { count: effect.jobSearch.maxPaydays, from: effect.jobSearch.rollFrom }),
      );
    }
    if (effect.setState) {
      const s = effect.setState;
      for (const key of ['relationship', 'home', 'pet', 'location', 'employment'] as const) {
        const value = s[key];
        if (value) {
          lines.push(
            t('state', {
              what: this.translate.instant(`CashflowGame.life.badge.${key}`),
              value: this.translate.instant(`CashflowGame.life.value.${value}`),
            }),
          );
        }
      }
      if (s.car) {
        lines.push(
          t('state', {
            what: this.translate.instant('CashflowGame.life.badge.car'),
            value: this.translate.instant('CashflowGame.life.value.yes'),
          }),
        );
      }
    }
    if (effect.partnerRisk) lines.push(t('partnerRisk'));
    if (effect.removeCostMinor) lines.push(t('endable', { amount: money(effect.removeCostMinor) }));
    if (effect.minPaydays) lines.push(t('minPaydays', { count: effect.minPaydays }));
    return lines;
  }

  outcomeLines(outcome: LifeOutcome): string[] {
    const lang = this.lang;
    const money = (minor: number) => `${this.amount(minor)} ${this.currency}`;
    const t = (key: string, params?: Record<string, unknown>) =>
      this.translate.instant(`CashflowGame.life.${key}`, params);
    const lines: string[] = [];
    if (outcome.oneTimeMinor) {
      lines.push(
        t(outcome.oneTimeMinor < 0 ? 'oncePay' : 'onceGet', {
          amount: money(outcome.oneTimeMinor),
        }),
      );
    }
    for (const line of outcome.lines) {
      const span = line.paydaysLeft ? t('forPaydays', { count: line.paydaysLeft }) : '';
      lines.push(
        `${line.title[lang]}: ${line.amountMinor > 0 ? '+' : '−'}${money(line.amountMinor)} ${t('perMonth')}${span}`,
      );
    }
    if (outcome.rewardTurns) lines.push(t('reward', { count: outcome.rewardTurns }));
    for (const item of outcome.scheduled) {
      lines.push(t('scheduled', { title: item.title[lang], count: item.paydaysLeft }));
    }
    if (outcome.jobSearch) {
      lines.push(
        t('jobSearch', { count: outcome.jobSearch.paydaysLeft, from: outcome.jobSearch.rollFrom }),
      );
    }
    if (outcome.triggered) {
      lines.push(
        t('triggered', {
          card:
            this.service.lifeCards.find((c) => c.id === outcome.triggered)?.title[lang] ??
            outcome.triggered,
        }),
      );
    }
    if (lines.length === 0) lines.push(t('nothing'));
    return lines;
  }

  // ── career ──

  get career() {
    return this.service.careerStatus;
  }

  get next() {
    return this.service.careerNext;
  }

  get careerView() {
    return this.service.careerView;
  }

  get careerResult() {
    return this.service.careerView?.result ?? null;
  }

  progress(next: { paydaysIn: number; minPaydays: number }): number {
    return Math.min(100, Math.round((next.paydaysIn / Math.max(1, next.minPaydays)) * 100));
  }

  momentKey(moment: string): string {
    return `CashflowGame.career.moment.${moment}`;
  }

  rollCareer(): void {
    void this.roll(() => {
      this.service.rollCareerTile(this.callbacks);
      const result = this.service.careerView?.result;
      if (!result || !('roll' in result)) return [];
      const dice = [result.roll];
      if ('confirmRoll' in result && result.confirmRoll) dice.push(result.confirmRoll);
      if ('momentRoll' in result && result.momentRoll) dice.push(result.momentRoll);
      return dice;
    });
  }

  chooseBranch(id: string): void {
    this.busy = true;
    this.service.reachStage(id, this.callbacks);
  }

  // ── dream ──

  get dream() {
    return this.service.dreamView;
  }

  get maxOpen(): number {
    return this.service.dreamSettings.maxOpenDreams;
  }

  /** Once one dream is chosen the other goes away. */
  shownOffers<T extends { id: string }>(view: { offers: T[]; taken?: string }): T[] {
    if (this.selectedOffer && !view.taken) {
      return view.offers.filter((offer) => offer.id === this.selectedOffer);
    }
    return view.offers;
  }

  drawDreamOffers(count: number): void {
    this.selectedOffer = null;
    this.service.drawDream(this.callbacks, { forceOffers: count });
  }

  takeDream(id: string): void {
    this.busy = true;
    this.service.takeDream(id, this.callbacks);
    // the project opens at once, to be funded or planned
    const title = this.service.dreamView?.taken;
    if (title) this.openSmile.emit(title);
  }

  declineDreams(): void {
    this.service.declineDreams(this.callbacks);
  }

  get momentTargets() {
    const view = this.service.dreamView;
    if (!view?.moment) return [];
    const entries = this.service.openDreams;
    const open = entries.map((entry) => ({
      card: entry.card,
      buckets: entry.project.buckets.map((bucket) => ({
        target: Number(bucket.target),
        amount: Number(bucket.amount),
      })),
    }));
    return dreamsForMoment(view.moment.id as DreamMomentId, open).map((i) => entries[i]);
  }

  get momentNothing(): boolean {
    const view = this.service.dreamView;
    return (
      !!view?.moment &&
      !view.applied &&
      this.momentTargets.length === 0 &&
      !['M02', 'M05', 'M07'].includes(view.moment.id)
    );
  }

  progressOf(entry: { project: { buckets: { target: number; amount: number }[] } }): number {
    const total = entry.project.buckets.reduce((sum, bucket) => sum + Number(bucket.target), 0);
    const saved = entry.project.buckets.reduce(
      (sum, bucket) => sum + Math.min(Number(bucket.amount), Number(bucket.target)),
      0,
    );
    return total > 0 ? Math.round((saved / total) * 100) : 0;
  }

  applyMoment(projectTitle?: string): void {
    const view = this.service.dreamView;
    if (!view?.moment) return;
    this.busy = true;
    const entry = this.service.openDreams.find(
      (candidate) => candidate.project.title === projectTitle,
    );
    const bucketIndex = Math.max(
      0,
      entry?.project.buckets.findIndex(
        (bucket) => Number(bucket.amount) + 0.005 < Number(bucket.target),
      ) ?? 0,
    );
    this.service.applyDreamMoment(view.moment.id, { projectTitle, bucketIndex }, this.callbacks);
  }
}
