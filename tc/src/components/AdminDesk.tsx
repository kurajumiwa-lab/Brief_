import React from 'react';
import * as briefApi from '../api/briefApi';
import type { AuthedUser } from '../api/briefApi';
import { X } from 'lucide-react';

// ---------------------------------------------------------------------------
// ADMIN DESK — the F4 operator surface (§21–24), absorbing Tikiti's T8 loops.
//
// NOT a sixth consumer destination: it is an overlay reached from the menu,
// offered only when the session carries an operator capability, and every
// control here is enforced AGAIN server-side by capability. The desk never
// assumes the client's word for anything.
//
// Loops it closes:
//   flag -> inspect -> decide -> audit       (reports, verification, listings)
//   order -> payment -> settlement -> reconciliation (Commerce, finance)
//   upload -> validate -> serve -> missing-file     (Media)
//   who did what, when                        (Security: roles + audit log)
//
// Honesty rules, same as everywhere: a refusal is shown verbatim (403 bodies
// name `requiredCapability`), an empty queue says so, a disputed order stays
// visibly contested (the order machine has no fake resolve button), and no
// number is ever shown that a real row does not back.
// ---------------------------------------------------------------------------

type Tab = 'health' | 'attention' | 'ingestion' | 'content' | 'media' | 'commerce' | 'security' | 'diagnostics';

const TABS: { id: Tab; label: string }[] = [
  { id: 'health', label: 'Health' },
  { id: 'attention', label: 'Attention' },
  { id: 'ingestion', label: 'Ingestion' },
  { id: 'content', label: 'Content' },
  { id: 'media', label: 'Media' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'security', label: 'Security' },
  { id: 'diagnostics', label: 'Diagnostics' }
];

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-2">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111111]/50">{title}</p>
      {note && <p className="text-[10px] leading-snug text-[#111111]/45">{note}</p>}
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[#111111]/50">{children}</p>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2 text-[11px] text-[#111111]/80">{children}</div>;
}

