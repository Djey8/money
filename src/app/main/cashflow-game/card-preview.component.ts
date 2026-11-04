import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { isInsuredAgainst, quoteEmergency, type EmergencyCard } from '@money/domain';
import { CashflowGameService } from '../../shared/services/cashflow-game.service';
import {
  cardFacts,
  dreamCardWords,
  effectLines,
  findDreamCard,
  type Effect,
  type RawCard,
} from '../../dreamfund-tables/dream-card-facts';
import { dreamMoney } from '../../dreamfund-tables/dream-texts';

interface Row {
  label: string;
  value: string;
  note?: string;
}

/**
 * A card of a Dreamfund pile as it was shown to the player who drew it (JFK, 2026-11-04): the title and what it is, its story, what it
 * costs or brings - for the player who looks at it, at their own price level and with their own insurances - and the chances of its
 * dice. Read only, with none of the buttons: the card of another player's move, or a line of the history, opens in this.
 */
@Component({
  selector: 'app-card-preview',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="cp" *ngIf="found as f" [attr.data-pile]="f.pile">
      <header class="cp-head">
        <h4>{{ title }}</h4>
        <ul class="cp-tags">
          <li class="cp-tag cp-tag--pile">{{ facts.deck }}</li>
          <li class="cp-tag" *ngFor="let line of facts.lines">{{ line }}</li>
        </ul>
      </header>
      <p class="cp-story">{{ facts.text }}</p>

      <section class="cp-section" *ngIf="rows.length">
        <h5>{{ heading }}</h5>
        <dl class="cp-rows">
          <div *ngFor="let row of rows">
            <dt>{{ row.label }}</dt>
            <dd>
              {{ row.value }}<small *ngIf="row.note"> · {{ row.note }}</small>
            </dd>
          </div>
        </dl>
      </section>

      <section class="cp-section" *ngIf="chances.length">
        <h5>🎲 {{ words.dice }}</h5>
        <dl class="cp-rows">
          <div *ngFor="let row of chances">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </section>

      <p class="cp-insured" *ngIf="insuredLine" [class.cp-insured--yes]="insured">
        {{ insuredLine }}
      </p>

      <section class="cp-section" *ngFor="let block of texts">
        <h5>{{ block.label }}</h5>
        <p>{{ block.text }}</p>
      </section>
    </article>
  `,
  styles: [
    `
      .cp {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        border-radius: 12px;
        border: 2px solid var(--color-border-light, #ddd);
        border-inline-start: 6px solid var(--tc, var(--color-primary, #2a7de1));
        background: var(--color-surface, #fff);
        font-size: 0.92rem;
        line-height: 1.4;
      }
      .cp h4,
      .cp h5,
      .cp p {
        margin: 0;
      }
      .cp h4 {
        font-size: 1.1rem;
      }
      .cp h5 {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.7;
      }
      .cp-tags {
        list-style: none;
        margin: 6px 0 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .cp-tag {
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 0.78rem;
        background: var(--color-surface-alt, #f4f6f8);
        border: 1px solid var(--color-border-light, #ddd);
      }
      .cp-tag--pile {
        font-weight: 700;
        border-color: var(--tc, var(--color-primary, #2a7de1));
      }
      .cp-story {
        font-size: 0.95rem;
      }
      .cp-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cp-rows {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .cp-rows > div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 10px;
        border-radius: 8px;
        background: var(--color-surface-alt, #f4f6f8);
      }
      .cp-rows dt {
        min-width: 0;
      }
      .cp-rows dd {
        margin: 0;
        text-align: end;
        font-weight: 600;
      }
      .cp-rows small {
        font-weight: 400;
        opacity: 0.75;
      }
      .cp-insured {
        padding: 6px 10px;
        border-radius: 8px;
        background: rgba(192, 57, 43, 0.12);
      }
      .cp-insured--yes {
        background: rgba(39, 174, 96, 0.14);
      }
    `,
  ],
})
export class CardPreviewComponent {
  private readonly service = inject(CashflowGameService);
  private readonly translate = inject(TranslateService);

  private idValue = '';
  private langValue = 'en';
  found: ReturnType<typeof findDreamCard> = null;
  facts: ReturnType<typeof cardFacts> = { deck: '', lines: [], text: '' };
  rows: Row[] = [];
  chances: Row[] = [];
  texts: { label: string; text: string }[] = [];
  insuredLine = '';
  insured = false;
  heading = '';

  @Input({ required: true }) set cardId(value: string) {
    this.idValue = value;
    this.build();
  }
  @Input() set lang(value: string) {
    this.langValue = value;
    this.build();
  }

  get words() {
    return dreamCardWords(this.langValue);
  }

  get title(): string {
    return this.found?.card.title[this.langValue === 'de' ? 'de' : 'en'] ?? '';
  }

  private m(minor: number): string {
    return dreamMoney(minor, this.langValue);
  }

  private build(): void {
    this.rows = [];
    this.chances = [];
    this.texts = [];
    this.insuredLine = '';
    this.insured = false;
    this.found = this.idValue ? findDreamCard(this.idValue) : null;
    if (!this.found) return;
    const { pile, card } = this.found;
    this.facts = cardFacts(pile, card, this.langValue);
    const de = this.langValue === 'de';
    const w = this.words;
    this.heading = pile === 'emergency' || pile === 'opportunity' ? w.cost : w.total;
    if (pile === 'emergency') this.buildEmergency(card);
    else if (pile === 'life') this.buildLife(card);
    else if (pile === 'dream') this.buildDream(card);
    else if (pile === 'opportunity') this.buildOpportunity(card);
    else if (pile === 'harvest' && card.realWorld) {
      this.texts = [
        { label: de ? 'In der Wirklichkeit' : 'In the real world', text: card.realWorld },
      ];
    }
  }

  /** What the card costs the player who looks at it: their price level, their insurances. */
  private buildEmergency(card: RawCard): void {
    const de = this.langValue === 'de';
    const l = de ? 'de' : 'en';
    const context = this.service.emergencyContext;
    const typed = card as unknown as EmergencyCard;
    const pay = (selection: Parameters<typeof quoteEmergency>[1]) =>
      quoteEmergency(typed, selection, context);
    if (card.type === 'dice' && card.dice) {
      this.heading = this.words.cost;
      this.chances = card.dice.map((band) => ({
        label: band.from === band.to ? `${band.from}` : `${band.from} – ${band.to}`,
        value: this.m(pay({ rolls: { main: band.from } }).payMinor),
      }));
    } else if (card.type === 'choice' && card.choices) {
      this.rows = card.choices.map((choice) => ({
        label: choice.label[l],
        value: this.m(pay({ choiceId: choice.id }).payMinor),
      }));
    } else {
      const quote = pay({});
      this.rows = quote.buckets.length
        ? quote.buckets.map((bucket) => ({
            label: bucket.title[l],
            value: this.m(bucket.amountMinor),
          }))
        : (card.buckets ?? []).map((bucket) => ({
            label: bucket.title[l],
            value: this.m(bucket.amountMinor),
          }));
      if (quote.ready && quote.buckets.length > 1) {
        this.rows.push({ label: this.words.total, value: this.m(quote.payMinor) });
      }
    }
    if (card.insurance) {
      this.insured = isInsuredAgainst(typed, context.insurances);
      const kind = this.translate.instant(`CashflowGame.insurance.kind.${card.insurance}`);
      this.insuredLine = this.insured
        ? de
          ? `Deine Versicherung (${kind}) greift: du zahlst nur den Selbstbehalt.`
          : `Your insurance (${kind}) covers it: you pay only the deductible.`
        : de
          ? `Nicht versichert (${kind}): du zahlst alles selbst.`
          : `Not insured (${kind}): you pay all of it.`;
    }
  }

  private buildLife(card: RawCard): void {
    const de = this.langValue === 'de';
    const l = de ? 'de' : 'en';
    this.heading = this.words.fate;
    const rows = (effect: Effect | undefined, label: string): Row[] => {
      const lines = effectLines(effect, this.langValue);
      return lines.length ? [{ label, value: lines.join(' · ') }] : [];
    };
    this.rows = [
      ...rows(card.effects, de ? 'Wirkung' : 'Effect'),
      ...rows(card.accept, de ? 'Annehmen' : 'Accept'),
      ...(card.options ?? []).flatMap((option) => rows(option.effect, option.label[l])),
    ];
    this.chances = (card.dice ?? []).map((band) => {
      const value = (band.value ?? {}) as Effect;
      const lines = effectLines(value, this.langValue);
      if (value.schedule) {
        lines.push(
          `${value.schedule.cardId} ${de ? 'nach' : 'after'} ${value.schedule.afterPaydays} ${this.words.paydays}`,
        );
      }
      return {
        label: band.from === band.to ? `${band.from}` : `${band.from} – ${band.to}`,
        value: lines.join(' · ') || (de ? 'nichts' : 'nothing'),
      };
    });
  }

  private buildDream(card: RawCard): void {
    const l = this.langValue === 'de' ? 'de' : 'en';
    this.rows = (card.buckets ?? []).map((bucket) => ({
      label: bucket.title[l],
      value: this.m(bucket.amountMinor),
    }));
  }

  /** What it costs the player who looks at it (their price level), what it brings, and the chances of its dice. */
  private buildOpportunity(raw: RawCard): void {
    const de = this.langValue === 'de';
    const w = this.words;
    const card = (this.service.opportunityCards.find((c) => c.id === raw.id) ?? raw) as RawCard;
    const rows: Row[] = [];
    if (card.share) {
      rows.push({
        label: card.share.ticker,
        value: `${this.m(card.share.unitPriceMinor)} ${w.perUnit}`,
      });
      if (card.share.dividendMonthPerUnitMinor) {
        rows.push({
          label: w.dividend,
          value: `${this.m(card.share.dividendMonthPerUnitMinor)} ${w.month} ${w.perUnit}`,
        });
      }
    } else if (card.costMinor) {
      rows.push({ label: w.cost, value: this.m(card.costMinor) });
    } else if (card.stepMinor) {
      rows.push({
        label: w.cost,
        value: `${this.m(card.stepMinor)} ${de ? 'je Schritt' : 'a step'}`,
      });
    }
    this.rows = rows;
    const labels: Record<string, string> = {
      monthlySavingsMinor: de ? 'Ersparnis im Monat' : 'Saving a month',
      monthlyIncomeMinor: de ? 'Einkommen im Monat' : 'Income a month',
      monthlyMinor: de ? 'Im Monat' : 'A month',
      oneTimeMinor: de ? 'Einmalig' : 'Once',
    };
    this.chances = (card.dice ?? []).map((band) => ({
      label: band.from === band.to ? `${band.from}` : `${band.from} – ${band.to}`,
      value:
        Object.entries(band.value ?? {})
          .map(([key, value]) =>
            typeof value === 'number' && key.endsWith('Minor')
              ? `${labels[key] ?? key}: ${this.m(value)}`
              : `${key}: ${JSON.stringify(value)}`,
          )
          .join(' · ') || (de ? 'nichts' : 'nothing'),
    }));
    const texts: { label: string; text: string }[] = [];
    if (card.strategy) texts.push({ label: de ? 'Strategie' : 'Strategy', text: card.strategy });
    if (card.risks) texts.push({ label: w.risk, text: card.risks });
    this.texts = texts;
  }
}
