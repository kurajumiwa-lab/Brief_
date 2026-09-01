import React from 'react';
import * as briefApi from '../api/briefApi';
import type { AccountVerificationKind, VerificationRecord } from '../api/briefApi';

// ---------------------------------------------------------------------------
// VERIFICATION PANEL (Tikiti T6) — My Layer → Verify.
//
// Identity is verified by PEOPLE reviewing evidence, not by a self-declared
// checkbox:
//   * a submission creates a pending record for a reviewer (capability-gated
//     server-side; audited),
//   * standing (verified / pending / unverified) is DERIVED from the records,
//     never stored as a second truth,
//   * a reviewer's reason is shown verbatim — a rejection that explains
//     itself can be fixed; one that doesn't cannot,
//   * no documents are ever collected here.
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<AccountVerificationKind, string> = {
  email: 'Email',
  phone: 'Phone',
  identity: 'Identity'
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-[#222630] text-[#F7F7F8]/60',
  approved: 'bg-[#FF5A1F] text-[#F7F7F8]',
  rejected: 'bg-[#12151A] text-[#F7F7F8]',
  revoked: 'bg-[#222630] text-[#F7F7F8]/60'
};

export function VerificationPanel() {
  const [records, setRecords] = React.useState<VerificationRecord[] | null>(null);
  const [standing, setStanding] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<AccountVerificationKind>('email');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [noteMsg, setNoteMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    const res = await briefApi.getMyVerification();
    if (res.ok) {
      setRecords(res.data.records);
      setStanding(res.data.standing);
    } else {
      setRecords([]);
      setError(res.error);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setNoteMsg(null);
    const res = await briefApi.submitVerification({ kind, note: note.trim() || null });
    setBusy(false);
    if (!res.ok) { setNoteMsg(res.error); return; }
    setNote(res.data.changed
      ? `Submitted for review (${KIND_LABEL[kind]}). A person checks it; you will see the outcome here.`
      : `You already have a ${KIND_LABEL[kind].toLowerCase()} review open — it is still pending.`);
    await load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-[#F7F7F8]">Verify</h2>
        <p className="text-[10px] text-[#F7F7F8]/60 leading-snug">
          Verified email, phone and identity unlock the things the compliance
          gates require. Reviews are human, recorded, and reversible — no
          documents are collected here.
        </p>
      </div>

      {/* standing — derived by the server from the records below */}
      <div className="grid grid-cols-3 gap-2">
        {(['email', 'phone', 'identity'] as AccountVerificationKind[]).map((k) => (
          <div key={k} className="rounded-2xl border border-[#222630] bg-[#12151A] p-3">
            <p className="text-[9px] uppercase tracking-[0.14em] text-[#F7F7F8]/60">{KIND_LABEL[k]}</p>
            <p className="mt-1 text-[12px] font-extrabold text-[#F7F7F8] capitalize">
              {standing[k] ?? 'unverified'}
            </p>
          </div>
        ))}
      </div>

      {/* submit */}
      <div className="rounded-2xl border border-[#222630] bg-[#12151A] p-4 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#F7F7F8]">Ask for a review</p>
        <div className="flex flex-wrap gap-1.5">
          {(['email', 'phone', 'identity'] as AccountVerificationKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border ${
                kind === k ? 'bg-[#FF5A1F] text-[#0D0F12] border-[#22E6E0]' : 'bg-[#12151A] text-[#F7F7F8]/70 border-[#222630]'
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          aria-label="what a reviewer should check"
          placeholder="What should the reviewer check? (e.g. the phone number on my M-Pesa registration is …)"
          className="w-full rounded-xl border border-[#222630] bg-[#171A20] px-3 py-2.5 text-[12px] text-[#F7F7F8] resize-none"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !note.trim()}
          className="rounded-lg bg-[#FF5A1F] px-4 py-2 text-[11px] font-extrabold text-[#0D0F12] cursor-pointer disabled:opacity-40"
        >
          {busy ? 'Submitting…' : 'Submit for review'}
        </button>
        {noteMsg && <p className="text-[11px] text-[#F7F7F8]">{noteMsg}</p>}
      </div>

      {error && <p className="text-xs text-[#F7F7F8]">{error}</p>}
      {records === null && <p className="text-xs text-[#F7F7F8]/60">Loading…</p>}

      {/* history */}
      {records !== null && records.length === 0 && !error && (
        <p className="text-xs text-[#F7F7F8]/60">
          No verification history yet. Unverified is the honest default.
        </p>
      )}
      {records !== null && records.length > 0 && (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="rounded-2xl border border-[#222630] bg-[#12151A] p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-[#F7F7F8]">{KIND_LABEL[r.kind] ?? r.kind}</p>
                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] ?? STATUS_STYLE.pending}`}>
                  {r.status}
                </span>
              </div>
              {r.note && <p className="text-[10px] text-[#F7F7F8]/60">{r.note}</p>}
              <p className="text-[9px] text-[#F7F7F8]/60">
                submitted {r.submittedAt.slice(0, 10)}
                {r.reviewedAt ? ` · reviewed ${r.reviewedAt.slice(0, 10)}` : ' · awaiting review'}
              </p>
              {r.reason && (
                <p className="text-[10px] text-[#F7F7F8] break-words">
                  Reviewer: {r.reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VerificationPanel;