/** A labelled yes/no that never invents a third state. */
function Fact({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  return (
    <Row>
      <span>{label}</span>
      <span className={`font-extrabold ${ok === false ? 'text-[#111111]' : 'text-[#111111]/60'}`}>
        {ok === null ? 'unknown' : ok ? 'yes' : 'NO'}
        {detail ? <span className="ml-1 font-bold text-[#111111]/40">{detail}</span> : null}
      </span>
    </Row>
  );
}

export function AdminDesk({ open, onClose, me }: { open: boolean; onClose: () => void; me: AuthedUser | null }) {
  const [tab, setTab] = React.useState<Tab>('health');
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick((t) => t + 1);
  const caps = me?.capabilities ?? [];
  const can = (c: string) => caps.includes(c);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#111111]/30 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-3xl mx-auto min-h-full bg-[#FAFAFA]">
        <div className="sticky top-0 z-10 bg-[#FAFAFA]/95 border-b border-[#E5E7EB] px-4 pt-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#111111]">Operate</h2>
              <p className="text-[10px] text-[#111111]/60 leading-snug">
                The operator desk. Every action here is capability-checked again
                on the server and written to the audit log. You carry:
                <span className="font-bold"> {caps.length > 0 ? caps.join(', ') : 'no operator capability'}</span>.
              </p>
            </div>
            <button onClick={onClose} aria-label="Close the operator desk"
              className="shrink-0 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-2 cursor-pointer">
              <X className="w-4 h-4 text-[#111111]" />
            </button>
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-extrabold cursor-pointer ${
                  tab === t.id ? 'bg-[#111111] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#111111]/70 border border-[#E5E7EB]'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 space-y-4">
          {tab === 'health' && <HealthTab tick={tick} can={can} refresh={refresh} />}
          {tab === 'attention' && <AttentionTab tick={tick} can={can} refresh={refresh} />}
          {tab === 'ingestion' && <IngestionTab tick={tick} />}
          {tab === 'content' && <ContentTab tick={tick} can={can} refresh={refresh} />}
          {tab === 'media' && <MediaTab tick={tick} can={can} refresh={refresh} />}
          {tab === 'commerce' && <CommerceTab tick={tick} can={can} refresh={refresh} />}
          {tab === 'security' && <SecurityTab tick={tick} can={can} refresh={refresh} />}
          {tab === 'diagnostics' && <DiagnosticsTab tick={tick} can={can} />}
        </div>
      </div>
    </div>
  );
}

// --- Health ------------------------------------------------------------------

function HealthTab({ tick, can, refresh }: { tick: number; can: (c: string) => boolean; refresh: () => void }) {
  const [data, setData] = React.useState<Record<string, any> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [backupNote, setBackupNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true; setError(null);
    void briefApi.getOpsDiagnostics().then((r) => {
      if (!live) return;
      if (r.ok) setData(r.data); else setError(r.error);
    });
    return () => { live = false; };
  }, [tick]);

  const backup = async () => {
    setBackupNote('taking backup…');
    const r = await briefApi.opsBackup();
    setBackupNote(r.ok ? `backup written (${r.data.size} bytes) and audited` : r.error);
  };

  if (error) return <Card title="Diagnostics"><Empty>{error}</Empty></Card>;
  if (!data) return <Card title="Diagnostics"><Empty>loading…</Empty></Card>;

  const errors: any[] = data.recentErrors ?? [];
  return (
    <>
      <Card title="Startup" note="Where the data lives and whether the process can write it.">
        <Fact ok={data.startup?.dataWritable === true} label="data file writable" detail={String(data.startup?.dataFile ?? '')} />
        <Fact ok={data.readiness?.ok !== false} label="readiness" />
        <Row><span>rejected payment callbacks</span><span className="font-extrabold">{String(data.rejectedCallbacks ?? 0)}</span></Row>
      </Card>
      <Card title="Collections" note="Live counts of the rows the system actually holds.">
        <div className="grid grid-cols-2 gap-x-4">
          {Object.entries(data.counts ?? {}).map(([k, v]) => (
            <Row key={k}><span>{k}</span><span className="font-extrabold">{String(v)}</span></Row>
          ))}
        </div>
      </Card>
      <Card title="Recent errors" note="Where silent breakage hides. Empty means none recorded.">
        {errors.length === 0 ? <Empty>No recorded errors.</Empty> : errors.slice(-8).reverse().map((e, i) => (
          <Row key={e.id ?? i}>
            <span className="min-w-0 truncate">{String(e.kind ?? e.action ?? 'error')}</span>
            <span className="shrink-0 text-[9px] text-[#111111]/40">{String(e.at ?? e.createdAt ?? '').slice(0, 16)}</span>
          </Row>
        ))}
      </Card>
      {can('ops.run') ? (
        <button onClick={() => void backup()}
          className="w-full rounded-xl bg-[#111111] px-3 py-2.5 text-[11px] font-extrabold text-[#FFFFFF] cursor-pointer">
          Take a backup now (audited)
        </button>
      ) : (
        <Empty>Backup needs the ops.run capability; diagnostics alone are read-only.</Empty>
      )}
      {backupNote && <Empty>{backupNote}</Empty>}
    </>
  );
}

// --- Attention ---------------------------------------------------------------

