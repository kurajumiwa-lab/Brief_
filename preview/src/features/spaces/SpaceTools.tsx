import React, { useEffect, useState } from 'react';
import { Check, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import type { Listing, Space } from '../../api/types';
import type { SpaceTemplate } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// SPACE TOOLS — the three things that make a shopfront operable, and nothing
// else. Each one writes a row a person could point at later.
//
//   OPENING HOURS   the weekly grid, writing the SAME `availability` field the
//                   space file shows. There is deliberately no second schedule
//                   table: two places to edit one fact is how a screen starts
//                   lying to its own owner.
//   PINNED OFFERS   up to three of your own active offers lead the catalog. This
//                   is a choice, not a boost: no ranking algorithm is involved
//                   and nothing is hidden from anyone else.
//   TEMPLATES       your own sentences, one tap to put on the clipboard so they
//                   can be pasted where you actually reply. Twelve is the cap —
//                   a list of forty is a pile, not a tool.
//
// Deliberately NOT here: a team-and-roles panel. Brief's authority model is a
// role bound to a scope (operator, partner, program lead, cohort anchor, circle
// treasurer, vendor, field agent, auditor) resolved in one place; a "Manager /
// Staff / Viewer" picker for spaces would need every space route to honour that
// scope, and shipping the picker without the enforcement would tell a vendor
// their staff account is read-only when it is not. That is a safety matter, so
// it waits for the phase where the resolver learns the space scope.
// ---------------------------------------------------------------------------

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const CAP = 'A Space is a shopfront: hours, what is on the counter, and what you say back.';

export function SpaceTools({
  space,
  offers,
  templates,
  featured,
  onChanged,
  className = ''
}: {
  space: Space;
  offers: Listing[];
  templates: SpaceTemplate[];
  featured: string[];
  onChanged: () => void;
  className?: string;
}) {
  const stored = (space.profile?.fields?.availability?.value ?? {}) as {
    days?: string[]; from?: string | null; to?: string | null; summary?: string;
  };
  const [days, setDays] = useState<string[]>(stored.days ?? []);
  const [from, setFrom] = useState<string>(stored.from ?? '');
  const [to, setTo] = useState<string>(stored.to ?? '');
  const [summary, setSummary] = useState<string>(stored.summary ?? '');
  const [saveState, setSaveState] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // The server returns the whole list after a write, so the panel shows THAT
  // rather than a locally-invented one — and still updates when the parent
  // refetches, because the prop is the seed.
  const [tpl, setTpl] = useState<SpaceTemplate[]>(templates ?? []);
  const [label, setLabel] = useState('');
  const [body, setBody] = useState('');
  const [draftFeatured, setDraftFeatured] = useState<string[]>(featured ?? []);
  const [pinState, setPinState] = useState<'idle' | 'busy'>('idle');

  useEffect(() => { setDraftFeatured(featured ?? []); }, [featured]);
  useEffect(() => { setTpl(templates ?? []); }, [templates]);
  useEffect(() => {
    setDays(stored.days ?? []);
    setFrom(stored.from ?? '');
    setTo(stored.to ?? '');
    setSummary(stored.summary ?? '');
    // Re-seed from the server row whenever the space reloads, so this panel can
    // never show a stale schedule the owner has already changed elsewhere.
  }, [space.id, space.updatedAt]);

  const saveHours = async () => {
    setSaveState('busy');
    setMessage(null);
    const res = await briefApi.updateSpaceProfile(space.id, {
      availability: { days, from: from || null, to: to || null, summary }
    });
    if (!res.ok) {
      setSaveState('error');
      setMessage(res.error ?? 'The schedule was not saved.');
      return;
    }
    setSaveState('saved');
    setMessage(
      res.data.changed.length
        ? 'Hours saved. Buyers see them on your public page and in the directory.'
        : 'Nothing changed — recorded as a confirmation that these hours still stand.'
    );
    onChanged();
  };

  const addTemplate = async () => {
    if (!label.trim() || !body.trim()) { setMessage('A template needs a short label and the message itself.'); return; }
    const res = await briefApi.saveSpaceTemplate(space.id, { label: label.trim(), body: body.trim() });
    if (!res.ok) { setMessage(res.error ?? 'The template was not saved.'); return; }
    if (Array.isArray(res.data.templates)) setTpl(res.data.templates);
    setLabel(''); setBody(''); setMessage('Template saved.');
    soundEngine.play('tap');
    onChanged();
  };

  const removeTemplate = async (id: string) => {
    const res = await briefApi.deleteSpaceTemplate(space.id, id);
    if (res.ok && Array.isArray(res.data.templates)) setTpl(res.data.templates);
    setMessage(res.ok ? 'Template removed.' : res.error ?? 'Could not remove it.');
    onChanged();
  };

  const copyTemplate = async (t: SpaceTemplate) => {
    try {
      await navigator.clipboard.writeText(t.body);
      setMessage(`Copied “${t.label}” — paste it where you reply.`);
    } catch {
      setMessage('Your browser would not accept the copy. The text is on the card: select it.');
    }
  };

  const togglePin = async (id: string) => {
    const next = draftFeatured.includes(id)
      ? draftFeatured.filter((x) => x !== id)
      : [...draftFeatured, id].slice(-3);
    setDraftFeatured(next);
    setPinState('busy');
    const res = await briefApi.setSpaceFeatured(space.id, next);
    setPinState('idle');
    if (!res.ok) { setMessage(res.error ?? 'The pin was refused.'); return; }
    setMessage(next.length ? `${next.length} offer${next.length === 1 ? '' : 's'} lead your catalog.` : 'Nothing is pinned now.');
    onChanged();
  };

  const active = offers.filter((o) => o.status === 'active');

  return (
    <div className={`space-y-5 ${className}`}>
      <p className="text-[12px]" style={{ color: 'var(--brief-muted)' }}>{CAP}</p>

      {/* ── OPENING HOURS ─────────────────────────────────────────────────── */}
      <section className="space-y-2" aria-label="Opening hours">
        <h3 className="text-[12px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-ink)' }}>
          When you are on
        </h3>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--brief-muted)' }}>
          This is the same field your space file shows and the pipeline reads. Toggle the days; leave the
          hours blank if you do not work a fixed window.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDays((cur) => (on ? cur.filter((x) => x !== d) : [...cur, d]))}
                className="w-12 py-2 rounded-xl text-[12px] font-black uppercase cursor-pointer border"
                style={{
                  background: on ? 'var(--color-primary)' : 'var(--color-paper)',
                  color: on ? 'var(--accent-ink)' : 'var(--brief-muted)',
                  borderColor: on ? 'transparent' : 'var(--brief-line)'
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="time" aria-label="Opens at" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-xl text-[14px] font-mono border bg-[color:var(--color-paper)]" style={{ borderColor: 'var(--brief-line)' }} />
          <span style={{ color: 'var(--brief-muted)' }}>→</span>
          <input type="time" aria-label="Closes at" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-xl text-[14px] font-mono border bg-[color:var(--color-paper)]" style={{ borderColor: 'var(--brief-line)' }} />
          <input type="text" aria-label="Or describe it" placeholder="or say it in words (market days only)"
            value={summary} onChange={(e) => setSummary(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-2 rounded-xl text-[14px] border bg-[color:var(--color-paper)]" style={{ borderColor: 'var(--brief-line)' }} />
          <button
            type="button"
            onClick={() => void saveHours()}
            disabled={saveState === 'busy' || (days.length === 0 && !summary.trim())}
            className="px-3.5 py-2 rounded-full text-[13px] font-black cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
          >
            {saveState === 'busy' ? 'Saving…' : 'Save hours'}
          </button>
        </div>
      </section>

      {/* ── PINNED OFFERS ─────────────────────────────────────────────────── */}
      <section className="space-y-2" aria-label="Pinned offers">
        <h3 className="text-[12px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-ink)' }}>
          Lead the counter
        </h3>
        <p className="text-[11px]" style={{ color: 'var(--brief-muted)' }}>
          Pin up to three of your active offers. Your choice, in front — no algorithm is consulted, and no
          buyer is shown anything you did not put there.
        </p>
        {active.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--brief-muted)' }}>Nothing is active to pin yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {active.map((o) => {
              const on = draftFeatured.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => void togglePin(o.id)}
                    disabled={pinState === 'busy'}
                    aria-pressed={on}
                    className="w-full text-left p-2.5 rounded-2xl border-2 cursor-pointer flex items-center gap-2 disabled:opacity-60"
                    style={{ borderColor: on ? 'var(--color-primary)' : 'var(--brief-line)', background: 'var(--color-paper)' }}
                  >
                    {on ? <PinOff className="w-4 h-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
                       : <Pin className="w-4 h-4 shrink-0" style={{ color: 'var(--color-quiet)' }} />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold truncate" style={{ color: 'var(--brief-ink)' }}>{o.title}</span>
                      <span className="block text-[12px] font-mono" style={{ color: 'var(--brief-muted)' }}>
                        {o.currency} {o.price.toLocaleString('en-KE')}
                      </span>
                    </span>
                    {on && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--color-primary)' }} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── TEMPLATES ─────────────────────────────────────────────────────── */}
      <section className="space-y-2" aria-label="Message templates">
        <h3 className="text-[12px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-ink)' }}>
          Sentences you keep retyping
        </h3>
        <p className="text-[11px]" style={{ color: 'var(--brief-muted)' }}>
          Tap one to put it on the clipboard and paste it where you reply. Nothing is sent for you — Brief
          does not message your customers from a template.
        </p>
        {tpl.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--brief-muted)' }}>None saved yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {tpl.map((t) => (
              <li key={t.id} className="p-2.5 rounded-2xl border flex items-start gap-2" style={{ borderColor: 'var(--brief-line)', background: 'var(--color-paper)' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-black uppercase tracking-wide" style={{ color: 'var(--brief-muted)' }}>{t.label}</p>
                  <p className="text-[14px] leading-snug mt-0.5" style={{ color: 'var(--brief-ink)' }}>{t.body}</p>
                </div>
                <button type="button" onClick={() => void copyTemplate(t)} aria-label={`Copy ${t.label}`}
                  className="shrink-0 px-2.5 py-1.5 rounded-full text-[12px] font-bold cursor-pointer border" style={{ borderColor: 'var(--brief-line)' }}>
                  Copy
                </button>
                <button type="button" onClick={() => void removeTemplate(t.id)} aria-label={`Delete ${t.label}`}
                  className="shrink-0 p-1.5 rounded-full cursor-pointer" style={{ color: 'var(--color-quiet)' }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="p-3 rounded-2xl space-y-2" style={{ background: 'var(--color-well)' }}>
          <input type="text" maxLength={40} aria-label="Template label" placeholder="Label (e.g. Order confirmed)"
            value={label} onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-[14px] border bg-[color:var(--color-paper)]" style={{ borderColor: 'var(--brief-line)' }} />
          <textarea rows={2} maxLength={300} aria-label="Template message" placeholder="Your order is confirmed for Saturday, 10am. Pay on collection."
            value={body} onChange={(e) => setBody(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-[14px] border bg-[color:var(--color-paper)] resize-none" style={{ borderColor: 'var(--brief-line)' }} />
          <button type="button" onClick={() => void addTemplate()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-black cursor-pointer"
            style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}>
            <Plus className="w-4 h-4" /> Save template
          </button>
        </div>
      </section>

      {message && (
        <p role="status" className="text-[13px] font-bold" style={{ color: 'var(--color-success)' }}>{message}</p>
      )}

      <p className="text-[11px] leading-snug p-3 rounded-xl" style={{ background: 'var(--color-well)', color: 'var(--brief-muted)' }}>
        Not here yet: staff and roles for a space. Brief&rsquo;s authority is a role bound to a scope, resolved
        in one place; a Manager/Staff/Viewer picker that no route enforced would tell you a colleague is
        read-only when they are not. It comes with the scope, not before it.
      </p>
    </div>
  );
}

export default SpaceTools;
