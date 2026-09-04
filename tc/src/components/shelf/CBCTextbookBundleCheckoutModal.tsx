import React, { useState } from 'react';
import { 
  BookOpen, 
  Truck, 
  Coins, 
  ShieldCheck, 
  CheckCircle2, 
  X, 
  ArrowRight, 
  Sparkles, 
  Phone, 
  Building2, 
  Clock, 
  ChevronRight
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface CBCTextbookBundle {
  id: string;
  grade: string;
  title: string;
  subtitle: string;
  curriculum: string;
  supplier: string;
  retailPriceKes: number;
  bulkPriceKes: number;
  discountPercent: number;
  booksIncluded: string[];
  stockCount: number;
  verifiedBadge: string;
}

export const SAMPLE_CBC_BUNDLES: CBCTextbookBundle[] = [
  {
    id: 'cbc-g7',
    grade: 'Grade 7',
    title: 'CBC Grade 7 Core Curriculum Starter Pack',
    subtitle: 'KLB Topmark & Oxford Approved CBC Textbooks',
    curriculum: 'KICD Approved · CBC 2026 Edition',
    supplier: 'Textbook Centre & Westlands Book Depot (Verified Supplier Till: 541289)',
    retailPriceKes: 6800,
    bulkPriceKes: 4890,
    discountPercent: 28,
    booksIncluded: [
      'Mathematics Learner’s Book & Workbook Gr 7',
      'Integrated Science Course Book Gr 7',
      'Social Studies & Life Skills Gr 7',
      'Kiswahili Tukufu & Insha Gr 7',
      'English Literacy & Composition Gr 7',
      'Agriculture & Nutrition Gr 7'
    ],
    stockCount: 42,
    verifiedBadge: 'PTA VERIFIED'
  },
  {
    id: 'cbc-g8',
    grade: 'Grade 8',
    title: 'CBC Grade 8 Junior School Full Suite',
    subtitle: 'Complete 8-Subject Book Pack with Laboratory Manual',
    curriculum: 'KICD Approved · Junior Secondary 2026',
    supplier: 'Nairobi Publishers Guild (Verified Paybill: 247247 · Acc: CBC8-WAIRO)',
    retailPriceKes: 8500,
    bulkPriceKes: 6120,
    discountPercent: 28,
    booksIncluded: [
      'Pre-Technical Studies & ICT Gr 8',
      'Integrated Science & Lab Manual Gr 8',
      'Mathematics Advanced Track Gr 8',
      'English & Set Books Anthology Gr 8',
      'Kiswahili Sanifu Gr 8',
      'Social Studies & History Gr 8',
      'Health Education & Physical Wellness Gr 8'
    ],
    stockCount: 35,
    verifiedBadge: 'BULK ACCREDITED'
  },
  {
    id: 'cbc-g4',
    grade: 'Grade 4',
    title: 'CBC Grade 4 Primary Foundational Bundle',
    subtitle: 'Primary Literacy, Numeracy & Indigenous Languages',
    curriculum: 'KICD Approved · Upper Primary',
    supplier: 'Machakos Education Supplies (Till: 893120)',
    retailPriceKes: 4200,
    bulkPriceKes: 3020,
    discountPercent: 28,
    booksIncluded: [
      'Mathematics Activities Gr 4',
      'Science & Technology Gr 4',
      'English Activities Gr 4',
      'Kiswahili Mufti Gr 4',
      'Creative Arts & Music Gr 4'
    ],
    stockCount: 68,
    verifiedBadge: 'PARENT RECOMMENDED'
  }
];

export interface CBCTextbookBundleCheckoutModalProps {
  isOpen: boolean;
  initialBundleId?: string;
  onClose: () => void;
  onOrderSuccess?: (order: {
    bundleId: string;
    grade: string;
    totalAmountKes: number;
    deliveryLocation: string;
    paymentMethod: string;
    wairoTrackingCode: string;
    mpesaReceipt: string;
  }) => void;
}

export const CBCTextbookBundleCheckoutModal: React.FC<CBCTextbookBundleCheckoutModalProps> = ({
  isOpen,
  initialBundleId = 'cbc-g7',
  onClose,
  onOrderSuccess
}) => {
  const [selectedBundleId, setSelectedBundleId] = useState<string>(initialBundleId);
  const [quantity, setQuantity] = useState<number>(1);
  const [deliveryType, setDeliveryType] = useState<'wairo_door' | 'wairo_gate' | 'pickup'>('wairo_door');
  const [deliveryWard, setDeliveryWard] = useState<string>('Machakos Town (Gate 4)');
  const [parentName, setParentName] = useState<string>('Madam Beatrice Mwangi');
  const [parentPhone, setParentPhone] = useState<string>('0722 849 102');
  const [paymentSource, setPaymentSource] = useState<'mpesa' | 'chama_table_bank'>('chama_table_bank');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);

  if (!isOpen) return null;

  const currentBundle = SAMPLE_CBC_BUNDLES.find(b => b.id === selectedBundleId) || SAMPLE_CBC_BUNDLES[0];
  const deliveryFeeKes = deliveryType === 'wairo_door' ? 250 : deliveryType === 'wairo_gate' ? 120 : 0;
  const itemsSubtotalKes = currentBundle.bulkPriceKes * quantity;
  const totalAmountKes = itemsSubtotalKes + deliveryFeeKes;
  const totalSavingsKes = (currentBundle.retailPriceKes - currentBundle.bulkPriceKes) * quantity;

  const handleExecuteCheckout = () => {
    soundEngine.play('heavyTap');
    setIsProcessing(true);

    setTimeout(() => {
      soundEngine.play('victory');
      soundEngine.triggerHaptic([30, 40, 60]);
      setIsProcessing(false);

      const tracking = `WAIRO-${Math.floor(100000 + Math.random() * 900000)}`;
      const mpesaRef = `QKJ${Math.floor(100000 + Math.random() * 900000)}B`;

      const orderData = {
        bundleId: currentBundle.id,
        grade: currentBundle.grade,
        bundleTitle: currentBundle.title,
        totalAmountKes,
        deliveryLocation: deliveryWard,
        deliveryType,
        paymentMethod: paymentSource === 'chama_table_bank' ? 'Chama Table Bank (Circle Payout)' : 'Direct M-Pesa STK',
        wairoTrackingCode: tracking,
        mpesaReceipt: mpesaRef,
        parentName,
        parentPhone,
        date: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setCompletedOrder(orderData);
      onOrderSuccess?.(orderData);
    }, 900);
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
        className="w-full max-w-xl bg-[#FAFAF8] rounded-[28px] overflow-hidden shadow-2xl text-[#1A1F2E] animate-slideUp my-auto max-h-[92vh] flex flex-col"
      >
        {/* ================= MODAL HEADER ================= */}
        <div className="bg-[#121318] text-white p-5 sm:p-6 relative shrink-0">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#B8621F] text-white">
                  1-CLICK CBC DEMAND RUN
                </span>
                <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>KICD Approved</span>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                CBC Textbooks & WAIRO Courier
              </h2>
              <p className="text-xs text-stone-400">
                Aggregated PTA bulk prices · 28% wholesale discount · Door delivery
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Grade Selector Strip */}
          {!completedOrder && (
            <div className="flex items-center space-x-2 mt-4 overflow-x-auto no-scrollbar pt-1">
              {SAMPLE_CBC_BUNDLES.map(b => {
                const isSelected = b.id === selectedBundleId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      soundEngine.play('tap');
                      setSelectedBundleId(b.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-[#B8621F] text-white shadow-md'
                        : 'bg-white/10 hover:bg-white/20 text-stone-300'
                    }`}
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>{b.grade}</span>
                    <span className="text-[9px] opacity-80">(-{b.discountPercent}%)</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ================= MODAL BODY / SCROLLABLE ================= */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          
          {/* STATE 1: COMPLETED ORDER RECEIPT */}
          {completedOrder ? (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-[#1A1F2E]">
                  CBC Order Confirmed & Dispatched!
                </h3>
                <p className="text-xs text-[#4B5563]">
                  Paid KES {completedOrder.totalAmountKes.toLocaleString()} via {completedOrder.paymentMethod}
                </p>
              </div>

              {/* Physical Receipt Card */}
              <div className="p-5 rounded-2xl bg-white shadow-sm space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500 font-bold uppercase">WAIRO Waybill:</span>
                  <span className="font-black text-[#B8621F]">{completedOrder.wairoTrackingCode}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500 font-bold uppercase">M-Pesa Receipt:</span>
                  <span className="font-bold text-gray-800">{completedOrder.mpesaReceipt}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500 font-bold uppercase">Bundle Pack:</span>
                  <span className="font-bold text-right truncate max-w-[200px]">{completedOrder.bundleTitle}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-gray-500 font-bold uppercase">Destination:</span>
                  <span className="font-bold text-right">{completedOrder.deliveryLocation}</span>
                </div>
                <div className="flex items-center justify-between pt-1 text-sm font-black">
                  <span>TOTAL PAID:</span>
                  <span className="text-[#10B981]">KES {completedOrder.totalAmountKes.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#1A1F2E] text-white flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <Truck className="w-5 h-5 text-[#00BFEF] animate-bounce" />
                  <div>
                    <span className="text-xs font-black block">WAIRO Rider Assigned</span>
                    <span className="text-[10px] text-cyan-300">Evans Maina · In Transit to Gate</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold bg-white/20 px-2 py-1 rounded">
                  ETA 45 Mins
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl bg-[#B8621F] hover:bg-[#9B5118] text-white font-black text-sm shadow-md transition-transform active:scale-95 cursor-pointer"
              >
                Done & Return to Shelf
              </button>
            </div>
          ) : (
            <>
              {/* Selected Bundle Overview Card */}
              <div className="p-4 rounded-2xl bg-white shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#B8621F] block">
                      {currentBundle.curriculum}
                    </span>
                    <h3 className="text-base font-black text-[#1A1F2E] leading-tight mt-0.5">
                      {currentBundle.title}
                    </h3>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {currentBundle.supplier}
                    </p>
                  </div>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Save KES {totalSavingsKes.toLocaleString()}
                  </span>
                </div>

                {/* Price Display */}
                <div className="flex items-baseline space-x-2 pt-1 border-t border-black/[0.04]">
                  <span className="text-2xl font-black text-[#10B981]">
                    KES {currentBundle.bulkPriceKes.toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-gray-400 line-through">
                    KES {currentBundle.retailPriceKes.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-bold text-[#B8621F]">
                    (Wholesale PTA Rate)
                  </span>
                </div>

                {/* Included Books Accordion preview */}
                <div className="bg-[#F9F8F6] rounded-xl p-3 space-y-1.5 text-xs">
                  <span className="font-bold text-[11px] text-[#4B5563] uppercase tracking-wider block">
                    {currentBundle.booksIncluded.length} Textbooks in this Bundle:
                  </span>
                  <ul className="space-y-1 text-[#374151] pl-1">
                    {currentBundle.booksIncluded.map((book, idx) => (
                      <li key={idx} className="flex items-center space-x-1.5 text-[11.5px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{book}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Step 1: Delivery Location & Mode */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-[#1A1F2E] flex items-center justify-between">
                  <span>1. WAIRO Delivery Method</span>
                  <span className="text-[10px] text-[#B8621F] font-bold">47 Counties Gate Network</span>
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setDeliveryType('wairo_door'); }}
                    className={`p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                      deliveryType === 'wairo_door'
                        ? 'bg-[#B8621F] text-white shadow-sm'
                        : 'bg-white hover:bg-white/80 text-[#374151] shadow-xs'
                    }`}
                  >
                    <Truck className="w-4 h-4 mb-1" />
                    <div>
                      <span className="text-xs font-bold block">Door Delivery</span>
                      <span className="text-[10px] opacity-80">+KES 250</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setDeliveryType('wairo_gate'); }}
                    className={`p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                      deliveryType === 'wairo_gate'
                        ? 'bg-[#B8621F] text-white shadow-sm'
                        : 'bg-white hover:bg-white/80 text-[#374151] shadow-xs'
                    }`}
                  >
                    <Building2 className="w-4 h-4 mb-1" />
                    <div>
                      <span className="text-xs font-bold block">Town Gate Desk</span>
                      <span className="text-[10px] opacity-80">+KES 120</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setDeliveryType('pickup'); }}
                    className={`p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                      deliveryType === 'pickup'
                        ? 'bg-[#B8621F] text-white shadow-sm'
                        : 'bg-white hover:bg-white/80 text-[#374151] shadow-xs'
                    }`}
                  >
                    <Clock className="w-4 h-4 mb-1" />
                    <div>
                      <span className="text-xs font-bold block">Depot Pickup</span>
                      <span className="text-[10px] opacity-80">Free (KES 0)</span>
                    </div>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-white shadow-xs flex items-center space-x-2">
                  <span className="text-xs font-bold text-gray-500">Destination Ward:</span>
                  <input
                    type="text"
                    value={deliveryWard}
                    onChange={(e) => setDeliveryWard(e.target.value)}
                    className="flex-1 text-xs font-bold text-[#1A1F2E] bg-transparent outline-none focus:text-[#B8621F]"
                  />
                </div>
              </div>

              {/* Step 2: Payment Method (Chama Balance vs Direct M-Pesa) */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-[#1A1F2E] flex items-center justify-between">
                  <span>2. Payment Source</span>
                  <span className="text-[10px] text-emerald-600 font-bold">Encrypted & Instant</span>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setPaymentSource('chama_table_bank'); }}
                    className={`p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                      paymentSource === 'chama_table_bank'
                        ? 'bg-[#4C1D95] text-white shadow-sm'
                        : 'bg-white hover:bg-white/80 text-[#374151] shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Coins className="w-4 h-4 text-amber-300" />
                      <span className="text-[8px] font-black uppercase bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded">
                        Available
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs font-black block">Chama Table Bank</span>
                      <span className="text-[10px] text-purple-200">Cycle 5 Payout Balance</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { soundEngine.play('tap'); setPaymentSource('mpesa'); }}
                    className={`p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                      paymentSource === 'mpesa'
                        ? 'bg-[#059669] text-white shadow-sm'
                        : 'bg-white hover:bg-white/80 text-[#374151] shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Phone className="w-4 h-4 text-emerald-200" />
                      <span className="text-[8px] font-black uppercase bg-white/20 text-white px-1.5 py-0.5 rounded">
                        STK Push
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs font-black block">M-Pesa Express</span>
                      <span className="text-[10px] text-emerald-200">{parentPhone}</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Order Summary & Primary CTA */}
              <div className="pt-2 border-t border-black/[0.06] space-y-3">
                <div className="flex items-center justify-between text-sm font-black text-[#1A1F2E]">
                  <span>Total Payable:</span>
                  <span className="text-xl text-[#10B981]">
                    KES {totalAmountKes.toLocaleString()}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleExecuteCheckout}
                  className="w-full py-4 rounded-2xl bg-[#B8621F] hover:bg-[#9B5118] text-white font-black text-sm shadow-lg shadow-[#B8621F]/25 flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Securing CBC Bundle & WAIRO Rider...</span>
                    </div>
                  ) : (
                    <>
                      <span>Confirm & Pay KES {totalAmountKes.toLocaleString()}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-[10px] text-center text-gray-500 font-medium">
                  Protected by Brief 90-Day Neighborhood Trust & Verified Supplier Guarantee
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default CBCTextbookBundleCheckoutModal;
