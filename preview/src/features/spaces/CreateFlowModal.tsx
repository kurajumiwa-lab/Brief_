import React, { useState } from 'react';
import type { Space, SpaceType } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { X, Sparkles, Store, Briefcase, Tag, Users, ArrowRight, Check } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface CreateFlowModalProps {
  isOpen: boolean;
  initialStep?: 1 | 2;
  existingSpaceId?: string | null;
  onClose: () => void;
  onCompleted: (space: Space) => void;
}

const SPACE_OPTIONS: Array<{ id: SpaceType; title: string; desc: string; icon: any }> = [
  { id: 'business', title: 'Business', desc: 'Bakery, shop, catering, physical store', icon: Store },
  { id: 'side_hustle', title: 'Side Hustle', desc: 'Home-based selling, WhatsApp commerce', icon: Briefcase },
  { id: 'creator', title: 'Creator Work', desc: 'Bespoke crafts, services, content', icon: Tag },
  { id: 'community', title: 'Community & Co-op', desc: 'Chama, group projects, circular funds', icon: Users }
];

export const CreateFlowModal: React.FC<CreateFlowModalProps> = ({
  isOpen,
  initialStep = 1,
  existingSpaceId = null,
  onClose,
  onCompleted
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(existingSpaceId ? 2 : initialStep);

  // Step 1: Space details
  const [name, setName] = useState('');
  const [type, setType] = useState<SpaceType>('side_hustle');
  const [goal, setGoal] = useState('Get my first 20 customers');

  // Step 2: First Offer details
  const [offerTitle, setOfferTitle] = useState('Birthday Cake');
  const [offerPrice, setOfferPrice] = useState('4500');
  const [offerDescription, setOfferDescription] = useState('Custom 2-tier celebration cake, baked fresh');
  const [offerType, setOfferType] = useState<'product' | 'service'>('product');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFinish = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    soundEngine.play('reward');

    try {
      if (existingSpaceId) {
        // Just adding offer to existing space
        const offerRes = await briefApi.createSpaceOffer(existingSpaceId, {
          title: offerTitle.trim(),
          price: Number(offerPrice) || 0,
          description: offerDescription.trim(),
          type: offerType,
          currency: 'KES'
        });

        if (offerRes.ok && offerRes.data?.offer) {
          // Publish offer
          await briefApi.publishSpaceOffer(existingSpaceId, offerRes.data.offer.id);
          const spaceRes = await briefApi.getSpace(existingSpaceId);
          if (spaceRes.ok && spaceRes.data?.space) {
            onCompleted(spaceRes.data.space);
            onClose();
          }
        }
      } else {
        // Create Space + First Offer combined
        const res = await briefApi.createSpace({
          name: name.trim(),
          type,
          goal: goal.trim(),
          initialOffer: {
            title: offerTitle.trim(),
            description: offerDescription.trim(),
            price: Number(offerPrice),
            currency: 'KES',
            type: offerType
          }
        });

        if (res.ok && res.data?.space) {
          const createdSpace = res.data.space;
          // Publish the specific initial offer the server created. Do NOT
          // guess `offers[0]` — a space shares the owner's vendor, so the
          // first offer in the list may be a pre-existing listing.
          const offerId = (createdSpace as any).initialOfferId
            ?? createdSpace.offers?.[0]?.id;
          if (offerId) {
            await briefApi.publishSpaceOffer(createdSpace.id, offerId);
          }
          onCompleted(createdSpace);
          onClose();
        } else {
          setErrorMsg((res as any).error || 'Failed to create space');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-scaleIn border border-black/5">
        {/* Progress Bar */}
        <div className="w-full bg-[color:var(--color-surface)] h-1.5">
          <div
            className="bg-[color:var(--color-primary)] h-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Modal Header */}
        <div className="p-5 bg-[color:var(--color-surface)] flex items-center justify-between border-b border-black/5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[color:var(--color-primary)]">
                Step {step} of 3
              </span>
            </div>
            <h3 className="text-base font-black text-[color:var(--color-text)]">
              {step === 1 && 'What are you building?'}
              {step === 2 && 'Add your first Offer'}
              {step === 3 && 'Ready to Publish'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
              {errorMsg}
            </div>
          )}

          {/* STEP 1: SPACE TYPE & NAME */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-2.5">
                {SPACE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = type === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        soundEngine.play('tap');
                        setType(opt.id);
                      }}
                      className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[color:var(--color-primary-subtle)] border-[color:var(--color-primary)] shadow-2xs'
                          : 'bg-[color:var(--color-surface)] border-black/5 hover:bg-black/5'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-[color:var(--color-primary)]' : 'text-[color:var(--color-text-muted)]'}`} />
                      <p className="text-xs font-bold text-[color:var(--color-text)]">{opt.title}</p>
                      <p className="text-[10px] text-[color:var(--color-text-muted)] leading-tight mt-0.5">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[color:var(--color-text)]">Space Name</label>
                <input
                  type="text"
                  placeholder="e.g. Amina's Cakes, Zawadi Leather"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[color:var(--color-text)]">Primary Goal</label>
                <input
                  type="text"
                  placeholder="e.g. Get my first 20 customers, Reach KES 100k revenue"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setStep(2);
                }}
                className="w-full py-2.5 rounded-2xl bg-[color:var(--color-text)] hover:bg-black text-[color:var(--color-primary)] text-xs font-black transition-all cursor-pointer flex items-center justify-center space-x-1"
              >
                <span>Continue to First Offer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: FIRST OFFER */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[color:var(--color-text)]">Offer Title</label>
                <input
                  type="text"
                  placeholder="e.g. Birthday Cake, Custom Dress, Makeup Session"
                  value={offerTitle}
                  onChange={(e) => setOfferTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[color:var(--color-text)]">Price (KES)</label>
                  <input
                    type="number"
                    placeholder="4500"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[color:var(--color-text)]">Type</label>
                  <select
                    value={offerType}
                    onChange={(e) => setOfferType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none"
                  >
                    <option value="product">Product (Goods)</option>
                    <option value="service">Service (Skill / Booking)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[color:var(--color-text)]">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description for customers on WhatsApp and web"
                  value={offerDescription}
                  onChange={(e) => setOfferDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
                />
              </div>

              <div className="flex items-center gap-2">
                {!existingSpaceId && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="py-2.5 px-4 rounded-2xl bg-[color:var(--color-surface)] hover:bg-black/5 text-[color:var(--color-text-muted)] text-xs font-bold transition-all cursor-pointer"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('tap');
                    setStep(3);
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-[color:var(--color-text)] hover:bg-black text-[color:var(--color-primary)] text-xs font-black transition-all cursor-pointer flex items-center justify-center space-x-1"
                >
                  <span>Preview & Publish</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & PUBLISH */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-[color:var(--color-primary-subtle)] border border-[color:var(--color-primary)] space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[color:var(--color-text)]">
                  Ready to Launch
                </span>
                <p className="text-sm font-black text-[color:var(--color-text)]">
                  {name || 'Your business name'}
                </p>
                <div className="p-3 rounded-xl bg-white shadow-xs border border-black/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[color:var(--color-text)]">{offerTitle}</span>
                    <span className="text-xs font-black text-[color:var(--color-text)]">
                      KES {Number(offerPrice || 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-[color:var(--color-text-muted)]">{offerDescription}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-2.5 px-4 rounded-2xl bg-[color:var(--color-surface)] hover:bg-black/5 text-[color:var(--color-text-muted)] text-xs font-bold transition-all cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-2xl bg-[color:var(--color-text)] hover:bg-black text-[color:var(--color-primary)] text-xs font-black transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{submitting ? 'Launching...' : 'Publish Space & Offer'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateFlowModal;
