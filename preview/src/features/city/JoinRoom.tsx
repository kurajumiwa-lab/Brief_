// ---------------------------------------------------------------------------
// JOIN ROOM — the page behind a link pasted in WhatsApp.
//
// This is the whole acquisition loop in one screen: a coordinator lists their
// room, pastes the link into the group chat, and a stranger lands HERE without
// an account. So the page has one job — make the room legible enough to decide
// with, and give two doors — and one constraint: it must not read the room's
// contents to do it. The server's `peek` hands over the shape (what it is about,
// how many people, what is live right now, how much money has actually settled
// through the group), and nothing else. Block text, member names and the ledger
// stay behind the door, because "anyone with the link can browse our private
// group" is not something a chama agreed to when they tapped "list it".
//
// The second door matters more than it looks. Most of these groups live on
// WhatsApp today; a page that only offers "make an account" loses them. So the
// organiser's own link is shown as what it is — theirs, unverified by Brief, and
// clearly labelled — because a room that lies about where a click goes has spent
// the only asset it has.
// ---------------------------------------------------------------------------

import React from 'react';
import { ArrowRight, MessageCircle, ShieldAlert } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { JoinPreview } from '../../api/briefApi';

export interface JoinRoomProps {
  code: string;
  signedIn: boolean;
  /** Opens the app's own sign-in flow. No fake "continue" here. */
  onRequireAuth: () => void;
  onOpenCircles: () => void;
  className?: string;
}

const money = (n: number, currency: string) => `${currency} ${Number(n).toLocaleString('en-KE')}`;

