import React from 'react';
import { LeadPackSheet } from './LeadPackSheet';
import { Heart, Search } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { CoopIntent, CoopPost, CoopMatch, CoopCooperation, WhoCanHelpAnswer } from '../api/briefApi';

// ---------------------------------------------------------------------------
// MSHIKANO — "What one person has can help another."
//
// The cooperation desk: post what you HAVE / NEED / CAN HELP / LOOKING FOR,
// see complementary matches (each with its reasons), mark that you worked
// together (both sides must confirm), and ask "who can help?".
//
// Honesty rules carried over from the server: trust is EVIDENCE (confirmed
// cooperations, repeat partners, recommendations) — never stars; empty
// results are stated in words, never padded.
// ---------------------------------------------------------------------------

/** The grouped answer to "who can help?" — real rows only, empty stated. */
const INTENTS: { id: CoopIntent; label: string; chip: string; dot: string }[] = [
  { id: 'have', label: 'Have', chip: 'bg-[#16A34A]', dot: 'bg-[#16A34A]' },
  { id: 'need', label: 'Need', chip: 'bg-[#2563EB]', dot: 'bg-[#2563EB]' },
  { id: 'can_help', label: 'Can help', chip: 'bg-[#2563EB]', dot: 'bg-[#2563EB]' },
  { id: 'looking_for', label: 'Looking for', chip: 'bg-[#B45309]', dot: 'bg-[#B45309]' }
];

const LEVEL_WORDS: Record<string, string> = {
  new: 'New — no confirmed cooperation yet',
  cooperating: 'Cooperating — has worked with someone, both sides confirmed',
  proven: 'Proven — repeatedly confirmed in cooperation',
  established: 'Established — people come back to cooperate again'
};

