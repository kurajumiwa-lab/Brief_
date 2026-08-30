// ---------------------------------------------------------------------------
// THE OFFLINE QUEUE — writes survive a dead signal.
//
// A duka on a bad connection cannot lose the sale it just logged. When a
// write hits a network failure it is parked in localStorage with a clientKey;
// the server makes the write idempotent on that key, so a replay after
// reconnect can never create a second sale. Reads are never queued (a cached
// read that pretends to be live is a lie); only writes are.
//
// Honesty rules:
//   * the caller is told the write is QUEUED, not done — { queued: true }
//   * the queue replays oldest-first when the browser says it is online
//   * anything the server refuses on replay is dropped with its error kept
//     in `deadLetters` for the surface to show — never silently deleted
// ---------------------------------------------------------------------------

export interface QueuedWrite {
  id: string;
  path: string;
  method: string;
  body: string | null;
  clientKey: string | null;
  /** Carried so the replay is still signed with the session that queued it. */
  headers?: Record<string, string>;
  queuedAt: string;
}

export interface DeadLetter extends QueuedWrite {
  error: string;
  failedAt: string;
}

const QUEUE_KEY = 'brief.offlineQueue.v1';
const DEAD_KEY = 'brief.offlineDead.v1';
const MAX_QUEUE = 200;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the queue degrades to "this write failed
    // normally", which the caller already handles. Never throw from here.
  }
}

export function queueDepth(): number {
  return readJson<QueuedWrite[]>(QUEUE_KEY, []).length;
}

export function deadLetters(): DeadLetter[] {
  return readJson<DeadLetter[]>(DEAD_KEY, []);
}

export function enqueue(write: Omit<QueuedWrite, 'id' | 'queuedAt'>): QueuedWrite {
  const queue = readJson<QueuedWrite[]>(QUEUE_KEY, []);
  // One clientKey, one queued write: a re-tap while offline replaces, not doubles.
  if (write.clientKey) {
    const at = queue.findIndex((w) => w.clientKey === write.clientKey);
    if (at >= 0) queue.splice(at, 1);
  }
  const row: QueuedWrite = {
    ...write,
    id: `qw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString()
  };
  queue.push(row);
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  writeJson(QUEUE_KEY, queue);
  return row;
}

/** How the queue re-sends: the same fetch contract the app uses. */
export type Replayer = (write: QueuedWrite) => Promise<{ ok: boolean; error?: string }>;

/** Oldest-first replay. Returns how many landed. */
export async function replayQueue(replayer: Replayer): Promise<number> {
  const queue = readJson<QueuedWrite[]>(QUEUE_KEY, []);
  if (queue.length === 0) return 0;
  const dead: DeadLetter[] = readJson<DeadLetter[]>(DEAD_KEY, []);
  const still: QueuedWrite[] = [];
  let landed = 0;
  for (const w of queue) {
    try {
      const out = await replayer(w);
      if (out.ok) {
        landed++;
      } else {
        // A server REFUSAL is final for this write: keep it visible, do not retry forever.
        dead.push({ ...w, error: out.error ?? 'refused on replay', failedAt: new Date().toISOString() });
      }
    } catch {
      still.push(w); // still offline — try again next time
    }
  }
  writeJson(QUEUE_KEY, still);
  if (dead.length > 0) writeJson(DEAD_KEY, dead.slice(-50));
  return landed;
}

export function clearDeadLetters(): void {
  writeJson(DEAD_KEY, []);
}
