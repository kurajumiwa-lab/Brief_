import React, { useState, useEffect } from 'react';
import type { SpaceDispatch, SpaceDispatchStatus } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { CreateDispatchModal } from './CreateDispatchModal';
import {
  Truck,
  MapPin,
  Phone,
  MessageCircle,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  Package,
  Info
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface SpaceDispatchesProps {
  spaceId: string;
  spaceName?: string;
  onRefresh?: () => void;
  className?: string;
}

export const SpaceDispatches: React.FC<SpaceDispatchesProps> = ({
  spaceId,
  spaceName = 'Space',
  onRefresh,
  className = ''
}) => {
  const [dispatches, setDispatches] = useState<SpaceDispatch[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadDispatches = async () => {
    if (!spaceId) return;
    setLoading(true);
    try {
      const res = await briefApi.getSpaceDispatches(spaceId);
      if (res.ok && res.data?.dispatches) {
        setDispatches(res.data.dispatches);
      }
    } catch (err) {
      console.error('Failed to load dispatches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDispatches();
  }, [spaceId]);

  const handleUpdateStatus = async (dispatchId: string, nextStatus: SpaceDispatchStatus) => {
    soundEngine.play('reward');
    try {
      await briefApi.updateSpaceDispatchStatus(spaceId, dispatchId, { status: nextStatus });
      showToast(`Status updated to ${nextStatus.replace('_', ' ')}`);
      loadDispatches();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to update dispatch status:', err);
    }
  };

  const handleShareTracking = (d: SpaceDispatch) => {
    soundEngine.play('tap');
    const msg = encodeURIComponent(
      `Habari ${d.receiverName}! Your parcel from ${spaceName} was dispatched via ${d.carrierSacco} to ${d.destinationTown} (${d.destinationCounty}). Waybill: ${d.waybillRef}${d.conductorContact ? `. Conductor contact: ${d.conductorContact}` : ''}. Asante sana!`
    );
    const phone = d.receiverPhone.replace(/[^\d]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
    showToast(`WhatsApp tracking prepared for ${d.receiverName}`);
  };

  const statusColors: Record<SpaceDispatchStatus, { bg: string; text: string; label: string }> = {
    staged: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Staged at Sacco' },
    in_transit: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Transit on Road' },
    ready_at_stage: { bg: 'bg-[#93EE34]/30', text: 'text-[#1A1F2E]', label: 'Ready at Destination Stage' },
    collected: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Collected by Receiver' },
    cancelled: { bg: 'bg-rose-100', text: 'text-rose-800', label: 'Cancelled' }
  };

  return (
    <section className={`space-y-4 ${className}`}>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Truck className="w-4 h-4 text-[#1A1F2E]" />
          <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F2E]">
            Inter-County Cargo Dispatches ({dispatches.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={() => {
            soundEngine.play('heavyTap');
            setCreateModalOpen(true);
          }}
          className="px-3 py-1.5 rounded-full bg-[#1A1F2E] hover:bg-black text-[#93EE34] font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Dispatch Parcel</span>
        </button>
      </div>

      {/* Dispatches List */}
      {dispatches.length === 0 ? (
        <div className="p-6 rounded-3xl bg-white border border-black/5 text-center space-y-2 shadow-sm">
          <Truck className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
          <p className="text-xs font-bold text-[#1A1F2E]">No cargo dispatches recorded yet</p>
          <p className="text-[11px] text-[#64748B] max-w-sm mx-auto">
            Connect your home-baked cakes and goods to cross-county distribution stages (2NK, Easy Coach, Mololine).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {dispatches.map((d) => {
            const sc = statusColors[d.status] || statusColors.in_transit;

            return (
              <div
                key={d.id}
                className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-3"
              >
                {/* Top Row: Waybill & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black text-[#1A1F2E] font-mono">
                        {d.waybillRef}
                      </span>
                      <span className="text-[10px] font-bold text-[#5B2EA6] bg-[#5B2EA6]/10 px-2 py-0.5 rounded-full">
                        {d.carrierSacco}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#1A1F2E] mt-1 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700 inline shrink-0" />
                      <span>{d.destinationTown} ({d.destinationCounty})</span>
                    </p>
                  </div>

                  <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${sc.bg} ${sc.text}`}>
                    {sc.label}
                  </span>
                </div>

                {/* Receiver details */}
                <div className="p-3 rounded-2xl bg-[#FAFAF8] text-[11px] space-y-1 text-[#64748B]">
                  <p>
                    <strong className="text-[#1A1F2E]">Receiver:</strong> {d.receiverName} ({d.receiverPhone})
                  </p>
                  {d.conductorContact && (
                    <p>
                      <strong className="text-[#1A1F2E]">Conductor Contact:</strong> {d.conductorContact}
                    </p>
                  )}
                  {d.notes && (
                    <p className="italic text-[#1A1F2E]/80">
                      "{d.notes}"
                    </p>
                  )}
                  {d.stageFeeKes > 0 && (
                    <p className="text-[10px] font-mono text-[#1A1F2E]">
                      Parcel Stage Fee: KES {d.stageFeeKes.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 gap-2">
                  <button
                    type="button"
                    onClick={() => handleShareTracking(d)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Share WhatsApp Tracking</span>
                  </button>

                  <div className="flex items-center space-x-1.5">
                    {d.status === 'in_transit' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(d.id, 'ready_at_stage')}
                        className="px-2.5 py-1.5 rounded-xl bg-[#93EE34]/20 hover:bg-[#93EE34]/40 text-[#1A1F2E] text-[10px] font-extrabold transition-all cursor-pointer"
                      >
                        Mark Ready at Stage
                      </button>
                    )}
                    {d.status === 'ready_at_stage' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(d.id, 'collected')}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold transition-all cursor-pointer"
                      >
                        Mark Collected
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {createModalOpen && (
        <CreateDispatchModal
          isOpen={createModalOpen}
          spaceId={spaceId}
          onClose={() => setCreateModalOpen(false)}
          onDispatchCreated={(dispatch) => {
            showToast(`Waybill ${dispatch.waybillRef} generated!`);
            loadDispatches();
            onRefresh?.();
          }}
        />
      )}
    </section>
  );
};

export default SpaceDispatches;
