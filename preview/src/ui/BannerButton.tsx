import React from 'react';
import { ArrowRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// BANNER BUTTON — the one dark-gradient banner a screen may carry. Home gets
// one ("What's moving today →"); Mine gets one when the member owns a shop
// ("Your shop overview →"). Never two on a screen: a second gradient is a
// second shout, and the rule of this refactor is that nothing is special,
// so the ONE banner is the only place on the screen allowed to be loud.
// ---------------------------------------------------------------------------

export const BannerButton: React.FC<{
  label: string;
  onClick?: () => void;
  /** A quiet second line, only when it is a real row (a count the server
      stated). Optional. */
  sub?: string | null;
  testId?: string;
}> = ({ label, onClick, sub = null, testId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId ? `gradient-banner-${testId}` : 'gradient-banner'}
    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left cursor-pointer transition-transform active:scale-[0.99]"
    style={{
      background: 'linear-gradient(115deg, #0B1220 0%, #101B31 55%, #1E293B 100%)',
      boxShadow: 'var(--lift-2)'
    }}
  >
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-bold text-white leading-tight truncate">{label}</span>
      {sub ? <span className="block text-[12px] text-white/70 mt-0.5 truncate">{sub}</span> : null}
    </span>
    <ArrowRight className="w-4 h-4 shrink-0 text-white" />
  </button>
);

export default BannerButton;
