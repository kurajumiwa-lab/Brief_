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
  Share2,
  ExternalLink,
  MessageCircle,
  Package,
  Sparkles,
  ShoppingBag,
  Trophy
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface PipelineViewProps {
  space: Space;
  onRefresh: () => void;
  onShareOffer?: (offerTitle: string) => void;
  onViewCityFeed?: () => void;
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
  onViewCityFeed,
  className = ''
}) => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [activeDispatchCardId, setActiveDispatchCardId] = useState<string | null>(null);

  // Quote drafting state
  const [activeQuoteCardId, setActiveQuoteCardId] = useState<string | null>(null);
  const [quoteTitle, setQuoteTitle] = useState('Custom Order Proposal');
  const [quotePrice, setQuotePrice] = useState('4500');
  const [quoteNotes, setQuoteNotes] = useState('Includes packaging & stage drop-off');

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

  const handleSendQuote = async (conv: SpaceConversation) => {
    const numPrice = Number(quotePrice) || 0;
    if (numPrice <= 0) return;
    soundEngine.play('heavyTap');
    try {
      await briefApi.createSpaceQuote(space.id, conv.id, {
        title: quoteTitle.trim() || 'Custom Order Proposal',
        priceKes: numPrice,
        notes: quoteNotes.trim()
      });
      setActiveQuoteCardId(null);
      showToast(`Quote sent for KES ${numPrice.toLocaleString()}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to create quote:', err);
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

  const handleShareTracking = (conv: SpaceConversation, saccoName = '2NK Sacco', town = 'Nakuru') => {
    soundEngine.play('tap');
    const msg = encodeURIComponent(
      `Habari ${conv.customerName}! Your order from ${space.name} is on the way via ${saccoName} to ${town}. Asante sana!`
    );
    const phone = (conv.customerContact || '').replace(/[^\d]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
    showToast(`WhatsApp tracking link opened for ${conv.customerName}`);
  };

  const handleOpenWhatsAppChat = (phone?: string) => {
    const cleanPhone = (phone || '').replace(/[^\d]/g, '');
    const url = cleanPhone ? `https://wa.me/${cleanPhone}` : `https://wa.me/`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const conversations = space.recentConversations || [];
  const dispatches = (space as any).recentDispatches || [];
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

      {/* ── 1. "NAIROBI TONIGHT" CITY PREVIEW STRIP (Horizontal 3-Card Strip) ── */}
      <div className="p-4 rounded-3xl bg-[#1A1F2E] text-white space-y-3 shadow-md border border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#93EE34] animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-wider text-[#93EE34]">
              Nairobi Tonight · Live City Highlights
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              onViewCityFeed?.();
            }}
            className="text-[11px] font-bold text-[#93EE34] hover:underline flex items-center space-x-1 cursor-pointer"
          >
            <span>See Full City Feed</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3 Horizontal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Card 1: Events */}
          <div
            onClick={() => onViewCityFeed?.()}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 transition-all cursor-pointer space-y-1 border border-white/5"
          >
            <div className="flex items-center space-x-1 text-white/70 text-[9px] uppercase font-bold">
              <Clock className="w-3 h-3 text-[#93EE34]" />
              <span>Events & Night Market</span>
            </div>
            <p className="text-xs font-bold text-white truncate">Alchemist Street Festival</p>
            <p className="text-[10px] text-white/60">Tonight 7PM · Westlands</p>
          </div>

          {/* Card 2: Marketplace */}
          <div
            onClick={() => onViewCityFeed?.()}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 transition-all cursor-pointer space-y-1 border border-white/5"
          >
            <div className="flex items-center space-x-1 text-white/70 text-[9px] uppercase font-bold">
              <ShoppingBag className="w-3 h-3 text-[#E8985E]" />
              <span>Marketplace Drop</span>
            </div>
            <p className="text-xs font-bold text-white truncate">Zawadi Leather Tote</p>
            <p className="text-[10px] text-white/60">KES 2,800 · Kilimani</p>
          </div>

          {/* Card 3: EPL */}
          <div
            onClick={() => onViewCityFeed?.()}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 transition-all cursor-pointer space-y-1 border border-white/5"
          >
            <div className="flex items-center space-x-1 text-white/70 text-[9px] uppercase font-bold">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>EPL Matchday Room</span>
            </div>
            <p className="text-xs font-bold text-white truncate">Arsenal vs Chelsea</p>
            <p className="text-[10px] text-white/60">Gameweek 4 · 12 Spots</p>
          </div>
        </div>
      </div>

      {/* ── 2. COMPACT KPI HEADER STRIP ── */}
      <div className="p-4 rounded-3xl bg-white shadow-2xs border border-black/5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-[#64748B] font-semibold">Good morning, Amina</span>
            <span className="text-[10px] text-[#64748B] bg-[#FAFAF8] px-2 py-0.5 rounded-full font-bold">
              {space.type}
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-black text-[#1A1F2E] truncate mt-0.5">
            {space.name} — Pipeline
          </h2>
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

      {/* ── 3. PIPELINE TIMELINE OF ORDERS & CHATS ── */}
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
              const isQuoting = activeQuoteCardId === conv.id;

              const hasDispatches = dispatches.filter((d: any) => d.receiverName === conv.customerName || d.orderId === conv.orderId);
              const latestDispatch = hasDispatches[0];

              const pendingPrompt = conv.paymentPrompts?.find((p) => p.status === 'pending');
              const paidPrompt = conv.paymentPrompts?.find((p) => p.status === 'paid');
              const latestQuote = conv.quotes?.[conv.quotes.length - 1];

              // Lifecycle status calculation
              const isDispatched = !!latestDispatch;
              const isPaid = conv.status === 'converted' || !!paidPrompt;
              const isQuoteSent = !isPaid && !!latestQuote;
              const isInquiry = !isPaid && !isQuoteSent;

              const lastMessages = conv.messages?.slice(-2) || [];
              const price = conv.offerPriceKes || latestQuote?.priceKes || 4500;

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
                            isDispatched
                              ? 'bg-teal-100 text-teal-800'
                              : isPaid
                              ? 'bg-[#93EE34] text-[#1A1F2E]'
                              : isQuoteSent
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isDispatched
                            ? 'DISPATCHED'
                            : isPaid
                            ? 'PAID & READY'
                            : isQuoteSent
                            ? 'QUOTE SENT'
                            : 'INQUIRY'}
                        </span>
                        <span className="text-xs font-bold text-[#1A1F2E] truncate">
                          {conv.customerName}
                        </span>
                        {conv.customerContact && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenWhatsAppChat(conv.customerContact);
                            }}
                            className="p-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle className="w-3 h-3" />
                          </button>
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
                        KES {price.toLocaleString()}
                      </span>
                    </div>

                    {/* Dispatched Info if available */}
                    {isDispatched && (
                      <div className="p-2 rounded-xl bg-teal-50/70 border border-teal-200 text-teal-900 text-[11px] flex items-center justify-between">
                        <span className="flex items-center space-x-1 truncate">
                          <Truck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                          <span className="font-bold">{latestDispatch.carrierSacco}</span>
                          <span>→ {latestDispatch.destinationTown}</span>
                          <span className="font-mono text-[10px]">({latestDispatch.waybillRef})</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareTracking(conv, latestDispatch.carrierSacco, latestDispatch.destinationTown);
                          }}
                          className="text-[10px] font-bold text-teal-800 underline ml-2 shrink-0 cursor-pointer"
                        >
                          Share Tracking
                        </button>
                      </div>
                    )}

                    {/* Recent 2 messages snippet */}
                    {lastMessages.length > 0 && (
                      <div className="space-y-1 pt-0.5">
                        {lastMessages.map((m) => (
                          <p key={m.id} className="text-[11px] text-[#64748B] bg-[#F4F7F2] p-1.5 rounded-xl truncate">
                            💬 <strong className="text-[#1A1F2E]">{m.from === 'customer' ? conv.customerName : 'You'}:</strong> {m.text}
                          </p>
                        ))}
                      </div>
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

                      {/* ── INLINE ACTION BAR BASED ON STATE ── */}
                      {isInquiry && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveQuoteCardId(isQuoting ? null : conv.id)}
                              className="py-2 rounded-xl bg-[#FAFAF8] hover:bg-black/5 text-[#1A1F2E] text-xs font-bold border border-black/5 cursor-pointer"
                            >
                              {isQuoting ? 'Cancel Quote' : '📝 Send Quote'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTriggerMpesa(conv, price)}
                              className="py-2 rounded-xl bg-[#1A1F2E] hover:bg-black text-[#93EE34] text-xs font-black shadow-xs cursor-pointer flex items-center justify-center space-x-1"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Trigger M-Pesa</span>
                            </button>
                          </div>

                          {/* Inline Quote Drawer Form */}
                          {isQuoting && (
                            <div className="p-3 bg-white rounded-2xl border border-black/5 space-y-2 animate-fadeIn">
                              <span className="text-[10px] font-black uppercase tracking-wider text-[#5B2EA6]">
                                Prepare Quotation for {conv.customerName}
                              </span>
                              <input
                                type="text"
                                placeholder="Proposal Title"
                                value={quoteTitle}
                                onChange={(e) => setQuoteTitle(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#FAFAF8] text-xs border border-black/5"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  placeholder="Price (KES)"
                                  value={quotePrice}
                                  onChange={(e) => setQuotePrice(e.target.value)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#FAFAF8] text-xs border border-black/5"
                                />
                                <input
                                  type="text"
                                  placeholder="Notes"
                                  value={quoteNotes}
                                  onChange={(e) => setQuoteNotes(e.target.value)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#FAFAF8] text-xs border border-black/5"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSendQuote(conv)}
                                className="w-full py-2 rounded-xl bg-[#5B2EA6] text-white text-xs font-bold cursor-pointer"
                              >
                                Post Quote into Conversation
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {isQuoteSent && !isPaid && (
                        <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900">
                              Quote Sent · Waiting on Customer
                            </span>
                            <span className="text-xs font-black text-blue-900">
                              KES {price.toLocaleString()}
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
                              onClick={() => handleTriggerMpesa(conv, price)}
                              className="w-full py-2 rounded-xl bg-[#1A1F2E] hover:bg-black text-[#93EE34] text-xs font-black shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Trigger M-Pesa STK Push (KES {price.toLocaleString()})</span>
                            </button>
                          )}
                        </div>
                      )}

                      {isPaid && (
                        <div className="space-y-2">
                          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 text-xs font-bold flex items-center justify-between">
                            <span className="flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>M-Pesa Verified (Receipt {paidPrompt?.receipt || 'Confirmed'})</span>
                            </span>
                            <span>KES {price.toLocaleString()}</span>
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
                                  onClick={() => handleShareTracking(conv, carrierSacco, destTown)}
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

      {/* ── 4. SINGLE NET-PROFIT PILL AT BOTTOM OF SCROLL ── */}
      <div className="p-4 rounded-3xl bg-[#1A1F2E] text-white flex items-center justify-between shadow-xs border border-white/10">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-[#93EE34]" />
          <div>
            <span className="text-[10px] text-white/70 uppercase font-bold block">Today's Net Take-Home</span>
            <span className="text-sm font-black text-[#93EE34]">KES {revenueKes.toLocaleString()}</span>
          </div>
        </div>
        <span className="text-[10px] text-white/60 bg-white/10 px-2.5 py-1 rounded-full font-bold">
          {space.name}
        </span>
      </div>
    </div>
  );
};

export default PipelineView;