function TrustChip({ trust }: { trust: CoopPost['trust'] }) {
  if (!trust) return null;
  const e = trust.evidence;
  const bits = [`${e.confirmedCooperations} confirmed`];
  if (e.repeatPartners > 0) bits.push(`${e.repeatPartners} repeat`);
  if (e.recommendations > 0) bits.push(`${e.recommendations} recs`);
  return (
    <span
      aria-label={LEVEL_WORDS[trust.level] ?? trust.levelWords}
      className="inline-flex items-center gap-1 rounded-full border border-[#E5E8EC] bg-[#FFFFFF] px-2 py-0.5 text-[9px] font-bold text-[#0D1117]/70"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${trust.level === 'new' ? 'bg-[#7A8494]' : 'bg-[#FF5A1F]'}`}
      />
      {trust.level === 'new' ? 'new member' : bits.join(' · ')}
    </span>
  );
}

export function MshikanoDesk() {
  const [posts, setPosts] = React.useState<CoopPost[] | null>(null);
  const [filter, setFilter] = React.useState<CoopIntent | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  // composer
  const [intent, setIntent] = React.useState<CoopIntent>('have');
  const [title, setTitle] = React.useState('');
  const [town, setTown] = React.useState('');
  const [county, setCounty] = React.useState('');

  // matches drawer
  const [introFor, setIntroFor] = React.useState<CoopPost | null>(null);
  const [matchesFor, setMatchesFor] = React.useState<{ post: CoopPost; rows: CoopMatch[] } | null>(null);

  // cooperations
  const [coops, setCoops] = React.useState<{ pending: CoopCooperation[]; confirmed: CoopCooperation[]; disputed: CoopCooperation[] } | null>(null);
  const [disputeFor, setDisputeFor] = React.useState<string | null>(null);
  const [disputeReason, setDisputeReason] = React.useState('');

  // who can help
  const [question, setQuestion] = React.useState('');
  const [answer, setAnswer] = React.useState<WhoCanHelpAnswer | null>(null);

  const load = React.useCallback(async () => {
    const [p, c] = await Promise.all([briefApi.listCoopPosts({ intent: filter ?? undefined }), briefApi.listCooperations()]);
    if (p.ok) setPosts(p.data.posts);
    if (c.ok) setCoops({ pending: c.data.pending, confirmed: c.data.confirmed, disputed: c.data.disputed });
  }, [filter]);

  React.useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (title.trim().length < 4 || busy) return;
    setBusy(true); setNote(null);
    const res = await briefApi.createCoopPost({ intent, title: title.trim(), town: town.trim() || null, county: county.trim() || null });
    setBusy(false);
    if (!res.ok) { setNote(res.error); return; }
    setTitle(''); setTown(''); setCounty('');
    setNote('Posted. Check its matches below.');
    await load();
  };

  const openMatches = async (post: CoopPost) => {
    if (matchesFor?.post.id === post.id) { setMatchesFor(null); return; }
    const res = await briefApi.coopMatches(post.id);
    if (!res.ok) { setNote(res.error); return; }
    setMatchesFor({ post, rows: res.data.matches });
  };

  const markWorked = async (post: CoopPost) => {
    setBusy(true); setNote(null);
    const res = await briefApi.proposeCooperation({
      postId: post.id,
      partnerUserId: post.author.id,
      summary: `About: ${post.title}`
    });
    setBusy(false);
    setNote(res.ok
      ? `Proposed to ${post.author.displayName}. It counts once THEY confirm it.`
      : res.error);
    await load();
  };

  const respond = async (id: string, accept: boolean) => {
    setBusy(true);
    const res = await briefApi.respondCooperation(id, accept);
    setBusy(false);
    setNote(res.ok ? (accept ? 'Confirmed — it now counts on both graphs.' : 'Declined.') : res.error);
    await load();
  };

  const dispute = async (id: string) => {
    if (busy || disputeReason.trim().length < 4) return;
    setBusy(true); setNote(null);
    const res = await briefApi.disputeCooperation(id, disputeReason.trim());
    setBusy(false);
    if (!res.ok) { setNote(res.error); return; }
    setDisputeFor(null); setDisputeReason('');
    setNote('Disputed. The confirmation no longer counts for either of you.');
    await load();
  };

  const ask = async () => {
    if (question.trim().length < 3) return;
    setBusy(true); setAnswer(null);
    const res = await briefApi.whoCanHelp(question.trim());
    setBusy(false);
    if (!res.ok) { setNote(res.error); return; }
    setAnswer(res.data);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-[#FF5A1F]" aria-hidden="true" />
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#0D1117]">Mshikano</h1>
        </div>
        <p className="text-[11px] leading-snug text-[#0D1117]/60">
          What one person has can help another. Post it, find your complement, work together —
          and both of you confirm it so trust is earned, never bought.
        </p>
      </header>

      {/* Composer */}
      <section aria-label="Post to the cooperation network" className="rounded-2xl border border-[#E5E8EC] bg-[#FFFFFF] p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose an intent">
          {INTENTS.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setIntent(it.id)}
              aria-pressed={intent === it.id}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold transition-colors ${
                intent === it.id ? `${it.chip} text-[#0D1117]` : 'border border-[#E5E8EC] text-[#0D1117]/70 bg-[#FFFFFF]'
              }`}
            >
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${intent === it.id ? 'bg-[#FFFFFF]' : it.dot}`} />
              {it.label}
            </button>
          ))}
        </div>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={2}
          placeholder="e.g. 1 tonne of mangoes in Makueni · reliable electrician in Kisumu · solar training for three people"
          className="w-full rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-3 py-2 text-[12px] text-[#0D1117] outline-none focus:border-[#2563EB]"
        />
        <div className="flex gap-2">
          <input value={town} onChange={(e) => setTown(e.target.value)} placeholder="Town" aria-label="Town"
            className="w-28 rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-2.5 py-1.5 text-[11px] text-[#0D1117]" />
          <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="County" aria-label="County"
            className="w-32 rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-2.5 py-1.5 text-[11px] text-[#0D1117]" />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || title.trim().length < 4}
            className="ml-auto rounded-lg bg-[#FF5A1F] px-4 py-2 text-[11px] font-extrabold text-[#0D1117] disabled:opacity-40"
          >
            Post it
          </button>
        </div>
        {note && <p role="status" className="text-[11px] font-bold text-[#0D1117]/70">{note}</p>}
      </section>

      {/* Who can help? */}
      <section aria-label="Who can help" className="rounded-2xl border border-[#E5E8EC] bg-[#FFFFFF] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-[#FF5A1F]" aria-hidden="true" />
          <h2 className="text-[13px] font-extrabold text-[#0D1117]">Who can help?</h2>
        </div>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void ask(); }}
            placeholder="I need someone who can help me start a poultry business in Bungoma"
            aria-label="Ask who can help"
            className="flex-1 rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-3 py-2 text-[12px] text-[#0D1117]"
          />
          <button type="button" onClick={() => void ask()} disabled={busy || question.trim().length < 3}
            className="rounded-lg bg-[#FF5A1F] px-3 py-2 text-[11px] font-extrabold text-[#0D1117] disabled:opacity-40">
            Ask
          </button>
        </div>
        {answer && (
          <div className="space-y-2">
            <p className="text-[11px] font-extrabold text-[#0D1117]">
              {answer.counts.people} {answer.counts.people === 1 ? 'person' : 'people'} · {answer.counts.businesses} {answer.counts.businesses === 1 ? 'business' : 'businesses'} · {answer.counts.groups} {answer.counts.groups === 1 ? 'group' : 'groups'} · {answer.counts.guides} {answer.counts.guides === 1 ? 'guide' : 'guides'}
              {answer.counts.people + answer.counts.businesses + answer.counts.groups + answer.counts.guides === 0 && ' — nobody has posted this yet. Post what you need; the network fills in around it.'}
            </p>
            {answer.groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-[#E5E8EC] px-3 py-2">
                <p className="text-[11px] font-bold text-[#0D1117]">{g.name}</p>
                <p className="text-[9px] text-[#0D1117]/55">{g.members} {g.members === 1 ? 'member' : 'members'}{g.description ? ` · ${g.description.slice(0, 70)}` : ''}</p>
              </div>
            ))}
            {[...answer.people, ...answer.businesses].slice(0, 6).map((p) => (
              <div key={p.id} className="rounded-xl border border-[#E5E8EC] px-3 py-2">
                <p className="text-[11px] font-bold text-[#0D1117]">{p.title}</p>
                <p className="text-[9px] text-[#0D1117]/55">{p.author.displayName}{p.county ? ` · ${p.county}` : ''} · {p.intentLabel}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending confirmations */}
      {coops && coops.pending.filter((c) => c.direction === 'incoming').length > 0 && (
        <section aria-label="Confirm a cooperation" className="rounded-2xl border border-[#2563EB] bg-[#FFFFFF] p-4 space-y-2">
          <h2 className="text-[13px] font-extrabold text-[#0D1117]">Someone says you worked together</h2>
          {coops.pending.filter((c) => c.direction === 'incoming').map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E8EC] px-3 py-2">
              <p className="text-[11px] text-[#0D1117]">
                <span className="font-bold">{c.partner?.displayName}</span>{c.summary ? ` — ${c.summary}` : ''}
              </p>
              <span className="flex gap-1.5 shrink-0">
                <button type="button" onClick={() => void respond(c.id, true)} disabled={busy}
                  className="rounded-lg bg-[#FF5A1F] px-3 py-1.5 text-[10px] font-extrabold text-[#0D1117]">Confirm</button>
                <button type="button" onClick={() => void respond(c.id, false)} disabled={busy}
                  className="rounded-lg border border-[#E5E8EC] px-3 py-1.5 text-[10px] font-extrabold text-[#0D1117]/70">Decline</button>
              </span>
            </div>
          ))}
        </section>
      )}

      {/* The stream */}
      <section aria-label="Cooperation posts" className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setFilter(null)} aria-pressed={filter === null}
            className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${filter === null ? 'bg-[#FF5A1F] text-[#0D1117]' : 'border border-[#E5E8EC] text-[#0D1117]/70'}`}>
            All
          </button>
          {INTENTS.map((it) => (
            <button key={it.id} type="button" onClick={() => setFilter(it.id)} aria-pressed={filter === it.id}
              className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${filter === it.id ? `${it.chip} text-[#0D1117]` : 'border border-[#E5E8EC] text-[#0D1117]/70'}`}>
              {it.label}
            </button>
          ))}
        </div>

        {posts === null && <p className="text-[11px] text-[#0D1117]/70">Loading the network…</p>}
        {posts !== null && posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#E5E8EC] bg-[#FFFFFF] px-4 py-3">
            <p className="text-[11px] font-extrabold text-[#0D1117]">Nothing here yet</p>
            <p className="mt-1 text-[10px] leading-snug text-[#0D1117]/55">
              No {filter ? INTENTS.find((i) => i.id === filter)?.label.toLowerCase() : ''} posts yet. The network starts
              with the first honest post — yours.
            </p>
          </div>
        )}

        {posts?.map((p) => (
          <article key={p.id} className="rounded-2xl border border-[#E5E8EC] bg-[#FFFFFF] p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${INTENTS.find((i) => i.id === p.intent)?.dot}`} />
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#0D1117]/70">{p.intentLabel}</span>
                </div>
                <h3 className="mt-0.5 text-[13px] font-bold leading-snug text-[#0D1117]">{p.title}</h3>
                <p className="text-[9px] text-[#0D1117]/55">
                  {p.author.displayName}{p.town ? ` · ${p.town}` : ''}{p.county ? `, ${p.county}` : ''}
                </p>
              </div>
              <TrustChip trust={p.trust} />
            </div>
            <div className="flex gap-1.5">
              {!p.mine && (
                <button type="button" onClick={() => void markWorked(p)} disabled={busy}
                  className="rounded-lg bg-[#FF5A1F] px-3 py-1.5 text-[10px] font-extrabold text-[#0D1117] disabled:opacity-40">
                  We worked together
                </button>
              )}
              <button type="button" onClick={() => void openMatches(p)}
                aria-expanded={matchesFor?.post.id === p.id}
                className="rounded-lg border border-[#2563EB] px-3 py-1.5 text-[10px] font-extrabold text-[#FF5A1F]">
                {matchesFor?.post.id === p.id ? 'Hide matches' : 'See matches'}
              </button>
            </div>
            {matchesFor?.post.id === p.id && (
              <div className="space-y-1.5 border-t border-[#E5E8EC] pt-2">
                {matchesFor.rows.length === 0 && (
                  <p className="text-[10px] text-[#0D1117]/55">No complement posted yet — a {p.intent === 'have' ? 'NEED' : p.intent === 'need' ? 'HAVE' : p.intent === 'can_help' ? 'LOOKING FOR' : 'CAN HELP'} for this will match here.</p>
                )}
                {matchesFor.rows.map((m) => (
                  <div key={m.post.id} className="rounded-xl bg-[#F0F2F5] px-3 py-2">
                    <p className="text-[11px] font-bold text-[#0D1117]">{m.post.title}</p>
                    <p className="text-[9px] text-[#0D1117]/55">{m.post.author.displayName}{m.post.county ? ` · ${m.post.county}` : ''}</p>
                    {m.reasons.length > 0 && (
                      <p className="mt-0.5 text-[9px] text-[#FF5A1F] font-bold">Why: {m.reasons.join(' · ')}</p>
                    )}
                    {!m.post.mine && (
                      <button
                        type="button"
                        onClick={() => setIntroFor(m.post)}
                        className="mt-1.5 cursor-pointer rounded-full border border-[#FF5A1F] px-2.5 py-0.5 text-[9px] font-extrabold text-[#FF5A1F] hover:bg-[#F0F2F5]"
                      >
                        Get introduced — priority
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>

      {coops && coops.confirmed.length > 0 && (
        <section aria-label="Confirmed cooperations" className="rounded-2xl border border-[#E5E8EC] bg-[#FFFFFF] p-4 space-y-1.5">
          <h2 className="text-[13px] font-extrabold text-[#0D1117]">Your cooperation graph</h2>
          {coops.confirmed.slice(0, 6).map((c) => (
            <div key={c.id} className="space-y-1">
              <p className="text-[10px] text-[#0D1117]/70">
                🤝 {c.direction === 'outgoing' ? 'You proposed' : 'Confirmed with'} <span className="font-bold">{c.partner?.displayName}</span>
                {c.confirmedAt ? ` · ${new Date(c.confirmedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}` : ''}
              </p>
              {disputeFor === c.id ? (
                <div className="flex gap-1">
                  <input value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Say what went wrong — both sides will see it"
                    aria-label="Dispute reason"
                    className="flex-1 rounded-lg border border-[#E5E8EC] bg-[#F0F2F5] px-2 py-1 text-[10px] text-[#0D1117]" />
                  <button type="button" onClick={() => void dispute(c.id)} disabled={busy || disputeReason.trim().length < 4}
                    className="rounded-lg bg-[#DC2626] px-2 py-1 text-[9px] font-extrabold text-[#0D1117] disabled:opacity-40">Send</button>
                  <button type="button" onClick={() => { setDisputeFor(null); setDisputeReason(''); }}
                    className="rounded-lg border border-[#E5E8EC] px-2 py-1 text-[9px] font-bold text-[#0D1117]">Keep it</button>
                </div>
              ) : (
                <button type="button" onClick={() => { setDisputeFor(c.id); setDisputeReason(''); }}
                  className="text-[9px] font-bold text-[#DC2626]/80 underline">Did not go as written?</button>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Disputed — the credit is withdrawn, the record stays */}
      {coops && coops.disputed.length > 0 && (
        <section aria-label="Disputed cooperations" className="rounded-2xl border border-[#DC2626]/40 bg-[#FFFFFF] p-4 space-y-1.5">
          <h2 className="text-[13px] font-extrabold text-[#DC2626]">Disputed — no longer counts for anyone</h2>
          {coops.disputed.slice(0, 6).map((c) => (
            <p key={c.id} className="text-[10px] text-[#0D1117]/70">
              ⚠️ With <span className="font-bold">{c.partner?.displayName}</span> — “{c.dispute?.note ?? ''}”. The confirmation is withdrawn until this is resolved.
            </p>
          ))}
        </section>
      )}
      {introFor && (
        <LeadPackSheet
          postId={introFor.id}
          postTitle={introFor.title}
          onClose={() => setIntroFor(null)}
          onPaid={() => setIntroFor(null)}
        />
      )}
    </div>
  );
}
