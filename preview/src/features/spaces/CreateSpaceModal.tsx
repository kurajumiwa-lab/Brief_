import React, { useEffect, useState } from 'react';
import { X, Sparkles, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import type { Space, SpaceType, SpaceFieldStatus } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { SpaceFieldInputs, type FieldValues } from './SpaceFieldInputs';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// THE GENESIS SET — step 4 asks the operational questions whose answers become
// structured data the pipeline reads: what you sell, how much you can carry,
// when you are on, where, how far, what you CANNOT do, what you need from the
// network, what you give it. They are asked here because a space created without
// them is a container; with them it is an instrument.
//
// Every question comes from the server schema (GET /api/spaces/profile-schema),
// so the wizard and the workspace can never drift apart. Answering is optional —
// and that is stated honestly: an unanswered field is listed in the space's own
// queue as "never answered" instead of being defaulted to a plausible zero.
// ---------------------------------------------------------------------------

/** Only send a field when it actually holds an answer. */
function answeredOnly(values: FieldValues): FieldValues {
  const out: FieldValues = {};
  for (const [key, raw] of Object.entries(values)) {
    const v = raw as Record<string, unknown> | undefined;
    if (!v) continue;
    if (typeof v.text === 'string') { if (v.text.trim().length >= 3) out[key] = { text: v.text.trim() }; continue; }
    if ('value' in v && 'unit' in v) {
      const n = Number(v.value);
      if (Number.isFinite(n) && n > 0 && String(v.unit ?? '').trim()) {
        out[key] = { value: n, unit: String(v.unit).trim(), per: String(v.per ?? 'day').trim() || 'day' };
      }
      continue;
    }
    if ('days' in v || 'summary' in v) {
      const days = Array.isArray(v.days) ? (v.days as string[]) : [];
      const summary = String(v.summary ?? '').trim();
      const from = v.from ? String(v.from) : null;
      const to = v.to ? String(v.to) : null;
      if (days.length || summary) out[key] = { days, summary, from, to };
      continue;
    }
    if ('items' in v) {
      const items = (Array.isArray(v.items) ? (v.items as string[]) : []).map((x) => String(x).trim()).filter(Boolean);
      if (items.length) out[key] = { items: items.slice(0, 12) };
    }
  }
  return out;
}

export interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpaceCreated: (space: Space) => void;
}

