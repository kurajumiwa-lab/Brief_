import React, { useState } from 'react';
import {
  ShieldCheck,
  Video,
  CheckCircle2,
  CircleAlert,
  Crosshair,
  User,
  Lock,
  Sparkles,
  ArrowRight,
  X,
  RefreshCw,
  Eye,
  Globe,
  FileText,
  Smartphone,
  Check,
  BadgeCheck
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export type DocType = 'national_id' | 'passport' | 'alien_card' | 'military_id';

export interface SmileKycResult {
  isVerified: boolean;
  idNumber: string;
  fullName: string;
  docType: DocType;
  country: string;
  confidenceScore: number;
  livenessPassed: boolean;
  iprsMatched: boolean;
  smileJobId: string;
  certificateRef: string;
  verifiedAt: string;
}

export interface SmileIdKycModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerificationComplete?: (result: SmileKycResult) => void;
  initialDocType?: DocType;
  targetRole?: 'general' | 'driver_logbook' | 'chama_signatory' | 'vendor_seller';
}

export const SmileIdKycModal: React.FC<SmileIdKycModalProps> = ({
  isOpen,
  onClose,
  onVerificationComplete,
  initialDocType = 'national_id',
  targetRole = 'general'
}) => {
  const [step, setStep] = useState<'input' | 'liveness' | 'processing' | 'success'>('input');
  const [docType, setDocType] = useState<DocType>(initialDocType);
  const [country, setCountry] = useState<string>('Kenya 🇰🇪');
  const [idNumber, setIdNumber] = useState<string>('29481920');
  const [fullName, setFullName] = useState<string>('Dennis Kimani');
  const [dob, setDob] = useState<string>('1994-08-14');

  // Liveness & Processing State
  const [livenessStage, setLivenessStage] = useState<'center' | 'turn_left' | 'turn_right' | 'blink' | 'captured'>('center');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStatusText, setProcessingStatusText] = useState<string>('Connecting to Smile Identity Gateway...');
  const [kycResult, setKycResult] = useState<SmileKycResult | null>(null);

  if (!isOpen) return null;

  const startLivenessCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idNumber.trim()) return;
    soundEngine.play('heavyTap');
    setStep('liveness');
    setLivenessStage('center');

    // Simulate 3D Smart Selfie Liveness Sequence
    setTimeout(() => {
      setLivenessStage('turn_left');
      soundEngine.play('tap');
      soundEngine.triggerHaptic([20, 30]);
    }, 1200);

    setTimeout(() => {
      setLivenessStage('turn_right');
      soundEngine.play('tap');
      soundEngine.triggerHaptic([20, 30]);
    }, 2400);

    setTimeout(() => {
      setLivenessStage('blink');
      soundEngine.play('tap');
      soundEngine.triggerHaptic([30, 40]);
    }, 3600);

    setTimeout(() => {
      setLivenessStage('captured');
      soundEngine.play('victory');
      soundEngine.triggerHaptic([30, 50, 70]);
      run10SecondProcessingPipeline();
    }, 4500);
  };

  const run10SecondProcessingPipeline = () => {
    setStep('processing');
    setProcessingProgress(10);
    setProcessingStatusText('1/4: Encrypting biometric selfie payload & OCR extraction...');

    setTimeout(() => {
      setProcessingProgress(35);
      setProcessingStatusText('2/4: Querying Kenya IPRS (National Population Registry)...');
      soundEngine.play('tap');
    }, 1800);

    setTimeout(() => {
      setProcessingProgress(65);
      setProcessingStatusText('3/4: 3D Facial Liveness & Anti-Spoofing 1:1 Match (99.6%)...');
      soundEngine.play('tap');
      soundEngine.triggerHaptic([25, 35]);
    }, 3800);

    setTimeout(() => {
      setProcessingProgress(88);
      setProcessingStatusText('4/4: AML Sanctions & Politically Exposed Persons (PEP) Clear...');
      soundEngine.play('tap');
    }, 5800);

    setTimeout(() => {
      setProcessingProgress(100);
      setProcessingStatusText('Verification Complete (<8.2s). Certificate Issued.');
      soundEngine.play('victory');
      soundEngine.triggerHaptic([40, 60, 80]);

      const result: SmileKycResult = {
        isVerified: true,
        idNumber,
        fullName,
        docType,
        country,
        confidenceScore: 99.6,
        livenessPassed: true,
        iprsMatched: true,
        smileJobId: `SM-JOB-${Math.floor(100000 + Math.random() * 900000)}`,
        certificateRef: `SM-KE-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        verifiedAt: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };

      setKycResult(result);
      setStep('success');
      onVerificationComplete?.(result);
    }, 7800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0F172A] border border-slate-700/80 rounded-[28px] overflow-hidden shadow-2xl text-white animate-slideUp my-auto flex flex-col"
      >
        {/* ================= MODAL HEADER ================= */}
        <div className="p-5 bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E1B4B] border-b border-slate-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#00BFEF] text-[#0D1117] text-[10px] font-mono font-black uppercase tracking-wider">
                SMILE IDENTITY API
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>&lt;10s Pan-African KYC</span>
              </span>
            </div>
            <h3 className="text-lg font-black text-white tracking-tight flex items-center space-x-2">
              <span>Instant ID & 3D Liveness Verification</span>
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================= STEP 1: DOCUMENT DETAILS ================= */}
        {step === 'input' && (
          <form onSubmit={startLivenessCheck} className="p-5 sm:p-6 space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-1 text-slate-300">
              <p className="text-[11px] leading-relaxed">
                Brief utilizes <b>Smile Identity</b> (Official Pan-African KYC Provider) to verify Kenyan National IDs, Passports, and 3D facial liveness in real-time against the national IPRS registry.
              </p>
            </div>

            {/* Country Corridor */}
            <div className="space-y-1">
              <label className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                Country Authority
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-bold outline-none focus:border-[#00BFEF]"
              >
                <option value="Kenya 🇰🇪">Kenya 🇰🇪 (IPRS National Database)</option>
                <option value="Uganda 🇺🇬">Uganda 🇺🇬 (NIRA NIN Registry)</option>
                <option value="Tanzania 🇹🇿">Tanzania 🇹🇿 (NIDA National Database)</option>
                <option value="Rwanda 🇷🇼">Rwanda 🇷🇼 (NIDA Identity Portal)</option>
                <option value="Nigeria 🇳🇬">Nigeria 🇳🇬 (NIMC NIN / BVN Database)</option>
              </select>
            </div>

            {/* Document Type Selector */}
            <div className="space-y-1">
              <label className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                Document Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'national_id', label: 'National ID' },
                  { id: 'passport', label: 'Passport' },
                  { id: 'alien_card', label: 'Alien Card' }
                ].map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setDocType(doc.id as any); }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      docType === doc.id
                        ? 'bg-[#00BFEF] text-[#0D1117] font-black shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {doc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ID Number & Full Legal Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                  {docType === 'national_id' ? 'National ID Number' : docType === 'passport' ? 'Passport Number' : 'Card Serial Number'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 29481920"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-[#00BFEF]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                  Full Name (as on ID)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dennis Kimani"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-[#00BFEF]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-[#00BFEF] hover:bg-[#00a8d6] text-[#0D1117] font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg cursor-pointer transition-transform active:scale-[0.99]"
            >
              <Video className="w-4 h-4" />
              <span>Proceed to 3D Smart Selfie Scan</span>
            </button>
          </form>
        )}

        {/* ================= STEP 2: 3D BIOMETRIC LIVENESS ================= */}
        {step === 'liveness' && (
          <div className="p-6 space-y-5 text-center">
            <div className="relative w-48 h-48 mx-auto rounded-full border-4 border-[#00BFEF] overflow-hidden flex items-center justify-center bg-slate-900 shadow-2xl">
              {/* Simulated Camera Scanning Reticle */}
              <div className="absolute inset-2 rounded-full border-2 border-dashed border-cyan-400/60 animate-[spin_8s_linear_infinite]" />
              
              <div className="w-28 h-28 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                <User className="w-14 h-14 text-cyan-400 animate-pulse" />
              </div>

              {/* Liveness Target Prompt */}
              <div className="absolute bottom-2 inset-x-0 bg-black/60 backdrop-blur-xs py-1 text-[10px] font-mono font-bold text-cyan-300">
                {livenessStage === 'center' && '👤 Look directly at camera'}
                {livenessStage === 'turn_left' && '⬅️ Slowly turn head left'}
                {livenessStage === 'turn_right' && '➡️ Slowly turn head right'}
                {livenessStage === 'blink' && '👁️ Blink both eyes now'}
                {livenessStage === 'captured' && '✅ 3D Biometrics Captured'}
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-black text-white">
                Smile 3D Liveness Detection
              </h4>
              <p className="text-[11px] text-slate-400">
                Anti-spoofing algorithm is checking depth, texture, and active micro-expressions.
              </p>
            </div>
          </div>
        )}

        {/* ================= STEP 3: <10-SEC PROCESSING PIPELINE ================= */}
        {step === 'processing' && (
          <div className="p-6 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-cyan-400/40 flex items-center justify-center mx-auto relative">
              <RefreshCw className="w-8 h-8 text-[#00BFEF] animate-spin" />
            </div>

            <div className="space-y-2">
              <h4 className="text-base font-black text-white">
                Pan-African KYC Verification in Progress
              </h4>
              <p className="text-xs font-mono text-cyan-300">
                {processingStatusText}
              </p>
            </div>

            {/* Stepper Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-[#00BFEF] via-[#38BDF8] to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${processingProgress}%` }}
              />
            </div>

            <div className="text-[10px] font-mono text-slate-500">
              Smile Identity Secure Enclave • Encrypted IPRS Pipe
            </div>
          </div>
        )}

        {/* ================= STEP 4: SUCCESS CERTIFICATE ================= */}
        {step === 'success' && kycResult && (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center mx-auto shadow-lg">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h4 className="text-base font-black text-emerald-400">
                Identity Verified Successfully!
              </h4>
              <p className="text-xs text-slate-300 font-mono">
                Verified in 7.8s • IPRS Match 99.6%
              </p>
            </div>

            {/* Cryptographic Certificate Card */}
            <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="text-slate-400 uppercase text-[10px]">Certificate Ref:</span>
                <span className="font-bold text-cyan-300">{kycResult.certificateRef}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="text-slate-400 uppercase text-[10px]">Legal Name:</span>
                <span className="font-bold text-white">{kycResult.fullName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="text-slate-400 uppercase text-[10px]">National ID / Doc:</span>
                <span className="font-bold text-white">{kycResult.idNumber}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="text-slate-400 uppercase text-[10px]">3D Liveness Score:</span>
                <span className="font-bold text-emerald-400">{kycResult.confidenceScore}% (Passed)</span>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className="text-slate-400 uppercase text-[10px]">Issued Standing:</span>
                <span className="font-black text-emerald-400">TIER-3 VERIFIED CITIZEN</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer transition-all active:scale-[0.99]"
            >
              Done & Apply Verified Badge
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
