import React from 'react';
import { Users, MessageCircle, Phone, ArrowRight } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface CustomerEntry {
  name: string;
  contact?: string;
  ordersCount?: number;
  totalSpentKes?: number;
}

export interface SpacePeopleProps {
  customers?: CustomerEntry[];
  onMessage?: (customer: CustomerEntry) => void;
  className?: string;
}

export const SpacePeople: React.FC<SpacePeopleProps> = ({
  customers = [],
  onMessage,
  className = ''
}) => {
  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-[#5B2EA6]" />
          <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F2E]">
            Customers & People ({customers.length})
          </h3>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="p-5 rounded-2xl bg-white border border-black/5 text-center">
          <p className="text-xs text-[#64748B]">No customers have connected yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {customers.map((c, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-white border border-black/5 shadow-2xs flex items-center justify-between gap-3"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#5B2EA6]/10 text-[#5B2EA6] font-black text-xs flex items-center justify-center shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#1A1F2E] block truncate">
                    {c.name}
                  </span>
                  <span className="text-[10px] text-[#64748B] block truncate">
                    {c.contact || 'Direct contact'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.play('heavyTap');
                  onMessage?.(c);
                }}
                className="p-2 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all cursor-pointer"
                title="Message on WhatsApp"
                aria-label={`Message ${c.name}`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default SpacePeople;
