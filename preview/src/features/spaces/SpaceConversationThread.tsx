import React, { useState } from 'react';
import type { SpaceConversation, SpaceQuote, SpacePaymentPrompt } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { MessageSquare, Send, CheckCircle2, DollarSign, Smartphone, Tag, ArrowLeft, Clock } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface SpaceConversationThreadProps {
  spaceId: string;
  conversation: SpaceConversation;
  onBack?: () => void;
  onUpdated?: () => void;
  className?: string;
}

export const SpaceConversationThread: React.FC<SpaceConversationThreadProps> = ({
  spaceId,
  conversation,
  onBack,
  onUpdated,
  className = ''
}) => {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // Quote generator state
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteTitle, setQuoteTitle] = useState(conversation.offerTitle ? `Custom ${conversation.offerTitle}` : 'Custom Order');
  const [quotePrice, setQuotePrice] = useState<string>(conversation.offerPriceKes ? String(conversation.offerPriceKes) : '5000');
  const [quoteNotes, setQuoteNotes] = useState('');

  // M-Pesa prompt state
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [promptPhone, setPromptPhone] = useState(conversation.customerContact || '254712345678');
  const [promptAmount, setPromptAmount] = useState<string>(conversation.offerPriceKes ? String(conversation.offerPriceKes) : '5000');
  const [promptDesc, setPromptDesc] = useState(conversation.offerTitle ? `Payment for ${conversation.offerTitle}` : 'Order Payment');
  const [activeQuoteId, setActiveQuoteId] = useState<string | undefined>(undefined);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    soundEngine.play('heavyTap');
    try {
      await briefApi.postSpaceMessage(spaceId, conversation.id, {
        text: inputText.trim(),
        from: 'owner',
        sender: 'You'
      });
      setInputText('');
      onUpdated?.();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSendQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = Number(quotePrice);
    if (!quoteTitle.trim() || isNaN(numPrice) || numPrice <= 0 || sending) return;

    setSending(true);
    soundEngine.play('reward');
    try {
      await briefApi.createSpaceQuote(spaceId, conversation.id, {
        title: quoteTitle.trim(),
        priceKes: numPrice,
        notes: quoteNotes.trim()
      });
      setShowQuoteForm(false);
      onUpdated?.();
    } catch (err) {
      console.error('Failed to create quote:', err);
    } finally {
      setSending(false);
    }
  };

  const handleTriggerMpesa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numAmount = Number(promptAmount);
    if (isNaN(numAmount) || numAmount <= 0 || sending) return;

    setSending(true);
    soundEngine.play('heavyTap');
    try {
      await briefApi.triggerSpaceMpesaPrompt(spaceId, conversation.id, {
        quoteId: activeQuoteId,
        phoneNumber: promptPhone,
        amountKes: numAmount,
        description: promptDesc
      });
      setShowPromptForm(false);
      onUpdated?.();
    } catch (err) {
      console.error('Failed to trigger STK push:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSimulatePayment = async (promptId: string, amount: number) => {
    setSending(true);
    soundEngine.play('reward');
    try {
      await briefApi.completeSpaceMpesaPayment(spaceId, conversation.id, {
        paymentRequestId: promptId,
        amountPaid: amount
      });
      onUpdated?.();
    } catch (err) {
      console.error('Failed to complete payment:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white rounded-3xl shadow-sm overflow-hidden ${className}`}>
      {/* ── THREAD HEADER ── */}
      <div className="p-4 bg-[#FAFAF8] flex items-center justify-between border-b border-black/5">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-black/5 text-[#64748B] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-[#1A1F2E] text-sm">{conversation.customerName}</h3>
              {conversation.customerContact && (
                <span className="text-[10px] font-mono text-[#64748B] bg-white px-2 py-0.5 rounded-full shadow-xs">
                  {conversation.customerContact}
                </span>
              )}
            </div>
            {conversation.offerTitle && (
              <p className="text-[11px] text-[#5B2EA6] font-semibold mt-0.5 flex items-center space-x-1">
                <Tag className="w-3 h-3" />
                <span>Inquiring about: {conversation.offerTitle}</span>
                {conversation.offerPriceKes && (
                  <span className="font-bold">(KES {conversation.offerPriceKes.toLocaleString()})</span>
                )}
              </p>
            )}
          </div>
        </div>

        {conversation.status === 'converted' && (
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[#93EE34]/20 text-[#1A1F2E] text-[10px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#1A1F2E]" />
            <span>Order Converted</span>
          </div>
        )}
      </div>

      {/* ── MESSAGE STREAM ── */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto min-h-[300px] max-h-[450px] bg-[#FDFDFD]">
        {conversation.messages.map((msg) => {
          const isCustomer = msg.from === 'customer';
          const isSystem = msg.from === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="p-3 rounded-2xl bg-[#93EE34]/15 border border-[#93EE34]/30 text-center text-xs text-[#1A1F2E] space-y-1">
                <p className="font-bold">{msg.text}</p>
                {msg.paymentPrompt && msg.paymentPrompt.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleSimulatePayment(msg.paymentPrompt!.id, msg.paymentPrompt!.amountKes)}
                    className="mt-1 px-3 py-1 rounded-full bg-[#1A1F2E] text-white text-[10px] font-bold shadow-xs hover:bg-black transition-all cursor-pointer"
                  >
                    Simulate Customer M-Pesa PIN Entry
                  </button>
                )}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-3 shadow-xs ${
                  isCustomer
                    ? 'bg-[#F4F7F2] text-[#1A1F2E]'
                    : 'bg-[#5B2EA6] text-white'
                }`}
              >
                <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                
                {/* Embedded Quote Card */}
                {msg.quote && (
                  <div className="mt-2 p-3 rounded-xl bg-white text-[#1A1F2E] shadow-sm space-y-1.5 border border-black/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#5B2EA6]">Official Quote</span>
                      <span className="text-xs font-black text-[#1A1F2E]">KES {msg.quote.priceKes.toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-bold">{msg.quote.title}</p>
                    {msg.quote.notes && <p className="text-[11px] text-[#64748B]">{msg.quote.notes}</p>}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveQuoteId(msg.quote!.id);
                        setPromptAmount(String(msg.quote!.priceKes));
                        setPromptDesc(`Payment for ${msg.quote!.title}`);
                        setShowPromptForm(true);
                      }}
                      className="w-full mt-1 py-1.5 rounded-lg bg-[#93EE34] hover:bg-[#85e028] text-[#1A1F2E] text-[11px] font-black transition-all cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Send M-Pesa STK Prompt</span>
                    </button>
                  </div>
                )}

                {/* Timestamp */}
                <div
                  className={`text-[9px] mt-1 text-right ${
                    isCustomer ? 'text-[#64748B]' : 'text-white/70'
                  }`}
                >
                  {new Date(msg.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── INLINE ACTION DRAWER (QUOTE / M-PESA) ── */}
      {showQuoteForm && (
        <form onSubmit={handleSendQuote} className="p-4 bg-[#F4F7F2] border-t border-black/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1A1F2E]">Create Custom Quote</span>
            <button
              type="button"
              onClick={() => setShowQuoteForm(false)}
              className="text-[11px] text-[#64748B] hover:text-[#1A1F2E] font-medium"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Item / Custom variation title"
              value={quoteTitle}
              onChange={(e) => setQuoteTitle(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[#5B2EA6]"
              required
            />
            <input
              type="number"
              placeholder="Price in KES"
              value={quotePrice}
              onChange={(e) => setQuotePrice(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[#5B2EA6]"
              required
            />
          </div>
          <input
            type="text"
            placeholder="Notes (e.g. including delivery, specific flavors...)"
            value={quoteNotes}
            onChange={(e) => setQuoteNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[#5B2EA6]"
          />
          <button
            type="submit"
            disabled={sending}
            className="w-full py-2 rounded-xl bg-[#5B2EA6] hover:bg-[#4a2489] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            {sending ? 'Sending Quote...' : 'Send Quote in Chat'}
          </button>
        </form>
      )}

      {showPromptForm && (
        <form onSubmit={handleTriggerMpesa} className="p-4 bg-[#FCE3EA]/40 border-t border-black/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1A1F2E]">Send M-Pesa STK Push Prompt</span>
            <button
              type="button"
              onClick={() => setShowPromptForm(false)}
              className="text-[11px] text-[#64748B] hover:text-[#1A1F2E] font-medium"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="tel"
              placeholder="Customer Phone (e.g. 254712345678)"
              value={promptPhone}
              onChange={(e) => setPromptPhone(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[#5B2EA6]"
              required
            />
            <input
              type="number"
              placeholder="Amount in KES"
              value={promptAmount}
              onChange={(e) => setPromptAmount(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[#5B2EA6]"
              required
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="w-full py-2 rounded-xl bg-[#1A1F2E] hover:bg-black text-[#93EE34] text-xs font-black shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-1.5"
          >
            <Smartphone className="w-4 h-4" />
            <span>{sending ? 'Prompting...' : `Prompt M-Pesa (KES ${Number(promptAmount || 0).toLocaleString()})`}</span>
          </button>
        </form>
      )}

      {/* ── QUICK ACTIONS BAR ── */}
      <div className="p-2 bg-[#FAFAF8] border-t border-black/5 flex items-center space-x-2">
        <button
          type="button"
          onClick={() => {
            setShowQuoteForm(!showQuoteForm);
            setShowPromptForm(false);
          }}
          className="px-3 py-1.5 rounded-xl bg-white hover:bg-black/5 text-[#5B2EA6] text-[11px] font-bold shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Quote</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowPromptForm(!showPromptForm);
            setShowQuoteForm(false);
          }}
          className="px-3 py-1.5 rounded-xl bg-white hover:bg-black/5 text-[#1A1F2E] text-[11px] font-bold shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#059669]" />
          <span>M-Pesa STK</span>
        </button>

        {/* Text Input */}
        <form onSubmit={handleSendMessage} className="flex-1 flex items-center space-x-1.5">
          <input
            type="text"
            placeholder="Type a reply..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-xl bg-white text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[#5B2EA6]"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="p-1.5 rounded-xl bg-[#5B2EA6] hover:bg-[#4a2489] text-white disabled:opacity-40 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default SpaceConversationThread;
