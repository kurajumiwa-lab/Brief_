import React from 'react';
import { 
  Sparkles, 
  Briefcase, 
  Gamepad2, 
  BookOpen, 
  ShoppingBag, 
  Video, 
  Award, 
  ArrowRight,
  Clock
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface OpportunityItem {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  bgGradient: string;
  textColor: string;
  category: string;
}

export function TodayOpportunities({
  onSelectOpportunity
}: {
  onSelectOpportunity?: (item: OpportunityItem) => void;
}) {
  const items: OpportunityItem[] = [
    {
      id: 'opp-1',
      badge: '3',
      title: 'Paid Gigs',
      subtitle: 'Waiter, Delivery, Cashier',
      bgGradient: 'from-[#059669] to-[#10B981]',
      textColor: 'text-white',
      category: 'gigs'
    },
    {
      id: 'opp-2',
      badge: '1',
      title: 'Pool Match',
      subtitle: 'needs 1 player · eFootball',
      bgGradient: 'from-[#2563EB] to-[#3B82F6]',
      textColor: 'text-white',
      category: 'arena'
    },
    {
      id: 'opp-3',
      badge: 'Free',
      title: 'Skills Workshop',
      subtitle: '2:00 PM · Online Zoom',
      bgGradient: 'from-[#EA580C] to-[#F97316]',
      textColor: 'text-white',
      category: 'learning'
    },
    {
      id: 'opp-4',
      badge: 'Bale',
      title: 'Thrift Drop',
      subtitle: '12:00 PM · Nyamataro Market',
      bgGradient: 'from-[#0284C7] to-[#0EA5E9]',
      textColor: 'text-white',
      category: 'thrift'
    },
    {
      id: 'opp-5',
      badge: 'Creator',
      title: 'J Segera',
      subtitle: 'Live at 7:00 PM · Kisii Lounge',
      bgGradient: 'from-[#7C3AED] to-[#8B5CF6]',
      textColor: 'text-white',
      category: 'events'
    },
    {
      id: 'opp-6',
      badge: '2',
      title: 'Grants',
      subtitle: 'closing soon · Youth Fund',
      bgGradient: 'from-[#65A30D] to-[#84CC16]',
      textColor: 'text-white',
      category: 'grants'
    }
  ];

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-[#FF5A1F] animate-pulse" />
          <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#0D1117]">
            Today's Opportunities
          </h3>
        </div>
        <span className="text-[10px] font-mono text-gray-500 font-bold">Updated Live</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              soundEngine.play('heavyTap');
              if (onSelectOpportunity) onSelectOpportunity(item);
            }}
            className={`p-3 rounded-2xl bg-gradient-to-br ${item.bgGradient} text-left text-white shadow-sm hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between min-h-[95px]`}
          >
            <div className="flex items-start justify-between">
              <span className="text-[18px] sm:text-xl font-black leading-none block">
                {item.badge}
              </span>
              <span className="text-[8px] font-mono uppercase tracking-wider bg-black/20 px-1.5 py-0.5 rounded text-white/90">
                {item.category}
              </span>
            </div>

            <div className="mt-2 space-y-0.5">
              <h4 className="font-black text-xs leading-tight block">
                {item.title}
              </h4>
              <p className="text-[10px] text-white/80 line-clamp-1">
                {item.subtitle}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