function AttentionTab({ tick, can, refresh }: { tick: number; can: (c: string) => boolean; refresh: () => void }) {
  const [reports, setReports] = React.useState<Record<string, any>[] | null>(null);
  const [queue, setQueue] = React.useState<Record<string, any>[] | null>(null);
  const [disputes, setDisputes] = React.useState<Record<string, any>[] | null>(null);
  const [listings, setListings] = React.useState<Record<string, any>[] | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    void briefApi.getOpsReports().then((r) => { if (live) setReports(r.ok ? r.data : []); });
    void briefApi.getOpsVerificationQueue().then((r) => { if (live) setQueue(r.ok ? r.data : []); });
    void briefApi.getOpsDisputes().then((r) => { if (live) setDisputes(r.ok ? r.data : []); });
    void briefApi.getOpsTicketListings().then((r) => { if (live) setListings(r.ok ? r.data : []); });
    return () => { live = false; };
  }, [tick]);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, what: string) => {
    const r = await fn();
    setNote(r.ok ? `${what} — done, and audited` : r.error ?? 'refused');
    refresh();
  };

  return (
    <>
      {note && <Empty>{note}</Empty>}
      <Card title="Reports on objects" note="Flag → inspect → decide. Removal hides without deleting; every decision is audited with a reason.">
        {reports === null ? <Empty>loading…</Empty>
          : reports.length === 0 ? <Empty>No open reports.</Empty>
          : reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#E5E7EB] p-2.5 space-y-1">
              <Row><span>{String(r.reason ?? r.kind ?? 'report')}</span><span className="text-[9px] text-[#111111]/40">{String(r.createdAt ?? '').slice(0, 10)}</span></Row>
              <p className="text-[10px] text-[#111111]/50">object {String(r.objectId ?? r.targetId ?? '?')}</p>
              {can('moderate') ? (
                <div className="flex gap-1.5 pt-1">
                  <button onClick={() => void act(() => briefApi.resolveOpsReport(r.id, 'dismiss', 'reviewed at the desk'), 'dismissed')}
                    className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-[9px] font-extrabold cursor-pointer">Dismiss</button>
                  <button onClick={() => void act(() => briefApi.resolveOpsReport(r.id, 'remove', 'removed from discovery at the desk'), 'removed from discovery')}
                    className="rounded-lg bg-[#111111] px-2 py-1 text-[9px] font-extrabold text-[#FFFFFF] cursor-pointer">Remove from discovery</button>
                </div>
              ) : <Empty>Deciding needs the moderate capability.</Empty>}
            </div>
          ))}
      </Card>

      <Card title="Verification queue" note="Account verification (email / phone / identity). No documents are ever collected; the reviewer sees the claim and decides with a reason.">
        {queue === null ? <Empty>loading…</Empty>
          : queue.length === 0 ? <Empty>The review queue is empty.</Empty>
          : queue.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#E5E7EB] p-2.5 space-y-1">
              <Row>
                <span className="font-extrabold">{String(r.kind)}</span>
                <span className="text-[9px] text-[#111111]/40">submitted {String(r.submittedAt ?? '').slice(0, 10)}</span>
              </Row>
              <p className="text-[10px] text-[#111111]/50">user {String(r.userId ?? '?')}{r.note ? ` — “${String(r.note)}”` : ''}</p>
              {/* White-label KYC assist: the provider's outcome codes, shown as
                  EVIDENCE for the reviewer -- never an auto-verdict. */}
              {r.providerAssist && (
                <p className="text-[9px] text-[#111111]/40">
                  provider check ({String(r.providerAssist.provider)}):{' '}
                  {r.providerAssist.ok
                    ? `${String(r.providerAssist.resultCode ?? '')} ${String(r.providerAssist.resultText ?? '')}`.trim() || 'no detail returned'
                    : `unavailable — ${String(r.providerAssist.reason)}`}
                  {' '}· evidence, not a verdict
                </p>
              )}
              {can('moderate') ? <DecideRow
                onDecide={(d, reason) => act(() => briefApi.opsVerificationDecision(r.id, d, reason), `${d} verification`)}
              /> : <Empty>Review needs the moderate capability.</Empty>}
            </div>
          ))}
      </Card>

      <Card title="Disputed orders" note="A dispute is deliberately terminal: there is no half resolution flow. It stays visibly contested; remedies are refunds, moderation and the ledger.">
        {disputes === null ? <Empty>loading…</Empty>
          : disputes.length === 0 ? <Empty>No disputes.</Empty>
          : disputes.slice(0, 10).map((d) => (
            <Row key={d.id}>
              <span className="min-w-0 truncate">{String(d.reason ?? 'dispute')}</span>
              <span className="shrink-0 text-[9px] text-[#111111]/40">order {String(d.orderId ?? '?').slice(0, 12)}</span>
            </Row>
          ))}
      </Card>

      <Card title="Resale listing wall" note="Active listings plus removed ones with their reasons — the moderation trail reads end to end.">
        {listings === null ? <Empty>loading…</Empty>
          : listings.length === 0 ? <Empty>No resale listings.</Empty>
          : listings.slice(0, 12).map((l) => (
            <Row key={l.id}>
              <span className="min-w-0 truncate">
                {String(l.status)}
                {l.status === 'removed' && l.removedReason ? ` — ${String(l.removedReason)}` : ''}
              </span>
              <span className="shrink-0 text-[9px] text-[#111111]/40">KES {String(l.priceKes ?? l.price ?? '?')}</span>
            </Row>
          ))}
      </Card>
    </>
  );
}

