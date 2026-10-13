import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MoneyLocation } from 'src/app/interfaces/location';
import { AppNumberPipe } from 'src/app/shared/pipes/app-number.pipe';
import { locationLabel } from 'src/app/shared/location.utils';
import { SplitRow, splitPreview, splitProblem } from 'src/app/shared/location-split.utils';

/**
 * "Split across locations": send part of a booking (or of every booking a subscription generates) to OTHER
 * locations. Each row is a location with a percentage or a fixed amount; the main location, picked in the
 * form around this editor, receives the rest. The rows array belongs to the parent and is edited in place.
 */
@Component({
  selector: 'app-location-split',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './location-split.component.html',
  styleUrls: ['./location-split.component.css'],
})
export class LocationSplitComponent {
  /** The rows to edit (owned by the parent, edited in place). */
  @Input() rows: SplitRow[] = [];
  /** The main location chosen in the form; it is excluded from the choices and shown in the preview. */
  @Input() mainLocationId: string | null = null;
  /** The booking amount (signed) for the live preview; null when not known yet. */
  @Input() amount: number | null = null;
  /** Every location (a stable array - not a fresh one per change detection). */
  @Input() locations: MoneyLocation[] = [];
  @Input() currency = '€';
  /** Subscriptions have no single amount when the field is empty; the preview then stays hidden. */
  @Input() showPreview = true;

  readonly label = locationLabel;
  expanded = false;

  get isOpen(): boolean {
    return this.expanded || this.rows.length > 0;
  }

  get problem(): string | null {
    return splitProblem(this.rows, this.mainLocationId);
  }

  get preview() {
    if (!this.showPreview || this.amount === null) return [];
    return splitPreview(this.amount, this.mainLocationId, this.rows, this.locations);
  }

  /** The locations a row may pick: not the main one and not one another row already uses. */
  choicesFor(row: SplitRow): MoneyLocation[] {
    const used = new Set(
      this.rows.filter((r) => r !== row && r.locationId).map((r) => r.locationId as string),
    );
    return this.locations.filter((l) => l.id !== this.mainLocationId && !used.has(l.id));
  }

  open(): void {
    this.expanded = true;
    if (this.rows.length === 0) this.add();
  }

  add(): void {
    this.rows.push({ locationId: null, mode: 'percent', value: null });
  }

  remove(index: number): void {
    this.rows.splice(index, 1);
    if (this.rows.length === 0) this.expanded = false;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
