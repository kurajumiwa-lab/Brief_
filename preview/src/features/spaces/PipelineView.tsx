import React, { useState } from 'react';
import type { Space, SpaceConversation, SpaceDispatch, SpaceDispatchStatus } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import {
  Truck,
  MessageSquare,
  Smartphone,
  Tag,
  CheckCircle2,
  ChevronDown,
  Send,
  MapPin,
  Clock,
  ArrowRight,
  TrendingUp,
  Share2
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface PipelineViewProps {
  space: Space;
  onRefresh: () => void;
  onShareOffer?: (offerTitle: string) => void;
  className?: string;
}

const COMMON_COUNTIES = [
  'Nakuru', 'Mombasa', 'Kisumu', 'Eldoret / Uasin Gishu', 'Nyeri', 'Kiambu', 'Machakos', 'Meru', 'Kakamega', 'Kisii', 'Kericho', 'Nanyuki / Laikipia', 'Kilifi / Malindi'
];

const POPULAR_CARRIERS = [
  '2NK Sacco', 'Easy Coach', 'Mololine Shuttle', 'Transline Galaxy', 'Guardian Coach', 'North Rift Shuttle', '4NTE Sacco', 'Modern Coast', 'Direct Boda / Local Rider'
];

export const PipelineView: React.FC<PipelineViewProps> = ({
  space,
  onRefresh,
  onShareOffer,
  className = ''
}) => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [activeDispatchCardId, setActiveDispatchCardId] = useState<string | null>(null);

  // Inline chat state
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingMsg, setSendingMsg] = useState(false);

  // Inline dispatch form state
  const [destCounty, setDestCounty] = useState('Nakuru');
  const [destTown, setDestTown] = useState('Nakuru Town KFA Stage');
  const [carrierSacco, setCarrierSacco] = useState('2NK Sacco');
  const [conductorPhone, setConductorPhone] = useState('');
  const [stageFee, setStageFee] = useState('300');
  const [dispatchNotes, setDispatchNotes] = useState('Fragile cake, keep level');
  const [submittingDispatch, setSubmittingDispatch] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSendReply = async (convId: string, text: string) => {
    if (!text.trim() || sendingMsg) return;
    setSendingMsg(true);
    soundEngine.play('tap');
    try {
      await briefApi.postSpaceMessage(space.id, convId, {
        text: text.trim(),
        from: 'owner',
        sender: space.name
      });
      setReplyText((prev) => ({ ...prev, [convId]: '' }));
      showToast('Reply sent');
      onRefresh();
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleTriggerMpesa = async (conv: SpaceConversation, amount: number) => {
    soundEngine.play('heavyTap');
    try {
      await briefApi.triggerSpaceMpesaPrompt(space.id, conv.id, {
        phoneNumber: conv.customerContact || '254712345678',
        amountKes: amount,
        description: `Payment for ${conv.offerTitle || 'Order'}`
      });
      showToast(`M-Pesa STK Prompt sent for KES ${amount.toLocaleString()}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to trigger STK prompt:', err);
    }
  };

  const handleSimulatePayment = async (convId: string, promptId: string, amount: number) => {
    soundEngine.play('reward');
    try {
      await briefApi.completeSpaceMpesaPayment(space.id, convId, {
        paymentRequestId: promptId,
        amountPaid: amount
      });
      showToast(`Payment Confirmed! Order created for KES ${amount.toLocaleString()}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to complete payment:', err);
    }
  };

  const handleSubmitInlineDispatch = async (conv: SpaceConversation) => {
    if (submittingDispatch) return;
    setSubmittingDispatch(true);
    soundEngine.play('reward');
    try {
      const res = await briefApi.createSpaceDispatch(space.id, {
        orderId: conv.orderId || null,
        destinationCounty: destCounty.trim(),
        destinationTown: destTown.trim(),
        carrierSacco: carrierSacco.trim(),
        receiverName: conv.customerName,
        receiverPhone: conv.customerContact || '254712345678',
        conductorContact: conductorPhone.trim(),
        stageFeeKes: Number(stageFee || 0),
        notes: dispatchNotes.trim()
      });

      if (res.ok && res.data?.dispatch) {
        showToast(`Dispatched via ${carrierSacco} (${res.data.dispatch.waybillRef})`);
        setActiveDispatchCardId(null);
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to create dispatch:', err);
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const handleShareTracking = (conv: SpaceConversation) => {
    soundEngine.play('tap');
    const msg = encodeURIComponent(
      `Habari ${conv.customerName}! Your order from ${space.name} is on the way via ${carrierSacco} to ${destTown} (${destCounty}). Asante sana!`
    );
    const phone = (conv.customerContact || '').replace(/[^\d]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
    showToast(`WhatsApp tracking prepared for ${conv.customerName}`);
  };

  const conversations = space.recentConversations || [];
  const revenueKes = space.metrics?.revenueKes || 0;
  const activeOrdersCount = space.metrics?.activeOrdersCount || 0;

  return (
    <div className={`space-y-5 max-w-2xl mx-auto ${className}`}>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* ── COMPACT KPI HEADER STRIP ── */}
      <div className="p-4 rounded-3xl bg-white shadow-2xs border border-black/5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-black text-[#1A1F2E] truncate">{space.name}</h2>
            <span className="text-[10px] text-[#64748B] bg-[#FAFAF8] px-2 py-0.5 rounded-full font-bold">
              {space.type}
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] truncate mt-0.5">
            {space.goal || 'Active Pipeline'}
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="px-3 py-1.5 rounded-2xl bg-[#93EE34]/20 border border-[#93EE34]/40 text-[#1A1F2E] text-right">
            <span className="text-[9px] uppercase tracking-wider font-extrabold block text-[#1A1F2E]/70">Take-home</span>
            <span className="text-xs font-black block text-[#1A1F2E]">KES {revenueKes.toLocaleString()}</span>
          </div>
          <div className="px-2.5 py-1.5 rounded-2xl bg-[#1A1F2E] text-[#93EE34] text-xs font-black">
            {activeOrdersCount} Active
          </div>
        </div>
      </div>

      {/* ── PIPELINE TIMELINE OF ORDERS & CHATS ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-[#1A1F2E]">
            Active Orders & Inquiries ({conversations.length})
          </span>
          <span className="text-[10px] text-[#64748B]">Real-time stream</span>
        </div>

        {conversations.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-black/5 text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
            <p className="text-xs font-bold text-[#1A1F2E]">No active orders in pipeline</p>
            <p className="text-[11px] text-[#64748B] max-w-sm mx-auto">
              Share your catalog offers on WhatsApp or social channels to receive inbound inquiries and orders.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => {
              const isExpanded = expandedCardId === conv.id;
              const isDispatching = activeDispatchCardId === conv.id;
              const isConverted = conv.status === 'converted';
              const lastMsg = conv.messages?.[conv.messages.length - 1];
              const pendingPrompt = conv.paymentPrompts?.find((p) => p.status === 'pending');
              const paidPrompt = conv.paymentPrompts?.find((p) => p.status === 'paid');

              return (
                <div
                  key={conv.id}
                  className="rounded-3xl bg-white border border-black/5 shadow-2xs overflow-hidden transition-all"
                >
                  {/* Card Main Row */}
                  <div
                    onClick={() => setExpandedCardId(isExpanded ? null : conv.id)}
                    className="p-4 cursor-pointer hover:bg-[#FAFAF8] transition-colors space-y-2.5"
                  >
                    {/* Header: Status badge, customer name, contact */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span
                          className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 ${
                            isConverted
                              ? 'bg-[#93EE34] text-[#1A1F2E]'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isConverted ? 'PAID & READY' : 'NEW INQUIRY'}
                        </span>
                        <span className="text-xs font-bold text-[#1A1F2E] truncate">
                          {conv.customerName}
                        </span>
                        {conv.customerContact && (
                          <span className="text-[10px] text-[#64748B] font-mono hidden sm:inline">
                            {conv.customerContact}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <ChevronDown className={`w-4 h-4 text-[#64748B] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Single-line token summary */}
                    <div className="flex items-center justify-between text-xs">
                      <p className="font-bold text-[#1A1F2E] truncate">
                        🎂 {conv.offerTitle || 'Custom Order'}
                      </p>
                      <span className="font-black text-[#1A1F2E] shrink-0 ml-2">
                        KES {(conv.offerPriceKes || 4500).toLocaleString()}
                      </span>
                    </div>

                    {/* Latest message snippet */}
                    {lastMsg && (
                      <p className="text-[11px] text-[#64748B] bg-[#F4F7F2] p-2 rounded-xl truncate">
                        💬 <strong className="text-[#1A1F2E]">{lastMsg.from === 'customer' ? conv.customerName : 'You'}:</strong> {lastMsg.text}
                      </p>
                    )}
                  </div>

                  {/* ── EXPANDED LIFECYCLE CONTROLS ── */}
                  {isExpanded && (
                    <div className="p-4 bg-[#FAFAF8] border-t border-black/5 space-y-3.5 animate-fadeIn">
                      {/* Full Chat Thread */}
                      <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-white rounded-2xl border border-black/5">
                        {conv.messages?.map((m) => (
                          <div
                            key={m.id}
                            className={`flex flex-col ${m.from === 'customer' ? 'items-start' : 'items-end'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-xl p-2 text-xs font-medium ${
                                m.from === 'customer'
                                  ? 'bg-[#F4F7F2] text-[#1A1F2E]'
                                  : m.from === 'system'
                                  ? 'bg-[#93EE34]/20 text-[#1A1F2E]'
                                  : 'bg-[#5B2EA6] text-white'
                              }`}
                            >
                              <p>{m.text}</p>
                              {m.quote && (
                                <div className="mt-1 p-2 rounded-lg bg-white text-[#1A1F2E] shadow-2xs text-[11px]">
                                  <strong>Quote:</strong> KES {m.quote.priceKes.toLocaleString()} ({m.quote.title})
                                </div>
                              )}
                            </div>
                            <span className="text-[8px] text-[#64748B] mt-0.5">
                              {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Inline Quick Reply Form */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendReply(conv.id, replyText[conv.id] || '');
                        }}
                        className="flex items-center space-x-1.5"
                      >
                        <input
                          type="text"
                          placeholder={`Reply to ${conv.customerName}...`}
                          value={replyText[conv.id] || ''}
                          onChange={(e) => setReplyText({ ...replyText, [conv.id]: e.target.value })}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-white text-xs border border-black/5 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!replyText[conv.id]?.trim() || sendingMsg}
                          className="p-2 rounded-xl bg-[#1A1F2E] text-[#93EE34] disabled:opacity-40 transition-all cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>

                      {/* Payment Action Bar */}
                      {!isConverted ? (
                        <div className="p-3 rounded-2xl bg-[#93EE34]/15 border border-[#93EE34]/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1F2E]">
                              Payment Required
                            </span>
                            <span className="text-xs font-black text-[#1A1F2E]">
                              KES {(conv.offerPriceKes || 4500).toLocaleString()}
                            </span>
                          </div>

                          {pendingPrompt ? (
                            <button
                              type="button"
                              onClick={() => handleSimulatePayment(conv.id, pendingPrompt.id, pendingPrompt.amountKes)}
                              className="w-full py-2 rounded-xl bg-[#1A1F2E] hover:bg-black text-[#93EE34] text-xs font-black shadow-xs cursor-pointer"
                            >
                              Simulate Customer M-Pesa PIN Confirmation
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleTriggerMpesa(conv, conv.offerPriceKes || 4500)}
                              className="w-full py-2 rounded-xl bg-[#1A1F2E] hover:bg-black text-[#93EE34] text-xs font-black shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Trigger M-Pesa STK Push (KES {(conv.offerPriceKes || 4500).toLocaleString()})</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        /* Paid State: Shipping & Dispatch Action */
                        <div className="space-y-2">
                          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 text-xs font-bold flex items-center justify-between">
                            <span className="flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>M-Pesa Verified (Receipt {paidPrompt?.receipt || 'Confirmed'})</span>
                            </span>
                            <span>KES {(conv.offerPriceKes || 4500).toLocaleString()}</span>
                          </div>

                          {/* Inline WAIRO Dispatch Action */}
                          {!isDispatching ? (
                            <button
                              type="button"
                              onClick={() => setActiveDispatchCardId(conv.id)}
                              className="w-full py-2 rounded-xl bg-[#1A1F2E] hover:bg-black text-[#93EE34] text-xs font-black transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                            >
                              <Truck className="w-4 h-4" />
                              <span>Ship via WAIRO Cargo (Inter-County Matatu Stage)</span>
                            </button>
                          ) : (
                            /* Inline WAIRO Cargo Expansion Form */
                            <div className="p-3.5 rounded-2xl bg-white border border-black/5 shadow-xs space-y-2.5 animate-fadeIn">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#1A1F2E] flex items-center space-x-1">
                                  <Truck className="w-3.5 h-3.5 text-[#5B2EA6]" />
                                  <span>Inline WAIRO Dispatch to {conv.customerName}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveDispatchCardId(null)}
                                  className="text-[10px] text-[#64748B] hover:text-[#1A1F2E]"
                                >
                                  Cancel
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={destCounty}
                                  onChange={(e) => setDestCounty(e.target.value)}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
                                >
                                  {COMMON_COUNTIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  placeholder="Stage (e.g. KFA Stage)"
                                  value={destTown}
                                  onChange={(e) => setDestTown(e.target.value)}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={carrierSacco}
                                  onChange={(e) => setCarrierSacco(e.target.value)}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
                                >
                                  {POPULAR_CARRIERS.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                                <input
                                  type="tel"
                                  placeholder="Conductor Phone (opt)"
                                  value={conductorPhone}
                                  onChange={(e) => setConductorPhone(e.target.value)}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSubmitInlineDispatch(conv)}
                                  disabled={submittingDispatch}
                                  className="flex-1 py-2 rounded-xl bg-[#1A1F2E] hover:bg-black text-[#93EE34] text-xs font-black transition-all cursor-pointer"
                                >
                                  {submittingDispatch ? 'Waybill Issuing...' : 'Generate Waybill & Mark Dispatched'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleShareTracking(conv)}
                                  className="p-2 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                                  title="Share WhatsApp tracking"
                                >
                                  <Share2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── RECENT ACTIVITY AUDIT FEED ── */}
      {space.recentActivities && space.recentActivities.length > 0 && (
        <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">
            Recent Pipeline Activity
          </span>
          <div className="space-y-1.5">
            {space.recentActivities.slice(0, 4).map((a) => (
              <div key={a.id} className="text-xs text-[#1A1F2E] flex items-center justify-between">
                <span className="truncate">⚡ {a.title}</span>
                <span className="text-[9px] text-[#64748B] shrink-0 ml-2">
                  {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineView;
