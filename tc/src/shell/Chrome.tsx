import React from 'react';
import { Bell, Menu, Sparkles } from 'lucide-react';
import { ActivityDot, DESTINATIONS, DESTINATION_ICONS } from '../model/core';



// ---------------------------------------------------------------------------
// CHROME -- App shell furniture: toasts, spring overlay, desktop rail, mobile
// dock. Extracted verbatim from App.tsx (Phase 5). All state lives in App /
// hooks; these only render.
// ---------------------------------------------------------------------------


export function StatusToasts(props: { setSpringOverlayOpen: any, springOverlayOpen: any, toastMessage: any }) {
  const { setSpringOverlayOpen, springOverlayOpen, toastMessage } = props;
  return (
    <>
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#FF5A1F] text-[#0D0F12] px-4 py-2.5 rounded-xl font-extrabold shadow-2xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="text-xs">{toastMessage}</span>
        </div>
      )}

      {springOverlayOpen && (
        <>
          <div
            onClick={() => setSpringOverlayOpen(false)}
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[8px] transition-opacity"
          />
          <div className="brief-spring-modal fixed top-1/2 left-1/2 z-[70] w-[calc(100%-48px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#22E6E0]/25 bg-[#12151A]/90 px-6 py-8 text-center shadow-2xl">
            <div className="text-4xl mb-4">⏳</div>
            <h3 className="text-xl font-bold mb-2">Nothing to do here?</h3>
            <p className="text-sm text-[#F7F7F8]/60 leading-relaxed mb-6">
              The current timeline is looking ultra quiet. Let's look into a
              different zone.
            </p>
            <button
              onClick={() => setSpringOverlayOpen(false)}
              className="w-full py-4 rounded-lg bg-[#12151A] border border-[#22E6E0]/30 text-[#F7F7F8] text-[15px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 hover:border-[#22E6E0]/70 active:translate-y-0.5 active:scale-[0.96] active:border-white"
            >
              🗓️ Check a Different Time
            </button>
          </div>
        </>
      )}
    </>
  );
}