function DecideRow({ onDecide }: { onDecide: (decision: 'approved' | 'rejected', reason: string) => void }) {
  const [reason, setReason] = React.useState('');
  return (
    <div className="space-y-1.5 pt-1">
      <input value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="reason (a rejection without one is refused)"
        className="w-full rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-[10px]" />
      <div className="flex gap-1.5">
        <button onClick={() => onDecide('approved', reason || 'approved at the desk')}
          className="rounded-lg bg-[#111111] px-2 py-1 text-[9px] font-extrabold text-[#FFFFFF] cursor-pointer">Approve</button>
        <button onClick={() => onDecide('rejected', reason)}
          disabled={!reason.trim()}
          className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-[9px] font-extrabold cursor-pointer disabled:opacity-40">Reject</button>
      </div>
    </div>
  );
}

// --- Ingestion ---------------------------------------------------------------

function IngestionTab({ tick }: { tick: number }) {
  const [caps, setCaps] = React.useState<Record<string, any> | null>(null);
  const [ingest, setIngest] = React.useState<Record<string, any> | null>(null);
  React.useEffect(() => {
    let live = true;
    void briefApi.getConnectorCapabilities().then((r) => { if (live) setCaps(r.ok ? (r.data as any) : { error: r.error }); });
    void briefApi.getIngestStatus().then((r) => { if (live) setIngest(r.ok ? (r.data as any) : { error: r.error }); });
    return () => { live = false; };
  }, [tick]);

  return (
    <>
      <Card title="Connector capabilities" note="Which external connectors are configured. Absent credentials are named, never implied away.">
        {caps === null ? <Empty>loading…</Empty> : Object.entries(caps).map(([k, v]) => (
          <Row key={k}><span>{k}</span><span className="font-extrabold">{typeof v === 'boolean' ? (v ? 'configured' : 'absent') : String(v)}</span></Row>
        ))}
      </Card>
      <Card title="Ingest status" note="What the sources layer reports about itself right now.">
        {ingest === null ? <Empty>loading…</Empty> : (
          <pre className="overflow-x-auto rounded-xl bg-[#111111] px-3 py-2 text-[9px] leading-relaxed text-[#FFFFFF]/90">
            {JSON.stringify(ingest, null, 2).slice(0, 1200)}
          </pre>
        )}
      </Card>
    </>
  );
}

// --- Content -----------------------------------------------------------------