export function JoinRoom({ code, signedIn, onRequireAuth, onOpenCircles, className = '' }: JoinRoomProps) {
  const [state, setState] = React.useState<'loading' | 'ready' | 'gone' | 'error'>('loading');
  const [room, setRoom] = React.useState<JoinPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [joining, setJoining] = React.useState(false);
  const [joined, setJoined] = React.useState(false);
  // Retry is a re-read, not a page reload: reloading throws away whatever the
  // visitor had been reading on this page for a blip at the door.
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    setState('loading');
    void briefApi.getJoinPreview(code).then((res) => {
      if (!live) return;
      if (res.ok) { setRoom(res.data); setState('ready'); return; }
      // 404 is a real answer with two causes the visitor cannot tell apart, and
      // the page must not pretend to know which: a bad link, or a room that is
      // not listed. Saying "this link does not open a room" is the honest union.
      setState(res.status === 404 ? 'gone' : 'error');
      setError(res.error ?? null);
    });
    return () => { live = false; };
  }, [code, attempt]);

  const join = async () => {
    if (!room) return;
    setJoining(true);
    const res = await briefApi.joinCircle(room.id);
    setJoining(false);
    if (!res.ok) { setError(res.error ?? 'the room did not let you in'); return; }
    setJoined(true);
  };

  return (
    <div className={`max-w-md mx-auto space-y-4 ${className}`}>
      <button
        type="button"
        onClick={onOpenCircles}
        className="text-[12px] font-bold cursor-pointer"
        style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0 }}
      >
        ← Groups
      </button>

      {state === 'loading' && <div className="brief-skeleton h-40 rounded-3xl" style={{ background: 'var(--color-paper)' }} aria-busy="true" />}

      {state === 'gone' && (
        <div className="rounded-3xl p-6 text-center space-y-1" style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-2), inset 0 0 0 1px var(--brief-line)' }}>
          <p className="text-[15px] font-extrabold" style={{ color: 'var(--brief-ink)' }}>This link does not open a room</p>
          <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
            Ask whoever sent it for a fresh link, or look for the room in Groups.
          </p>
          <button
            type="button"
            onClick={onOpenCircles}
            className="mt-2 px-4 py-2 rounded-full text-[13px] font-black cursor-pointer"
            style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)', boxShadow: 'var(--lift-signal)' }}
          >
            Browse rooms
          </button>
        </div>
      )}

      {state === 'error' && (
        <p role="alert" className="text-[13px] font-bold" style={{ color: 'var(--color-danger)' }}>
          {error ?? 'The room could not be read.'}{' '}
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="underline cursor-pointer">Try again</button>
        </p>
      )}

      {state === 'ready' && room && (
        <>
          <header className="rounded-3xl overflow-hidden" style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-2)' }}>
            <div className="h-16" style={{ background: 'var(--color-well)' }} />
            <div className="p-4 pt-0 -mt-6">
              <span
                className="inline-block w-12 h-12 rounded-2xl grid place-items-center text-[15px] font-black mb-2"
                style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
                aria-hidden="true"
              >
                {String(room.name ?? '?').trim().slice(0, 1).toUpperCase()}
              </span>
              <h1 className="text-[32px] font-extrabold leading-tight" style={{ color: 'var(--brief-ink)' }}>{room.name}</h1>
              {room.purpose && (
                <p className="text-[13px] leading-snug mt-1" style={{ color: 'var(--color-text-secondary)' }}>{room.purpose}</p>
              )}
              <p className="text-[11px] font-mono mt-2" style={{ color: 'var(--color-text-muted)' }}>
                {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
                {room.openTaskCount ? ` · ${room.openTaskCount} job${room.openTaskCount === 1 ? '' : 's'} waiting` : ''}
                {room.liveVoteCount ? ` · ${room.liveVoteCount} vote${room.liveVoteCount === 1 ? '' : 's'} open` : ''}
              </p>
            </div>
          </header>



          {joined ? (
            <div className="rounded-2xl p-4 text-center space-y-1" style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-2), inset 0 0 0 1px var(--brief-line)' }}>
              <p className="text-[15px] font-extrabold" style={{ color: 'var(--brief-ink)' }}>You are in the room</p>
              <button
                type="button"
                onClick={onOpenCircles}
                className="mt-1 inline-flex items-center gap-1 px-4 py-2 rounded-full text-[13px] font-black cursor-pointer"
                style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)', boxShadow: 'var(--lift-signal)' }}
              >
                Open it <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {room.canJoin ? (
                signedIn ? (
                  <button
                    type="button"
                    onClick={() => void join()}
                    disabled={joining}
                    className="w-full px-4 py-3 rounded-2xl text-[14px] font-black cursor-pointer"
                    style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)', boxShadow: 'var(--lift-signal)' }}
                  >
                    {joining ? 'Letting you in…' : 'Join this room'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRequireAuth}
                    className="w-full px-4 py-3 rounded-2xl text-[14px] font-black cursor-pointer"
                    style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)', boxShadow: 'var(--lift-signal)' }}
                  >
                    Sign in to join
                  </button>
                )
              ) : (
                <p className="text-[13px] leading-snug rounded-2xl p-3" style={{ background: 'var(--color-well)', color: 'var(--color-text-secondary)' }}>
                  This room does not take self-joins — a coordinator adds people. Use the link below to reach them, or ask for an invite.
                </p>
              )}

              {error && !room.canJoin && <p role="alert" className="text-[12px] font-bold" style={{ color: 'var(--color-danger)' }}>{error}</p>}

              {room.externalLink && (
                <a
                  href={room.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[14px] font-black"
                  style={{ background: 'rgba(37,211,102,0.12)', color: '#128C41', boxShadow: 'inset 0 0 0 1px rgba(37,211,102,0.35)' }}
                >
                  <MessageCircle className="w-4 h-4" /> Open the group they use today
                </a>
              )}
              {room.externalLink && room.externalLinkNote && (
                <p className="flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />
                  {room.externalLinkNote}
                </p>
              )}
            </div>
          )}

          <p className="text-[11px] leading-snug px-1" style={{ color: 'var(--color-text-muted)' }}>
            What is said inside a room stays inside it. This page shows how many people are in
            {` ${room.name ?? 'the room'}`} and what is live — not what they have written.
          </p>
        </>
      )}
    </div>
  );
}

export default JoinRoom;