export function DesktopRail(props: { activeTab: any, destinationAlerts: any, goToDestination: any, menuOpen: any, setMenuOpen: any , notificationsOpen: any, notifUnread: any, setNotificationsOpen: any }) {
  const { activeTab, destinationAlerts, goToDestination, menuOpen, setMenuOpen, notificationsOpen, notifUnread, setNotificationsOpen } = props;
  return (
    <>
        <nav
          aria-label="Primary"
          className="hidden md:flex flex-col shrink-0 w-[76px] hover:w-60 transition-all duration-200 border-r border-[#222630] bg-[#12151A] sticky top-0 h-screen py-4 group/rail overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setMenuOpen((v: any) => !v)}
            title="Menu"
            aria-expanded={menuOpen}
            className={`relative flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
              menuOpen ? 'text-[#F7F7F8] bg-[#12151A] font-extrabold' : 'text-[#F7F7F8] hover:text-[#F7F7F8]'
            }`}
          >
            <span
              className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r transition-all ${
                menuOpen ? 'h-7 bg-[#FF5A1F]' : 'h-0 bg-transparent'
              }`}
            />
            <Menu className="w-5 h-5 shrink-0" />
            <span className="min-w-0 opacity-0 group-hover/rail:opacity-100 transition-opacity">
              <span className="block text-[13px] font-extrabold whitespace-nowrap">Menu</span>
            </span>
          </button>
          {DESTINATIONS.map((d) => {
            const active = activeTab === d.id;
            const Icon = DESTINATION_ICONS[d.id];
            return (
              <button
                key={d.id}
                onClick={() => goToDestination(d.id)}
                title={d.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                  active
                    ? 'text-[#F7F7F8] bg-[#12151A] font-extrabold'
                    : 'text-[#F7F7F8] hover:text-[#F7F7F8]'
                }`}
              >
                {/* Active marker on the edge, not a heavy filled pill. */}
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r transition-all ${
                    active ? 'h-7 bg-[#FF5A1F]' : 'h-0 bg-transparent'
                  }`}
                />
                <span className="relative shrink-0">
                  <Icon className="w-5 h-5" />
                  <span className="absolute -right-1.5 -top-1.5">
                    <ActivityDot n={destinationAlerts[d.id] ?? 0} />
                  </span>
                </span>
                <span className="min-w-0 opacity-0 group-hover/rail:opacity-100 transition-opacity">
                  <span className="block text-[13px] font-extrabold whitespace-nowrap">
                    {d.label}
                  </span>
                </span>
              </button>
            );
          })}
        {/* Bell — the subtle return-loop entry. Badge only when non-zero. */}
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            title="Updates"
            aria-label={notifUnread > 0 ? `Updates, ${notifUnread} unread` : 'Updates'}
            className={`relative mt-auto flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
              notificationsOpen ? 'text-[#F7F7F8] bg-[#12151A] font-extrabold' : 'text-[#F7F7F8] hover:text-[#F7F7F8]'
            }`}
          >
            <span className="relative shrink-0">
              <Bell className="w-5 h-5" />
              {notifUnread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF5D6C] px-1 text-[9px] font-extrabold text-[#F7F7F8]">
                  {notifUnread > 99 ? '99+' : notifUnread}
                </span>
              )}
            </span>
            <span className="min-w-0 opacity-0 group-hover/rail:opacity-100 transition-opacity">
              <span className="block text-[13px] font-extrabold whitespace-nowrap">Updates</span>
              {notifUnread > 0 && (
                <span className="block text-[9px] font-bold whitespace-nowrap text-[#FF5D6C]">{notifUnread} unread</span>
              )}
            </span>
          </button>
        </nav>
    </>
  );
}

export function DockNav(props: { activeTab: any, destinationAlerts: any, dockOn: any, goToDestination: any, isAnyModalActive: any, menuOpen: any, setDockOn: any, setMenuOpen: any }) {
  const { activeTab, destinationAlerts, dockOn, goToDestination, isAnyModalActive, menuOpen, setDockOn, setMenuOpen } = props;
  return (
    <>
      <button
        type="button"
        aria-label="Show navigation"
        onClick={() => setDockOn(true)}
        className={`md:hidden fixed bottom-0 left-1/2 z-[55] -translate-x-1/2 h-5 w-16 rounded-t-full bg-[#12151A] border border-b-0 border-[#222630] cursor-pointer transition-transform ${
          dockOn || isAnyModalActive ? 'translate-y-full pointer-events-none hidden' : ''
        } ${isAnyModalActive ? 'hidden' : ''}`}
      >
        <span className="mx-auto mt-1.5 block h-1 w-8 rounded-full bg-[#D1D5DB]" />
      </button>

      <nav
        aria-label="Primary"
        className={`md:hidden fixed bottom-0 inset-x-0 z-[55] bg-[#12151A]/98 backdrop-blur-xl border-t border-[#222630] flex shadow-lg transition-transform duration-200 ${
          dockOn && !isAnyModalActive ? 'translate-y-0' : 'translate-y-full hidden pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => { setMenuOpen((v: any) => !v); setDockOn(true); }}
          aria-label="Menu"
          aria-expanded={menuOpen}
          title="Menu"
          className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-2 cursor-pointer transition-colors ${
            menuOpen ? 'text-[var(--brief-green)] font-bold border-t-2 border-[var(--brief-green)]' : 'text-[var(--brief-muted)]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[12px] font-extrabold leading-none">Menu</span>
        </button>
        {DESTINATIONS.map((d) => {
          const active = activeTab === d.id;
          const Icon = DESTINATION_ICONS[d.id];
          return (
            <button
              key={d.id}
              onClick={() => goToDestination(d.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-2 cursor-pointer transition-colors ${
                active ? 'text-[var(--brief-green)] font-bold border-t-2 border-[var(--brief-green)]' : 'text-[var(--brief-muted)]'
              }`}
            >
              <span className="relative">
                <Icon className="w-5 h-5" />
                <span className="absolute -right-2 -top-1.5">
                  <ActivityDot n={destinationAlerts[d.id] ?? 0} />
                </span>
              </span>
              <span className="text-[12px] font-extrabold leading-none">
                {d.label}
              </span>
              {(destinationAlerts[d.id] ?? 0) > 0 && (
                <span className="sr-only">
                  {destinationAlerts[d.id]} update{(destinationAlerts[d.id] ?? 0) > 1 ? 's' : ''}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
