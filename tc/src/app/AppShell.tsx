import React, { useState, useEffect } from 'react';
import type { Space, Listing } from '../api/types';
import * as briefApi from '../api/briefApi';
import { Navigation, BriefNavigationTab } from './Navigation';
import { HomeSurface } from '../features/home/HomeSurface';
import { SpaceShell } from '../features/spaces/SpaceShell';
import { CreateSpaceModal } from '../features/spaces/CreateSpaceModal';
import { PublicOfferModal } from '../features/offers/PublicOfferModal';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { soundEngine } from '../utils/SoundEngine';

export interface AppShellProps {
  initialTab?: BriefNavigationTab;
  initialSpaceId?: string | null;
  onNavigateLegacyTab?: (tab: string) => void;
  className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  initialTab = 'home',
  initialSpaceId = null,
  onNavigateLegacyTab,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<BriefNavigationTab>(initialTab);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(initialSpaceId);
  const [createSpaceOpen, setCreateSpaceOpen] = useState<boolean>(false);
  const [publicOfferModalOpen, setPublicOfferModalOpen] = useState<boolean>(false);
  const [activePublicOffer, setActivePublicOffer] = useState<Listing | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleOpenSpace = (spaceId: string) => {
    setActiveSpaceId(spaceId);
    setActiveTab('spaces');
  };

  return (
    <div className={`min-h-screen w-full bg-[#F0EDE8] text-[#1A1F2E] font-sans flex ${className}`}>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* Navigation (Sidebar on desktop, bottom dock on mobile) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'spaces') {
            // retain activeSpaceId for quick return
          }
        }}
        onCreateAction={() => setCreateSpaceOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 pb-28 md:pb-6 overflow-y-auto min-h-screen">
        {/* Tab 1: HOME */}
        {activeTab === 'home' && (
          <HomeSurface
            userName="Amina"
            onOpenSpace={handleOpenSpace}
            onExploreDiscover={() => setActiveTab('discover')}
            onGetPaid={() => showToast('Opening M-Pesa Ledger')}
          />
        )}

        {/* Tab 2: SPACES */}
        {activeTab === 'spaces' && (
          <div>
            {activeSpaceId ? (
              <SpaceShell
                spaceId={activeSpaceId}
                onBack={() => setActiveTab('home')}
                onShare={(s) => showToast(`Share link for ${s.name} copied!`)}
              />
            ) : (
              <HomeSurface
                userName="Amina"
                onOpenSpace={handleOpenSpace}
                onExploreDiscover={() => setActiveTab('discover')}
                onGetPaid={() => showToast('Opening M-Pesa Ledger')}
              />
            )}
          </div>
        )}

        {/* Tab 3: DISCOVER */}
        {activeTab === 'discover' && (
          <div className="max-w-2xl mx-auto">
            <DiscoverScreen />
          </div>
        )}

        {/* Tab 4: ACTIVITY */}
        {activeTab === 'activity' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-xl font-black text-[#1A1F2E]">All Activity</h2>
            <div className="p-6 rounded-3xl bg-white border border-black/5 text-center text-xs text-[#64748B]">
              Real-time activity feed across all your spaces and customer orders.
            </div>
          </div>
        )}
      </main>

      {/* Global Modals */}
      {createSpaceOpen && (
        <CreateSpaceModal
          isOpen={createSpaceOpen}
          onClose={() => setCreateSpaceOpen(false)}
          onSpaceCreated={(space) => {
            handleOpenSpace(space.id);
            showToast(`Space "${space.name}" created!`);
          }}
        />
      )}

      {publicOfferModalOpen && activePublicOffer && (
        <PublicOfferModal
          isOpen={publicOfferModalOpen}
          offer={activePublicOffer}
          onClose={() => setPublicOfferModalOpen(false)}
          onInquirySent={() => showToast('Inquiry submitted to seller!')}
        />
      )}
    </div>
  );
};

export default AppShell;
