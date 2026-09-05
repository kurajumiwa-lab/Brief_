import React from 'react';
import { DollarSign, TrendingUp, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface SpaceMoneyProps {
  revenueKes?: number;
  pendingKes?: number;
  ordersCount?: number;
  onViewLedger?: () => void;
  className?: string;
}

export const SpaceMoney: React.FC<SpaceMoneyProps> = ({
  revenueKes = 0,
  pendingKes = 0,
  ordersCount = 0,
  onViewLedger,
  className = ''
}) => {
  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <DollarSign className="w-4 h-4 text-[#10B981]" />
          <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F2E]">
            Money & Ledger
          </h3>
        </div>
        <span className="text-[10px] font-mono text-[#64748B]">Server Authoritative</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/5 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase text-[#64748B] block font-semibold">
            Collected Revenue
          </span>
          <span className="text-lg font-black text-emerald-700 block">
            KES {revenueKes.toLocaleString()}
          </span>
          <span className="text-[10px] text-[#64748B] block">From completed orders</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/5 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase text-[#64748B] block font-semibold">
            Pending Orders
          </span>
          <span className="text-lg font-black text-amber-700 block">
            KES {pendingKes.toLocaleString()}
          </span>
          <span className="text-[10px] text-[#64748B] block">Awaiting payment / dispatch</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/5 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-mono uppercase text-[#64748B] block font-semibold">
            Total Orders
          </span>
          <span className="text-lg font-black text-[#1A1F2E] block">
            {ordersCount}
          </span>
          <span className="text-[10px] text-[#64748B] block">Tracked on ledger</span>
        </div>
      </div>
    </section>
  );
};

export default SpaceMoney;
