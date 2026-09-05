import React, { useState } from 'react';
import { X, Sparkles, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import type { Space, SpaceType } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { soundEngine } from '../../utils/SoundEngine';

export interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpaceCreated: (space: Space) => void;
}

const SPACE_OPTIONS: Array<{ type: SpaceType; label: string; desc: string; emoji: string }> = [
  { type: 'business', label: 'Business', desc: 'Shop, bakery, service, or company', emoji: '🍰' },
  { type: 'side_hustle', label: 'Side Hustle', desc: 'Selling products or weekend gigs', emoji: '🌱' },
  { type: 'creator', label: 'Creator Work', desc: 'Music, photography, crafts, or art', emoji: '🎨' },
  { type: 'community', label: 'Community / Chama', desc: 'Savings circle, clan group, or PTA', emoji: '🌸' },
  { type: 'event', label: 'Event / Gathering', desc: 'Market, tournament, or celebration', emoji: '🎉' },
  { type: 'project', label: 'Project', desc: 'Campaign, build, or initiative', emoji: '🚀' }
];

export const CreateSpaceModal: React.FC<CreateSpaceModalProps> = ({
  isOpen,
  onClose,
  onSpaceCreated
}) => {
  const [step, setStep] = useState<number>(1);
  const [selectedType, setSelectedType] = useState<SpaceType>('business');
  const [name, setName] = useState<string>('');
  const [goal, setGoal] = useState<string>('');
  const [targetValueKes, setTargetValueKes] = useState<string>('100000');
  const [hasWhatsApp, setHasWhatsApp] = useState<boolean>(true);
  const [hasProducts, setHasProducts] = useState<boolean>(true);
  const [hasCustomers, setHasCustomers] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErrorMsg('Please give your space a name');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await briefApi.createSpace({
        name: name.trim(),
        type: selectedType,
        goal: goal.trim() || 'Get first customers',
        targetValueKes: parseInt(targetValueKes, 10) || 0
      });

      if (res.ok && res.data?.space) {
        soundEngine.play('heavyTap');
        onSpaceCreated(res.data.space);
        onClose();
      } else {
        setErrorMsg((res as any).error || 'Failed to create space. Please try again.');
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
        className="w-full max-w-md bg-[#FAFAF8] text-[#1A1F2E] rounded-3xl p-6 shadow-2xl space-y-5 animate-slideUp border border-black/5"
      >
        {/* Top Progress & Close */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#5B2EA6]" />
            <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider">
              Step {step} of 4
            </span>
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

        {/* STEP 1: What are you building? */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-[#1A1F2E]">
                What are you building?
              </h2>
              <p className="text-xs text-[#64748B]">
                Brief will assemble the right tools and rails for your goal.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {SPACE_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    soundEngine.play('tap');
                    setSelectedType(opt.type);
                  }}
                  className={`p-3 rounded-2xl text-left transition-all border cursor-pointer flex flex-col justify-between ${
                    selectedType === opt.type
                      ? 'bg-[#5B2EA6] text-white border-[#5B2EA6] shadow-sm'
                      : 'bg-white text-[#1A1F2E] border-black/5 hover:border-black/15'
                  }`}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <div className="mt-2">
                    <span className="font-bold text-xs block leading-tight">
                      {opt.label}
                    </span>
                    <span
                      className={`text-[10px] block mt-0.5 line-clamp-1 ${
                        selectedType === opt.type ? 'text-white/80' : 'text-[#64748B]'
                      }`}
                    >
                      {opt.desc}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('tap');
                setStep(2);
              }}
              className="w-full py-3 rounded-full bg-[#1A1F2E] hover:bg-black text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4 text-[#93EE34]" />
            </button>
          </div>
        )}

        {/* STEP 2: Name */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-[#1A1F2E]">
                What should we call it?
              </h2>
              <p className="text-xs text-[#64748B]">
                Give your space a clear, recognizable name.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1A1F2E]">Space Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amina's Cakes, Kilimani Food Circle"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white border border-black/10 text-sm font-bold text-[#1A1F2E] focus:outline-hidden focus:border-[#5B2EA6]"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#1A1F2E] transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    setErrorMsg('Please enter a name');
                    return;
                  }
                  setErrorMsg(null);
                  soundEngine.play('tap');
                  setStep(3);
                }}
                className="flex-1 py-3 rounded-full bg-[#1A1F2E] hover:bg-black text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 text-[#93EE34]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Goal */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-[#1A1F2E]">
                What do you want to achieve?
              </h2>
              <p className="text-xs text-[#64748B]">
                A measurable goal keeps your space focused.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1A1F2E]">Goal Description</label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Get my first 20 customers"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-xs font-medium text-[#1A1F2E] focus:outline-hidden focus:border-[#5B2EA6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1A1F2E]">Monthly Target (KES)</label>
                <input
                  type="number"
                  value={targetValueKes}
                  onChange={(e) => setTargetValueKes(e.target.value)}
                  placeholder="100000"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-xs font-mono font-bold text-[#1A1F2E] focus:outline-hidden focus:border-[#5B2EA6]"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#1A1F2E] transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setStep(4);
                }}
                className="flex-1 py-3 rounded-full bg-[#1A1F2E] hover:bg-black text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 text-[#93EE34]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: What you have & Confirm */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-[#1A1F2E]">
                What do you already have?
              </h2>
              <p className="text-xs text-[#64748B]">
                Check what's ready so we can connect rails.
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center space-x-3 p-3 rounded-xl bg-white border border-black/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasWhatsApp}
                  onChange={(e) => setHasWhatsApp(e.target.checked)}
                  className="rounded text-[#5B2EA6] w-4 h-4"
                />
                <span className="text-xs font-bold text-[#1A1F2E]">WhatsApp Customers</span>
              </label>

              <label className="flex items-center space-x-3 p-3 rounded-xl bg-white border border-black/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasProducts}
                  onChange={(e) => setHasProducts(e.target.checked)}
                  className="rounded text-[#5B2EA6] w-4 h-4"
                />
                <span className="text-xs font-bold text-[#1A1F2E]">Products / Services Ready</span>
              </label>

              <label className="flex items-center space-x-3 p-3 rounded-xl bg-white border border-black/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCustomers}
                  onChange={(e) => setHasCustomers(e.target.checked)}
                  className="rounded text-[#5B2EA6] w-4 h-4"
                />
                <span className="text-xs font-bold text-[#1A1F2E]">Physical Shop / Stall</span>
              </label>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 font-bold">{errorMsg}</p>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#1A1F2E] transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-full bg-[#5B2EA6] hover:bg-[#4A238A] active:scale-95 text-white font-black text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Creating Space...' : 'Create Space'}</span>
                <Check className="w-4 h-4 text-[#93EE34]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateSpaceModal;
