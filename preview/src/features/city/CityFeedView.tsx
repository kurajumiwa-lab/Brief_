import React, { useState } from 'react';
import {
  Sparkles,
  ShoppingBag,
  Users,
  Lock,
  ArrowRight,
  MapPin,
  TrendingUp,
  Flame,
  Search,
  Clock
} from 'lucide-react';
import { EventsHub } from '../../components/EventsHub';
import { Marketplace } from '../../components/Marketplace';
import { Circles } from '../../components/Circles';
import { Vault } from '../../components/vault/Vault';
import { soundEngine } from '../../utils/SoundEngine';

export interface CityFeedViewProps {
  initialSubTab?: 'all' | 'events' | 'marketplace' | 'circles' | 'vault';
  onOpenSpace?: (spaceId: string) => void;
  className?: string;
}

type CitySubTab = 'all' | 'events' | 'marketplace' | 'circles' | 'vault';

export const CityFeedView: React.FC<CityFeedViewProps> = ({
  initialSubTab = 'all',
  onOpenSpace,
  className = ''
}) => {
  const [activeSubTab, setActiveSubTab] = useState<CitySubTab>(initialSubTab);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const subTabs: Array<{ id: CitySubTab; label: string }> = [
    { id: 'all', label: '🌆 All City' },
    { id: 'events', label: '🎟️ Events & Festivals' },
    { id: 'marketplace', label: '🛍️ Marketplace' },
    { id: 'circles', label: '🤝 Circles' },
    { id: 'vault', label: '🔐 Vault & Drops' }
  ];

  return (
    <div className={`space-y-6 max-w-4xl mx-auto ${className}`}>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[color:var(--color-text)] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* ── CITY FEED HERO HEADER ── */}
      <div className="p-6 rounded-3xl bg-[color:var(--color-text)] text-white space-y-4 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[color:var(--color-primary)] animate-ping" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[color:var(--color-primary)]">
                Live Nairobi Activity
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Everything Happening Around You
            </h1>
            <p className="text-xs text-white/70 max-w-md mt-0.5">
              Local events, creator drops, community circles, and secret drops across Nairobi.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="px-3 py-1.5 rounded-2xl bg-white/10 text-[color:var(--color-primary)] text-xs font-bold border border-white/10">
              📍 Nairobi · Kilimani · CBD
            </span>
          </div>
        </div>

        {/* Filter Navigation Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-2 scrollbar-none">
          {subTabs.map((tab) => {
            const isSelected = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setActiveSubTab(tab.id);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-[color:var(--color-primary)] text-[color:var(--color-text)] shadow-sm'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MOUNTED CITIZEN SURFACES ── */}
      <div className="space-y-6">
        {/* ALL CITY STREAM VIEW */}
        {activeSubTab === 'all' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top Events Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-[color:var(--color-primary)]" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--color-text)]">
                    Featured Events & Experiences
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('events')}
                  className="text-xs font-bold text-[color:var(--color-primary)] hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>View All Events</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs">
                <EventsHub />
              </div>
            </section>

            {/* Marketplace Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-4 h-4 text-[color:var(--color-accent)]" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--color-text)]">
                    Community Marketplace & Second-Hand Drops
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('marketplace')}
                  className="text-xs font-bold text-[color:var(--color-accent)] hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>Explore Market</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs">
                <Marketplace />
              </div>
            </section>

            {/* Community Circles & Vault Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-[color:var(--color-primary)]" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
                      Community Circles & Mutual Aid
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('circles')}
                    className="text-[11px] font-bold text-[color:var(--color-primary)] hover:underline cursor-pointer"
                  >
                    All Circles →
                  </button>
                </div>
                <Circles />
              </section>

              <section className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-[color:var(--color-text)]" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
                      Vault & Special Drops
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('vault')}
                    className="text-[11px] font-bold text-[color:var(--color-primary)] hover:underline cursor-pointer"
                  >
                    Open Vault →
                  </button>
                </div>
                <Vault />
              </section>
            </div>
          </div>
        )}

        {/* SPECIFIC SUB-TABS */}
        {activeSubTab === 'events' && (
          <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs animate-fadeIn">
            <EventsHub />
          </div>
        )}

        {activeSubTab === 'marketplace' && (
          <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs animate-fadeIn">
            <Marketplace />
          </div>
        )}

        {activeSubTab === 'circles' && (
          <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs animate-fadeIn">
            <Circles />
          </div>
        )}

        {activeSubTab === 'vault' && (
          <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs animate-fadeIn">
            <Vault />
          </div>
        )}
      </div>
    </div>
  );
};

export default CityFeedView;
