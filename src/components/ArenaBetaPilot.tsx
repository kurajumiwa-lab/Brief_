import React from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  MessageCircle,
  Share2,
  ShieldCheck,
  Target,
  Trophy,
  Users
} from 'lucide-react';
import type { ArenaBetaSegment, ArenaBetaSummary } from '../api/types';

// ---------------------------------------------------------------------------
// EFOOTBALL BETA PILOT
//
// Arena is early. This surface is intentionally a test control, not a glossy
// promise: it recruits a small cohort, makes the first match obvious, and
// exposes the behaviour we need to learn before automating matchmaking.
//
// Counts are always read from the server summary. Targets are labelled as
// targets; an unavailable summary never falls back to a made-up population.
// ---------------------------------------------------------------------------

export interface ArenaBetaPilotProps {
  summary: ArenaBetaSummary | null;
  signedIn: boolean;
  joined: boolean;
  joinedSegment: ArenaBetaSegment | null;
  hasGameTag: boolean;
  busy: boolean;
  onJoin: (segment: ArenaBetaSegment) => void;
  onOpenProfile: () => void;
  onOpenChallenges: () => void;
}

const SEGMENTS: {
  id: ArenaBetaSegment;
  label: string;
  title: string;
  detail: string;
  message: string;
}[] = [
  {
    id: 'casual',
    label: 'Casual',
    title: 'Quick games, low friction',
    detail: 'Find someone for a friendly 1v1 and play without a league commitment.',
    message: 'Find a friendly eFootball opponent tonight.'
  },
  {
    id: 'competitive',
    label: 'Competitive',
    title: 'Rankings, tournaments, proof',
    detail: 'Play ranked matches, climb from confirmed results, and shape the first cup.',
    message: 'Prove your eFootball level and climb the Arena rankings.'
  }
];

const RECRUITING_CHANNELS = [
  { label: 'WhatsApp + Telegram groups', target: 40, detail: 'Ask admins to share one direct pilot invite.' },
  { label: 'Facebook eFootball groups', target: 25, detail: 'Post the competition, not a generic website link.' },
  { label: 'Creators on TikTok / Instagram', target: 15, detail: 'Give each creator a trackable invite message.' },
  { label: 'Gaming cafés + universities', target: 10, detail: 'Recruit players who already play together.' },
  { label: 'Player referrals', target: 10, detail: 'Ask every first player to bring one opponent.' }
];

