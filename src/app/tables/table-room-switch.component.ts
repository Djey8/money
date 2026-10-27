import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environment';
import { TableRoomComponent } from './table-room.component';
import { keepGame, OpenTableGame, type TableGame } from './table-game';

/**
 * One address for every table (`/tables/:id`): the table says which game it is, and the one room page opens for it - the classic
 * Cashflow's or the Dreamfund's, with the same lobby, table layer and solo screen.
 */
@Component({
  selector: 'app-table-room-switch',
  standalone: true,
  imports: [CommonModule, TableRoomComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-table-room *ngIf="game" />`,
})
export class TableRoomSwitchComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  game: TableGame | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.http
      .get<{ table?: { kind?: string } }>(
        `${environment.selfhosted.apiUrl}/v1/game/rooms/${encodeURIComponent(id)}`,
      )
      // a table that cannot be read is shown by the room page, which says what is wrong
      .subscribe({
        next: (room) => this.show(room.table?.kind === 'dreamfund' ? 'dreamfund' : 'classic'),
        error: () => this.show('classic'),
      });
  }

  private show(game: TableGame): void {
    // the lobby and the leaderboard open on the game of the table just left
    keepGame(game);
    OpenTableGame.current = game;
    this.game = game;
    this.cdr.markForCheck();
  }
}