const SPACE_OPTIONS: Array<{ type: SpaceType; label: string; desc: string; emoji: string }> = [
  { type: 'business', label: 'Business', desc: 'Shop, bakery, service, or company', emoji: '🍰' },
  { type: 'side_hustle', label: 'Side Hustle', desc: 'Selling products or weekend gigs', emoji: '🌱' },
  { type: 'creator', label: 'Creator Work', desc: 'Music, photography, crafts, or art', emoji: '🎨' },
  { type: 'community', label: 'Community / Circle', desc: 'Savings circle, clan group, or PTA', emoji: '🌸' },
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
  // The questions themselves are server-owned data, not a client-side form spec.
  const [schemaFields, setSchemaFields] = useState<SpaceFieldStatus[]>([]);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [genesis, setGenesis] = useState<FieldValues>({});

  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    void briefApi.getSpaceProfileSchema().then((res) => {
      if (!live) return;
      if (res.ok) setSchemaFields(res.data.fields);
      else setSchemaError(res.error ?? 'The operational questions could not be loaded.');
    });
    return () => { live = false; };
  }, [isOpen]);

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
        targetValueKes: parseInt(targetValueKes, 10) || 0,
        // The genesis answers travel as structured data; the server validates
        // each one and stamps its own timestamp.
        profile: answeredOnly(genesis)
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
        className="w-full max-w-md bg-[color:var(--color-surface)] text-[color:var(--color-text)] rounded-3xl p-6 shadow-2xl space-y-5 animate-slideUp border border-black/5"
      >
        {/* Top Progress & Close */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[color:var(--color-primary)]" />
            <span className="text-[11px] font-mono font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider">
              Step {step} of 5
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
              <h2 className="text-xl font-black text-[color:var(--color-text)]">
                What are you building?
              </h2>
              <p className="text-xs text-[color:var(--color-text-muted)]">
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
                      ? 'bg-[color:var(--color-primary)] text-[color:var(--accent-ink)] border-[color:var(--color-primary)] shadow-sm'
                      : 'bg-[color:var(--color-paper)] text-[color:var(--color-text)] border-black/5 hover:border-black/15'
                  }`}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <div className="mt-2">
                    <span className="font-bold text-xs block leading-tight">
                      {opt.label}
                    </span>
                    <span
                      className={`text-[11px] block mt-0.5 line-clamp-1 ${
                        selectedType === opt.type ? 'text-white/80' : 'text-[color:var(--color-text-muted)]'
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
              className="w-full py-3 rounded-full bg-[color:var(--color-text)] hover:bg-black text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4 text-[color:var(--color-primary)]" />
            </button>
          </div>
        )}

        {/* STEP 2: Name */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-[color:var(--color-text)]">
                What should we call it?
              </h2>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                Give your space a clear, recognizable name.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[color:var(--color-text)]">Space Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amina's Cakes, Kilimani Food Circle"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-[color:var(--color-paper)] border border-black/10 text-sm font-bold text-[color:var(--color-text)] focus:outline-hidden focus:border-[color:var(--color-primary)]"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[color:var(--color-text)] transition-all cursor-pointer"
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
                className="flex-1 py-3 rounded-full bg-[color:var(--color-text)] hover:bg-black text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 text-[color:var(--color-primary)]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Goal */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-[color:var(--color-text)]">
                What do you want to achieve?
              </h2>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                A measurable goal keeps your space focused.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[color:var(--color-text)]">Goal Description</label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Get my first 20 customers"
                  className="w-full px-4 py-2.5 rounded-xl bg-[color:var(--color-paper)] border border-black/10 text-xs font-medium text-[color:var(--color-text)] focus:outline-hidden focus:border-[color:var(--color-primary)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[color:var(--color-text)]">Monthly Target (KES)</label>
                <input
                  type="number"
                  value={targetValueKes}
                  onChange={(e) => setTargetValueKes(e.target.value)}
                  placeholder="100000"
                  className="w-full px-4 py-2.5 rounded-xl bg-[color:var(--color-paper)] border border-black/10 text-xs font-mono font-bold text-[color:var(--color-text)] focus:outline-hidden focus:border-[color:var(--color-primary)]"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[color:var(--color-text)] transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setStep(4);
                }}
                className="flex-1 py-3 rounded-full bg-[color:var(--color-text)] hover:bg-black text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 text-[color:var(--color-primary)]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: the genesis set — operational answers, structured */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-[color:var(--color-text)]">
                What can you actually do?
              </h2>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                These become the fields the pipeline reads when it matches demand to you. Answer what you
                can — anything left blank shows up in your space's queue as unanswered, never as a zero.
              </p>
            </div>

            {schemaError && (
              <p className="text-xs font-bold" style={{ color: 'var(--color-danger)' }}>{schemaError}</p>
            )}
            {!schemaError && schemaFields.length === 0 && (
              <p className="text-xs text-[color:var(--color-text-muted)]">Loading the questions…</p>
            )}

            {schemaFields.length > 0 && (
              <SpaceFieldInputs
                fields={schemaFields}
                values={genesis}
                onChange={(key, value) => setGenesis((g) => ({ ...g, [key]: value }))}
                idPrefix="genesis"
              />
            )}

            {errorMsg && <p className="text-xs text-rose-600 font-bold">{errorMsg}</p>}

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => { soundEngine.play('tap'); setStep(3); }}
                className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[color:var(--color-text)] transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => { setErrorMsg(null); soundEngine.play('tap'); setStep(5); }}
                className="flex-1 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[color:var(--color-text)] transition-all cursor-pointer"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={() => {
                  const n = Object.keys(answeredOnly(genesis)).length;
                  if (n === 0) { setErrorMsg('Answer at least one, or press Skip for now.'); return; }
                  setErrorMsg(null);
                  soundEngine.play('tap');
                  setStep(5);
                }}
                className="flex-1 py-3 rounded-full bg-[color:var(--color-text)] hover:bg-black text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 text-[color:var(--color-primary)]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: What you have & Confirm */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-[color:var(--color-text)]">
                What do you already have?
              </h2>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                Check what's ready so we can connect rails.
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center space-x-3 p-3 rounded-xl bg-[color:var(--color-paper)] border border-black/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasWhatsApp}
                  onChange={(e) => setHasWhatsApp(e.target.checked)}
                  className="rounded text-[color:var(--color-primary)] w-4 h-4"
                />
                <span className="text-xs font-bold text-[color:var(--color-text)]">WhatsApp Customers</span>
              </label>

              <label className="flex items-center space-x-3 p-3 rounded-xl bg-[color:var(--color-paper)] border border-black/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasProducts}
                  onChange={(e) => setHasProducts(e.target.checked)}
                  className="rounded text-[color:var(--color-primary)] w-4 h-4"
                />
                <span className="text-xs font-bold text-[color:var(--color-text)]">Products / Services Ready</span>
              </label>

              <label className="flex items-center space-x-3 p-3 rounded-xl bg-[color:var(--color-paper)] border border-black/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCustomers}
                  onChange={(e) => setHasCustomers(e.target.checked)}
                  className="rounded text-[color:var(--color-primary)] w-4 h-4"
                />
                <span className="text-xs font-bold text-[color:var(--color-text)]">Physical Shop / Stall</span>
              </label>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 font-bold">{errorMsg}</p>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[color:var(--color-text)] transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-full bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-strong)] active:scale-95 text-[color:var(--accent-ink)] font-black text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Creating Space...' : 'Create Space'}</span>
                <Check className="w-4 h-4 text-[color:var(--color-primary)]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateSpaceModal;
