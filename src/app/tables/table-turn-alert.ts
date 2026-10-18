/**
 * "It is your turn" for a player who has the table in another tab (todo/cashflow-multiplayer.md phase U5): the page title
 * says so, and - only when the player has allowed it - the browser shows a notification. Nothing here plays a sound or asks
 * for permission by itself; asking is a button the player presses.
 */
export interface AlertEnvironment {
  document: Pick<Document, 'title' | 'hidden'>;
  /** The browser's Notification constructor, when it has one. */
  Notification?: {
    new (title: string, options?: { body?: string; tag?: string }): { close(): void };
    permission: NotificationPermission;
    requestPermission(): Promise<NotificationPermission>;
  };
}

export class TurnAlert {
  private original: string | null = null;
  private open: { close(): void } | null = null;

  constructor(private env: AlertEnvironment) {}

  /** Whether the browser can notify at all, and whether the player has not yet answered. */
  get canAsk(): boolean {
    return !!this.env.Notification && this.env.Notification.permission === 'default';
  }

  async ask(): Promise<boolean> {
    if (!this.env.Notification) return false;
    return (await this.env.Notification.requestPermission()) === 'granted';
  }

  /** The player's turn has begun: mark the tab, and notify when they are not looking at it. */
  turnStarted(text: string, body: string): void {
    if (this.original === null) this.original = this.env.document.title;
    this.env.document.title = `● ${text} - ${this.original}`;
    const notifications = this.env.Notification;
    if (notifications && notifications.permission === 'granted' && this.env.document.hidden) {
      this.open?.close();
      this.open = new notifications(text, { body, tag: 'mm-table-turn' });
    }
  }

  /** The turn is over, or the table was left: the tab is as it was. */
  turnEnded(): void {
    if (this.original !== null) this.env.document.title = this.original;
    this.original = null;
    this.open?.close();
    this.open = null;
  }
}