function progress(value: number | null, target: number): number {
  if (value === null || !Number.isFinite(value) || target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function Metric({
  label,
  value,
  target
}: {
  label: string;
  value: number | null;
  target: number;
}) {
  const known = typeof value === 'number';
  const pct = progress(value, target);
  return (
    <div className="rounded-xl border border-[#222630] bg-[#12151A] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold text-[#F7F7F8]/60">{label}</span>
        <span className="font-mono text-[12px] font-extrabold text-[#F7F7F8]">
          {known ? value : '—'} <span className="font-sans text-[9px] font-bold text-[#F7F7F8]/40">/ {target}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1D2027]">
        <div className="h-full rounded-full bg-[#FF5A1F] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[9px] text-[#F7F7F8]/40">pilot target</p>
    </div>
  );
}

function segmentCount(summary: ArenaBetaSummary | null, segment: ArenaBetaSegment): number | null {
  if (!summary) return null;
  return summary.segments[segment] ?? 0;
}

export function ArenaBetaPilot({
  summary,
  signedIn,
  joined,
  joinedSegment,
  hasGameTag,
  busy,
  onJoin,
  onOpenProfile,
  onOpenChallenges
}: ArenaBetaPilotProps) {
  const [segment, setSegment] = React.useState<ArenaBetaSegment>(joinedSegment ?? 'casual');
  const [copied, setCopied] = React.useState(false);
  const selected = SEGMENTS.find((item) => item.id === segment) ?? SEGMENTS[0];

  React.useEffect(() => {
    if (joinedSegment) setSegment(joinedSegment);
  }, [joinedSegment]);

  const copyInvite = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const invite = `Join the free eFootball Arena beta. Play competitive matches, get ranked, and help shape the first Beta Cup. ${url}`;
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is an enhancement; the invite remains visible in the UI.
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="arena-beta-title">
      {/* The promise is deliberately about behaviour, not scale. */}
      <div className="overflow-hidden rounded-[26px] border border-[#22E6E0] bg-[#FF5A1F] text-[#0D0F12]">
        <div className="relative px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border border-[#222630]/15" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-1 -top-5 h-24 w-24 rounded-full border border-[#222630]/10" />
          <div className="relative max-w-xl">
            <div className="flex flex-wrap items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#F7F7F8]/65">
              <span className="rounded-full border border-[#222630]/25 px-2 py-1 text-[#F7F7F8]">Controlled beta</span>
              <span>eFootball · Nairobi first · online</span>
            </div>
            <h1 id="arena-beta-title" className="mt-4 max-w-lg text-[27px] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-[34px]">
              Play the match. Tell us if you come back.
            </h1>
            <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-[#F7F7F8]/72">
              We are testing a small Arena with real players before building a big one. Join a free pilot, get paired manually, and help decide whether casual play or competitive rankings deserve the next build.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy || joined || !signedIn}
                onClick={() => onJoin(segment)}
                className="brief-tap inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#12151A] px-4 py-2.5 text-[12px] font-extrabold text-[#F7F7F8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {joined ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                {joined ? 'Pilot spot saved' : busy ? 'Saving your spot…' : signedIn ? 'Join the free beta' : 'Getting your account ready…'}
              </button>
              <button
                type="button"
                onClick={() => void copyInvite()}
                className="brief-tap inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#222630]/30 px-4 py-2.5 text-[12px] font-extrabold text-[#F7F7F8]"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Invite copied' : 'Copy invite'}
              </button>
            </div>
            <p className="mt-3 text-[10px] text-[#F7F7F8]/50">
              Free entry. No cash prize or payment rail is promised yet. The first job is proving that players show up and play.
            </p>
          </div>
        </div>

        <div className="grid gap-3 border-t border-[#222630]/15 bg-[#12151A] p-4 text-[#F7F7F8] sm:grid-cols-3 sm:p-5">
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-[11px] font-extrabold">Tonight, 7–11pm</p>
              <p className="mt-0.5 text-[10px] leading-snug text-[#F7F7F8]/60">A human pairs the first players while we learn.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Trophy className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-[11px] font-extrabold">Beta Cup proposed</p>
              <p className="mt-0.5 text-[10px] leading-snug text-[#F7F7F8]/60">64 players · one week · prize still to be confirmed.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-[11px] font-extrabold">Results need two yeses</p>
              <p className="mt-0.5 text-[10px] leading-snug text-[#F7F7F8]/60">Only mutually confirmed results reach rankings.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live funnel: the left number is real, the right number is a plan. */}
      <div className="rounded-2xl border border-[#222630] bg-[#12151A] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F7F7F8]">Pilot scoreboard</p>
            <h2 className="mt-1 text-[17px] font-extrabold tracking-[-0.02em]">Measure matches, not traffic.</h2>
          </div>
          <span className="text-[10px] text-[#F7F7F8]/45">
            {summary ? 'Live from Arena records' : 'Waiting for live records'}
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="Players signed up" value={summary?.actual.signups ?? null} target={summary?.targets.signups ?? 100} />
          <Metric label="First match" value={summary?.actual.playersWithFirstMatch ?? null} target={summary?.targets.playersWithFirstMatch ?? 30} />
          <Metric label="Matches completed" value={summary?.actual.matchesCompleted ?? null} target={summary?.targets.matchesCompleted ?? 200} />
          <Metric label="2+ matches" value={summary?.actual.playersWithTwoMatches ?? null} target={summary?.targets.playersWithTwoMatches ?? 20} />
        </div>
        {!summary && (
          <p className="mt-3 text-[10px] leading-snug text-[#F7F7F8]/50">
            The test plan is ready, but the live counter is unavailable. We will not fill it with a guessed population.
          </p>
        )}
      </div>

      {/* One choice makes the learning question explicit. */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-[#222630] bg-[#12151A] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F7F7F8]">Choose your reason to play</p>
              <h2 className="mt-1 text-[17px] font-extrabold">Which player are we building for?</h2>
            </div>
            <Target className="h-5 w-5 shrink-0 text-[#F7F7F8]/55" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {SEGMENTS.map((item) => {
              const active = item.id === segment;
              const count = segmentCount(summary, item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSegment(item.id)}
                  className="text-left rounded-xl border p-3 transition-colors"
                  style={{
                    borderColor: active ? '#FF5A1F' : '#222630',
                    background: active ? '#FF5A1F' : '#12151A',
                    color: active ? '#F7F7F8' : '#F7F7F8'
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold">{item.label}</span>
                    <span className="text-[9px] font-mono opacity-60">{count === null ? '—' : `${count} joined`}</span>
                  </div>
                  <p className="mt-2 text-[12px] font-extrabold leading-snug">{item.title}</p>
                  <p className="mt-1 text-[10px] leading-snug opacity-65">{item.detail}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-xl bg-[#1D2027] p-3">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#F7F7F8]/50">Message to test</p>
            <p className="mt-1 text-[12px] font-extrabold text-[#F7F7F8]">“{selected.message}”</p>
          </div>
          {joined && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#22E6E0] px-3 py-2.5">
              <p className="text-[11px] font-bold text-[#F7F7F8]">
                You joined as {joinedSegment ?? segment}.
                {!hasGameTag && ' Add your eFootball tag to play.'}
              </p>
              <button
                type="button"
                onClick={hasGameTag ? onOpenChallenges : onOpenProfile}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#FF5A1F] px-3 py-1.5 text-[10px] font-extrabold text-[#0D0F12]"
              >
                {hasGameTag ? 'Open matches' : 'Set game tag'} <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#222630] bg-[#12151A] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F7F7F8]">Tonight’s runbook</p>
              <h2 className="mt-1 text-[17px] font-extrabold">Concierge first. Automate later.</h2>
            </div>
            <ClipboardList className="h-5 w-5 shrink-0 text-[#F7F7F8]/55" />
          </div>
          <ol className="mt-4 space-y-3">
            {[
              ['01', 'Confirm the player', 'Save their segment and eFootball tag.'],
              ['02', 'Pair manually', 'Use open challenges; do not pretend the queue is full.'],
              ['03', 'Play + submit', 'Players report the score after the match.'],
              ['04', 'Confirm together', 'Only both-player agreement updates the record.']
            ].map(([number, title, body]) => (
              <li key={number} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5A1F] font-mono text-[9px] font-extrabold text-[#0D0F12]">{number}</span>
                <div>
                  <p className="text-[11px] font-extrabold text-[#F7F7F8]">{title}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-[#F7F7F8]/60">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* The acquisition plan is a plan, not an attained total. */}
      <div className="rounded-2xl border border-[#222630] bg-[#12151A] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F7F7F8]">Recruiting plan · first 100</p>
            <h2 className="mt-1 text-[17px] font-extrabold">Recruit where eFootball already happens.</h2>
          </div>
          <span className="rounded-full bg-[#1D2027] px-2.5 py-1 text-[10px] font-extrabold text-[#F7F7F8]">Targets, not results</span>
        </div>
        <div className="mt-4 divide-y divide-[#222630]">
          {RECRUITING_CHANNELS.map((channel) => (
            <div key={channel.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FF5A1F] text-[#0D0F12]">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[11px] font-extrabold text-[#F7F7F8]">{channel.label}</p>
                  <span className="font-mono text-[10px] font-extrabold text-[#F7F7F8]">{channel.target} target</span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-[#F7F7F8]/55">{channel.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#222630] pt-4">
          <Share2 className="h-4 w-4 text-[#F7F7F8]/55" />
          <p className="flex-1 text-[10px] leading-snug text-[#F7F7F8]/60">
            Lead with the competition: “Join the first eFootball Arena beta. Play, get ranked, and compete with other players.”
          </p>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#22E6E0] px-3 py-1.5 text-[10px] font-extrabold text-[#F7F7F8]"
          >
            <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy message'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#222630] bg-[#12151A] p-4 sm:p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F7F7F8]">What the first week should teach us</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-extrabold text-[#F7F7F8]">Return</p>
            <p className="mt-1 text-[10px] leading-snug text-[#F7F7F8]/60">Do players complete 2–3 matches and come back next week?</p>
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-[#F7F7F8]">Competition</p>
            <p className="mt-1 text-[10px] leading-snug text-[#F7F7F8]/60">Do they ask for ranked play, tournaments, leaderboards, or prizes?</p>
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-[#F7F7F8]">Business signal</p>
            <p className="mt-1 text-[10px] leading-snug text-[#F7F7F8]/60">Only after free play: would players pay a small fee, or would a sponsor help?</p>
          </div>
        </div>
      </div>

      <p className="flex items-start gap-2 px-1 text-[10px] leading-snug text-[#F7F7F8]/50">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F7F7F8]" />
        Trust rule: profiles, match history, community rules, and anti-cheating expectations come before prizes or paid competition.
      </p>
    </section>
  );
}

export default ArenaBetaPilot;
