import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { TableRoomSwitchComponent } from './table-room-switch.component';
import { TableRoomComponent } from './table-room.component';
import { DreamRoomComponent } from '../dreamfund-tables/dream-room.component';

describe('TableRoomSwitchComponent', () => {
  const setup = (kind: string | undefined) => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TableRoomSwitchComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 't1' }, queryParamMap: { get: () => null } },
          },
        },
      ],
    });
    // the rooms themselves are tested on their own: here only which one is chosen
    TestBed.overrideComponent(TableRoomSwitchComponent, { set: { imports: [], template: '' } });
    const fixture = TestBed.createComponent(TableRoomSwitchComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/v1/game/rooms/t1'))
      .flush({ id: 't1', table: kind ? { kind } : {} });
    return fixture.componentInstance;
  };

  it('opens the Dreamfund room for a Dreamfund table and remembers the game', () => {
    expect(setup('dreamfund').game).toBe('dreamfund');
    expect(localStorage.getItem('mm.tables.game')).toBe('dreamfund');
  });

  it('opens the classic room for any other table', () => {
    expect(setup(undefined).game).toBe('classic');
  });

  it('knows both rooms', () => {
    expect(TableRoomComponent).toBeDefined();
    expect(DreamRoomComponent).toBeDefined();
  });
});
