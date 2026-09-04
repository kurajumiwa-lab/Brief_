import React from 'react';
import { ShieldCheck, Award, Clock, AlertTriangle, Lock, Users } from 'lucide-react';
import { isNewToNeighborhood } from '../../model/neighborhoods';

export interface UserTrustBadgeProps {
  neighborhoodName?: string;
  joinedDate?: string;
  isChampion?: boolean;
  isUnderReview?: boolean;
  className?: string;
}

export const UserTrustBadge: React.FC<UserTrustBadgeProps> = ({
  neighborhoodName = 'Kilimani',
  joinedDate,
  isChampion = false,
  isUnderReview = false,
  className = ''
}) => {
  const isNew = isNewToNeighborhood(joinedDate);

  if (isUnderReview) {
    return (
      <span
        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 text-[10px] font-black uppercase tracking-wider ${className}`}
        title="Account is currently under community champion review"
      >
        <AlertTriangle className="w-3 h-3 text-amber-600" />
        <span>Under Community Review</span>
      </span>
    );
  }

  if (isChampion) {
    return (
      <span
        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#B8621F]/15 text-[#B8621F] text-[10px] font-black uppercase tracking-wider ${className}`}
        title="Verified Community Champion & Stage Moderator"
      >
        <Award className="w-3 h-3 text-[#B8621F]" />
        <span>Community Champion</span>
      </span>
    );
  }

  if (isNew) {
    return (
      <span
        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 text-[10px] font-black uppercase tracking-wider ${className}`}
        title="Member in their first 30 days in this neighborhood"
      >
        <Clock className="w-3 h-3 text-blue-600" />
        <span>New to {neighborhoodName}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px] font-black uppercase tracking-wider ${className}`}
    >
      <ShieldCheck className="w-3 h-3 text-emerald-600" />
      <span>{neighborhoodName} Resident</span>
    </span>
  );
};

export interface GroupTrustBadgeProps {
  isVerified?: boolean;
  isUnderReview?: boolean;
  membershipType?: 'invite_only' | 'champion_approved_public';
  visibility?: 'private' | 'neighborhood' | 'citywide';
  className?: string;
}

export const GroupTrustBadge: React.FC<GroupTrustBadgeProps> = ({
  isVerified = true,
  isUnderReview = false,
  membershipType = 'invite_only',
  visibility = 'neighborhood',
  className = ''
}) => {
  if (isUnderReview) {
    return (
      <span
        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 text-[10px] font-black uppercase tracking-wider ${className}`}
      >
        <AlertTriangle className="w-3 h-3 text-amber-600" />
        <span>Under Community Review</span>
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center space-x-1.5 ${className}`}>
      {isVerified ? (
        <span
          className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px] font-black uppercase tracking-wider"
          title="Verified Group (>90 days active, zero open disputes)"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>Verified Group</span>
        </span>
      ) : (
        <span
          className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-gray-500/15 text-gray-700 text-[10px] font-black uppercase tracking-wider"
        >
          <Clock className="w-3 h-3 text-gray-600" />
          <span>Forming (&lt;90 days)</span>
        </span>
      )}

      {membershipType === 'invite_only' ? (
        <span
          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-black/5 text-gray-700 text-[9px] font-bold"
          title="Invite-Only Group Membership"
        >
          <Lock className="w-2.5 h-2.5 text-gray-500" />
          <span>Invite Only</span>
        </span>
      ) : (
        <span
          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#0B6E6E]/10 text-[#0B6E6E] text-[9px] font-bold"
          title="Champion-Approved Public Group"
        >
          <Users className="w-2.5 h-2.5 text-[#0B6E6E]" />
          <span>Neighborhood Public</span>
        </span>
      )}
    </div>
  );
};
