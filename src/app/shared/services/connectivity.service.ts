import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { environment } from '../../../environments/environment';

/**
 * Tracks whether the app currently has working connectivity to the backend.
 *
 * `navigator.onLine` is necessary but not sufficient — it only reflects the OS's view of the
 * network interface. The browser can be "online" while the backend is unreachable (corp VPN
 * down, DNS issue, Wi-Fi captive portal, server restart, etc.). We therefore also run a
 * lightweight heartbeat against `${apiUrl}/health` while the document is visible.
 *
 * Heartbeats are skipped in firebase mode (no backend to probe) and in tests.
 */
@Injectable({
  providedIn: 'root'
})
export class ConnectivityService {
  /** ms between heartbeats while the tab is visible. */
  private static readonly HEARTBEAT_INTERVAL_MS = 30_000;
  /** ms before a heartbeat is considered failed. */
  private static readonly HEARTBEAT_TIMEOUT_MS = 5_000;

  // Initial online state: in firebase mode we are PESSIMISTIC at cold start — we don't
  // know if the network actually reaches Firebase until the boot REST probe confirms it.
  // navigator.onLine is unreliable here (some "work offline" browser extensions block all
  // Firebase traffic without toggling navigator.onLine), so trusting it would cause every
  // request issued before the probe finishes to hang on its own timeout. In other modes
  // navigator.onLine is the only signal we have, so we trust it.
  private readonly _online$ = new BehaviorSubject<boolean>(
    environment.mode === 'firebase'
      ? false
      : (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );
  /** Emits the current online state. Replays the latest value to new subscribers. */
  readonly online$: Observable<boolean> = this._online$.pipe(distinctUntilChanged());

  private heartbeatHandle: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  /**
   * In firebase mode we ALSO track Firebase's authoritative connection state via the
   * `.info/connected` reference. The browser's `navigator.onLine` and `online`/`offline`
   * events are unreliable (fire spuriously, are blocked by ad-blockers, etc.). Firebase's
   * own signal tells us whether the SDK actually has a working socket to the database.
   * We treat the user as online only when *both* signals agree.
   */
  private firebaseConnected: boolean | null = null;

  constructor(private zone: NgZone, private afDb: AngularFireDatabase) {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      // Trust the OS event optimistically only in non-firebase modes. In firebase mode
      // we wait for a verified round-trip before declaring ourselves online.
      if (environment.mode !== 'firebase') {
        this.set(true);
      } else {
        // Re-run the boot probe so reachability gets re-confirmed after the user re-enables
        // their network (e.g. turns off a kill-switch extension or rejoins Wi-Fi).
        this.bootProbe();
      }
      this.probe();
    });
    window.addEventListener('offline', () => this.set(false));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.startHeartbeat();
        this.probe();
      } else {
        this.stopHeartbeat();
      }
    });

    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      this.startHeartbeat();
    }

    // Firebase mode: subscribe to .info/connected. We treat this signal asymmetrically:
    //   - false  =>  immediately mark offline (definitive: SDK lost its socket).
    //   - true   =>  NOT trusted on its own. Firebase reports `connected=true` based on its
    //                internal socket state, which can stay `true` even when subsequent reads/writes
    //                hang (ad-blocker partially allowing requests, half-open socket, etc.).
    //                So we ignore the upward edge here and only flip ONLINE after a real
    //                round-trip (`verifyFirebaseOnline`) succeeds.
    if (environment.mode === 'firebase' && this.afDb?.database) {
      try {
        this.afDb.database.ref('.info/connected').on('value', snap => {
          const connected = !!snap?.val();
          this.firebaseConnected = connected;
          if (!connected) {
            this.lastOfflineAt = Date.now();
            this.set(false);
            this.resolveReady();
          } else {
            // .info/connected=true means the SDK has a working socket to Firebase. That is
            // the authoritative "online" signal — bypass anti-flap and the boot-probe gate
            // (which can fail spuriously on CORS / SW interception even when the socket is
            // perfectly fine) and commit online immediately.
            this.bootProbeConfirmedReachable = true;
            this.lastOfflineAt = 0;
            if (this.pendingOnlineTimer != null) {
              clearTimeout(this.pendingOnlineTimer);
              this.pendingOnlineTimer = null;
            }
            this.zone.run(() => {
              if (this._online$.value !== true) this._online$.next(true);
            });
            this.resolveReady();
          }
        });
      } catch (err) {
        console.warn('[Connectivity] Failed to subscribe to .info/connected', err);
        this.resolveReady();
      }
      // Authoritative boot probe: a real REST round-trip to the Firebase host. Used at
      // cold start to break ties before `.info/connected` fires — once the SDK socket is
      // up the probe is no longer needed.
      this.bootProbe();
    } else if (environment.mode === 'selfhosted') {
      // Selfhosted needs the same honest verdict as firebase: navigator.onLine lies on
      // installed mobile PWAs (it can stay true after OS suspend/resume while every fetch
      // hangs). Run a real /health round-trip before resolving waitForReady() so cold-start
      // callers don't fire tier1 against a server they can't actually reach.
      this.selfhostedBootProbe();
    } else {
      // Other modes: ready immediately — navigator.onLine is our truth.
      this.resolveReady();
    }
  }

  /** True once the boot REST probe has confirmed the Firebase host is reachable. */
  private bootProbeConfirmedReachable = false;

  /**
   * One-shot REST probe at startup. This is the source of truth for the initial online
   * verdict — `.info/connected` is too unreliable in the presence of network-blocking
   * extensions (it can stay true based on cached auth state even when the WebSocket is
   * blocked). Once this confirms reachability we let `.info/connected` take over.
   */
  private async bootProbe(): Promise<void> {
    const dbURL = (environment as any)?.firebase?.databaseURL;
    if (!dbURL) {
      // No URL to probe — fall back to navigator.onLine.
      this.bootProbeConfirmedReachable = typeof navigator === 'undefined' || navigator.onLine;
      this.resolveReady();
      return;
    }
    let reachable = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        ConnectivityService.FIREBASE_VERIFY_TIMEOUT_MS
      );
      try {
        const res = await fetch(`${dbURL}/.json?shallow=true&_=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { 'ngsw-bypass': 'true' },
          signal: controller.signal
        });
        reachable = res.status > 0;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      reachable = false;
    }
    this.bootProbeConfirmedReachable = reachable;
    if (reachable) {
      // Network reaches Firebase host. Commit online immediately, skipping the runtime
      // stability debounce — we need waitForReady() callers to see isOnline=true the moment
      // the verdict is in, otherwise they race past with stale isOnline=false and decide
      // they're offline. The `.info/connected` listener can still flip us back later if the
      // SDK socket drops.
      this.zone.run(() => {
        if (this._online$.value !== true) this._online$.next(true);
      });
    } else {
      // Network blocked — force offline regardless of any `.info/connected=true` the SDK
      // emits later until reachability is reconfirmed.
      this.lastOfflineAt = Date.now();
      this.zone.run(() => {
        if (this._online$.value !== false) this._online$.next(false);
      });
    }
    this.resolveReady();
  }

  /**
   * Selfhosted equivalent of {@link bootProbe}. Runs a real `/health` round-trip at cold
   * start so the initial connectivity verdict is honest before any tier load fires.
   * Without this, `waitForReady()` resolves instantly on `navigator.onLine` — which is
   * unreliable on mobile PWAs after OS suspend/resume — and tier1 hangs for 10s against
   * an unreachable backend instead of falling back to cached data immediately.
   */
  private async selfhostedBootProbe(): Promise<void> {
    const apiUrl = environment.selfhosted?.apiUrl;
    const navOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!apiUrl || !navOnline) {
      // No server URL or OS reports offline: trust navigator and resolve.
      if (!navOnline) {
        this.lastOfflineAt = Date.now();
        this.zone.run(() => {
          if (this._online$.value !== false) this._online$.next(false);
        });
      }
      this.resolveReady();
      return;
    }
    let reachable = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        ConnectivityService.HEARTBEAT_TIMEOUT_MS
      );
      try {
        const res = await fetch(`${apiUrl}/health?_=${Date.now()}`, {
          method: 'GET',
          credentials: 'omit',
          cache: 'no-store',
          headers: { 'ngsw-bypass': 'true' },
          signal: controller.signal
        });
        reachable = res.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      reachable = false;
    }
    if (reachable) {
      // Commit online immediately, skipping the runtime stability debounce — boot callers
      // need an honest verdict before tier1 fires.
      this.zone.run(() => {
        if (this._online$.value !== true) this._online$.next(true);
      });
    } else {
      this.lastOfflineAt = Date.now();
      this.zone.run(() => {
        if (this._online$.value !== false) this._online$.next(false);
      });
    }
    this.resolveReady();
  }

  /**
   * Verifies real Firebase connectivity by performing a tiny REST round-trip against the
   * database URL. We do NOT use `.info/serverTimeOffset` or any other Firebase-SDK
   * observable — those are computed locally and resolve instantly even when the network
   * is unreachable, defeating the whole purpose of verification.
   *
   * The REST call deliberately:
   *   - hits the actual Firebase database domain so an ad-blocker that blocks Firebase
   *     (ERR_BLOCKED_BY_CLIENT) also fails this check, correctly keeping us offline.
   *   - uses `shallow=true` and an unauthenticated request so it returns at most a tiny
   *     boolean structure (or 401), never user data.
   *   - is time-boxed so a hung TCP connection can't pin us in a "verifying" limbo.
   *   - treats *any* response (200, 401, 403) as proof the network reaches Firebase.
   *     Authentication is handled by the SDK separately; we only care if packets flow.
   */
  /**
   * Time-boxed REST probe used as a fallback when `.info/connected` never reports.
   */
  private static readonly FIREBASE_VERIFY_TIMEOUT_MS = 4_000;
  /** How long to wait for `.info/connected` before falling back to REST at boot. */
  private static readonly BOOT_FALLBACK_DELAY_MS = 2_000;
  /**
   * After going offline, the SDK sometimes briefly re-emits `.info/connected=true` even
   * though writes still fail. Suppress online flips for this many ms after the most recent
   * offline transition so a single bounce can't trigger a false "Back online — syncing" toast.
   */
  private static readonly ANTI_FLAP_MS = 10_000;
  private lastOfflineAt = 0;

  /**
   * Resolves once we have a definitive verdict on connectivity. In firebase mode this is
   * when `.info/connected` has fired at least once (or after a short fallback timeout).
   * Callers that read or write to the DB on cold start should await this so they don't
   * fire requests while the connectivity state is still optimistically `true` from
   * `navigator.onLine` even though Firebase's socket is actually blocked.
   */
  // Fallback must outlast a verification round-trip (4s) so callers awaiting waitForReady()
  // get the real verdict, not the optimistic initial value, before deciding offline vs online.
  private static readonly READY_FALLBACK_MS = 5_000;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyResolved = false;

  waitForReady(): Promise<void> {
    if (this.readyResolved) return Promise.resolve();
    if (!this.readyPromise) {
      this.readyPromise = new Promise<void>(resolve => {
        this.readyResolve = resolve;
        // Fallback so callers never block forever if Firebase never reports.
        setTimeout(() => this.resolveReady(), ConnectivityService.READY_FALLBACK_MS);
      });
    }
    return this.readyPromise;
  }

  private resolveReady(): void {
    if (this.readyResolved) return;
    this.readyResolved = true;
    this.readyResolve?.();
    this.readyResolve = null;
  }

  /** Returns the latest known online state synchronously. */
  get isOnline(): boolean {
    return this._online$.value;
  }

  /**
   * Force an immediate connectivity probe. Useful right before draining the outbox so we
   * don't optimistically push when the network is still flaky.
   */
  async probe(): Promise<boolean> {
    if (this.inFlight) return this._online$.value;

    // Firebase mode: do a real REST round-trip against the database host. We can't rely
    // solely on `.info/connected` because the SDK socket can stay half-open on mobile PWAs
    // (OS suspend/resume, captive portal, flaky cellular) reporting connected=true while
    // every read/write hangs. The periodic REST probe is our authoritative liveness signal.
    if (environment.mode === 'firebase') {
      const navOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (!navOnline) {
        this.set(false);
        return false;
      }
      const dbURL = (environment as any)?.firebase?.databaseURL;
      if (!dbURL) return this._online$.value;
      this.inFlight = true;
      try {
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          ConnectivityService.FIREBASE_VERIFY_TIMEOUT_MS
        );
        try {
          const res = await fetch(`${dbURL}/.json?shallow=true&_=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store',
            headers: { 'ngsw-bypass': 'true' },
            signal: controller.signal
          });
          const reachable = res.status > 0;
          if (reachable) {
            this.bootProbeConfirmedReachable = true;
            this.set(true);
          } else {
            this.set(false);
          }
          return reachable;
        } finally {
          clearTimeout(timer);
        }
      } catch {
        this.set(false);
        return false;
      } finally {
        this.inFlight = false;
      }
    }

    // Non-firebase, non-selfhosted modes: mirror navigator.onLine downward only.
    if (environment.mode !== 'selfhosted') {
      const navOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (!navOnline) {
        this.set(false);
      }
      return this._online$.value;
    }

    const apiUrl = environment.selfhosted?.apiUrl;
    if (!apiUrl) {
      this.set(true);
      return true;
    }

    this.inFlight = true;
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        ConnectivityService.HEARTBEAT_TIMEOUT_MS
      );
      try {
        // Cache-busting query param + ngsw-bypass header so the service worker can't lie to us
        // by serving a stale cached 200 OK from a previous probe while we're actually offline.
        const res = await fetch(`${apiUrl}/health?_=${Date.now()}`, {
          method: 'GET',
          credentials: 'omit',
          cache: 'no-store',
          headers: { 'ngsw-bypass': 'true' },
          signal: controller.signal
        });
        const ok = res.ok;
        this.set(ok);
        return ok;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      this.set(false);
      return false;
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * Belt-and-braces stability window for online transitions. The primary guard against
   * spurious online flips is `verifyFirebaseOnline` (real round-trip), so this can be short.
   * Going offline is reflected immediately so the user gets fast feedback that writes are
   * being queued locally.
   */
  private static readonly ONLINE_STABILITY_MS = 500;
  private pendingOnlineTimer: ReturnType<typeof setTimeout> | null = null;

  private set(online: boolean): void {
    // Hard guard: never flip to "online" while the OS says we're offline.
    if (online && typeof navigator !== 'undefined' && navigator.onLine === false) {
      online = false;
    }
    // In firebase mode, require Firebase's own socket state to agree before declaring us
    // online. Otherwise the blocked-websocket case shows online but every write hangs.
    if (online && environment.mode === 'firebase' && this.firebaseConnected === false) {
      online = false;
    }
    // In firebase mode, also require the boot REST probe to have confirmed reachability.
    // The SDK can report connected=true based on cached state even when the network is
    // actually blocked — the REST probe is our only honest signal at cold start.
    if (online && environment.mode === 'firebase' && !this.bootProbeConfirmedReachable) {
      online = false;
    }
    // Anti-flap: just after going offline, the SDK can briefly re-emit connected=true
    // even though writes still fail. Reject upward flips for ANTI_FLAP_MS after the most
    // recent offline transition.
    if (online && this.lastOfflineAt > 0
        && Date.now() - this.lastOfflineAt < ConnectivityService.ANTI_FLAP_MS) {
      online = false;
    }

    // Going OFFLINE is immediate — the user needs to know writes are being queued.
    // Going ONLINE is debounced so a flapping connection doesn't trigger sync prematurely.
    if (!online) {
      if (this.pendingOnlineTimer != null) {
        clearTimeout(this.pendingOnlineTimer);
        this.pendingOnlineTimer = null;
      }
      if (this._online$.value !== false) {
        this.lastOfflineAt = Date.now();
        this.zone.run(() => this._online$.next(false));
      }
      return;
    }

    // online === true — only commit after stability window. If anything flips us back to
    // offline before the timer fires, the cancellation above kicks in.
    if (this._online$.value === true) return; // already online, nothing to do
    if (this.pendingOnlineTimer != null) return; // already pending
    this.pendingOnlineTimer = setTimeout(() => {
      this.pendingOnlineTimer = null;
      // Re-check guards at fire time.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (environment.mode === 'firebase' && this.firebaseConnected === false) return;
      if (environment.mode === 'firebase' && !this.bootProbeConfirmedReachable) return;
      if (this.lastOfflineAt > 0
          && Date.now() - this.lastOfflineAt < ConnectivityService.ANTI_FLAP_MS) return;
      if (this._online$.value === true) return;
      this.zone.run(() => this._online$.next(true));
    }, ConnectivityService.ONLINE_STABILITY_MS);
  }

  private startHeartbeat(): void {
    if (this.heartbeatHandle != null) return;
    // Run the timer outside the zone so it doesn't keep change-detection awake.
    this.zone.runOutsideAngular(() => {
      this.heartbeatHandle = setInterval(
        () => this.probe(),
        ConnectivityService.HEARTBEAT_INTERVAL_MS
      );
    });
    // Firebase mode: while we're offline, periodically re-run the boot probe so we can
    // recover when the user re-enables their network. We don't probe while online —
    // `.info/connected` already detects socket loss and flips us offline immediately.
    if (environment.mode === 'firebase') {
      this.zone.runOutsideAngular(() => {
        setInterval(() => {
          if (!this._online$.value) this.bootProbe();
        }, ConnectivityService.HEARTBEAT_INTERVAL_MS);
      });
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatHandle != null) {
      clearInterval(this.heartbeatHandle);
      this.heartbeatHandle = null;    }
  }
}
