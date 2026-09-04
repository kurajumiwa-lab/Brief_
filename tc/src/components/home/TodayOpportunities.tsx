import React from 'react';
import { 
  Briefcase, 
  Truck, 
  BookOpen, 
  Coins, 
  CalendarDays, 
  Award
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
      subtitle: 'Inventory, Delivery, Cashier',
      bgGradient: 'from-[#059669] to-[#10B981]',
      textColor: 'text-white',
      category: 'gigs'
    },
    {
      id: 'opp-2',
      badge: 'EXPRESS',
      title: 'WAIRO Gate Run',
      subtitle: 'Sendy / Bolt Express Tier Active',
      bgGradient: 'from-[#0B6E6E] to-[#14919B]',
      textColor: 'text-white',
      category: 'cargo'
    },
    {
      id: 'opp-3',
      badge: '-28%',
      title: 'CBC Books Run',
      subtitle: 'Grade 7/8 PTA Bulk Order',
      bgGradient: 'from-[#B8621F] to-[#D97706]',
      textColor: 'text-white',
      category: 'demand'
    },
    {
      id: 'opp-4',
      badge: 'KES 60k',
      title: 'Chama Table Bank',
      subtitle: 'Cycle 5 Contribution Live',
      bgGradient: 'from-[#4C1D95] to-[#7C3AED]',
      textColor: 'text-white',
      category: 'chama'
    },
    {
      id: 'opp-5',
      badge: 'Live',
      title: 'Community Gigs',
      subtitle: '7:00 PM · Acoustic Sets & Popups',
      bgGradient: 'from-[#BE123C] to-[#E11D48]',
      textColor: 'text-white',
      category: 'events'
    },
    {
      id: 'opp-6',
      badge: '15%',
      title: 'Creator Program',
      subtitle: 'Organizer Commission Ledger',
      bgGradient: 'from-[#78350F] to-[#92400E]',
      textColor: 'text-white',
      category: 'creator'
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

export default TodayOpportunities;
