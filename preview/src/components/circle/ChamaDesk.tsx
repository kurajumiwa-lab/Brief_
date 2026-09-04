import React, { useState } from 'react';
import {
  Users,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Share2,
  Plus,
  Send,
  X,
  Check,
  Copy,
  ChevronRight,
  ArrowUpRight,
  Coins,
  FileText,
  MessageCircle,
  Sparkles,
  Repeat,
  Heart
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface ChamaMemberCycle {
  id: string;
  name: string;
  phone: string;
  payoutMonth: string;
  roundNumber: number;
  merryContributionKes: number;
  welfareContributionKes: number;
  status: 'paid' | 'pending';
  mpesaRef?: string;
  payoutStatus: 'received' | 'current_recipient' | 'upcoming';
  paidAt?: string;
}

export interface TableLoan {
  id: string;
  borrowerName: string;
  principalKes: number;
  interestRatePct: number;
  totalRepaymentKes: number;
  durationMonths: number;
  purpose: string;
  status: 'active' | 'pending_approval' | 'repaid';
  dueDate: string;
  guarantors: string[];
}

export function ChamaDesk({
  onClose,
  onOpenCircle
}: {
  onClose?: () => void;
  onOpenCircle?: (circleId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'roster' | 'contributions' | 'loans' | 'minutes'>('roster');
  
  // Chama State
  const [members, setMembers] = useState<ChamaMemberCycle[]>([
    { id: 'm-1', name: 'Grace Wanjiku', phone: '0722***410', payoutMonth: 'May 2026', roundNumber: 5, merryContributionKes: 5000, welfareContributionKes: 500, status: 'paid', mpesaRef: 'QKD89102A', payoutStatus: 'current_recipient', paidAt: 'May 18' },
    { id: 'm-2', name: 'Mary Atieno', phone: '0711***928', payoutMonth: 'Jan 2026', roundNumber: 1, merryContributionKes: 5000, welfareContributionKes: 500, status: 'paid', mpesaRef: 'QKB12849B', payoutStatus: 'received', paidAt: 'May 17' },
    { id: 'm-3', name: 'Faith Mwangi', phone: '0733***112', payoutMonth: 'Feb 2026', roundNumber: 2, merryContributionKes: 5000, welfareContributionKes: 500, status: 'paid', mpesaRef: 'QKC44910C', payoutStatus: 'received', paidAt: 'May 18' },
    { id: 'm-4', name: 'Jane Nyaboke', phone: '0700***543', payoutMonth: 'Mar 2026', roundNumber: 3, merryContributionKes: 5000, welfareContributionKes: 500, status: 'paid', mpesaRef: 'QKD77231D', payoutStatus: 'received', paidAt: 'May 19' },
    { id: 'm-5', name: 'Esther Chebet', phone: '0724***890', payoutMonth: 'Apr 2026', roundNumber: 4, merryContributionKes: 5000, welfareContributionKes: 500, status: 'paid', mpesaRef: 'QKE99301E', payoutStatus: 'received', paidAt: 'May 19' },
    { id: 'm-6', name: 'Caroline Gesare', phone: '0712***674', payoutMonth: 'Jun 2026', roundNumber: 6, merryContributionKes: 5000, welfareContributionKes: 500, status: 'paid', mpesaRef: 'QKF33912F', payoutStatus: 'upcoming', paidAt: 'May 20' },
    { id: 'm-7', name: 'Beatrice Ndinda', phone: '0728***321', payoutMonth: 'Jul 2026', roundNumber: 7, merryContributionKes: 5000, welfareContributionKes: 500, status: 'paid', mpesaRef: 'QKG88102G', payoutStatus: 'upcoming', paidAt: 'May 20' },
    { id: 'm-8', name: 'Sharon Moraa', phone: '0719***004', payoutMonth: 'Aug 2026', roundNumber: 8, merryContributionKes: 5000, welfareContributionKes: 500, status: 'paid', mpesaRef: 'QKH22049H', payoutStatus: 'upcoming', paidAt: 'May 21' },
    { id: 'm-9', name: 'Alice Muthoni', phone: '0721***789', payoutMonth: 'Sep 2026', roundNumber: 9, merryContributionKes: 5000, welfareContributionKes: 500, status: 'paid', mpesaRef: 'QKJ55831J', payoutStatus: 'upcoming', paidAt: 'May 21' },
    { id: 'm-10', name: 'Mercy Cherono', phone: '0705***231', payoutMonth: 'Oct 2026', roundNumber: 10, merryContributionKes: 5000, welfareContributionKes: 500, status: 'paid', mpesaRef: 'QKK90123K', payoutStatus: 'upcoming', paidAt: 'May 21' },
    { id: 'm-11', name: 'Lilian Akinyi', phone: '0714***899', payoutMonth: 'Nov 2026', roundNumber: 11, merryContributionKes: 5000, welfareContributionKes: 500, status: 'pending', payoutStatus: 'upcoming' },
    { id: 'm-12', name: 'Rose Wambui', phone: '0729***445', payoutMonth: 'Dec 2026', roundNumber: 12, merryContributionKes: 5000, welfareContributionKes: 500, status: 'pending', payoutStatus: 'upcoming' }
  ]);

  const [loans, setLoans] = useState<TableLoan[]>([
    {
      id: 'loan-1',
      borrowerName: 'Mary Atieno',
      principalKes: 20000,
      interestRatePct: 5,
      totalRepaymentKes: 21000,
      durationMonths: 2,
      purpose: 'Restock cereal shop stock (Nyamataro Market)',
      status: 'active',
      dueDate: '15 June 2026',
      guarantors: ['Grace Wanjiku', 'Faith Mwangi']
    },
    {
      id: 'loan-2',
      borrowerName: 'Caroline Gesare',
      principalKes: 15000,
      interestRatePct: 5,
      totalRepaymentKes: 15750,
      durationMonths: 3,
      purpose: 'School fees top-up for high school term 2',
      status: 'pending_approval',
      dueDate: '20 July 2026',
      guarantors: ['Jane Nyaboke', 'Sharon Moraa', 'Beatrice Ndinda']
    }
  ]);

  // Dialog States
  const [isLogPayOpen, setIsLogPayOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(members[10].id);
  const [logMpesaRef, setLogMpesaRef] = useState('');
  
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);
  const [loanBorrower, setLoanBorrower] = useState('Lilian Akinyi');
  const [loanPrincipal, setLoanPrincipal] = useState('10000');
  const [loanPurpose, setLoanPurpose] = useState('');
  
  const [copiedBroadcast, setCopiedBroadcast] = useState(false);

  // Calculations
  const cycleTargetPoolKes = members.length * 5000; // 12 * 5000 = KES 60,000
  const paidMembersCount = members.filter(m => m.status === 'paid').length;
  const totalCollectedMerryKes = paidMembersCount * 5000;
  const totalCollectedWelfareKes = paidMembersCount * 500;
  const cyclePercentComplete = Math.round((totalCollectedMerryKes / cycleTargetPoolKes) * 100);
  const outstandingMerryKes = cycleTargetPoolKes - totalCollectedMerryKes;
  const currentRecipient = members.find(m => m.payoutStatus === 'current_recipient') || members[0];
  const totalWelfareReserveKes = 142500 + totalCollectedWelfareKes;

  const handleConfirmMemberPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logMpesaRef.trim()) return;
    soundEngine.play('victory');
    setMembers(prev => prev.map(m => {
      if (m.id !== selectedMemberId) return m;
      return {
        ...m,
        status: 'paid',
        mpesaRef: logMpesaRef.trim().toUpperCase(),
        paidAt: 'Just now'
      };
    }));
    setIsLogPayOpen(false);
    setLogMpesaRef('');
  };

  const handleApplyLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const principal = Number(loanPrincipal) || 10000;
    const interest = Math.round(principal * 0.05);
    soundEngine.play('heavyTap');
    const newLoan: TableLoan = {
      id: `loan-${Date.now()}`,
      borrowerName: loanBorrower,
      principalKes: principal,
      interestRatePct: 5,
      totalRepaymentKes: principal + interest,
      durationMonths: 2,
      purpose: loanPurpose.trim() || 'Business operating capital',
      status: 'pending_approval',
      dueDate: '15 July 2026',
      guarantors: ['Grace Wanjiku']
    };
    setLoans(prev => [newLoan, ...prev]);
    setIsNewLoanOpen(false);
    setLoanPurpose('');
  };

  const handleApproveLoan = (loanId: string) => {
    soundEngine.play('reward');
    setLoans(prev => prev.map(l => {
      if (l.id !== loanId) return l;
      return { ...l, status: 'active' };
    }));
  };

  const handleShareWhatsAppReminder = () => {
    soundEngine.play('tap');
    const pendingNames = members.filter(m => m.status === 'pending').map(m => m.name).join(', ');
    const text = `*Kilimani Traders & Agri Chama — Cycle 5 Update 🌸*\n\n` +
      `*Merry-Go-Round Pot:* KES ${totalCollectedMerryKes.toLocaleString()} / KES ${cycleTargetPoolKes.toLocaleString()} (${cyclePercentComplete}%)\n` +
      `*This Month Beneficiary:* ${currentRecipient.name} (KES ${cycleTargetPoolKes.toLocaleString()})\n` +
      `*Pending Members:* ${pendingNames || 'None! All cleared 🎉'}\n` +
      `*Welfare Treasury:* KES ${totalWelfareReserveKes.toLocaleString()}\n\n` +
      `*Payment Details:* Send KES 5,500 via M-Pesa to Chama Pochi / Till: 0722001122\n\n` +
      `_Track rotational roster & table banking on Brief Circles: https://brief.ke/circle/kilimani-chama_`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedBroadcast(true);
      setTimeout(() => setCopiedBroadcast(false), 3000);
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-3xl overflow-hidden shadow-2xl text-[#0D1117] max-w-2xl mx-auto">
      
      {/* ================= HERO HEADER ================= */}
      <div className="bg-gradient-to-br from-[#1E1B4B] via-[#0F172A] to-[#0D1117] text-white p-5 sm:p-6 relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-[#FF5A1F] text-white uppercase tracking-wider">
                CHAMA & TABLE BANKING
              </span>
              <span className="text-xs text-indigo-200 font-bold flex items-center space-x-1">
                <Users className="w-3.5 h-3.5 text-[#00BFEF]" />
                <span>12 Active Members</span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black mt-2 text-white tracking-tight flex items-center space-x-2">
              <span>Kilimani Women Traders Chama</span>
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h2>
            <p className="text-xs text-indigo-200/80 mt-0.5">
              Cycle 5 of 12 • Monthly Contribution: KES 5,000 Merry + KES 500 Welfare
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); onClose(); }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab Strip */}
        <div className="flex items-center space-x-1.5 mt-5 border-t border-white/10 pt-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'roster', label: 'Payout Roster (12)' },
            { id: 'contributions', label: `Cycle 5 Contributions (${paidMembersCount}/12)` },
            { id: 'loans', label: `Table Banking (${loans.length})` },
            { id: 'minutes', label: 'Broadcast & Minutes' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { soundEngine.play('tap'); setActiveTab(tab.id as any); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-[#0D1117] shadow-md font-black'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= SUMMARY STATS BANNER ================= */}
      <div className="p-4 sm:p-5 bg-[#F7F8FA] border-b border-[#E5E8EC] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono font-black uppercase text-gray-600">
              CURRENT POT: {currentRecipient.name.toUpperCase()} (ROUND 5)
            </span>
          </div>
          <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            {cyclePercentComplete}% COLLECTED
          </span>
        </div>

        {/* Stepper Progress Bar */}
        <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-[#FF5A1F] via-[#FF8A00] to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${cyclePercentComplete}%` }}
          />
        </div>

        {/* Financial Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
          <div className="p-2.5 bg-white rounded-xl border border-gray-200">
            <span className="text-[9px] text-gray-400 block uppercase">POT TARGET</span>
            <span className="font-black text-[#0D1117] text-sm">
              KES {cycleTargetPoolKes.toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800">
            <span className="text-[9px] text-emerald-600 block uppercase font-bold">COLLECTED</span>
            <span className="font-black text-emerald-700 text-sm">
              KES {totalCollectedMerryKes.toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-200 text-indigo-800">
            <span className="text-[9px] text-indigo-600 block uppercase font-bold">WELFARE RESERVE</span>
            <span className="font-black text-indigo-700 text-sm">
              KES {totalWelfareReserveKes.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ================= TAB 1: PAYOUT ROSTER ================= */}
      {activeTab === 'roster' && (
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0D1117]">
                Rotational Merry-Go-Round Schedule
              </h3>
              <p className="text-[11px] text-gray-500">12-month sequential disbursement roster determined by ballot</p>
            </div>

            <button
              type="button"
              onClick={handleShareWhatsAppReminder}
              className="px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm cursor-pointer transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedBroadcast ? 'Copied!' : 'WhatsApp Roster'}</span>
            </button>
          </div>

          <div className="space-y-2">
            {members.map((m) => {
              const isCurrent = m.payoutStatus === 'current_recipient';
              const isReceived = m.payoutStatus === 'received';

              return (
                <div
                  key={m.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                    isCurrent
                      ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30'
                      : isReceived
                      ? 'bg-gray-50/60 border-gray-200 opacity-90'
                      : 'bg-white border-[#E5E8EC]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-xl font-mono font-black text-xs flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-[#FF5A1F] text-white shadow-md'
                        : isReceived
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      #{m.roundNumber}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-black text-[#0D1117]">
                          {m.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 animate-pulse">
                            THIS MONTH
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono block mt-0.5">
                        {m.payoutMonth} • Tel: {m.phone}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-black text-[#0D1117] block">
                      KES {cycleTargetPoolKes.toLocaleString()}
                    </span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                      isCurrent
                        ? 'bg-[#FF5A1F] text-white'
                        : isReceived
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isCurrent ? 'Receiving Pot' : isReceived ? 'Disbursed' : 'Upcoming'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 2: CONTRIBUTIONS & AUDIT LEDGER ================= */}
      {activeTab === 'contributions' && (
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0D1117]">
                Cycle 5 Contribution Ledger (May 2026)
              </h3>
              <p className="text-[11px] text-gray-500">
                {paidMembersCount} paid • {members.length - paidMembersCount} pending • Shortfall: KES {outstandingMerryKes.toLocaleString()}
              </p>
            </div>

            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); setIsLogPayOpen(true); }}
              className="px-3.5 py-1.5 rounded-xl bg-[#0D1117] hover:bg-black text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#FF5A1F]" />
              <span>Log M-Pesa</span>
            </button>
          </div>

          <div className="space-y-2">
            {members.map(m => (
              <div
                key={m.id}
                className="p-3.5 bg-white border border-[#E5E8EC] rounded-2xl flex items-center justify-between shadow-xs"
              >
                <div>
                  <span className="text-xs font-bold text-[#0D1117] block">
                    {m.name}
                  </span>
                  <div className="flex items-center space-x-2 text-[10px] text-gray-500 font-mono mt-0.5">
                    <span>{m.paidAt || 'Due by 25th May'}</span>
                    {m.mpesaRef && (
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 rounded border border-emerald-200">
                        Ref: {m.mpesaRef}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-black text-[#0D1117] block">
                    KES {(m.merryContributionKes + m.welfareContributionKes).toLocaleString()}
                  </span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                    m.status === 'paid'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {m.status === 'paid' ? 'PAID IN FULL' : 'PENDING'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: TABLE BANKING & MICRO-LOANS ================= */}
      {activeTab === 'loans' && (
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0D1117]">
                Table Banking Loans & Welfare Kitty
              </h3>
              <p className="text-[11px] text-gray-500">Emergency & business loans funded from Chama welfare reserve</p>
            </div>

            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); setIsNewLoanOpen(true); }}
              className="px-3.5 py-1.5 rounded-xl bg-[#0D1117] hover:bg-black text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#FF5A1F]" />
              <span>Apply Loan</span>
            </button>
          </div>

          <div className="space-y-3">
            {loans.map(loan => (
              <div
                key={loan.id}
                className="p-4 rounded-2xl bg-white border border-[#E5E8EC] space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black text-[#0D1117]">
                        {loan.borrowerName}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                        loan.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {loan.status === 'active' ? 'Active Loan' : 'Pending Member Approval'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{loan.purpose}</p>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-sm font-black text-[#0D1117] block">
                      KES {loan.totalRepaymentKes.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-gray-500">
                      KES {loan.principalKes.toLocaleString()} + {loan.interestRatePct}% Int
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Guarantors: <b>{loan.guarantors.join(', ')}</b></span>
                  </div>
                  <span>Due: <b>{loan.dueDate}</b></span>
                </div>

                {loan.status === 'pending_approval' && (
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproveLoan(loan.id)}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Vote Approve Loan (2/3 Approved)</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 4: MINUTES & WHATSAPP BROADCAST ================= */}
      {activeTab === 'minutes' && (
        <div className="p-5 sm:p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-[#F7F8FA] border border-[#E5E8EC] space-y-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-[#FF5A1F]" />
              <h4 className="text-xs font-black uppercase tracking-wider text-[#0D1117]">
                Last Meeting Minutes (10 May 2026)
              </h4>
            </div>

            <ul className="space-y-1.5 text-xs text-gray-700 list-disc pl-4 leading-relaxed">
              <li><strong>Cycle 5 Disbursement:</strong> Grace Wanjiku receives KES 60,000 for her bakery equipment upgrade.</li>
              <li><strong>Table Banking Interest:</strong> Agreed to maintain emergency loan interest at 5% per month.</li>
              <li><strong>Penalties:</strong> Late contribution after the 25th of the month incurs a KES 200 fine to the welfare fund.</li>
              <li><strong>Next Physical Meeting:</strong> Saturday, 14 June 2026 at 3:00 PM (Kilimani Social Hall).</li>
            </ul>
          </div>

          {/* 1-Tap WhatsApp Broadcast Generator */}
          <div className="p-4 rounded-2xl bg-[#0D1117] text-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-[#00BFEF]">
                1-Tap WhatsApp Chama Broadcast
              </span>
              <span className="text-[10px] font-mono text-gray-400">Official Format</span>
            </div>

            <p className="text-xs text-[#DCE2E6]/80 leading-relaxed">
              Auto-generate formatted WhatsApp updates with contribution progress, beneficiary details, and payment instructions to share with the group chat.
            </p>

            <button
              type="button"
              onClick={handleShareWhatsAppReminder}
              className="w-full py-3 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg cursor-pointer transition-all"
            >
              <Send className="w-4 h-4" />
              <span>{copiedBroadcast ? 'Copied to Clipboard!' : 'Copy WhatsApp Broadcast Text'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: LOG M-PESA PAYMENT ================= */}
      {isLogPayOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E8EC] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-[#0D1117]">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-sm font-black uppercase text-[#0D1117]">
                Log Member Contribution
              </h4>
              <button
                type="button"
                onClick={() => setIsLogPayOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleConfirmMemberPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Select Member:</label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#0D1117] focus:outline-none focus:border-[#2563EB]"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.status === 'paid' ? 'Paid' : 'Pending'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Contribution Total (KES):</label>
                <input
                  type="text"
                  disabled
                  value="KES 5,500 (KES 5,000 Merry + KES 500 Welfare)"
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-600"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">M-Pesa Transaction Reference Code:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QKL90123A"
                  value={logMpesaRef}
                  onChange={(e) => setLogMpesaRef(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono uppercase text-[#0D1117] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsLogPayOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0D1117] text-white font-black text-xs uppercase tracking-wider"
                >
                  Confirm & Update Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: APPLY TABLE LOAN ================= */}
      {isNewLoanOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E8EC] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-[#0D1117]">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-sm font-black uppercase text-[#0D1117]">
                Apply for Table Banking Loan
              </h4>
              <button
                type="button"
                onClick={() => setIsNewLoanOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleApplyLoan} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Applicant Name:</label>
                <select
                  value={loanBorrower}
                  onChange={(e) => setLoanBorrower(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#0D1117] focus:outline-none focus:border-[#2563EB]"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Loan Principal Amount (KES):</label>
                <input
                  type="number"
                  min="1000"
                  max="50000"
                  value={loanPrincipal}
                  onChange={(e) => setLoanPrincipal(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-[#0D1117] focus:outline-none focus:border-[#2563EB]"
                />
                <span className="text-[10px] text-gray-500 mt-0.5 block font-mono">
                  Interest: 5% monthly • Repayment: KES {(Number(loanPrincipal) * 1.05).toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Loan Purpose:</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Purchase wholesale dry maize stock for resale"
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-[#0D1117] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewLoanOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#FF5A1F] text-white font-black text-xs uppercase tracking-wider"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── NON-PROMISES DISCLAIMER (NEIGHBORHOOD TRUST OS) ── */}
      <div className="mt-6 p-4 rounded-2xl bg-black/5 text-[11px] text-gray-500 leading-relaxed space-y-1">
        <span className="font-bold text-gray-700 block">Self-Governing Group Records</span>
        <p>
          Brief helps you organize your chama. Money moves directly between members through M-Pesa — Brief does not hold your funds and does not guarantee any payout. Your group governs itself.
        </p>
      </div>

    </div>
  );
}
