import React, { useState } from 'react';
import { X, Tag, Sparkles, Check } from 'lucide-react';
import type { Listing } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { soundEngine } from '../../utils/SoundEngine';

export interface CreateOfferModalProps {
  isOpen: boolean;
  spaceId: string;
  onClose: () => void;
  onOfferCreated: (offer: Listing) => void;
}

export const CreateOfferModal: React.FC<CreateOfferModalProps> = ({
  isOpen,
  spaceId,
  onClose,
  onOfferCreated
}) => {
  const [title, setTitle] = useState<string>('');
  const [price, setPrice] = useState<string>('4500');
  const [description, setDescription] = useState<string>('');
  const [publishImmediately, setPublishImmediately] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please name your offer');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMsg('Please enter a valid price');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const createRes = await briefApi.createSpaceOffer(spaceId, {
        title: title.trim(),
        price: priceNum,
        description: description.trim(),
        currency: 'KES',
        type: 'product'
      });

      if (!createRes.ok || !createRes.data?.offer) {
        setErrorMsg((createRes as any).error || 'Failed to create offer');
        setIsSubmitting(false);
        return;
      }

      let finalOffer = createRes.data.offer;

      if (publishImmediately) {
        const pubRes = await briefApi.publishSpaceOffer(spaceId, finalOffer.id);
        if (pubRes.ok && pubRes.data?.offer) {
          finalOffer = pubRes.data.offer;
        }
      }

      soundEngine.play('heavyTap');
      onOfferCreated(finalOffer);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error creating offer');
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
        className="w-full max-w-md bg-[#FAFAF8] text-[#1A1F2E] rounded-3xl p-6 shadow-2xl space-y-5 animate-slideUp border border-black/5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Tag className="w-5 h-5 text-[#5B2EA6]" />
            <h2 className="text-xl font-black text-[#1A1F2E]">
              Create Offer
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1A1F2E]">What are you offering?</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Birthday Cake, Wedding Photography"
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-xs font-bold text-[#1A1F2E] focus:outline-hidden focus:border-[#5B2EA6]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1A1F2E]">Price (KES)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="4500"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-xs font-mono font-bold text-[#1A1F2E] focus:outline-hidden focus:border-[#5B2EA6]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1A1F2E]">Tell people about it</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Custom birthday cake for 10-15 people. Vanilla sponge with strawberry butter cream."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-xs text-[#1A1F2E] focus:outline-hidden focus:border-[#5B2EA6]"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={publishImmediately}
                onChange={(e) => setPublishImmediately(e.target.checked)}
                className="rounded text-[#5B2EA6] w-4 h-4"
              />
              <span className="text-xs font-bold text-[#1A1F2E]">Publish immediately (Make public)</span>
            </label>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 font-bold">{errorMsg}</p>
          )}

          <div className="pt-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#1A1F2E] transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-full bg-[#5B2EA6] hover:bg-[#4A238A] active:scale-95 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Saving...' : 'Publish Offer'}</span>
              <Check className="w-4 h-4 text-[#93EE34]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOfferModal;
