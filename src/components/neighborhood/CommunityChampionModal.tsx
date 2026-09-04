import React from 'react';
import {
  ShieldCheck,
  X,
  Phone,
  CheckCircle2,
  Users,
  Truck,
  TrendingUp,
  Award,
  Clock
} from 'lucide-react';
import { Neighborhood } from '../../model/neighborhoods';
import { soundEngine } from '../../utils/SoundEngine';

export interface CommunityChampionModalProps {
  isOpen: boolean;
  neighborhood: Neighborhood;
  onClose: () => void;
  onCallChampion?: (phone: string) => void;
  onVouchRider?: () => void;
}

export const CommunityChampionModal: React.FC<CommunityChampionModalProps> = ({
  isOpen,
  neighborhood,
  onClose,
  onCallChampion,
  onVouchRider
}) => {
  if (!isOpen) return null;

  const { champion } = neighborhood;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xl my-auto rounded-3xl bg-[#1A1F2E] text-white p-5 sm:p-6 shadow-2xl space-y-6 animate-slideUp">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
                GRASSROOTS TRUST
              </span>
              <h2 className="text-xl font-black text-white tracking-tight">
                Community Champion
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Champion Profile Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#262D3D] to-[#1E2536] space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center text-2xl shadow-lg">
                {champion.avatar}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-black text-white">{champion.name}</h3>
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-extrabold uppercase">
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    <span>Verified</span>
                  </span>
                </div>
                <p className="text-xs text-gray-300 font-medium">{champion.role}</p>
                <p className="text-[11px] text-gray-400">
                  {neighborhood.name} · Verified Since {champion.verifiedSince}
                </p>
              </div>
            </div>
          </div>

          {/* Quote */}
          <div className="p-3 rounded-xl bg-black/20 text-xs text-amber-100/90 italic">
            "{champion.quote}"
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2.5 rounded-xl bg-white/5 space-y-0.5">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Vouched</span>
              <span className="text-sm font-black text-white">{champion.vouchedRidersCount} Riders</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 space-y-0.5">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Merchants</span>
              <span className="text-sm font-black text-white">{champion.verifiedMerchantsCount} Dukas</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 space-y-0.5">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Monthly Run</span>
              <span className="text-sm font-black text-[#00BFEF]">{champion.communityVolume}</span>
            </div>
          </div>
        </div>

        {/* Live Activity Ledger */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Live {neighborhood.name} Activity</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">● REALTIME</span>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
            {neighborhood.recentActivity.map((act) => (
              <div
                key={act.id}
                className="p-3 rounded-xl bg-white/5 flex items-start space-x-2.5 text-xs text-gray-200"
              >
                <span className="text-base shrink-0">{act.icon}</span>
                <div className="flex-1 space-y-0.5">
                  <p className="leading-snug">{act.text}</p>
                  <span className="text-[10px] text-gray-400 block">{act.timeAgo}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 pt-2">
          <a
            href={`tel:${champion.phone}`}
            onClick={() => {
              soundEngine.play('heavyTap');
              onCallChampion?.(champion.phone);
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0D1117] font-black text-xs flex items-center justify-center space-x-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <Phone className="w-4 h-4" />
            <span>Call {champion.name}</span>
          </a>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onVouchRider?.();
            }}
            className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Vouch a Rider</span>
          </button>
        </div>

      </div>
    </div>
  );
};
