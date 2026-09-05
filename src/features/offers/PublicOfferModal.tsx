import React, { useState } from 'react';
import { X, Tag, MessageCircle, ShoppingBag, Check, CheckCircle2, DollarSign } from 'lucide-react';
import type { Listing } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { soundEngine } from '../../utils/SoundEngine';

export interface PublicOfferModalProps {
  isOpen: boolean;
  offer: Listing | null;
  spaceName?: string;
  onClose: () => void;
  onInquirySent?: () => void;
}

export const PublicOfferModal: React.FC<PublicOfferModalProps> = ({
  isOpen,
  offer,
  spaceName = "Amina's Cakes",
  onClose,
  onInquirySent
}) => {
  const [customerName, setCustomerName] = useState<string>('');
  const [contact, setContact] = useState<string>('');
  const [message, setMessage] = useState<string>('Can you make it for Saturday?');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSent, setIsSent] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !offer) return null;

  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMsg('Please enter your name');
      return;
    }
    if (!message.trim()) {
      setErrorMsg('Please enter a message');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const spaceId = (offer as any).spaceId || 'spc_default';
      const res = await briefApi.createSpaceConversation(spaceId, {
        offerId: offer.id,
        customerName: customerName.trim(),
        customerContact: contact.trim(),
        message: message.trim()
      });

      if (res.ok) {
        soundEngine.play('heavyTap');
        setIsSent(true);
        onInquirySent?.();
        setTimeout(() => {
          setIsSent(false);
          setIsAsking(false);
          onClose();
        }, 2000);
      } else {
        setErrorMsg((res as any).error || 'Failed to send message');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#FAFAF8] text-[#1A1F2E] rounded-3xl overflow-hidden shadow-2xl animate-slideUp border border-black/5 flex flex-col max-h-[90vh]"
      >
        {/* Cover image or placeholder */}
        <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-6 flex flex-col justify-between text-white">
          <div className="flex items-center justify-between z-10">
            <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-[10px] font-mono font-bold backdrop-blur-md">
              VERIFIED OFFER
            </span>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1 z-10">
            <span className="text-2xl sm:text-3xl font-black text-white block">
              {offer.currency || 'KES'} {(offer.price || 0).toLocaleString()}
            </span>
            <div className="flex items-center space-x-1.5 text-xs text-gray-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#93EE34]" />
              <span>{spaceName}</span>
            </div>
          </div>
        </div>

        {/* Details & Actions */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-[#1A1F2E]">
              {offer.title}
            </h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              {offer.description || 'Direct offer from verified creator.'}
            </p>
          </div>

          {/* Ask / Inquire Form */}
          {isAsking ? (
            <form onSubmit={handleSendInquiry} className="space-y-3 pt-2 border-t border-black/5 animate-fadeIn">
              <span className="text-xs font-bold text-[#1A1F2E] block">
                Message {spaceName}:
              </span>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#64748B]">Your Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Mary"
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-black/10 text-xs font-bold text-[#1A1F2E] focus:outline-hidden focus:border-[#5B2EA6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#64748B]">WhatsApp Phone</label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="+254 700 000 000"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-black/10 text-xs font-mono text-[#1A1F2E] focus:outline-hidden focus:border-[#5B2EA6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#64748B]">Your Question</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-black/10 text-xs text-[#1A1F2E] focus:outline-hidden focus:border-[#5B2EA6]"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-600 font-bold">{errorMsg}</p>
              )}

              {isSent ? (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Message sent to {spaceName}!</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAsking(false)}
                    className="px-4 py-2 rounded-full bg-gray-100 text-xs font-bold text-[#1A1F2E]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-full bg-[#5B2EA6] hover:bg-[#4A238A] text-white font-bold text-xs shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Sending...' : 'Send Inquiry'}</span>
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div className="pt-2 flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setIsAsking(true);
                }}
                className="flex-1 py-3 rounded-full bg-white hover:bg-gray-50 border border-black/10 text-[#1A1F2E] font-bold text-xs shadow-2xs flex items-center justify-center space-x-2 cursor-pointer transition-transform active:scale-95"
              >
                <MessageCircle className="w-4 h-4 text-[#5B2EA6]" />
                <span>Ask about this</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.play('heavyTap');
                  setIsAsking(true);
                }}
                className="flex-1 py-3 rounded-full bg-[#5B2EA6] hover:bg-[#4A238A] text-white font-black text-xs shadow-sm flex items-center justify-center space-x-2 cursor-pointer transition-transform active:scale-95"
              >
                <ShoppingBag className="w-4 h-4 text-[#93EE34]" />
                <span>Order Now</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicOfferModal;
