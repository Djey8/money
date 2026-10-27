import { Injectable } from '@angular/core';
import type { TableLegalAction, TableView } from '@money/domain';
import { TableSessionService } from '../tables/table-session.service';
import type { DreamTableView } from './dream-session.service';
import { dreamViewAsTable } from './dream-table-view';

/**
 * A Dreamfund table followed like a classic one (todo/dreamfund-tables-solo-ui.md, R3): the same stream, moves and lobby calls, with
 * the table brought into the shape the table screens read. Everything else - the room page, the table mode, the game screen - is the
 * classic table's own.
 */
@Injectable()
export class DreamTableSessionService extends TableSessionService {
  protected override adaptView(view: TableView): TableView {
    return dreamViewAsTable(view as unknown as DreamTableView);
  }

  protected override adaptLegal(actions: unknown[] | undefined): TableLegalAction[] {
    return ((actions ?? []) as { type: string; hint?: Record<string, unknown> }[]).map(
      (entry) => ({ action: entry.type, description: '' }) as unknown as TableLegalAction,
    );
  }
}
