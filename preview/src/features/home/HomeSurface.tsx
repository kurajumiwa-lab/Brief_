import React, { useState, useEffect } from 'react';
import {
  Plus,
  ArrowRight,
  MessageCircle,
  ShoppingBag,
  Package,
  Archive,
  RotateCcw,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import type { Space } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { CreateSpaceModal } from '../spaces/CreateSpaceModal';
import { soundEngine } from '../../utils/SoundEngine';
import { attentionQueue, needsAttention, splitSpaces } from './spaceSignals';
import { PromoCarousel } from '../spaces/PromoCarousel';
import { PositionCard } from './PositionCard';

export interface HomeSurfaceProps {
  userName?: string;
  onOpenSpace: (spaceId: string) => void;
  onExploreDiscover?: () => void;
  onGetPaid?: () => void;
  className?: string;
}

export const HomeSurface: React.FC<HomeSurfaceProps> = ({
  userName = 'there',
  onOpenSpace,
  onExploreDiscover,
  onGetPaid,
  className = ''
}) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [createSpaceOpen, setCreateSpaceOpen] = useState<boolean>(false);
  const [archivedOpen, setArchivedOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadSpaces = async () => {
    setIsLoading(true);
    try {
      const res = await briefApi.listMySpaces();
      if (res.ok && res.data?.spaces) {
        setSpaces(res.data.spaces);
      }
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSpaces();
  }, []);

  const handleSpaceCreated = (newSpace: Space) => {
    showToast(`Space "${newSpace.name}" created!`);
    loadSpaces();
    onOpenSpace(newSpace.id);
  };

  const setStatus = async (space: Space, status: 'active' | 'archived') => {
    setBusyId(space.id);
    const res = await briefApi.updateSpace(space.id, { status });
    setBusyId(null);
    if (res.ok) {
      showToast(status === 'archived' ? `Archived "${space.name}".` : `Restored "${space.name}".`);
      loadSpaces();
    } else {
      showToast(res.error ?? 'Could not update that space.');
    }
  };

  const { active, archived } = splitSpaces(spaces);
  const queue = attentionQueue(active);

  const ATTENTION_ICON: Record<string, React.ReactNode> = {
    conversation: <MessageCircle className="w-3 h-3" />,
    offer: <ShoppingBag className="w-3 h-3" />,
    order: <Package className="w-3 h-3" />
  };

  return (
    <div className={`space-y-6 max-w-2xl mx-auto ${className}`}>
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[color:var(--color-text)] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* Greeting */}
      <div className="space-y-1">
        <span className="text-xs font-semibold text-[color:var(--color-text-muted)]">
          Good morning, {userName}
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-[color:var(--color-text)] tracking-tight">
          What are you working on?
        </h1>
      </div>

      {/* ── WHAT'S ON — a compact vertical ticker of real events + a one-line
             feature-education note, so the home screen teaches as it sells. ── */}
      <PromoCarousel variant="vertical" />

      {/* ── YOUR POSITION — the honest clock: what's expiring, missed, still open. ── */}
      <PositionCard />

      <div className="p-3 rounded-2xl bg-[color:var(--color-primary-subtle)] border border-[color:var(--color-primary)]">
        <p className="text-[11px] leading-snug" style={{ color: "var(--color-text)" }}>
          <strong style={{ color: "var(--color-primary)" }}>Tip:</strong> a space is your project — add an offer, take orders, track the money. Make it <strong>Public</strong> to be found by others, or keep it <strong>Private</strong>.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-[color:var(--color-text-muted)]">Reading your spaces…</p>
      ) : spaces.length === 0 ? (
        /* A single create affordance, only when there is genuinely nothing yet. */
        <div className="p-6 rounded-3xl bg-white border border-dashed border-gray-300 text-center space-y-3">
          <p className="text-sm font-bold text-[color:var(--color-text)]">
            You don't have a space yet.
          </p>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            A space is your project — a bakery, a side-hustle, a craft studio, a
            community fund. Add offers, take orders, track the money, all in one place.
          </p>
          <button
            type="button"
            onClick={() => { soundEngine.play('heavyTap'); setCreateSpaceOpen(true); }}
            className="px-5 py-2.5 rounded-full bg-[color:var(--color-primary)] text-[color:var(--accent-ink)] font-bold text-xs inline-flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create your first space</span>
          </button>
        </div>
      ) : (
        <>
          {/* ── NEEDS YOUR ATTENTION — the real check-in queue, never mock ── */}
          <section className="space-y-3" aria-label="Needs your attention">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
                Needs your attention
              </h3>
              <button
                type="button"
                onClick={() => { soundEngine.play('tap'); setCreateSpaceOpen(true); }}
                className="text-xs font-bold text-[color:var(--color-primary)] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> New space
              </button>
            </div>

            {queue.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white border border-black/5 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[color:var(--color-success)]" />
                <span className="text-xs font-bold text-[color:var(--color-text)]">All caught up.</span>
                <span className="text-[10px] text-[color:var(--color-text-muted)]">No open conversations, draft offers or orders to fulfil.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map(({ space, items }) => (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => { soundEngine.play('tap'); onOpenSpace(space.id); }}
                    className="w-full text-left p-4 rounded-2xl bg-white border border-black/5 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[color:var(--color-text)]">{space.name}</span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((it) => (
                        <span key={it.kind} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:var(--color-primary-subtle)] text-[color:var(--color-text)] text-[10px] font-bold">
                          {ATTENTION_ICON[it.kind]} {it.label}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ── MY SPACES — every active space, organised ── */}
          <section className="space-y-3" aria-label="My spaces">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
                My spaces ({active.length})
              </h3>
            </div>

            <div className="space-y-2">
              {active.map((s) => {
                const attention = needsAttention(s);
                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-2xl bg-white border border-black/5 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => { soundEngine.play('tap'); onOpenSpace(s.id); }}
                      className="flex-1 text-left flex items-center space-x-2.5 cursor-pointer"
                    >
                      <span className="text-lg">🌱</span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[color:var(--color-text)] block truncate">
                          {s.name}
                        </span>
                        <span className="text-[10px] text-[color:var(--color-text-muted)] block">
                          {attention.length === 0
                            ? 'All caught up'
                            : attention.map((a) => a.label).join(' · ')}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={busyId === s.id}
                      onClick={() => setStatus(s, 'archived')}
                      aria-label={`Archive ${s.name}`}
                      title="Archive"
                      className="shrink-0 p-2 rounded-full text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-gray-100 transition-all cursor-pointer"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── ARCHIVED — collapsed, restorable ── */}
          {archived.length > 0 && (
            <section className="space-y-2" aria-label="Archived spaces">
              <button
                type="button"
                onClick={() => setArchivedOpen((v) => !v)}
                className="w-full flex items-center justify-between text-xs font-bold text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] cursor-pointer"
              >
                <span>Archived ({archived.length})</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${archivedOpen ? 'rotate-180' : ''}`} />
              </button>
              {archivedOpen && (
                <div className="space-y-2">
                  {archived.map((s) => (
                    <div key={s.id} className="p-3 rounded-2xl bg-white/50 border border-dashed border-gray-200 flex items-center justify-between gap-2 opacity-70">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className="text-lg">🗄️</span>
                        <span className="text-xs font-bold text-[color:var(--color-text)] truncate">{s.name}</span>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => setStatus(s, 'active')}
                        aria-label={`Restore ${s.name}`}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-subtle)] transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Create Space Modal */}
      {createSpaceOpen && (
        <CreateSpaceModal
          isOpen={createSpaceOpen}
          onClose={() => setCreateSpaceOpen(false)}
          onSpaceCreated={handleSpaceCreated}
        />
      )}
    </div>
  );
};

export default HomeSurface;
