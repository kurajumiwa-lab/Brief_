import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  MapPin, 
  Star, 
  ArrowRight, 
  X, 
  Search, 
  ChevronRight,
  Clock,
  Phone,
  CheckCircle2,
  CalendarDays,
  ShoppingBag,
  FileText
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  cards?: {
    id: string;
    title: string;
    subtitle: string;
    price?: string;
    rating?: number;
    reviews?: number;
    actionLabel: string;
    actionType: string;
  }[];
}

export function BriefAiAssistant({
  onClose,
  onOpenCardAction
}: {
  onClose?: () => void;
  onOpenCardAction?: (type: string, cardId: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'ai',
      text: "Hello Neighbor! 👑 I'm your Town Concierge (The Mayor). How can I help you connect with people, gigs, permits, or events in your town today?",
      time: 'Just now'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const quickPrompts = [
    "I need a reliable caterer for an event this Saturday for 100 people in Kisii",
    "What's happening near me tonight?",
    "Where can I fix my laptop?",
    "How to renew my single business permit?",
    "Football matches this weekend"
  ];

  const handleSend = (textToSend?: string) => {
    const q = (textToSend || inputText).trim();
    if (!q) return;

    soundEngine.play('tap');
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      time: 'Just now'
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      soundEngine.play('reward');
      setIsTyping(false);

      let responseText = "Here are the top verified resources from Brief's town directory:";
      let cards: ChatMessage['cards'] = [];

      const lower = q.toLowerCase();

      if (lower.includes('cater') || lower.includes('food') || lower.includes('event')) {
        responseText = "Sure! Here are some top-rated catering services available this Saturday in Kisii Town:";
        cards = [
          {
            id: 'cat-1',
            title: 'Nyaboke Catering Services',
            subtitle: 'Kisii Town • Full Event Buffet & Tents',
            price: 'KSh 1,200 per plate',
            rating: 4.9,
            reviews: 56,
            actionLabel: 'View & Book',
            actionType: 'vendor'
          },
          {
            id: 'cat-2',
            title: 'Omoke Events & Catering',
            subtitle: 'Nyamataro • Wedding & Funeral Packages',
            price: 'KSh 950 per plate',
            rating: 4.7,
            reviews: 32,
            actionLabel: 'Contact',
            actionType: 'vendor'
          }
        ];
      } else if (lower.includes('permit') || lower.includes('renew') || lower.includes('license') || lower.includes('sbp')) {
        responseText = "Here is the official guide to renew your Single Business Permit (SBP) in Kisii / Nairobi:";
        cards = [
          {
            id: 'guide-1',
            title: 'How to renew your Single Business Permit (SBP)',
            subtitle: 'County Government Self-Service Portal • Huduma Centre Counter 8',
            price: 'KES 3,500 – 15,000 / yr',
            actionLabel: 'Open Full Guide',
            actionType: 'civic'
          }
        ];
      } else if (lower.includes('tonight') || lower.includes('happen') || lower.includes('music')) {
        responseText = "Here is what's happening live near you tonight:";
        cards = [
          {
            id: 'ev-1',
            title: 'Sunset Jazz Evening',
            subtitle: 'Kisii Sports Club • Live music, food & drinks',
            price: 'Free Entry (R.S.V.P)',
            rating: 4.9,
            reviews: 120,
            actionLabel: 'View Pass',
            actionType: 'event'
          },
          {
            id: 'ev-2',
            title: 'Acoustic Chill Session',
            subtitle: 'The Green Park Lounge • 7:00 PM',
            price: 'KES 500 Entry',
            actionLabel: 'Reserve',
            actionType: 'event'
          }
        ];
      } else if (lower.includes('laptop') || lower.includes('fix') || lower.includes('repair')) {
        responseText = "Found 2 verified tech repair specialists near Kisii Market:";
        cards = [
          {
            id: 'tech-1',
            title: 'QuickFix Electronics & Tech',
            subtitle: 'Main Market Road • Hardware, Screen & Board repair',
            rating: 4.8,
            reviews: 44,
            actionLabel: 'Call Now',
            actionType: 'vendor'
          }
        ];
      } else {
        responseText = "Here are the top matches from Brief's town ledger for your query:";
        cards = [
          {
            id: 'gen-1',
            title: 'Sunset Jazz Evening',
            subtitle: 'Fri, 24 May • Kisii Sports Club',
            actionLabel: 'Open Details',
            actionType: 'event'
          },
          {
            id: 'gen-2',
            title: 'Airwalk Classics Sneakers (Size 42)',
            subtitle: 'Nyabs Collections • KSh 2,499 (Verified Seller)',
            actionLabel: 'View Item',
            actionType: 'market'
          }
        ];
      }

      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: responseText,
          time: 'Just now',
          cards
        }
      ]);
    }, 900);
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-3xl overflow-hidden shadow-2xl flex flex-col text-[#0D1117] h-[600px] max-w-2xl mx-auto">
      
      {/* ================= HEADER ================= */}
      <div className="bg-[#0D1117] text-white p-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FF5A1F] to-[#FF8A00] flex items-center justify-center text-white shadow-md">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h3 className="font-black text-sm text-white">Brief AI</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-mono font-bold">ONLINE</span>
            </div>
            <p className="text-[10px] text-[#DCE2E6]/70">The Town Centre Mayor & Navigator</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={() => { soundEngine.play('tap'); onClose(); }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ================= CHAT STREAM ================= */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F7F8FA]">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                msg.sender === 'user'
                  ? 'bg-[#FF5A1F] text-white rounded-tr-none font-medium'
                  : 'bg-white border border-[#E5E8EC] text-[#0D1117] rounded-tl-none space-y-2'
              }`}
            >
              <p className="leading-relaxed">{msg.text}</p>

              {/* Render Structured Recommendation Cards */}
              {msg.cards && msg.cards.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-gray-100">
                  {msg.cards.map(card => (
                    <div
                      key={card.id}
                      className="p-3 bg-[#F7F8FA] border border-[#E5E8EC] rounded-xl flex items-center justify-between gap-2 hover:border-[#FF5A1F] transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-bold text-xs text-[#0D1117] block truncate">
                          {card.title}
                        </span>
                        <span className="text-[10px] text-gray-500 block truncate">
                          {card.subtitle}
                        </span>
                        <div className="flex items-center space-x-2 text-[10px] font-mono mt-0.5">
                          {card.price && (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                              {card.price}
                            </span>
                          )}
                          {card.rating && (
                            <span className="text-amber-700 font-bold flex items-center">
                              ★ {card.rating} ({card.reviews})
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.play('tap');
                          if (onOpenCardAction) onOpenCardAction(card.actionType, card.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#0D1117] hover:bg-[#1E2633] text-white text-[10px] font-bold uppercase tracking-wider shrink-0 cursor-pointer shadow-xs"
                      >
                        {card.actionLabel} →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[9px] text-gray-400 font-mono mt-0.5 px-1">{msg.time}</span>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center space-x-1.5 bg-white border border-gray-200 px-3 py-2 rounded-2xl w-24">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A1F] animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A1F] animate-bounce delay-100" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A1F] animate-bounce delay-200" />
          </div>
        )}
      </div>

      {/* ================= QUICK PROMPTS CHIPS ================= */}
      <div className="px-3 py-2 bg-white border-t border-gray-200 flex space-x-1.5 overflow-x-auto">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(p)}
            className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-[10px] text-gray-700 font-medium whitespace-nowrap cursor-pointer transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      {/* ================= INPUT BAR ================= */}
      <form
        onSubmit={e => { e.preventDefault(); handleSend(); }}
        className="p-3 bg-white border-t border-gray-200 flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Ask Brief AI anything in your town..."
          className="flex-1 bg-[#F7F8FA] border border-gray-300 rounded-2xl px-4 py-2.5 text-xs text-[#0D1117] focus:outline-none focus:border-[#FF5A1F]"
        />
        <button
          type="submit"
          className="w-10 h-10 rounded-2xl bg-[#FF5A1F] hover:bg-[#ff4605] text-white flex items-center justify-center cursor-pointer shadow-md transition-all shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
}
