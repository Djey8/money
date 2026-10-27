import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { TableRoomComponent } from './table-room.component';
import { DreamRoomComponent } from '../dreamfund-tables/dream-room.component';
import { keepGame } from './table-game';

/**
 * One address for every table (`/tables/:id`): the table says which game it is, and its own room opens - the classic Cashflow's, or the
 * Dreamfund's. The lobby and the leaderboard are the same for both; only what is played at the table differs.
 */
@Component({
  selector: 'app-table-room-switch',
  standalone: true,
  imports: [CommonModule, TableRoomComponent, DreamRoomComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dream-room *ngIf="game === 'dreamfund'" />
    <app-table-room *ngIf="game === 'classic'" />
  `,
})
export class TableRoomSwitchComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  game: 'classic' | 'dreamfund' | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.http
      .get<{ table?: { kind?: string } }>(
        `${environment.selfhosted.apiUrl}/v1/game/rooms/${encodeURIComponent(id)}`,
      )
      // a table that cannot be read is shown by the classic room, which says what is wrong
      .subscribe({
        next: (room) => this.show(room.table?.kind === 'dreamfund' ? 'dreamfund' : 'classic'),
        error: () => this.show('classic'),
      });
  }

  private show(game: 'classic' | 'dreamfund'): void {
    // the lobby and the leaderboard open on the game of the table just left
    keepGame(game);
    this.game = game;
    this.cdr.markForCheck();
  }
}