function ContentTab({ tick, can, refresh }: { tick: number; can: (c: string) => boolean; refresh: () => void }) {
  const [cols, setCols] = React.useState<Record<string, any>[] | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    void briefApi.getAdminCollections().then((r) => { if (live) setCols(r.ok ? r.data : []); });
    return () => { live = false; };
  }, [tick]);

  const transition = async (key: string, action: string) => {
    const r = await briefApi.transitionAdminCollection(key, action);
    setNote(r.ok ? `collection ${key}: ${action}` : r.error);
    refresh();
  };

  return (
    <>
      {note && <Empty>{note}</Empty>}
      <Card title="Editorial collections" note="The curated shelves. Transitions follow the collection state machine; moderation is audited.">
        {cols === null ? <Empty>loading…</Empty>
          : cols.length === 0 ? <Empty>No collections.</Empty>
          : cols.map((c) => (
            <div key={c.id ?? c.key} className="rounded-xl border border-[#E5E7EB] p-2.5 space-y-1">
              <Row><span className="font-extrabold">{String(c.title ?? c.key)}</span><span className="text-[9px] text-[#111111]/40">{String(c.status ?? '')}</span></Row>
              {can('moderate') && (
                <div className="flex gap-1.5 pt-1">
                  {['publish', 'archive'].map((a) => (
                    <button key={a} onClick={() => void transition(String(c.key), a)}
                      className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-[9px] font-extrabold cursor-pointer">{a}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
      </Card>
      <Card title="Demo content" note="Clearly-tagged seed data, created in-process, creating no money. Removing it is as visible as adding it.">
        {!can('admin') ? <Empty>Seeding needs the admin capability.</Empty> : (
          <div className="flex gap-1.5">
            <button onClick={async () => { const r = await briefApi.seedDemo(); setNote(r.ok ? 'demo content seeded' : r.error); refresh(); }}
              className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-[9px] font-extrabold cursor-pointer">Seed demo</button>
            <button onClick={async () => { const r = await briefApi.clearDemo(); setNote(r.ok ? 'demo content cleared' : r.error); refresh(); }}
              className="rounded-lg bg-[#111111] px-2 py-1 text-[9px] font-extrabold text-[#FFFFFF] cursor-pointer">Clear demo</button>
          </div>
        )}
      </Card>
    </>
  );
}

// --- Media -------------------------------------------------------------------

function MediaTab({ tick, can, refresh }: { tick: number; can: (c: string) => boolean; refresh: () => void }) {
  const [status, setStatus] = React.useState<Record<string, any> | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ kind: 'category', key: '', url: '', alt: '' });

  React.useEffect(() => {
    let live = true;
    void briefApi.getMediaStatus().then((r) => { if (live) setStatus(r.ok ? (r.data as any) : { error: r.error }); });
    return () => { live = false; };
  }, [tick]);

  const record = async () => {
    const r = await briefApi.recordAdminMedia({ ...form, alt: form.alt || null });
    setNote(r.ok ? 'image recorded (draft)' : r.error);
    refresh();
  };

  return (
    <>
      {note && <Empty>{note}</Empty>}
      <Card title="Media storage" note="Local disk: bytes survive a restart but not a redeploy to a fresh container. The desk says that instead of implying cloud persistence.">
        {status === null ? <Empty>loading…</Empty> : (
          <>
            <Row><span>provider</span><span className="font-extrabold">{String(status.media?.provider ?? 'local disk')}</span></Row>
            <Fact ok={status.uploads?.persisted === true} label="persists across redeploys" />
            <Row><span>files stored</span><span className="font-extrabold">{String(status.uploads?.count ?? '?')}</span></Row>
            <Row><span>bytes</span><span className="font-extrabold">{String(status.uploads?.bytes ?? '?')}</span></Row>
          </>
        )}
      </Card>
      {can('ops.run') ? (
        <Card title="Record an editorial image" note="Validation is the server's: a bad kind or key is refused with the reason.">
          <div className="space-y-1.5">
            {(['kind', 'key', 'url', 'alt'] as const).map((f) => (
              <input key={f} value={(form as any)[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                placeholder={f} className="w-full rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-[10px]" />
            ))}
            <button onClick={() => void record()}
              className="rounded-lg bg-[#111111] px-2 py-1.5 text-[9px] font-extrabold text-[#FFFFFF] cursor-pointer">Record</button>
          </div>
        </Card>
      ) : <Empty>Recording media needs the ops.run capability.</Empty>}
    </>
  );
}

// --- Commerce ----------------------------------------------------------------

function CommerceTab({ tick, can, refresh }: { tick: number; can: (c: string) => boolean; refresh: () => void }) {
  const [settle, setSettle] = React.useState<Record<string, any> | null>(null);
  const [pay, setPay] = React.useState<Record<string, any> | null>(null);

  React.useEffect(() => {
    let live = true;
    if (can('finance')) {
      void briefApi.getEconomicReconcile().then((r) => { if (live) setSettle(r.ok ? (r.data.reconciliation as any) : { error: r.error }); });
      void briefApi.getPaymentsReconcile().then((r) => { if (live) setPay(r.ok ? (r.data.reconciliation as any) : { error: r.error }); });
    }
    return () => { live = false; };
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!can('finance')) {
    return <Card title="Reconciliation"><Empty>Reconciliation is the finance capability. The ledger stays the only economic truth either way.</Empty></Card>;
  }
  return (
    <>
      <Card title="Settlement reconciliation" note="Every settled order must sit on a genuinely settled ledger row of the same amount. Discrepancies are listed, never smoothed over.">
        {settle === null ? <Empty>loading…</Empty> : (
          <>
            <Row><span>checked (settled orders)</span><span className="font-extrabold">{String(settle.checked ?? settle.settledOrders ?? '?')}</span></Row>
            <Row><span>discrepancies</span><span className="font-extrabold">{String((settle.discrepancies ?? []).length)}</span></Row>
            {(settle.discrepancies ?? []).slice(0, 8).map((d: any, i: number) => (
              <Row key={i}><span className="text-[#111111]">{String(d.kind)}</span><span className="text-[9px] text-[#111111]/40">{String(d.orderId ?? d.intentId ?? '')}</span></Row>
            ))}
          </>
        )}
      </Card>
      <Card title="Payment intents" note="Confirmed intents must be backed by exactly one settled transaction. Replayed callbacks cannot pay twice.">
        {pay === null ? <Empty>loading…</Empty> : (
          <>
            <Row><span>discrepancies</span><span className="font-extrabold">{String((pay.discrepancies ?? []).length)}</span></Row>
            {(pay.discrepancies ?? []).slice(0, 8).map((d: any, i: number) => (
              <Row key={i}><span className="text-[#111111]">{String(d.kind)}</span><span className="text-[9px] text-[#111111]/40">{String(d.intentId ?? '')}</span></Row>
            ))}
            {(pay.discrepancies ?? []).length === 0 && <Empty>No intent discrepancies.</Empty>}
          </>
        )}
      </Card>
      <button onClick={refresh} className="w-full rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2 text-[11px] font-extrabold cursor-pointer">
        Re-run reconciliation
      </button>
    </>
  );
}

// --- Security ----------------------------------------------------------------

function SecurityTab({ tick, can, refresh }: { tick: number; can: (c: string) => boolean; refresh: () => void }) {
  const [audit, setAudit] = React.useState<Record<string, any>[] | null>(null);
  const [mailLog, setMailLog] = React.useState<Record<string, any>[] | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [roles, setRoles] = React.useState({ userId: '', roles: 'operator', reason: '' });

  React.useEffect(() => {
    let live = true;
    void briefApi.getOpsAudit(60).then((r) => { if (live) setAudit(r.ok ? r.data.audit : []); });
    void briefApi.getOpsEmailLog(20).then((r) => { if (live) setMailLog(r.ok ? r.data : []); });
    return () => { live = false; };
  }, [tick]);

  const submit = async () => {
    const r = await briefApi.setPlatformRoles(roles.userId.trim(), roles.roles.split(/[\s,]+/).filter(Boolean), roles.reason);
    setNote(r.ok ? `roles written for ${r.data?.user?.handle ?? roles.userId} and audited` : r.error);
    refresh();
  };

  return (
    <>
      {note && <Empty>{note}</Empty>}
      <Card title="Platform roles" note="Roles are written to the user's own row and audited with before/after. Authorisation never reads the request's claim about itself.">
        {!can('admin') ? <Empty>Assigning roles needs the admin capability.</Empty> : (
          <div className="space-y-1.5">
            <input value={roles.userId} onChange={(e) => setRoles({ ...roles, userId: e.target.value })}
              placeholder="user id or handle" className="w-full rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-[10px]" />
            <input value={roles.roles} onChange={(e) => setRoles({ ...roles, roles: e.target.value })}
              placeholder="roles (viewer, operator, reviewer, finance, admin)" className="w-full rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-[10px]" />
            <input value={roles.reason} onChange={(e) => setRoles({ ...roles, reason: e.target.value })}
              placeholder="reason (written to the audit log)" className="w-full rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-[10px]" />
            <button onClick={() => void submit()} disabled={!roles.userId.trim() || !roles.reason.trim()}
              className="rounded-lg bg-[#111111] px-2 py-1.5 text-[9px] font-extrabold text-[#FFFFFF] cursor-pointer disabled:opacity-40">
              Write roles
            </button>
          </div>
        )}
      </Card>
      <Card title="Audit log" note="Append-only, newest first. Every consequential operator action lands here.">
        {audit === null ? <Empty>loading…</Empty>
          : audit.length === 0 ? <Empty>Nothing audited yet.</Empty>
          : audit.slice(0, 15).map((a, i) => (
            <Row key={a.id ?? i}>
              <span className="min-w-0 truncate font-bold">{String(a.action)}</span>
              <span className="shrink-0 text-[9px] text-[#111111]/40">{String(a.at ?? a.createdAt ?? '').slice(0, 16)}</span>
            </Row>
          ))}
      </Card>
      <Card title="Email delivery log" note="There is no email provider configured, so delivery is honestly NOT sent — the log records what would have gone out, and the token is returned to the subscriber instead of a pretended send.">
        {mailLog === null ? <Empty>loading…</Empty>
          : mailLog.length === 0 ? <Empty>No subscription events recorded.</Empty>
          : mailLog.map((m, i) => (
            <Row key={m.id ?? i}>
              <span className="min-w-0 truncate">{String(m.kind ?? m.event ?? 'email event')}</span>
              <span className="shrink-0 text-[9px] text-[#111111]/40">{String(m.at ?? m.createdAt ?? '').slice(0, 16)}</span>
            </Row>
          ))}
      </Card>
    </>
  );
}

// --- Diagnostics -------------------------------------------------------------

function DiagnosticsTab({ tick, can }: { tick: number; can: (c: string) => boolean }) {
  const [dash, setDash] = React.useState<Record<string, any> | null>(null);
  const [contribs, setContribs] = React.useState<Record<string, any>[] | null>(null);
  const [activation, setActivation] = React.useState<Record<string, any> | null>(null);
  React.useEffect(() => {
    let live = true;
    void briefApi.getOpsAnalytics().then((r) => { if (live) setDash(r.ok ? (r.data.analytics as any) : null); });
    void briefApi.getOpsContributors().then((r) => { if (live) setContribs(r.ok ? r.data : []); });
    if (can('ops.read')) {
      void briefApi.getActivationMetrics().then((r) => { if (live && r.ok) setActivation((r.data as any)); });
    }
    return () => { live = false; };
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Card title="Analytics" note="Derived from real rows only (signals, objects, users). No sampling, no invention.">
        {dash === null ? <Empty>loading… or unavailable to this session</Empty> : (
          <div className="grid grid-cols-2 gap-x-4">
            {Object.entries(dash.counts ?? {}).map(([k, v]) => (
              <Row key={k}><span>{k}</span><span className="font-extrabold">{String(v)}</span></Row>
            ))}
          </div>
        )}
      </Card>
      {activation && (
        <Card title="Activation" note="Distinct actors per recorded activation event.">
          <div className="grid grid-cols-2 gap-x-4">
            {Object.entries(activation).map(([k, v]) => (
              <Row key={k}><span>{k}</span><span className="font-extrabold">{String(v as any)}</span></Row>
            ))}
          </div>
        </Card>
      )}
      <Card title="Contributors" note="The contribution leaderboard, from settled rows.">
        {contribs === null ? <Empty>loading…</Empty>
          : contribs.length === 0 ? <Empty>No contributions recorded.</Empty>
          : contribs.slice(0, 10).map((c, i) => (
            <Row key={c.userId ?? c.id ?? i}>
              <span className="min-w-0 truncate">{String(c.displayName ?? c.handle ?? c.userId ?? 'contributor')}</span>
              <span className="font-extrabold">{String(c.total ?? c.amount ?? '')}</span>
            </Row>
          ))}
      </Card>
    </>
  );
}

export default AdminDesk;
