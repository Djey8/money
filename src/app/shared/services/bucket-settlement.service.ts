import { Injectable } from '@angular/core';
import { AppStateService } from './app-state.service';
import { IncomeStatementService } from './income-statement.service';
import { PersistenceService } from './persistence.service';
import { settleBucketTransactions, unsettleBucketTransactions } from '../bucket.utils';

export type FundKind = 'smile' | 'fire';

export interface SettleRequest {
  bucket: { title: string; amount: number };
  actual: number;
  receipt?: string;
  moveSurplusTo?: string;
}

interface Callbacks {
  onSuccess: () => void;
  onError: (message: string) => void;
}

const DEFAULT_ACCOUNT: Record<FundKind, string> = { smile: 'Smile', fire: 'Fire' };

/**
 * Settles or reopens a Smile/Fire bucket from the app: edits the bucket's
 * `#settle:` transaction, lets the fund engine re-derive every bucket, and
 * persists transactions plus the rebuilt income statement and projects in one
 * batch — the app's counterpart of the API's `settle_bucket`/`unsettle_bucket`.
 */
@Injectable({ providedIn: 'root' })
export class BucketSettlementService {
  constructor(
    private persistence: PersistenceService,
    private incomeStatement: IncomeStatementService,
  ) {}

  settle(kind: FundKind, projectTitle: string, request: SettleRequest, callbacks: Callbacks): void {
    const now = new Date();
    settleBucketTransactions(AppStateService.instance.allTransactions, {
      projectTitle,
      bucket: request.bucket,
      actual: request.actual,
      receipt: request.receipt,
      moveSurplusTo: request.moveSurplusTo,
      account: DEFAULT_ACCOUNT[kind],
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    });
    this.save(
      kind,
      `settle_${kind}_bucket`,
      { projectTitle, bucket: request.bucket.title },
      callbacks,
    );
  }

  unsettle(kind: FundKind, projectTitle: string, bucketTitle: string, callbacks: Callbacks): void {
    if (
      !unsettleBucketTransactions(
        AppStateService.instance.allTransactions,
        projectTitle,
        bucketTitle,
      )
    ) {
      callbacks.onError(`Bucket "${bucketTitle}" is not settled.`);
      return;
    }
    this.save(kind, `unsettle_${kind}_bucket`, { projectTitle, bucket: bucketTitle }, callbacks);
  }

  private save(
    kind: FundKind,
    logEvent: string,
    logMetadata: Record<string, string>,
    callbacks: Callbacks,
  ): void {
    const state = AppStateService.instance;
    this.incomeStatement.recalculate();
    state.isSaving = true;
    this.persistence.batchWriteAndSync({
      // incomeStatement.getWrites() already includes smile, fire and mojo.
      writes: [
        { tag: 'transactions', data: state.allTransactions },
        ...this.incomeStatement.getWrites(),
      ],
      localStorageSaves: [
        { key: 'transactions', data: state.allTransactions },
        {
          key: kind,
          data: kind === 'smile' ? state.allSmileProjects : state.allFireEmergencies,
        },
      ],
      logEvent,
      logMetadata,
      onSuccess: () => {
        state.isSaving = false;
        this.incomeStatement.saveToLocalStorage();
        callbacks.onSuccess();
      },
      onError: (error: any) => {
        state.isSaving = false;
        callbacks.onError(error?.message || 'Database write failed');
      },
    });
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
