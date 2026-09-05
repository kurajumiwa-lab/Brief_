import React, { useState } from 'react';
import type { SpaceDispatch, SpaceDispatchCreate } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { Truck, X, MapPin, Phone, User, Tag, Sparkles } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface CreateDispatchModalProps {
  isOpen: boolean;
  spaceId: string;
  orderId?: string | null;
  defaultReceiverName?: string;
  defaultReceiverPhone?: string;
  defaultNotes?: string;
  onClose: () => void;
  onDispatchCreated: (dispatch: SpaceDispatch) => void;
}

const COMMON_COUNTIES = [
  'Nakuru',
  'Mombasa',
  'Kisumu',
  'Eldoret / Uasin Gishu',
  'Nyeri',
  'Kiambu',
  'Machakos',
  'Meru',
  'Kakamega',
  'Kisii',
  'Kericho',
  'Nanyuki / Laikipia',
  'Kilifi / Malindi'
];

const POPULAR_CARRIERS = [
  '2NK Sacco',
  'Easy Coach',
  'Mololine Shuttle',
  'Transline Galaxy',
  'Guardian Coach',
  'North Rift Shuttle',
  '4NTE Sacco',
  'Modern Coast',
  'Great Rift Shuttle',
  'Direct Boda / Local Rider'
];

export const CreateDispatchModal: React.FC<CreateDispatchModalProps> = ({
  isOpen,
  spaceId,
  orderId = null,
  defaultReceiverName = '',
  defaultReceiverPhone = '',
  defaultNotes = '',
  onClose,
  onDispatchCreated
}) => {
  const [destinationCounty, setDestinationCounty] = useState<string>('Nakuru');
  const [destinationTown, setDestinationTown] = useState<string>('Nakuru Town Stage');
  const [carrierSacco, setCarrierSacco] = useState<string>('2NK Sacco');
  const [receiverName, setReceiverName] = useState<string>(defaultReceiverName);
  const [receiverPhone, setReceiverPhone] = useState<string>(defaultReceiverPhone);
  const [conductorContact, setConductorContact] = useState<string>('');
  const [stageFeeKes, setStageFeeKes] = useState<string>('300');
  const [notes, setNotes] = useState<string>(defaultNotes || 'Fragile parcel, handle with care');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationCounty.trim() || !destinationTown.trim() || !receiverName.trim() || !receiverPhone.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    soundEngine.play('reward');
    try {
      const res = await briefApi.createSpaceDispatch(spaceId, {
        orderId,
        destinationCounty: destinationCounty.trim(),
        destinationTown: destinationTown.trim(),
        carrierSacco: carrierSacco.trim(),
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        conductorContact: conductorContact.trim(),
        stageFeeKes: Number(stageFeeKes || 0),
        notes: notes.trim()
      });

      if (res.ok && res.data?.dispatch) {
        onDispatchCreated(res.data.dispatch);
        onClose();
      }
    } catch (err) {
      console.error('Failed to create dispatch:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scaleIn border border-black/5">
        {/* Header */}
        <div className="p-5 bg-[#FAFAF8] flex items-center justify-between border-b border-black/5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1A1F2E] text-[#93EE34] flex items-center justify-center font-bold">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#1A1F2E]">
                WAIRO Cargo Dispatch
              </h3>
              <p className="text-[10px] text-[#64748B]">
                Inter-County Matatu Sacco & Courier Waybill
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#64748B] hover:text-[#1A1F2E] hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {/* Destination */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#1A1F2E] flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-[#5B2EA6]" />
              <span>Destination Stage</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={destinationCounty}
                onChange={(e) => setDestinationCounty(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
              >
                {COMMON_COUNTIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Town / Stage (e.g. KFA Stage)"
                value={destinationTown}
                onChange={(e) => setDestinationTown(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Carrier Sacco */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#1A1F2E]">Carrier / Matatu Sacco</label>
            <select
              value={carrierSacco}
              onChange={(e) => setCarrierSacco(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
            >
              {POPULAR_CARRIERS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Receiver Info */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#1A1F2E]">Receiver Name</label>
              <input
                type="text"
                placeholder="e.g. Mary Wanjiku"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#1A1F2E]">Receiver Phone</label>
              <input
                type="tel"
                placeholder="e.g. 254712345678"
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Conductor & Fee */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#1A1F2E]">Conductor Contact (Optional)</label>
              <input
                type="tel"
                placeholder="e.g. 254722000111"
                value={conductorContact}
                onChange={(e) => setConductorContact(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#1A1F2E]">Stage Parcel Fee (KES)</label>
              <input
                type="number"
                placeholder="300"
                value={stageFeeKes}
                onChange={(e) => setStageFeeKes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#1A1F2E]">Parcel Notes</label>
            <input
              type="text"
              placeholder="e.g. 2-Tier Birthday Cake, handle with care"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-2xl bg-[#1A1F2E] hover:bg-black text-[#93EE34] font-black text-xs transition-all shadow-md cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Truck className="w-4 h-4" />
              <span>{submitting ? 'Generating Waybill...' : 'Generate Waybill & Dispatch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDispatchModal;
