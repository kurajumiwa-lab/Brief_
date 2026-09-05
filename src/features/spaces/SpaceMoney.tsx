import React, { useState, useEffect } from 'react';
import type { SpaceMoneySummary, SpaceExpense, SpaceCustomerTab } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import {
  DollarSign,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Plus,
  BookOpen,
  ShoppingBag,
  MessageCircle,
  CheckCircle2,
  FileText,
  CreditCard,
  Zap,
  Sparkles
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface SpaceMoneyProps {
  spaceId?: string;
  revenueKes?: number;
  pendingKes?: number;
  ordersCount?: number;
  onViewLedger?: () => void;
  className?: string;
}

const QUICK_CATEGORIES = [
  { id: 'Ingredients', label: '🌾 Ingredients' },
  { id: 'Transport', label: '🛵 Transport' },
  { id: 'Packaging', label: '📦 Packaging' },
  { id: 'Airtime', label: '📱 Airtime' }
];

export const SpaceMoney: React.FC<SpaceMoneyProps> = ({
  spaceId = '',
  revenueKes = 0,
  pendingKes = 0,
  ordersCount = 0,
  onViewLedger,
  className = ''
}) => {
  const [summary, setSummary] = useState<SpaceMoneySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Expense form state
  const [showExpenseForm, setShowExpenseForm] = useState<boolean>(false);
  const [expCategory, setExpCategory] = useState<string>('supplies');
  const [expDesc, setExpDesc] = useState<string>('');
  const [expAmount, setExpAmount] = useState<string>('');

  // Quick Expense Logger state (<3s entry)
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickCategory, setQuickCategory] = useState<string>('Ingredients');
  const [loggingQuick, setLoggingQuick] = useState<boolean>(false);

  // Tab form state
  const [showTabForm, setShowTabForm] = useState<boolean>(false);
  const [tabCustomerName, setTabCustomerName] = useState<string>('');
  const [tabCustomerPhone, setTabCustomerPhone] = useState<string>('');
  const [tabAmount, setTabAmount] = useState<string>('');
  const [tabNote, setTabNote] = useState<string>('');

  // Tab payment state
  const [activePayingTab, setActivePayingTab] = useState<SpaceCustomerTab | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadSummary = async () => {
    if (!spaceId) return;
    setLoading(true);
    try {
      const res = await briefApi.getSpaceMoneySummary(spaceId);
      if (res.ok && res.data?.money) {
        setSummary(res.data.money);
      }
    } catch (err) {
      console.error('Failed to load money summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (spaceId) {
      loadSummary();
    }
  }, [spaceId]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(expAmount);
    if (!expDesc.trim() || isNaN(numAmount) || numAmount <= 0) return;

    soundEngine.play('heavyTap');
    try {
      await briefApi.recordSpaceExpense(spaceId, {
        category: expCategory,
        description: expDesc.trim(),
        amountKes: numAmount
      });
      setExpDesc('');
      setExpAmount('');
      setShowExpenseForm(false);
      showToast('Expense recorded');
      loadSummary();
    } catch (err) {
      console.error('Failed to record expense:', err);
    }
  };

  const handleQuickLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(quickAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setLoggingQuick(true);
    soundEngine.play('heavyTap');
    try {
      await briefApi.recordSpaceExpense(spaceId, {
        category: quickCategory.toLowerCase(),
        description: `${quickCategory} purchase`,
        amountKes: numAmount
      });
      setQuickAmount('');
      showToast(`Logged KES ${numAmount.toLocaleString()} for ${quickCategory}`);
      loadSummary();
    } catch (err) {
      console.error('Failed to quick log expense:', err);
    } finally {
      setLoggingQuick(false);
    }
  };

  const handleAddTab = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(tabAmount);
    if (!tabCustomerName.trim() || isNaN(numAmount) || numAmount <= 0) return;

    soundEngine.play('heavyTap');
    try {
      await briefApi.recordSpaceCustomerTab(spaceId, {
        customerName: tabCustomerName.trim(),
        customerContact: tabCustomerPhone.trim(),
        amountKes: numAmount,
        note: tabNote.trim()
      });
      setTabCustomerName('');
      setTabCustomerPhone('');
      setTabAmount('');
      setTabNote('');
      setShowTabForm(false);
      showToast('Customer credit tab recorded in DukaBook');
      loadSummary();
    } catch (err) {
      console.error('Failed to record tab:', err);
    }
  };

  const handleRecordTabPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePayingTab) return;
    const numAmount = Number(paymentAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    soundEngine.play('reward');
    try {
      await briefApi.recordSpaceTabPayment(spaceId, activePayingTab.id, {
        amountKes: numAmount,
        note: paymentNote.trim() || 'Tab installment'
      });
      setActivePayingTab(null);
      setPaymentAmount('');
      setPaymentNote('');
      showToast('Payment credited to customer tab');
      loadSummary();
    } catch (err) {
      console.error('Failed to record tab payment:', err);
    }
  };

  const handleSendReminder = (tab: SpaceCustomerTab) => {
    soundEngine.play('tap');
    const politeText = encodeURIComponent(
      `Habari ${tab.customerName}, gentle reminder regarding your balance of KES ${tab.balanceKes.toLocaleString()}${tab.notes ? ` for ${tab.notes}` : ''}. Whenever convenient, you can settle via M-Pesa. Asante sana!`
    );
    const phone = (tab.customerContact || '').replace(/[^\d]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${politeText}` : `https://wa.me/?text=${politeText}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
    showToast(`WhatsApp reminder prepared for ${tab.customerName}`);
  };

  const totalRev = summary?.totalRevenueKes ?? revenueKes;
  const totalExp = summary?.totalExpensesKes ?? 0;
  const netProfit = summary?.netProfitKes ?? (totalRev - totalExp);
  const marginPct = summary?.marginPercent ?? (totalRev > 0 ? Math.round((netProfit / totalRev) * 100) : 0);
  const receivables = summary?.totalReceivablesKes ?? 0;

  return (
    <section className={`space-y-6 max-w-2xl mx-auto ${className}`}>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* ── PROFIT & CASH FLOW HERO METER (ZERO-ERP) ── */}
      <div className="p-5 rounded-3xl bg-white shadow-2xs space-y-4 border border-black/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-xl bg-[#5B2EA6]/10 text-[#5B2EA6]">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F2E]">
              Profit & Cash Flow
            </h3>
          </div>
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[#93EE34]/20 text-[#1A1F2E] text-[10px] font-black animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[#93EE34]" />
            <span>Server Authoritative</span>
          </div>
        </div>

        {/* 3-Way Cashflow Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Money In */}
          <div className="p-4 rounded-2xl bg-[#93EE34]/15 border border-[#93EE34]/30 space-y-1">
            <div className="flex items-center space-x-1 text-[#1A1F2E] text-[10px] font-bold uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
              <span>Money In (Sales)</span>
            </div>
            <p className="text-lg font-black text-[#1A1F2E]">
              KES {totalRev.toLocaleString()}
            </p>
            <p className="text-[10px] text-[#64748B]">
              Completed space orders
            </p>
          </div>

          {/* Money Out */}
          <div className="p-4 rounded-2xl bg-[#FCE3EA] border border-[#E8985E]/20 space-y-1">
            <div className="flex items-center space-x-1 text-[#1A1F2E] text-[10px] font-bold uppercase tracking-wider">
              <ArrowUp className="w-3.5 h-3.5 text-rose-700" />
              <span>Money Out (Supplies)</span>
            </div>
            <p className="text-lg font-black text-[#1A1F2E]">
              KES {totalExp.toLocaleString()}
            </p>
            <p className="text-[10px] text-[#64748B]">
              Ingredients & costs
            </p>
          </div>

          {/* Net Profit */}
          <div className="p-4 rounded-2xl bg-[#1A1F2E] text-white space-y-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                Net Profit
              </span>
              <span className="text-[9px] font-extrabold bg-white/20 text-[#93EE34] px-1.5 py-0.5 rounded-full">
                {marginPct}% Margin
              </span>
            </div>
            <p className="text-lg font-black text-[#93EE34]">
              KES {netProfit.toLocaleString()}
            </p>
            <p className="text-[10px] text-white/70">
              Clear operator take-home
            </p>
          </div>
        </div>

        {/* Action Button Strip */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setShowExpenseForm(!showExpenseForm);
              setShowTabForm(false);
            }}
            className="flex-1 py-2 rounded-xl bg-[#FAFAF8] hover:bg-black/5 text-[#1A1F2E] font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer border border-black/5"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#E8985E]" />
            <span>+ Record Expense</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowTabForm(!showTabForm);
              setShowExpenseForm(false);
            }}
            className="flex-1 py-2 rounded-xl bg-[#FAFAF8] hover:bg-black/5 text-[#1A1F2E] font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer border border-black/5"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#5B2EA6]" />
            <span>+ Open DukaBook Tab</span>
          </button>
        </div>

        {/* ── EXPENSE QUICK-LOGGER (<3s entry) ── */}
        <div className="p-3.5 rounded-2xl bg-[#FAFAF8] border border-black/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#1A1F2E] flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick-Log Outflow (&lt; 3s)</span>
            </span>
            <span className="text-[10px] text-[#64748B]">Instant ledger update</span>
          </div>

          <form onSubmit={handleQuickLogExpense} className="space-y-2">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
              {QUICK_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setQuickCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                    quickCategory === cat.id
                      ? 'bg-[#1A1F2E] text-[#93EE34]'
                      : 'bg-white border border-black/5 text-[#64748B] hover:text-[#1A1F2E]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2 text-xs font-bold text-[#64748B]">KES</span>
                <input
                  type="number"
                  placeholder="350"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  className="w-full pl-11 pr-3 py-1.5 rounded-xl bg-white text-xs border border-black/5 font-bold focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loggingQuick || !quickAmount}
                className="px-4 py-1.5 rounded-xl bg-[#1A1F2E] hover:bg-black text-[#93EE34] font-bold text-xs transition-all cursor-pointer shadow-xs disabled:opacity-40 shrink-0"
              >
                {loggingQuick ? 'Logging...' : 'Log Outflow'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── FULL EXPENSE FORM ── */}
      {showExpenseForm && (
        <form onSubmit={handleAddExpense} className="p-5 rounded-3xl bg-[#F4F7F2] border border-black/5 shadow-sm space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1A1F2E]">Record Operating Expense</span>
            <button
              type="button"
              onClick={() => setShowExpenseForm(false)}
              className="text-[11px] text-[#64748B] hover:text-[#1A1F2E]"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Description (e.g. 5kg Flour, Cake boxes)"
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none"
              required
            />
            <input
              type="number"
              placeholder="Amount (KES)"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-[#1A1F2E] hover:bg-black text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            Save Expense
          </button>
        </form>
      )}

      {/* ── DUKABOOK TAB FORM ── */}
      {showTabForm && (
        <form onSubmit={handleAddTab} className="p-5 rounded-3xl bg-[#FCE3EA]/50 border border-black/5 shadow-sm space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1A1F2E]">Open Customer Credit Tab (Lipa Pole Pole)</span>
            <button
              type="button"
              onClick={() => setShowTabForm(false)}
              className="text-[11px] text-[#64748B] hover:text-[#1A1F2E]"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Customer Name"
              value={tabCustomerName}
              onChange={(e) => setTabCustomerName(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none"
              required
            />
            <input
              type="tel"
              placeholder="Phone (e.g. 254712345678)"
              value={tabCustomerPhone}
              onChange={(e) => setTabCustomerPhone(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Credit Balance (KES)"
              value={tabAmount}
              onChange={(e) => setTabAmount(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none"
              required
            />
            <input
              type="text"
              placeholder="Notes (e.g. 2 birthday cakes for Mary)"
              value={tabNote}
              onChange={(e) => setTabNote(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-[#5B2EA6] hover:bg-[#4a2489] text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            Record in DukaBook
          </button>
        </form>
      )}

      {/* ── TAB PAYMENT INLINE FORM ── */}
      {activePayingTab && (
        <form onSubmit={handleRecordTabPayment} className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200 shadow-sm space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">
              Record Payment from {activePayingTab.customerName} (Current Balance: KES {activePayingTab.balanceKes.toLocaleString()})
            </span>
            <button
              type="button"
              onClick={() => setActivePayingTab(null)}
              className="text-[11px] text-[#64748B] hover:text-[#1A1F2E]"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Amount Paid (KES)"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              max={activePayingTab.balanceKes}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none"
              required
            />
            <input
              type="text"
              placeholder="Payment Note (e.g. M-Pesa partial installment)"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            Credit Payment to Tab
          </button>
        </form>
      )}

      {/* ── DUKABOOK CREDIT (LIPA POLE POLE) LEDGER ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-[#5B2EA6]" />
            <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F2E]">
              DukaBook Credit ({summary?.tabs?.length ?? 0})
            </h3>
          </div>
          {receivables > 0 && (
            <span className="text-[11px] font-bold text-[#E8985E]">
              KES {receivables.toLocaleString()} outstanding
            </span>
          )}
        </div>

        {(!summary?.tabs || summary.tabs.length === 0) ? (
          <div className="p-4 rounded-2xl bg-white border border-black/5 text-center">
            <p className="text-xs text-[#64748B]">No customer credit tabs recorded. Keep track of informal "Lipa Pole Pole" balances here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {summary.tabs.map((tab) => (
              <div
                key={tab.id}
                className="p-4 rounded-2xl bg-white border border-black/5 shadow-2xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1A1F2E]">{tab.customerName}</h4>
                    {tab.notes && <p className="text-[10px] text-[#64748B]">{tab.notes}</p>}
                  </div>
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                      tab.status === 'cleared'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {tab.status === 'cleared' ? 'Cleared' : `KES ${tab.balanceKes.toLocaleString()} due`}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#FAFAF8] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#5B2EA6] h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((tab.initialDebtKes - tab.balanceKes) / tab.initialDebtKes) * 100)
                      )}%`
                    }}
                  />
                </div>

                {tab.status === 'active' && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePayingTab(tab);
                        setPaymentAmount(String(tab.balanceKes));
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-[#FAFAF8] hover:bg-black/5 text-emerald-800 text-[10px] font-bold transition-colors cursor-pointer border border-black/5"
                    >
                      Record Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendReminder(tab)}
                      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
                      title="Send gentle WhatsApp reminder"
                      aria-label="Send gentle WhatsApp reminder"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RECENT SUPPLIES & EXPENSES AUDIT FEED ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#E8985E]" />
            <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F2E]">
              Recent Supplies & Expenses ({summary?.recentExpenses?.length ?? 0})
            </h3>
          </div>
        </div>

        {(!summary?.recentExpenses || summary.recentExpenses.length === 0) ? (
          <div className="p-4 rounded-2xl bg-white border border-black/5 text-center">
            <p className="text-xs text-[#64748B]">No expenses recorded yet. Track ingredients and delivery costs to see your true daily take-home.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {summary.recentExpenses.map((exp) => (
              <div
                key={exp.id}
                className="p-3 rounded-2xl bg-white border border-black/5 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#1A1F2E] truncate">{exp.description}</p>
                  <p className="text-[10px] text-[#64748B]">
                    {exp.category} · {exp.date}
                  </p>
                </div>
                <span className="text-xs font-black text-rose-700 shrink-0">
                  - KES {exp.amountKes.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default SpaceMoney;
