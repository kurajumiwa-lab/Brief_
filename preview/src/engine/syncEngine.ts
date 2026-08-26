// ---------------------------------------------------------------------------
// SYNC ENGINE — the client half of Zero-Latency State Management.
//
// The app never shows a loading spinner for engine-synced data:
//
//   HEARTBEAT   a tier-paced background loop asks the server to run the
//               pipeline (Ping -> Hash -> Delta -> Render).
//   PREDICTION  visibilitychange + window focus trigger an immediate beat —
//               the engine syncs the moment the user is "about to open the
//               app", so the data is already fresh when they look.
//   DELTAS      the client carries a compact manifest; only changed rows ever
//               cross the wire, and subscribers receive them as transitions
//               they can merge silently (no remount, no spinner).
//   BACKOFF     a 429 from the tier guardrail is obeyed exactly (retryAfterMs);
//               failures back off quietly and never surface as errors.
//
// HONESTY: stage telemetry comes from the server's real timings; the render
// stage's duration is measured HERE, on the real apply. Nothing is animated
// for show — the pipeline visualizer renders exactly what ran.
// ---------------------------------------------------------------------------

export interface EngineStage {
  id: 'ping' | 'hash' | 'delta' | 'render' | string;
  label: string;
  status: 'done' | 'client' | 'active' | 'blocked' | 'failed' | string;
  ms: number | null;
  detail: string;
}

export interface EngineDelta<T = any> {
  added: T[];
  updated: T[];
  removed: string[];
}

export interface EngineRun {
  at: number;
  inSync: boolean;
  deltaRows: number;
  stages: EngineStage[];
  version: string | null;
  deltas: Record<string, EngineDelta> | null;
  renderMs: number | null;
}

export interface SyncEngineOptions {
  /** Called with merged transitions per collection. Apply silently. */
  onDelta?: (deltas: Record<string, EngineDelta>, run: EngineRun) => void;
  /** Telemetry after every completed beat (for the pipeline visualizer). */
  onRun?: (run: EngineRun) => void;
  /** The heartbeat interval while visible; the server may override downward. */
  intervalMs?: number;
  /** Injection seam for tests. */
  fetchImpl?: typeof fetch;
  enabled?: boolean;
}

interface SyncResponse {
  inSync: boolean;
  version: string;
  stages: EngineStage[];
  deltas: Record<string, EngineDelta>;
  deltaRows: number;
  manifest: {
    version: string;
    collections: Record<string, { count: number; digest: string; rows: Record<string, string> }>;
  };
  guardrail?: { caps: { syncIntervalMs: number } };
  error?: string;
  code?: string;
  retryAfterMs?: number;
}

const EMPTY_INTERVAL = 30_000;

export class SyncEngine {
  private manifest: { version: string; collections: Record<string, { rows: Record<string, string> }> } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private stopped = true;
  private lastRun: EngineRun | null = null;
  private opts: Required<Pick<SyncEngineOptions, 'intervalMs'>> & SyncEngineOptions;

  constructor(opts: SyncEngineOptions = {}) {
    this.opts = { intervalMs: opts.intervalMs ?? EMPTY_INTERVAL, ...opts };
  }

  /** Start the heartbeat + the prediction listeners. */
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    document.addEventListener('visibilitychange', this.onWake);
    window.addEventListener('focus', this.onWake);
    this.schedule(1500); // first beat soon after start
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onWake);
    window.removeEventListener('focus', this.onWake);
  }

  /** The latest telemetry — exactly what the visualizer renders. */
  get last(): EngineRun | null {
    return this.lastRun;
  }

  /** Force a beat now (used by a manual "Sync" affordance). */
  async syncNow(): Promise<EngineRun | null> {
    return this.beat();
  }

  private onWake = () => {
    // Prediction: the user just focused the app — sync before they scroll.
    if (!this.stopped && document.visibilityState === 'visible') {
      void this.beat();
    }
  };

  private schedule(delayMs: number) {
    if (this.stopped) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.beat(), Math.max(1000, delayMs));
  }

  private async beat(): Promise<EngineRun | null> {
    if (this.running || this.stopped) return null;
    this.running = true;
    try {
      const doFetch = this.opts.fetchImpl ?? fetch.bind(globalThis);
      const res = await doFetch('/ingest/api/engine/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manifest: this.manifest })
      });
      const body: SyncResponse = await res.json().catch(() => ({}) as SyncResponse);

      if (res.status === 429) {
        // The tier guardrail spoke: obey it exactly.
        const retry = Number(body.retryAfterMs ?? this.opts.intervalMs);
        this.recordRun({
          at: Date.now(),
          inSync: this.lastRun?.inSync ?? false,
          deltaRows: 0,
          stages: this.lastRun?.stages ?? [],
          version: this.lastRun?.version ?? null,
          deltas: null,
          renderMs: null
        }, { blocked: true });
        this.schedule(retry + 250);
        return this.lastRun;
      }
      if (!res.ok) {
        // Quiet backoff — the engine never surfaces as an error state.
        this.schedule(this.opts.intervalMs * 2);
        return null;
      }

      // Apply the delta and measure the render honestly.
      const t0 = performance.now();
      if (!body.inSync && body.deltas && this.opts.onDelta) {
        this.opts.onDelta(body.deltas, {
          at: Date.now(),
          inSync: false,
          deltaRows: body.deltaRows,
          stages: body.stages,
          version: body.version,
          deltas: body.deltas,
          renderMs: null
        });
      }
      const renderMs = Math.round((performance.now() - t0) * 100) / 100;

      // Stages come back with the render stage unmeasured (status 'client');
      // fill in OUR measurement — the server never invents it.
      const stages = (body.stages ?? []).map((s) =>
        s.status === 'client'
          ? { ...s, status: 'done', ms: renderMs, detail: body.inSync ? s.detail : s.detail }
          : s
      );
      this.manifest = body.manifest
        ? {
            version: body.manifest.version,
            collections: Object.fromEntries(
              Object.entries(body.manifest.collections).map(([k, v]) => [k, { rows: v.rows }])
            )
          }
        : this.manifest;

      const run: EngineRun = {
        at: Date.now(),
        inSync: body.inSync,
        deltaRows: body.deltaRows ?? 0,
        stages,
        version: body.version,
        deltas: body.inSync ? null : body.deltas,
        renderMs
      };
      this.recordRun(run, {});
      // Respect the server's tier interval when it is stricter.
      const serverInterval = body.guardrail?.caps?.syncIntervalMs;
      this.schedule(serverInterval ? Math.max(serverInterval, 1000) : this.opts.intervalMs);
      return run;
    } catch {
      this.schedule(this.opts.intervalMs * 2);
      return null;
    } finally {
      this.running = false;
    }
  }

  private recordRun(run: EngineRun, extra: { blocked?: boolean }) {
    const finalRun: EngineRun = extra.blocked
      ? { ...run, stages: markBlocked(run.stages) }
      : run;
    this.lastRun = finalRun;
    this.opts.onRun?.(finalRun);
  }
}

function markBlocked(stages: EngineStage[]): EngineStage[] {
  // When the guardrail blocks a beat, the stages that did not run say so.
  let blockedSeen = false;
  return stages.map((s) => {
    if (blockedSeen || s.status === 'client') {
      blockedSeen = true;
      return { ...s, status: 'blocked', ms: null, detail: 'held by the tier guardrail' };
    }
    return s;
  });
}
