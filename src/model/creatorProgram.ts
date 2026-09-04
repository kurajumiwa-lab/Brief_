/**
 * CREATOR PARTNER PROGRAM & GROUP ACTIVATION ENGINE
 * 
 * Rules:
 * 1. Brief never pays for raw registrations or vanity signups.
 * 2. Commissions unlocked strictly on activated, retained coordination value.
 * 3. Qualified Activation Threshold:
 *    - 10+ active members in 30 days
 *    - 1 completed contribution cycle OR 1 completed bulk demand run OR 1 WAIRO logistics delivery
 * 4. Payout: 15% of Brief's net take-rate, settled via M-Pesa.
 */

export type CreatorRole = 'community_creator' | 'institutional_organizer' | 'category_operator';

export interface CreatorProfile {
  id: string;
  name: string;
  phone: string;
  role: CreatorRole;
  title: string;
  primaryNeighborhoodId: string;
  mPesaNumber: string;
  activatedGroupsCount: number;
  totalCoordinatedVolumeKes: number;
  earnedCommissionsKes: number;
  pendingCommissionsKes: number;
  joinedDate: string;
  referralCode: string;
  groupsBrought: Array<{
    groupId: string;
    groupName: string;
    groupCategory: string;
    memberCount: number;
    isActivated: boolean;
    monthlyVolumeKes: number;
    commissionAccruedKes: number;
  }>;
}

export const INITIAL_CREATOR_PROFILES: CreatorProfile[] = [
  {
    id: 'creator-waweru-1',
    name: 'Teacher Waweru',
    phone: '+254 722 391 840',
    role: 'institutional_organizer',
    title: 'Kilimani Primary PTA & Staff Welfare Lead',
    primaryNeighborhoodId: 'kilimani',
    mPesaNumber: '254722391840',
    activatedGroupsCount: 3,
    totalCoordinatedVolumeKes: 840000,
    earnedCommissionsKes: 12600,
    pendingCommissionsKes: 3400,
    joinedDate: '2026-01-15',
    referralCode: 'WAWERU-KILI',
    groupsBrought: [
      {
        groupId: 'grp-kili-pta-6',
        groupName: 'Class 6 Parents CBC Consortium',
        groupCategory: 'school_pta',
        memberCount: 42,
        isActivated: true,
        monthlyVolumeKes: 380000,
        commissionAccruedKes: 5700
      },
      {
        groupId: 'grp-kili-teachers-welfare',
        groupName: 'Kilimani Staff Welfare Table Bank',
        groupCategory: 'teacher_welfare',
        memberCount: 28,
        isActivated: true,
        monthlyVolumeKes: 260000,
        commissionAccruedKes: 3900
      },
      {
        groupId: 'grp-kili-choir-retreat',
        groupName: 'St. Jude Youth Choir Coordination',
        groupCategory: 'church_fellowship',
        memberCount: 35,
        isActivated: true,
        monthlyVolumeKes: 200000,
        commissionAccruedKes: 3000
      }
    ]
  },
  {
    id: 'creator-beatrice-2',
    name: 'Madam Beatrice',
    phone: '+254 712 908 311',
    role: 'community_creator',
    title: 'TRM Mirema Youth & Student Guild Coordinator',
    primaryNeighborhoodId: 'roysambu',
    mPesaNumber: '254712908311',
    activatedGroupsCount: 4,
    totalCoordinatedVolumeKes: 620000,
    earnedCommissionsKes: 9300,
    pendingCommissionsKes: 2100,
    joinedDate: '2026-02-01',
    referralCode: 'BEA-MIREMA',
    groupsBrought: [
      {
        groupId: 'grp-roy-campus-1',
        groupName: 'Mirema Campus Tech Innovators',
        groupCategory: 'campus_association',
        memberCount: 52,
        isActivated: true,
        monthlyVolumeKes: 220000,
        commissionAccruedKes: 3300
      },
      {
        groupId: 'grp-roy-traders-2',
        groupName: 'TRM Fashion Pop-up Vendors Guild',
        groupCategory: 'neighborhood',
        memberCount: 24,
        isActivated: true,
        monthlyVolumeKes: 400000,
        commissionAccruedKes: 6000
      }
    ]
  },
  {
    id: 'creator-maina-3',
    name: 'Evans Maina',
    phone: '+254 711 440 928',
    role: 'category_operator',
    title: 'South B Traders Logistics Aggregator',
    primaryNeighborhoodId: 'south-b',
    mPesaNumber: '254711440928',
    activatedGroupsCount: 5,
    totalCoordinatedVolumeKes: 1150000,
    earnedCommissionsKes: 17250,
    pendingCommissionsKes: 4500,
    joinedDate: '2025-11-20',
    referralCode: 'EVANS-SOUTHB',
    groupsBrought: [
      {
        groupId: 'grp-sb-plainsview-dukas',
        groupName: 'Plainsview Retailers Wholesale Run',
        groupCategory: 'estate_association',
        memberCount: 36,
        isActivated: true,
        monthlyVolumeKes: 650000,
        commissionAccruedKes: 9750
      },
      {
        groupId: 'grp-sb-boda-welfare',
        groupName: 'Sana Sana Boda Riders Welfare SACCO',
        groupCategory: 'sacco_branch',
        memberCount: 44,
        isActivated: true,
        monthlyVolumeKes: 500000,
        commissionAccruedKes: 7500
      }
    ]
  }
];

export function calculateCommission(
  coordinatedVolumeKes: number,
  platformTakeRatePct: number = 2.0, // Brief takes ~2% coordination fee
  creatorSharePct: number = 15.0 // Creator receives 15% of Brief's take-rate
): { platformTakeKes: number; creatorCommissionKes: number } {
  const platformTakeKes = (coordinatedVolumeKes * platformTakeRatePct) / 100;
  const creatorCommissionKes = (platformTakeKes * creatorSharePct) / 100;
  return { platformTakeKes, creatorCommissionKes };
}

export function checkGroupActivation(memberCount: number, completedRhythmsCount: number): boolean {
  return memberCount >= 10 && completedRhythmsCount >= 1;
}
