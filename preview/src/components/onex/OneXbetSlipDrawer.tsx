import React, { useState } from 'react';
import {
  X,
  Trash2,
  Share2,
  CheckCircle2,
  Copy,
  Zap,
  Lock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Phone
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface SlipItem {
  id: string;
  category: 'arena_stake' | 'wairo_courier' | 'chama_pot' | 'intercounty_cargo';
  matchTitle: string;
  selectionName: string;
  oddsMultiplier: number;
  stakeKes: number;
  details?: string;
}

interface OneXbetSlipDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: SlipItem[];
  onRemoveItem: (id: string) => void;
  onClearSlip: () => void;
  onUpdateStake: (id: string, newStake: number) => void;
  onPlaceBet: (totalStake: number) => void;
}

export function OneXbetSlipDrawer({
  isOpen,
  onClose,
  items,
  onRemoveItem,
  onClearSlip,
  onUpdateStake,
  onPlaceBet
}: OneXbetSlipDrawerProps) {
  const [phoneInput, setPhoneInput] = useState('0712 *** 890');
  const [isPlacing, setIsPlacing] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<string | null>(null);
  const [bookingCode, setBookingCode] = useState<string>('1X-BRF-7741');
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const totalStakeKes = items.reduce((sum, item) => sum + (item.stakeKes || 100), 0);
  const totalPotentialReturnKes = Math.round(
    items.reduce((sum, item) => sum + (item.stakeKes || 100) * item.oddsMultiplier, 0)
  );

  const handleAuthorizeMpesa = () => {
    if (items.length === 0) return;
    soundEngine.play('heavyTap');
    setIsPlacing(true);

    setTimeout(() => {
      soundEngine.play('victory');
      setIsPlacing(false);
      const receiptId = `MPESA-STK-${Math.floor(100000 + Math.random() * 900000)}`;
      setSuccessReceipt(receiptId);
      onPlaceBet(totalStakeKes);
    }, 1200);
  };

  const handleCopyCode = () => {
    soundEngine.play('tap');
    navigator.clipboard?.writeText(bookingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-[#0D1C2E] text-white h-full flex flex-col border-l border-[#203A60] shadow-2xl animate-slideLeft">
        
        {/* ================= SLIP HEADER ================= */}
        <div className="bg-[#11233B] p-4 border-b border-[#203A60] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#00D26A] animate-pulse" />
            <h3 className="font-mono font-black text-sm uppercase tracking-wider text-white">
              Brief Slip ({items.length})
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => { soundEngine.play('tap'); onClearSlip(); }}
                className="text-[10px] text-gray-400 hover:text-red-400 flex items-center space-x-1 cursor-pointer transition-colors"
                title="Clear all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); onClose(); }}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= SLIP ITEMS LIST ================= */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 && (
            <div className="text-center py-16 space-y-3 text-gray-400">
              <span className="text-4xl block">📝</span>
              <p className="font-bold text-sm text-white">Your Brief Slip is Empty</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Tap odds on Arena matches, choose a courier fleet, or back a community Chama to add selections here.
              </p>
            </div>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-[#162B48] border border-[#203A60] space-y-2 relative"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[9px] font-mono uppercase bg-[#00BFEF]/20 text-[#00BFEF] px-1.5 py-0.2 rounded font-bold">
                    {item.category.replace('_', ' ')}
                  </span>
                  <h4 className="font-bold text-xs text-white mt-1">{item.matchTitle}</h4>
                  <p className="text-[11px] text-emerald-400 font-mono font-bold">
                    Selection: {item.selectionName} @ {item.oddsMultiplier.toFixed(2)}x
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => { soundEngine.play('tap'); onRemoveItem(item.id); }}
                  className="text-gray-400 hover:text-red-400 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Stake input row */}
              <div className="pt-2 border-t border-[#203A60] flex items-center justify-between text-xs">
                <span className="text-gray-400 text-[10px]">Stake (KES):</span>
                <div className="flex items-center space-x-1.5">
                  {[100, 250, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => { soundEngine.play('tap'); onUpdateStake(item.id, amt); }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        item.stakeKes === amt
                          ? 'bg-[#00BFEF] text-[#07121E]'
                          : 'bg-[#0D1C2E] text-gray-300 border border-[#203A60] hover:border-gray-400'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Booking Code Share Bar */}
          {items.length > 0 && (
            <div className="p-3 rounded-xl bg-[#11233B] border border-[#203A60] flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-[9px] text-gray-400 uppercase block">Shareable Slip Code</span>
                <span className="font-black text-[#00BFEF] text-xs">{bookingCode}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] flex items-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          )}

          {successReceipt && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs space-y-1 animate-fadeIn">
              <div className="flex items-center space-x-1.5 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>M-Pesa STK Push Initiated</span>
              </div>
              <p className="text-[11px] text-emerald-300">
                Ref: {successReceipt}. Enter your M-Pesa PIN on your phone to lock escrow.
              </p>
            </div>
          )}
        </div>

        {/* ================= SLIP FOOTER ================= */}
        {items.length > 0 && (
          <div className="p-4 bg-[#11233B] border-t border-[#203A60] space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-gray-300">
                <span>Total Stake:</span>
                <span className="font-mono font-bold text-white">KES {totalStakeKes}</span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span>Potential Returns / Escrow Payout:</span>
                <span className="font-mono font-black text-amber-400 text-sm">KES {totalPotentialReturnKes}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAuthorizeMpesa}
              disabled={isPlacing}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#00D26A] to-[#00BFEF] hover:opacity-95 text-[#07121E] font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
            >
              {isPlacing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Pushing M-Pesa STK Prompt…</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Place Stake via M-Pesa (KES {totalStakeKes})</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
