import React, { useState } from 'react';
import { X, Tag, Sparkles, Check, ImagePlus } from 'lucide-react';
import type { Listing } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { ImageField } from '../../components/ImageField';
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
  /** Uploaded photos. Held as media ids/urls exactly as the server returns them. */
  const [images, setImages] = useState<string[]>([]);
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
        type: 'product',
        // Named `images` on this rail and mapped to the listing's `media` by
        // the server (space.js) — that mapping used to be wrong and the photos
        // were silently dropped, which is why no offer had a picture.
        images
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
        className="w-full max-w-md bg-[color:var(--color-surface)] text-[color:var(--color-text)] rounded-3xl p-6 shadow-2xl space-y-5 animate-slideUp border border-black/5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Tag className="w-5 h-5 text-[color:var(--color-primary)]" />
            <h2 className="text-xl font-black text-[color:var(--color-text)]">
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
            <label className="text-xs font-bold text-[color:var(--color-text)]">What are you offering?</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Birthday Cake, Wedding Photography"
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-[color:var(--color-paper)] border border-black/10 text-xs font-bold text-[color:var(--color-text)] focus:outline-hidden focus:border-[color:var(--color-primary)]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[color:var(--color-text)]">Price (KES)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="4500"
              className="w-full px-4 py-2.5 rounded-xl bg-[color:var(--color-paper)] border border-black/10 text-xs font-mono font-bold text-[color:var(--color-text)] focus:outline-hidden focus:border-[color:var(--color-primary)]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[color:var(--color-text)]">Tell people about it</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Custom birthday cake for 10-15 people. Vanilla sponge with strawberry butter cream."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-[color:var(--color-paper)] border border-black/10 text-xs text-[color:var(--color-text)] focus:outline-hidden focus:border-[color:var(--color-primary)]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-[color:var(--color-text)]">
              <ImagePlus className="w-3.5 h-3.5" /> Photos of the actual goods
            </label>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {images.map((src, i) => (
                  <div key={`${src}-${i}`} className="relative">
                    <img src={src} alt="" className="h-16 w-20 rounded-xl object-cover border border-black/10" />
                    <button
                      type="button"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => setImages((v) => v.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-[#0A0E14] p-1 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <ImageField
              compact
              multiple
              label={images.length ? 'Add more' : 'Choose photos'}
              hint="A photo of these goods. Nothing here is a stock image: an offer with no photo shows no photo."
              onAdd={(url) => setImages((v) => (v.includes(url) ? v : [...v, url]))}
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={publishImmediately}
                onChange={(e) => setPublishImmediately(e.target.checked)}
                className="rounded text-[color:var(--color-primary)] w-4 h-4"
              />
              <span className="text-xs font-bold text-[color:var(--color-text)]">Publish immediately (Make public)</span>
            </label>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 font-bold">{errorMsg}</p>
          )}

          <div className="pt-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[color:var(--color-text)] transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-full bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-strong)] active:scale-95 text-[color:var(--accent-ink)] font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Saving...' : 'Publish Offer'}</span>
              <Check className="w-4 h-4 text-[color:var(--color-primary)]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOfferModal;
