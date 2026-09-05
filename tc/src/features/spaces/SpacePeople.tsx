import React, { useState } from 'react';
import type { SpaceConversation } from '../../api/types';
import { SpaceConversationThread } from './SpaceConversationThread';
import { Users, MessageSquare, Phone, ArrowRight, CheckCircle2, Tag } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface CustomerEntry {
  name: string;
  contact?: string;
  ordersCount?: number;
  totalSpentKes?: number;
}

export interface SpacePeopleProps {
  spaceId?: string;
  customers?: CustomerEntry[];
  conversations?: SpaceConversation[];
  onMessage?: (customer: CustomerEntry) => void;
  onRefresh?: () => void;
  className?: string;
}

export const SpacePeople: React.FC<SpacePeopleProps> = ({
  spaceId = '',
  customers = [],
  conversations = [],
  onMessage,
  onRefresh,
  className = ''
}) => {
  const [selectedConv, setSelectedConv] = useState<SpaceConversation | null>(null);

  // If a conversation is selected, show thread view
  if (selectedConv && spaceId) {
    return (
      <SpaceConversationThread
        spaceId={spaceId}
        conversation={selectedConv}
        onBack={() => setSelectedConv(null)}
        onUpdated={() => {
          onRefresh?.();
        }}
        className={className}
      />
    );
  }

  return (
    <section className={`space-y-6 ${className}`}>
      {/* ── CONVERSATIONS / INQUIRIES ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-[#5B2EA6]" />
            <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F2E]">
              Active Inquiries & WhatsApp Chats ({conversations.length})
            </h3>
          </div>
        </div>

        {conversations.length === 0 ? (
          <div className="p-5 rounded-2xl bg-white border border-black/5 text-center">
            <p className="text-xs text-[#64748B]">No customer chats yet. Inbound WhatsApp messages and inquiries will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => {
              const lastMsg = conv.messages && conv.messages.length > 0
                ? conv.messages[conv.messages.length - 1]
                : null;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    soundEngine.play('tap');
                    setSelectedConv(conv);
                  }}
                  className="p-3.5 rounded-2xl bg-white hover:bg-[#FAFAF8] border border-black/5 shadow-2xs flex items-center justify-between gap-3 cursor-pointer transition-all"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#5B2EA6]/10 text-[#5B2EA6] font-black text-xs flex items-center justify-center shrink-0">
                      {conv.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#1A1F2E] truncate">
                          {conv.customerName}
                        </span>
                        {conv.status === 'converted' && (
                          <span className="px-2 py-0.5 rounded-full bg-[#93EE34]/20 text-[#1A1F2E] text-[9px] font-bold">
                            Order Paid
                          </span>
                        )}
                      </div>
                      {conv.offerTitle && (
                        <p className="text-[10px] text-[#5B2EA6] font-semibold truncate flex items-center space-x-1">
                          <Tag className="w-2.5 h-2.5 inline" />
                          <span>{conv.offerTitle}</span>
                        </p>
                      )}
                      {lastMsg && (
                        <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                          {lastMsg.from === 'customer' ? `${conv.customerName}: ` : 'You: '}
                          {lastMsg.text}
                        </p>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[#64748B] shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CUSTOMER CONTACTS ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-[#5B2EA6]" />
            <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F2E]">
              Customers ({customers.length})
            </h3>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white border border-black/5 text-center">
            <p className="text-xs text-[#64748B]">No saved customers yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {customers.map((c, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-white border border-black/5 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#1A1F2E]/10 text-[#1A1F2E] font-bold text-xs flex items-center justify-center shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#1A1F2E] block truncate">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-[#64748B] block truncate">
                      {c.contact || 'WhatsApp Customer'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEngine.play('heavyTap');
                    onMessage?.(c);
                  }}
                  className="p-2 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all cursor-pointer"
                  title="Message on WhatsApp"
                  aria-label={`Message ${c.name}`}
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default SpacePeople;
