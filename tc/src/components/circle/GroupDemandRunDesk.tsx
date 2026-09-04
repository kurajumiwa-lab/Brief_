import React, { useState } from 'react';
import {
  Package,
  CheckCircle2,
  TrendingUp,
  Truck,
  Users,
  ShieldCheck,
  Phone,
  ArrowRight,
  Info,
  X,
  Plus
} from 'lucide-react';
import { DEMO_DEMAND_RUNS, GroupDemandRun } from '../../model/neighborhoods';
import { soundEngine } from '../../utils/SoundEngine';

export interface GroupDemandRunDeskProps {
  onClose?: () => void;
  onPledgeRun?: (runId: string, quantity: number) => void;
}

export const GroupDemandRunDesk: React.FC<GroupDemandRunDeskProps> = ({
  onClose,
  onPledgeRun
}) => {
  const [runs, setRuns] = useState<GroupDemandRun[]>(DEMO_DEMAND_RUNS);
  const [selectedRunId, setSelectedRunId] = useState<string>(runs[0]?.id || '');
  const [pledgeCount, setPledgeCount] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeRun = runs.find((r) => r.id === selectedRunId) || runs[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePledge = () => {
    soundEngine.play('victory');
    setRuns((prev) =>
      prev.map((r) =>
        r.id === activeRun.id
          ? {
              ...r,
              currentPledged: Math.min(r.targetQuantity, r.currentPledged + pledgeCount),
              status: r.currentPledged + pledgeCount >= r.targetQuantity ? 'threshold_reached' : r.status
            }
          : r
      )
    );
    showToast(`Pledged ${pledgeCount} bundle(s) for "${activeRun.title}"!`);
    onPledgeRun?.(activeRun.id, pledgeCount);
  };

  const callSupplier = (phone: string, supplierName: string) => {
    soundEngine.play('heavyTap');
    showToast(`Calling verified supplier: ${supplierName}`);
    window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl bg-[#FAFAF8] shadow-2xl overflow-hidden font-sans text-[#1A1F2E]">
      
      {/* ── HEADER ── */}
      <div className="p-6 sm:p-7 bg-gradient-to-br from-[#1A1F2E] via-[#2A3447] to-[#1A1F2E] text-white relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-[#B8621F] text-white tracking-wider">
                COMMUNITY DEMAND AGGREGATION
              </span>
              <span className="text-xs text-gray-300 font-bold flex items-center space-x-1">
                <Truck className="w-3.5 h-3.5 text-[#00BFEF]" />
                <span>Bulk Group Runs</span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2">
              <span>Consolidated Goods & Textbook Desk</span>
            </h2>
            <p className="text-xs text-gray-300 max-w-lg leading-relaxed">
              Parents, teachers, and estate dukas combine purchase volume directly with verified millers & publishers. One delivery to the school or estate gate.
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

        {/* TAB SWITCHER */}
        <div className="flex items-center space-x-2 mt-5 overflow-x-auto no-scrollbar pt-2 border-t border-white/10">
          {runs.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                setSelectedRunId(r.id);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeRun.id === r.id
                  ? 'bg-white text-[#1A1F2E] shadow-md font-black'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {r.groupName.split(' ')[0]} · {r.title.slice(0, 22)}…
            </button>
          ))}
        </div>
      </div>

      {/* ── ACTIVE RUN DETAILS ── */}
      <div className="p-6 sm:p-7 space-y-6">
        
        {/* Main Card */}
        <div className="p-5 rounded-2xl bg-white shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-black uppercase text-[#B8621F] tracking-wide">
                {activeRun.groupName}
              </span>
              <h3 className="text-lg font-black text-[#1A1F2E] leading-snug">
                {activeRun.title}
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  activeRun.status === 'threshold_reached'
                    ? 'bg-emerald-500/15 text-emerald-700'
                    : 'bg-amber-500/15 text-amber-800'
                }`}
              >
                {activeRun.status === 'threshold_reached' ? '✓ Threshold Reached' : '● Pledging Active'}
              </span>
            </div>
          </div>

          <p className="text-xs text-[#6B7280] leading-relaxed">
            {activeRun.itemDescription}
          </p>

          {/* Progress Bar */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[#1A1F2E]">
                {activeRun.currentPledged} of {activeRun.targetQuantity} units committed
              </span>
              <span className="text-[#B8621F]">
                {Math.round((activeRun.currentPledged / activeRun.targetQuantity) * 100)}%
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#B8621F] to-[#E8985E] rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (activeRun.currentPledged / activeRun.targetQuantity) * 100)}%`
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-[#6B7280] block">
              Deadline: {activeRun.deadlineIso}
            </span>
          </div>

          {/* Savings Matrix */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-black/5">
            <div className="p-3 rounded-xl bg-[#F0EDE8]">
              <span className="text-[9px] font-bold text-[#6B7280] block uppercase">Group Wholesale</span>
              <span className="text-sm font-black text-[#1A1F2E]">KES {activeRun.unitWholesaleKes.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F0EDE8]">
              <span className="text-[9px] font-bold text-[#6B7280] block uppercase">Retail Store Price</span>
              <span className="text-sm font-bold text-gray-500 line-through">KES {activeRun.unitRetailKes.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <span className="text-[9px] font-bold text-emerald-800 block uppercase">You Save</span>
              <span className="text-sm font-black text-emerald-700">KES {activeRun.savingsKesPerUnit.toLocaleString()} / unit</span>
            </div>
          </div>
        </div>

        {/* Supplier & Logistics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Supplier */}
          <div className="p-4 rounded-2xl bg-white shadow-sm space-y-2">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-[#0B6E6E]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#1A1F2E]">
                Verified Supplier Depot
              </span>
            </div>
            <p className="text-xs font-bold text-[#1A1F2E]">{activeRun.supplier.name}</p>
            <p className="text-[11px] text-[#6B7280]">{activeRun.supplier.location}</p>

            <button
              type="button"
              onClick={() => callSupplier(activeRun.supplier.phone, activeRun.supplier.name)}
              className="mt-2 w-full py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#1A1F2E] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-[#0B6E6E]" />
              <span>Contact Depot ({activeRun.supplier.phone})</span>
            </button>
          </div>

          {/* WAIRO Carrier */}
          <div className="p-4 rounded-2xl bg-white shadow-sm space-y-2">
            <div className="flex items-center space-x-2">
              <Truck className="w-4 h-4 text-[#B8621F]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#1A1F2E]">
                WAIRO Gate Delivery
              </span>
            </div>
            <p className="text-xs font-bold text-[#1A1F2E]">{activeRun.wairoCarrierInfo?.carrierName}</p>
            <p className="text-[11px] text-[#6B7280]">Vehicle Plate: {activeRun.wairoCarrierInfo?.vehiclePlate}</p>
            <div className="inline-flex items-center space-x-1 text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
              <span>● Scheduled bulk gate drop</span>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="p-5 rounded-2xl bg-[#EFECE6] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-black text-[#1A1F2E]">Pledge Quantity:</span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setPledgeCount((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg bg-white shadow-sm font-black text-sm flex items-center justify-center cursor-pointer"
              >
                -
              </button>
              <span className="w-6 text-center font-mono font-black text-sm">{pledgeCount}</span>
              <button
                type="button"
                onClick={() => setPledgeCount((p) => p + 1)}
                className="w-8 h-8 rounded-lg bg-white shadow-sm font-black text-sm flex items-center justify-center cursor-pointer"
              >
                +
              </button>
            </div>
            <span className="text-xs text-[#6B7280] font-bold">
              Total: KES {(activeRun.unitWholesaleKes * pledgeCount).toLocaleString()}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePledge}
            className="py-3 px-6 rounded-xl bg-[#B8621F] hover:bg-[#9B5118] text-white font-black text-xs uppercase tracking-wider shadow-md transition-transform active:scale-95 cursor-pointer flex items-center justify-center space-x-2"
          >
            <span>Lock In Group Order</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Non-Promise Disclaimer */}
        <div className="p-3.5 rounded-2xl bg-black/[0.03] space-y-1 text-center">
          <p className="text-[10px] text-[#6B7280] leading-relaxed">
            Brief aggregates group demand and connects you directly with verified suppliers. Payments settle directly via M-Pesa. Brief is not the merchant of record and holds zero retail inventory.
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
