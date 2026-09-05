import React from 'react';
import { Activity, Clock, CheckCircle2, MessageCircle, DollarSign, Tag, Sparkles } from 'lucide-react';
import type { SpaceActivity as ActivityType } from '../../api/types';

export interface SpaceActivityProps {
  activities: ActivityType[];
  className?: string;
}

export const SpaceActivity: React.FC<SpaceActivityProps> = ({
  activities = [],
  className = ''
}) => {
  const getIcon = (kind: string) => {
    switch (kind) {
      case 'order_created':
      case 'payment_received':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-600" />;
      case 'conversation_received':
        return <MessageCircle className="w-3.5 h-3.5 text-blue-600" />;
      case 'offer_created':
      case 'offer_published':
        return <Tag className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#5B2EA6]" />
          <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F2E]">
            Recent Activity
          </h3>
        </div>
        <span className="text-[10px] font-mono text-[#64748B]">Real-time</span>
      </div>

      {activities.length === 0 ? (
        <div className="p-5 rounded-2xl bg-white border border-black/5 text-center">
          <p className="text-xs text-[#64748B]">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((act) => (
            <div
              key={act.id}
              className="p-3.5 rounded-2xl bg-white border border-black/5 shadow-2xs flex items-start space-x-3 transition-all hover:bg-gray-50/50"
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                {getIcon(act.kind)}
              </div>

              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#1A1F2E] truncate">
                    {act.title}
                  </span>
                  <span className="text-[10px] font-mono text-[#94A3B8] shrink-0">
                    {formatRelativeTime(act.createdAt)}
                  </span>
                </div>
                {act.description && (
                  <p className="text-[11px] text-[#64748B] leading-relaxed line-clamp-2">
                    {act.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default SpaceActivity;
