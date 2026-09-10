import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Plus, 
  ArrowRight, 
  MessageCircle, 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Compass, 
  CheckCircle2,
  Clock,
  Layers
} from 'lucide-react';
import type { Space } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { CreateSpaceModal } from '../spaces/CreateSpaceModal';
import { soundEngine } from '../../utils/SoundEngine';

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
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

  const primarySpace = spaces[0] || null;

  const handleSpaceCreated = (newSpace: Space) => {
    showToast(`Space "${newSpace.name}" created!`);
    loadSpaces();
    onOpenSpace(newSpace.id);
  };

  return (
    <div className={`space-y-6 max-w-2xl mx-auto ${className}`}>
      {/* Toast */}
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

      {/* ── PRIMARY SPACE CARD ── */}
      {primarySpace ? (
        <div
          onClick={() => {
            soundEngine.play('tap');
            onOpenSpace(primarySpace.id);
          }}
          className="p-5 sm:p-6 rounded-3xl bg-white border border-black/5 shadow-sm hover:shadow-md transition-all cursor-pointer space-y-4 group"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🍰</span>
                <h2 className="text-xl font-black text-[color:var(--color-text)] group-hover:text-[color:var(--color-primary)] transition-colors">
                  {primarySpace.name}
                </h2>
              </div>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                {primarySpace.goal || `${primarySpace.type} space`}
              </p>
            </div>

            <span className="px-3 py-1 rounded-full bg-[color:var(--color-primary-subtle)] text-[color:var(--color-text)] text-[10px] font-mono font-bold">
              ACTIVE
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-[color:var(--color-text-muted)] pt-1 border-t border-black/5">
            <span className="font-bold text-[color:var(--color-text)]">
              KES {(primarySpace.metrics?.revenueKes || 0).toLocaleString()} this month
            </span>
            <span>
              {primarySpace.metrics?.customerCount || 0} customers · {primarySpace.metrics?.offersCount || 0} offers
            </span>
          </div>

          <button
            type="button"
            className="w-full py-2.5 rounded-full bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-strong)] text-[color:var(--accent-ink)] font-bold text-xs flex items-center justify-center space-x-2 transition-all"
          >
            <span>Open space</span>
            <ArrowRight className="w-3.5 h-3.5 text-[color:var(--color-primary)]" />
          </button>
        </div>
      ) : (
        <div className="p-6 rounded-3xl bg-white border border-dashed border-gray-300 text-center space-y-3">
          <p className="text-sm font-bold text-[color:var(--color-text)]">
            You don't have a space yet.
          </p>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            Start a bakery, side-hustle, craft studio, or community circular fund.
          </p>
          <button
            type="button"
            onClick={() => {
              soundEngine.play('heavyTap');
              setCreateSpaceOpen(true);
            }}
            className="px-5 py-2.5 rounded-full bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-strong)] text-[color:var(--accent-ink)] font-bold text-xs inline-flex items-center space-x-2 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4 text-[color:var(--color-primary)]" />
            <span>Create your first space</span>
          </button>
        </div>
      )}

      {/* ── TODAY DECISION QUEUE (MAX 3 URGENT ITEMS) ── */}
      <section className="space-y-3" aria-label="Today Action Queue">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
            Today
          </h3>
          <span className="text-[10px] font-mono text-[color:var(--color-text-muted)]">Action Queue</span>
        </div>

        <div className="space-y-2.5">
          <div className="p-4 rounded-2xl bg-white border border-black/5 shadow-2xs space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[color:var(--color-text)] block">
                  Mary asked for a birthday cake
                </span>
                <span className="text-[10px] text-[color:var(--color-text-muted)] block">
                  12 minutes ago · Context: Birthday Cake (KES 4,500)
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[color:var(--color-success)] animate-pulse" />
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => showToast('Opening WhatsApp reply with Mary')}
                className="px-4 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-[color:var(--color-text)] text-xs font-bold transition-all cursor-pointer"
              >
                Reply
              </button>
              <button
                type="button"
                onClick={() => {
                  if (primarySpace) onOpenSpace(primarySpace.id);
                }}
                className="px-4 py-1.5 rounded-full bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-strong)] text-[color:var(--accent-ink)] text-xs font-bold transition-all cursor-pointer"
              >
                Create order
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-black/5 shadow-2xs space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[color:var(--color-text)] block">
                  Your chocolate cake is getting attention
                </span>
                <span className="text-[10px] text-[color:var(--color-text-muted)] block">
                  17 views in Kilimani · 3 new enquiries
                </span>
              </div>
              <span className="text-xs font-bold text-[color:var(--color-success)] font-mono">+17</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (primarySpace) onOpenSpace(primarySpace.id);
              }}
              className="px-4 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-[color:var(--color-text)] text-xs font-bold transition-all cursor-pointer"
            >
              View enquiries
            </button>
          </div>
        </div>
      </section>

      {/* ── WHAT DO YOU WANT TO DO? (4 QUICK ACTION PILLS) ── */}
      <section className="space-y-3" aria-label="Quick Actions">
        <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
          What do you want to do?
        </h3>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              if (primarySpace) onOpenSpace(primarySpace.id);
              else setCreateSpaceOpen(true);
            }}
            className="p-3.5 rounded-2xl bg-white hover:bg-gray-50 border border-black/5 shadow-2xs text-left transition-all cursor-pointer flex items-center space-x-2.5"
          >
            <div className="w-8 h-8 rounded-xl bg-[color:var(--color-primary-subtle)] text-[color:var(--color-primary)] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[color:var(--color-text)] block">Sell something</span>
              <span className="text-[10px] text-[color:var(--color-text-muted)] block">Create offer</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onExploreDiscover?.();
            }}
            className="p-3.5 rounded-2xl bg-white hover:bg-gray-50 border border-black/5 shadow-2xs text-left transition-all cursor-pointer flex items-center space-x-2.5"
          >
            <div className="w-8 h-8 rounded-xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-success)] flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[color:var(--color-text)] block">Find customers</span>
              <span className="text-[10px] text-[color:var(--color-text-muted)] block">Nearby radar</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onGetPaid?.();
            }}
            className="p-3.5 rounded-2xl bg-white hover:bg-gray-50 border border-black/5 shadow-2xs text-left transition-all cursor-pointer flex items-center space-x-2.5"
          >
            <div className="w-8 h-8 rounded-xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-warning)] flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[color:var(--color-text)] block">Get paid</span>
              <span className="text-[10px] text-[color:var(--color-text-muted)] block">M-Pesa Ledger</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('heavyTap');
              setCreateSpaceOpen(true);
            }}
            className="p-3.5 rounded-2xl bg-white hover:bg-gray-50 border border-black/5 shadow-2xs text-left transition-all cursor-pointer flex items-center space-x-2.5"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[color:var(--color-text)] block">Create space</span>
              <span className="text-[10px] text-[color:var(--color-text-muted)] block">New venture</span>
            </div>
          </button>
        </div>
      </section>

      {/* ── ALL SPACES LIST ── */}
      {spaces.length > 1 && (
        <section className="space-y-3" aria-label="My Spaces">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
              My Spaces ({spaces.length})
            </h3>
            <button
              type="button"
              onClick={() => setCreateSpaceOpen(true)}
              className="text-xs font-bold text-[color:var(--color-primary)] hover:underline cursor-pointer"
            >
              + Start another
            </button>
          </div>

          <div className="space-y-2">
            {spaces.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  soundEngine.play('tap');
                  onOpenSpace(s.id);
                }}
                className="p-3.5 rounded-2xl bg-white border border-black/5 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center space-x-2.5">
                  <span className="text-lg">🌱</span>
                  <div>
                    <span className="text-xs font-bold text-[color:var(--color-text)] block">
                      {s.name}
                    </span>
                    <span className="text-[10px] text-[color:var(--color-text-muted)] block">
                      {s.goal || `${s.type} space`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-[color:var(--color-text)]">
                    KES {(s.metrics?.revenueKes || 0).toLocaleString()}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </section>
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
