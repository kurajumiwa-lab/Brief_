import React, { useState } from 'react';
import {
  Award,
  Users,
  TrendingUp,
  Coins,
  Copy,
  CheckCircle2,
  Share2,
  Check,
  ShieldCheck,
  X,
  Phone,
  ArrowRight
} from 'lucide-react';
import {
  INITIAL_CREATOR_PROFILES,
  CreatorProfile,
  calculateCommission
} from '../../model/creatorProgram';
import { soundEngine } from '../../utils/SoundEngine';

export interface CreatorPartnerDeskProps {
  onClose?: () => void;
  onShareLink?: (code: string) => void;
}

export const CreatorPartnerDesk: React.FC<CreatorPartnerDeskProps> = ({
  onClose,
  onShareLink
}) => {
  const [creators] = useState<CreatorProfile[]>(INITIAL_CREATOR_PROFILES);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>(creators[0]?.id || '');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeCreator = creators.find((c) => c.id === selectedCreatorId) || creators[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopy = () => {
    soundEngine.play('tap');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`https://brief.africa/onboard?ref=${activeCreator.referralCode}`);
    }
    setCopiedCode(true);
    showToast(`Copied referral link: brief.africa/onboard?ref=${activeCreator.referralCode}`);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl bg-[#FAFAF8] shadow-2xl overflow-hidden font-sans text-[#1A1F2E]">
      
      {/* ── HEADER ── */}
      <div className="p-6 sm:p-7 bg-gradient-to-br from-[#1A1F2E] via-[#2A3447] to-[#1A1F2E] text-white relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-[#B8621F] text-white tracking-wider">
                CREATOR PARTNER DESK
              </span>
              <span className="text-xs text-gray-300 font-bold flex items-center space-x-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Group Activation Program</span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2">
              <span>Community Creators & Institutional Organizers</span>
            </h2>
            <p className="text-xs text-gray-300 max-w-lg leading-relaxed">
              Bring living groups (PTAs, welfare circles, church fellowships, campus guilds) onto Brief. Earn 15% net take-rate commission on retained, active coordination value.
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Creator Switcher */}
        <div className="flex items-center space-x-2 mt-5 overflow-x-auto no-scrollbar pt-2 border-t border-white/10">
          {creators.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                setSelectedCreatorId(c.id);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeCreator.id === c.id
                  ? 'bg-white text-[#1A1F2E] shadow-md font-black'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {c.name} ({c.title.split(' ')[0]})
            </button>
          ))}
        </div>
      </div>

      {/* ── METRICS & DASHBOARD ── */}
      <div className="p-6 sm:p-7 space-y-6">
        
        {/* Creator Info & Referral Card */}
        <div className="p-5 rounded-2xl bg-white shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono font-black uppercase text-[#B8621F] tracking-wide">
                {activeCreator.role.replace('_', ' ').toUpperCase()}
              </span>
              <h3 className="text-lg font-black text-[#1A1F2E] leading-snug">
                {activeCreator.name}
              </h3>
              <p className="text-xs text-[#6B7280]">{activeCreator.title}</p>
            </div>

            {/* Shareable Code */}
            <div className="flex items-center space-x-2">
              <div className="px-3.5 py-2 rounded-xl bg-[#F0EDE8] font-mono font-black text-xs text-[#1A1F2E] flex items-center space-x-2">
                <span>REF:</span>
                <span className="text-[#B8621F]">{activeCreator.referralCode}</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="py-2 px-3 rounded-xl bg-[#1A1F2E] hover:bg-black text-white text-xs font-bold flex items-center space-x-1.5 transition-transform active:scale-95 cursor-pointer shadow-sm"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* 3 Metrics Cards */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-[#F0EDE8] space-y-1">
              <div className="flex items-center space-x-1 text-[10px] font-bold text-[#6B7280] uppercase">
                <Users className="w-3.5 h-3.5 text-[#B8621F]" />
                <span>Activated Groups</span>
              </div>
              <span className="text-lg font-black text-[#1A1F2E]">
                {activeCreator.activatedGroupsCount}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#F0EDE8] space-y-1">
              <div className="flex items-center space-x-1 text-[10px] font-bold text-[#6B7280] uppercase">
                <TrendingUp className="w-3.5 h-3.5 text-[#0B6E6E]" />
                <span>Coordinated Volume</span>
              </div>
              <span className="text-lg font-black text-[#1A1F2E]">
                KES {activeCreator.totalCoordinatedVolumeKes.toLocaleString()}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 space-y-1">
              <div className="flex items-center space-x-1 text-[10px] font-bold text-emerald-800 uppercase">
                <Coins className="w-3.5 h-3.5 text-emerald-700" />
                <span>Earned Commissions</span>
              </div>
              <span className="text-lg font-black text-emerald-700">
                KES {activeCreator.earnedCommissionsKes.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Groups Brought Roster */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[#1A1F2E]">
              Groups Onboarded & Managed
            </span>
            <span className="text-[10px] font-mono text-[#6B7280] font-bold">
              15% NET TAKE-RATE CUT
            </span>
          </div>

          <div className="space-y-2.5">
            {activeCreator.groupsBrought.map((grp) => (
              <div
                key={grp.groupId}
                className="p-4 rounded-2xl bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-black text-[#1A1F2E]">{grp.groupName}</h4>
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      Activated
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    {grp.memberCount} active members · Category: {grp.groupCategory.replace('_', ' ')}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs font-black text-emerald-700 block">
                    +KES {grp.commissionAccruedKes.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#6B7280]">
                    From KES {grp.monthlyVolumeKes.toLocaleString()} monthly volume
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* M-Pesa Settlement Note */}
        <div className="p-4 rounded-2xl bg-[#EFECE6] flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-black text-[#1A1F2E] block">
              M-Pesa B2C Auto-Settlement
            </span>
            <p className="text-[11px] text-[#6B7280]">
              Disbursed on 1st of every month to registered line: {activeCreator.phone}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase block">Pending Payout</span>
            <span className="text-sm font-black text-[#B8621F]">KES {activeCreator.pendingCommissionsKes.toLocaleString()}</span>
          </div>
        </div>

        {/* Commission Rules Disclaimer */}
        <div className="p-3.5 rounded-2xl bg-black/[0.03] space-y-1 text-center">
          <p className="text-[10px] text-[#6B7280] leading-relaxed">
            Brief compensates creators on activated, retained community coordination value — never on raw registrations or vanity signups. Groups govern their own funds.
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl flex items-center space-x-2 animate-fadeIn border border-white/10">
          <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
