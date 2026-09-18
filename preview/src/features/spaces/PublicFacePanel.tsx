import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Lock, MessageCircle, Radio } from 'lucide-react';
import type { Space, SpacePublicFace } from '../../api/types';
import { StateDot } from '../../ui/StateDot';

// ---------------------------------------------------------------------------
// PUBLIC FACE PANEL — the owner's one look at the mirror.
//
// Deliberately NOT a page editor. There is nothing here to style, reorder or
// "optimise", because the moment this surface offers customization the owner
// spends an afternoon on fonts and never posts an offer again. What it does
// offer is the link, the truth about what a stranger can see right now, and the
// one switch that decides whether the page exists at all.
//
// The loop this panel is built to close: edit the Space → the page changes →
// paste the link into a WhatsApp status → somebody compliments it → edit again.
// So the panel shows exactly what is on the page, from the same read a stranger
// gets, and never a preview of anything the Space does not contain.
//
// What it refuses to show:
//   * a vanity domain — the link is the path the server actually minted
//     (`/s/<slug>`), prefixed with the origin this app is really served from;
//   * a view counter or a "shared N times" figure — a page opening writes one
//     row and the count lives in the header strip, not here, where it would
//     read as a score;
//   * any rating, badge, or "verified" mark: Brief stores no reviews, so a tick
//     here would be decoration over nothing;
//   * a "your page is live" claim when the space is not public — it states the
//     reason instead.
// ---------------------------------------------------------------------------

export interface PublicFacePanelProps {
  space: Space;
  face: SpacePublicFace | null;
  busy?: boolean;
  /** Flip the space to public. The confirmation lives here, not in a toast. */
  onPublish: () => void;
  /** Jump to the space file, where the page's content is actually edited. */
  onEditSpace?: () => void;
}

export function PublicFacePanel({ space, face, busy = false, onPublish, onEditSpace }: PublicFacePanelProps) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const open = face?.open === true;
  // The link the owner pastes. The path is the server's (a minted slug), the
  // origin is wherever this app is actually being served from — never a
  // hand-written domain the deployment does not own.
  const path = face?.path ?? `/s/${space.slug ?? space.id}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = face?.view?.pageUrl ?? `${origin}${path}`;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        return;
      }
    } catch {
      /* below is the honest fallback */
    }
    setCopied(false);
  };

  const view = face?.view ?? null;
  const needsContact = open && view?.contact == null;

  return (
    <section
      className="rounded-3xl overflow-hidden brief-lift-1"
      style={{ background: 'var(--brief-card)' }}
      aria-label="Public page"
      data-public-face={open ? 'live' : 'closed'}
    >
      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
          <h2 className="text-[14px] font-extrabold" style={{ color: 'var(--brief-ink)' }}>
            Public page
          </h2>
          <span className="ml-auto">
            <StateDot state={open ? 'live' : 'unknown'} label={open ? 'up' : 'down'} />
          </span>
        </div>

        {open ? (
          <>
            <p className="mt-1.5 text-[12px] leading-snug" style={{ color: 'var(--brief-muted)' }}>
              Mirror of this space. Edit the space and this page changes — there is nothing to edit here.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <code
                className="min-w-0 flex-1 truncate px-3 py-2 rounded-xl text-[12px] font-mono"
                style={{ background: 'var(--well, var(--color-well))', color: 'var(--brief-ink)' }}
                title={link}
              >
                {link.replace(/^https?:\/\//, '')}
              </code>
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] font-black cursor-pointer"
                style={{ background: copied ? 'var(--color-primary)' : 'var(--color-primary-subtle)', color: copied ? 'var(--accent-ink)' : 'var(--color-primary)' }}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={path}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </a>
            </div>

            {/* What a buyer can see, from the stranger's own read. A missing
                answer is named as missing — never dressed up as a zero. */}
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="What a buyer sees">
              <Chip
                icon={<Radio className="w-3 h-3" />}
                text={view && view.offerCount > 0 ? `${view.offerCount} offer${view.offerCount === 1 ? '' : 's'}` : 'no offers listed'}
                strong={Boolean(view && view.offerCount > 0)}
              />
              <Chip text={view?.open.label ?? (view?.open.stated ? `hours: ${view.open.stated}` : 'no hours stated')} strong={Boolean(view?.open.label)} />
              <Chip text={view?.where ? view.where : 'no place stated'} strong={Boolean(view?.where)} />
              <Chip text={view?.image ? 'cover photo up' : 'no cover photo'} strong={Boolean(view?.image)} />
              <Chip
                icon={<MessageCircle className="w-3 h-3" />}
                text={view?.contact ? 'WhatsApp button live' : 'no contact number'}
                strong={Boolean(view?.contact)}
              />
              <Chip text={view && view.updates.length > 0 ? `${view.updates.length} update${view.updates.length === 1 ? '' : 's'} posted` : 'no updates posted'} strong={Boolean(view && view.updates.length > 0)} />
            </div>

            {needsContact && (
              <p className="mt-2.5 text-[12px] leading-snug" style={{ color: 'var(--brief-faint)' }}>
                No WhatsApp number yet, so the page has no button. Add one under To do → contact, or leave it blank and buyers
                reach you through the Brief inbox.
              </p>
            )}

            {face && face.reports.count > 0 && (
              <p className="mt-2.5 text-[12px] font-bold leading-snug" style={{ color: 'var(--brief-muted)' }} data-reports={face.reports.count}>
                {face.reports.note}
              </p>
            )}
          </>
        ) : confirming ? (
          <div className="mt-2.5 rounded-2xl px-3 py-3" style={{ background: 'var(--color-well)' }}>
            <p className="text-[13px] leading-snug" style={{ color: 'var(--brief-ink)' }}>
              This puts <strong>{space.name}</strong> on the open internet at <span className="font-mono">{path}</span>: your name,
              cover photo, stated hours, and every live offer with its price. Anyone can read it, including people you do not
              know. Your orders, customers and money stay private.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  onPublish();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-black cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
              >
                <Globe className="w-3.5 h-3.5" /> Publish it
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-bold cursor-pointer"
                style={{ background: 'var(--brief-card)', color: 'var(--brief-ink)' }}
              >
                <Lock className="w-3.5 h-3.5" /> Stay private
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1.5 text-[12px] leading-snug" style={{ color: 'var(--brief-muted)' }}>
              {face?.reason ?? `This space is ${space.visibility ?? 'private'}, so there is no page.`}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-black cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              <Globe className="w-3.5 h-3.5" /> Make a public page
            </button>
            {onEditSpace && (
              <button
                type="button"
                onClick={onEditSpace}
                className="mt-2.5 ml-2 text-[12px] font-bold cursor-pointer"
                style={{ color: 'var(--color-primary)' }}
              >
                Fill the space first
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** A fact about the page, in the chip's own words. `strong` is real emphasis, not a badge. */
function Chip({ text, icon, strong = false }: { text: string; icon?: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{
        background: strong ? 'var(--color-primary-subtle)' : 'var(--color-well)',
        color: strong ? 'var(--color-primary)' : 'var(--brief-muted)'
      }}
    >
      {icon}
      {text}
    </span>
  );
}

export default PublicFacePanel;
