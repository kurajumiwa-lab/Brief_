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
  // A quote starts empty unless the enquiry itself carries a price. A default of
  // "5000" is an invented number that one tap turns into a real quote sent to a
  // real customer.
  const [quotePrice, setQuotePrice] = useState<string>(conversation.offerPriceKes ? String(conversation.offerPriceKes) : '');
  const [quoteNotes, setQuoteNotes] = useState('');

  // M-Pesa prompt state
  const [showPromptForm, setShowPromptForm] = useState(false);
  // Only the number the customer left. If there is none, the field is blank and
  // the send is refused with a reason — a phone is not something to fill in.
  const [promptPhone, setPromptPhone] = useState(conversation.customerContact || '');
  const [promptAmount, setPromptAmount] = useState<string>(conversation.offerPriceKes ? String(conversation.offerPriceKes) : '');
  const [promptDesc, setPromptDesc] = useState(conversation.offerTitle ? `Payment for ${conversation.offerTitle}` : 'Order Payment');
  const [activeQuoteId, setActiveQuoteId] = useState<string | undefined>(undefined);
  // Every refusal in this thread is shown, never console.error'd.
  const [threadError, setThreadError] = useState<string | null>(null);

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
    if (sending) return;
    if (!quoteTitle.trim() || !quotePrice.trim()) { setThreadError('Write the item and the price you are quoting. Nothing is sent for you.'); return; }
    if (isNaN(numPrice) || numPrice <= 0) { setThreadError('A quote price is a number above zero.'); return; }

    setSending(true);
    soundEngine.play('reward');
    try {
      const res = await briefApi.createSpaceQuote(spaceId, conversation.id, {
        title: quoteTitle.trim(),
        priceKes: numPrice,
        notes: quoteNotes.trim()
      });
      // briefApi never throws, so the refusal has to be READ, not caught. A
      // silent failure here means a seller believes a quote went out when it did not.
      if (!res.ok) { setThreadError(res.error ?? 'The quote was refused.'); return; }
      setThreadError(null);
      setShowQuoteForm(false);
      onUpdated?.();
    } catch (err) {
      setThreadError('The quote could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const handleTriggerMpesa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numAmount = Number(promptAmount);
    if (sending) return;
    if (!promptPhone.trim()) {
      setThreadError('This enquiry has no phone number on it. Ask the customer for one — Brief will not fill a number in and send a payment prompt to a stranger.');
      return;
    }
    if (!promptAmount.trim() || isNaN(numAmount) || numAmount <= 0) {
      setThreadError('Type the amount to prompt for. An STK push moves money, so it is not guessed at.');
      return;
    }

    setSending(true);
    soundEngine.play('heavyTap');
    try {
      const res = await briefApi.triggerSpaceMpesaPrompt(spaceId, conversation.id, {
        quoteId: activeQuoteId,
        phoneNumber: promptPhone.trim(),
        amountKes: numAmount,
        description: promptDesc
      });
      if (!res.ok) { setThreadError(res.error ?? 'The payment prompt was refused.'); return; }
      setThreadError(null);
      setShowPromptForm(false);
      onUpdated?.();
    } catch (err) {
      setThreadError('The payment prompt could not be sent.');
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
    <div className={`flex flex-col h-full bg-[color:var(--color-paper)] rounded-3xl shadow-sm overflow-hidden ${className}`}>

      {threadError && (
        <p role="alert" className="px-4 py-2 text-[12px] font-bold"
          style={{ background: '#FEF2F2', color: '#B91C1C' }}>{threadError}</p>
      )}

      {/* ── THREAD HEADER ── */}
      <div className="p-4 bg-[color:var(--color-surface)] flex items-center justify-between border-b border-black/5">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-black/5 text-[color:var(--color-text-muted)] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-[color:var(--color-text)] text-sm">{conversation.customerName}</h3>
              {conversation.customerContact && (
                <span className="text-[11px] font-mono text-[color:var(--color-text-muted)] bg-[color:var(--color-paper)] px-2 py-0.5 rounded-full shadow-xs">
                  {conversation.customerContact}
                </span>
              )}
            </div>
            {conversation.offerTitle && (
              <p className="text-[12px] text-[color:var(--color-primary)] font-semibold mt-0.5 flex items-center space-x-1">
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
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[color:var(--color-primary-subtle)] text-[color:var(--color-text)] text-[11px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-[color:var(--color-text)]" />
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
              <div key={msg.id} className="p-3 rounded-2xl bg-[color:var(--color-primary-subtle)] border border-[color:var(--color-primary)] text-center text-xs text-[color:var(--color-text)] space-y-1">
                <p className="font-bold">{msg.text}</p>
                {msg.paymentPrompt && msg.paymentPrompt.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleSimulatePayment(msg.paymentPrompt!.id, msg.paymentPrompt!.amountKes)}
                    className="mt-1 px-3 py-1 rounded-full bg-[color:var(--color-text)] text-white text-[11px] font-bold shadow-xs hover:bg-black transition-all cursor-pointer"
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
                    ? 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-text)]'
                    : 'bg-[color:var(--color-primary)] text-[color:var(--accent-ink)]'
                }`}
              >
                <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                {/* WhatsApp delivery status on owner replies — honest, from the
                    stored result (sent ✓ / not delivered + reason). */}
                {!isCustomer && (msg as any).whatsappDelivery && (
                  <p className="mt-1 text-[11px] font-bold" style={{ color: (msg as any).whatsappDelivery.ok ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.7)' }}>
                    {(msg as any).whatsappDelivery.ok
                      ? '✓ Sent via WhatsApp'
                      : `Not delivered — ${(msg as any).whatsappDelivery.reason ?? 'no provider'}`}
                  </p>
                )}

                {/* Embedded Quote Card */}
                {msg.quote && (
                  <div className="mt-2 p-3 rounded-xl bg-[color:var(--color-paper)] text-[color:var(--color-text)] shadow-sm space-y-1.5 border border-black/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold text-[color:var(--color-primary)]">Official Quote</span>
                      <span className="text-xs font-black text-[color:var(--color-text)]">KES {msg.quote.priceKes.toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-bold">{msg.quote.title}</p>
                    {msg.quote.notes && <p className="text-[12px] text-[color:var(--color-text-muted)]">{msg.quote.notes}</p>}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveQuoteId(msg.quote!.id);
                        setPromptAmount(String(msg.quote!.priceKes));
                        setPromptDesc(`Payment for ${msg.quote!.title}`);
                        setShowPromptForm(true);
                      }}
                      className="w-full mt-1 py-1.5 rounded-lg bg-[color:var(--color-primary)] hover:bg-[#85e028] text-[color:var(--color-text)] text-[12px] font-black transition-all cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Send M-Pesa STK Prompt</span>
                    </button>
                  </div>
                )}

                {/* Timestamp */}
                <div
                  className={`text-[11px] mt-1 text-right ${
                    isCustomer ? 'text-[color:var(--color-text-muted)]' : 'text-white/70'
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
        <form onSubmit={handleSendQuote} className="p-4 bg-[color:var(--color-surface-elevated)] border-t border-black/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[color:var(--color-text)]">Create Custom Quote</span>
            <button
              type="button"
              onClick={() => setShowQuoteForm(false)}
              className="text-[12px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] font-medium"
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
              className="px-3 py-2 rounded-xl bg-[color:var(--color-paper)] text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
              required
            />
            <input
              type="number"
              placeholder="Price in KES"
              value={quotePrice}
              onChange={(e) => setQuotePrice(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[color:var(--color-paper)] text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
              required
            />
          </div>
          <input
            type="text"
            placeholder="Notes (e.g. including delivery, specific flavors...)"
            value={quoteNotes}
            onChange={(e) => setQuoteNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[color:var(--color-paper)] text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={sending}
            className="w-full py-2 rounded-xl bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-strong)] text-[color:var(--accent-ink)] text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            {sending ? 'Sending Quote...' : 'Send Quote in Chat'}
          </button>
        </form>
      )}

      {showPromptForm && (
        <form onSubmit={handleTriggerMpesa} className="p-4 bg-[color:var(--color-surface-elevated)] border-t border-black/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[color:var(--color-text)]">Send M-Pesa STK Push Prompt</span>
            <button
              type="button"
              onClick={() => setShowPromptForm(false)}
              className="text-[12px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] font-medium"
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
              className="px-3 py-2 rounded-xl bg-[color:var(--color-paper)] text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
              required
            />
            <input
              type="number"
              placeholder="Amount in KES"
              value={promptAmount}
              onChange={(e) => setPromptAmount(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[color:var(--color-paper)] text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
              required
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="w-full py-2 rounded-xl bg-[color:var(--color-text)] hover:bg-black text-[color:var(--color-primary)] text-xs font-black shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-1.5"
          >
            <Smartphone className="w-4 h-4" />
            {/* The amount is not shown until it is typed: a button reading
                "KES 0" invites a tap that promises nothing. */}
            <span>
              {sending
                ? 'Prompting…'
                : promptAmount.trim()
                  ? `Prompt M-Pesa (KES ${Number(promptAmount).toLocaleString()})`
                  : 'Prompt M-Pesa'}
            </span>
          </button>
        </form>
      )}

      {/* ── QUICK ACTIONS BAR ── */}
      <div className="p-2 bg-[color:var(--color-surface)] border-t border-black/5 flex items-center space-x-2">
        <button
          type="button"
          onClick={() => {
            setShowQuoteForm(!showQuoteForm);
            setShowPromptForm(false);
          }}
          className="px-3 py-1.5 rounded-xl bg-[color:var(--color-paper)] hover:bg-black/5 text-[color:var(--color-primary)] text-[12px] font-bold shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
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
          className="px-3 py-1.5 rounded-xl bg-[color:var(--color-paper)] hover:bg-black/5 text-[color:var(--color-text)] text-[12px] font-bold shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
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
            className="flex-1 px-3 py-1.5 rounded-xl bg-[color:var(--color-paper)] text-xs border border-black/5 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="p-1.5 rounded-xl bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-strong)] text-[color:var(--accent-ink)] disabled:opacity-40 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default SpaceConversationThread;
