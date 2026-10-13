import { Injectable } from '@angular/core';
import {
  generateDueTransfers,
  reconcileGeneratedTransfers,
  RecurringTransferRule,
  TransferLike,
} from '@money/domain';
import { RecurringTransfer } from '../../interfaces/recurring-transfer';
import { Transfer } from '../../interfaces/transfer';
import { reconcileTransfer, releaseTransfers } from '../location-balance';
import { newTransferId } from '../transfer.utils';
import { AppStateService } from './app-state.service';
import { PersistenceService } from './persistence.service';

const toMinor = (amount: number): number => Math.round(amount * 100);

/** A rule as the domain engine sees it: money in minor units, no end date as `null`. */
export function toRule(rule: RecurringTransfer): RecurringTransferRule {
  return {
    title: rule.title,
    fromLocationId: rule.fromLocationId,
    toLocationId: rule.toLocationId,
    amountMinor: toMinor(rule.amount),
    startDate: rule.startDate,
    endDate: rule.endDate ? rule.endDate : null,
    comment: rule.comment || '',
    frequency: rule.frequency || 'monthly',
  };
}

const toLike = (transfer: Transfer): TransferLike => ({
  fromLocationId: transfer.fromLocationId,
  toLocationId: transfer.toLocationId,
  amountMinor: toMinor(transfer.amount),
  date: transfer.date,
  time: transfer.time || '',
  comment: transfer.comment || '',
});

/**
 * Generates and maintains the transfers of recurring transfers (todo/locations.md section 19). Never touches a
 * transaction: a recurring transfer only produces Transfers, so Cashflow cannot change.
 */
@Injectable({ providedIn: 'root' })
export class RecurringTransferService {
  static instance: RecurringTransferService;

  constructor(private persistence: PersistenceService) {
    RecurringTransferService.instance = this;
  }

  /**
   * Creates every transfer that is due and does not exist yet, for all rules, and moves the two balances of each.
   * Returns how many were created; the caller persists (see `save`) - `generateAndSave` does both.
   */
  generateDue(now: Date = new Date()): number {
    const state = AppStateService.instance;
    const due = generateDueTransfers(
      state.allRecurringTransfers.map(toRule),
      state.allTransfers.map(toLike),
      now,
    );
    for (const generated of due) {
      const transfer: Transfer = {
        id: newTransferId(),
        fromLocationId: generated.fromLocationId,
        toLocationId: generated.toLocationId,
        amount: generated.amountMinor / 100,
        date: generated.date,
        time: generated.time === '00:00' ? '' : generated.time,
        comment: generated.comment,
      };
      state.allTransfers.push(transfer);
      reconcileTransfer(state.allLocations, null, transfer);
    }
    if (due.length > 0) state.transfersUpdated$.next();
    return due.length;
  }

  /**
   * Brings the transfers `before` generated in line with `after` (`null` when the rule is deleted: everything it
   * generated goes). The ones `after` still has an occurrence for change in place, keeping their place in the list;
   * the others are removed; the balances follow. Transfers made by hand are never touched.
   */
  reconcile(
    before: RecurringTransfer,
    after: RecurringTransfer | null,
    now: Date = new Date(),
  ): { updated: number; removed: number } {
    const state = AppStateService.instance;
    const transfers = state.allTransfers;
    const { updates, removals } = reconcileGeneratedTransfers(
      toRule(before),
      after ? toRule(after) : null,
      transfers.map(toLike),
      now,
    );
    for (const update of updates) {
      const transfer = transfers[update.index];
      const bookedBefore = {
        fromLocationId: transfer.fromLocationId,
        toLocationId: transfer.toLocationId,
        amount: transfer.amount,
      };
      transfer.fromLocationId = update.fromLocationId;
      transfer.toLocationId = update.toLocationId;
      transfer.amount = update.amountMinor / 100;
      transfer.date = update.date;
      transfer.comment = update.comment;
      reconcileTransfer(state.allLocations, bookedBefore, transfer);
    }
    releaseTransfers(
      state.allLocations,
      removals.map((index) => transfers[index]),
    );
    const removed = new Set(removals);
    state.allTransfers = transfers.filter((_, index) => !removed.has(index));
    if (updates.length > 0 || removals.length > 0) state.transfersUpdated$.next();
    return { updated: updates.length, removed: removals.length };
  }

  /** Stores the rules, the transfers and the location balances (one batch). */
  save(logEvent: string, onDone?: (ok: boolean) => void): void {
    const state = AppStateService.instance;
    state.isSaving = true;
    state.transfersUpdated$.next();
    this.persistence.batchWriteAndSync({
      writes: [
        { tag: 'recurringTransfers', data: state.allRecurringTransfers },
        { tag: 'transfers', data: state.allTransfers },
        { tag: 'locations', data: state.allLocations },
      ],
      localStorageSaves: [
        { key: 'recurringTransfers', data: JSON.stringify(state.allRecurringTransfers) },
        { key: 'transfers', data: JSON.stringify(state.allTransfers) },
        { key: 'locations', data: JSON.stringify(state.allLocations) },
      ],
      logEvent,
      onSuccess: () => {
        state.isSaving = false;
        onDone?.(true);
      },
      onError: () => {
        state.isSaving = false;
        onDone?.(false);
      },
    });
  }

  /** Generates what is due and stores it; resolves to the number created (0 writes nothing). */
  generateAndSave(now: Date = new Date()): number {
    const created = this.generateDue(now);
    if (created > 0) this.save('recurring_transfers_generated');
    return created;
  }
}
