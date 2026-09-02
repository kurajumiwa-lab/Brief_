import type { ArenaStakeKind } from '../ArenaGameScreen';

export interface ArenaPlacard {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  endsIn: string;
  bgGradient: string;
  desc: string;
  rewards: string[];
  multiplier: string;
  defaultMode: string;
  defaultStake: ArenaStakeKind;
  defaultFee?: number;
}

export function getGamePlacards(gameId: string, shortName: string, name: string): ArenaPlacard[] {
  switch (gameId) {
    case 'cod':
      return [
        {
          id: 'cod-sniper-duel',
          title: '1v1 Sniper Duel: Killhouse / Gulag',
          tag: '1v1 SNIPER',
          tagColor: '#EF4444',
          endsIn: '3 day(s) 8 hr(s)',
          bgGradient: 'from-[#2B0E0E] via-[#451616] to-[#0D1117]',
          desc: 'Bolt-action snipers only (DL Q33 / Locus / Koshka). Quickscope & no-scope duel. First to 10 kills wins.',
          rewards: ['🎯 Sharpshooter Pin', '🏆 +45 Elo', 'KES 1,200 Pool'],
          multiplier: 'Sniper Only • 10 Kills',
          defaultMode: '1v1',
          defaultStake: 'entry_fee',
          defaultFee: 150,
        },
        {
          id: 'cod-clan-snd',
          title: '5v5 Search & Destroy Clan Scrim',
          tag: 'CLAN S&D',
          tagColor: '#F59E0B',
          endsIn: '5 day(s) 14 hr(s)',
          bgGradient: 'from-[#1F1708] via-[#33260E] to-[#0D1117]',
          desc: 'Competitive CDL rules. Bomb plant and defuse, no respawns. First squad to 6 rounds wins match.',
          rewards: ['💣 Tactical Badge', '⚡ Clan War Pts', 'KES 2,500 Pool'],
          multiplier: 'CDL Search & Destroy',
          defaultMode: 'Squad',
          defaultStake: 'entry_fee',
          defaultFee: 250,
        },
        {
          id: 'cod-br-isolated',
          title: 'Battle Royale Squad Drop (Isolated)',
          tag: 'BR SQUAD',
          tagColor: '#00BFEF',
          endsIn: '6 day(s) 20 hr(s)',
          bgGradient: 'from-[#081F2B] via-[#0F3547] to-[#0D1117]',
          desc: 'Custom private room BR drop in Isolated. Combined squad kill race + last surviving team takes tournament pot.',
          rewards: ['👑 Drop Champion', '💎 35k Clan Rep', 'KES 4,000 Pool'],
          multiplier: 'Custom BR Lobby',
          defaultMode: 'Squad',
          defaultStake: 'entry_fee',
          defaultFee: 300,
        },
        {
          id: 'cod-hardpoint-blitz',
          title: 'Hardpoint: 150-Point Fast Hill',
          tag: 'HARDPOINT',
          tagColor: '#10B981',
          endsIn: '4 day(s) 10 hr(s)',
          bgGradient: 'from-[#082015] via-[#103825] to-[#0D1117]',
          desc: 'Fast-paced rotational hill control. First team to 150 seconds in the hill wins. Double points for clean defense.',
          rewards: ['🔥 Zone Defender', '⭐ +50 Blitz Rep', 'Rank Badge'],
          multiplier: '150 Pts Rotation',
          defaultMode: 'Squad',
          defaultStake: 'ranked',
        }
      ];

    case 'pubg':
      return [
        {
          id: 'pubg-erangel-chicken',
          title: 'Erangel Staked Drop: Winner Dinner',
          tag: 'SOLO SURVIVOR',
          tagColor: '#F59E0B',
          endsIn: '4 day(s) 16 hr(s)',
          bgGradient: 'from-[#1F1708] via-[#33260E] to-[#0D1117]',
          desc: 'Custom room solo drop into Erangel (Pochinki / Military). Last player standing takes match pot.',
          rewards: ['🍗 Chicken Dinner Pot', '🏆 +50 Elo', 'Survivor Badge'],
          multiplier: 'Last Survivor Rules',
          defaultMode: 'Solo',
          defaultStake: 'entry_fee',
          defaultFee: 200,
        },
        {
          id: 'pubg-tdm-warehouse',
          title: '4v4 TDM Warehouse Quick Duel',
          tag: '4v4 TDM',
          tagColor: '#EF4444',
          endsIn: '2 day(s) 18 hr(s)',
          bgGradient: 'from-[#2B0E0E] via-[#451616] to-[#0D1117]',
          desc: 'Fast-paced Warehouse deathmatch. M416 / Kar98k loadouts. First squad to 40 kills claims victory.',
          rewards: ['⚡ +40 Arena Elo', '🔥 MVP Badge', 'KES 1,200 Pool'],
          multiplier: 'First to 40 Kills',
          defaultMode: 'Squad',
          defaultStake: 'entry_fee',
          defaultFee: 150,
        },
        {
          id: 'pubg-livik-race',
          title: 'Livik Blitz: Squad Kill Race',
          tag: 'SQUAD KILL RACE',
          tagColor: '#00BFEF',
          endsIn: '5 day(s) 12 hr(s)',
          bgGradient: 'from-[#081F2B] via-[#0F3547] to-[#0D1117]',
          desc: 'High-octane Livik drop. 4-man squad with the highest combined eliminations across 2 matches takes the pot.',
          rewards: ['⭐ Livik Conqueror', '💎 30k Clan Rep', 'KES 3,000 Pool'],
          multiplier: 'Squad Kill Race x2',
          defaultMode: 'Squad',
          defaultStake: 'entry_fee',
          defaultFee: 250,
        },
        {
          id: 'pubg-miramar-sniper',
          title: 'Miramar Bolt-Action Sniper Arena',
          tag: 'SNIPER LOBBY',
          tagColor: '#8B5CF6',
          endsIn: '6 day(s) 6 hr(s)',
          bgGradient: 'from-[#1A0B2E] via-[#2B144D] to-[#0D1117]',
          desc: 'Kar98k, M24 and AWM only with 8x scopes. Long range tactical duel across Miramar dunes.',
          rewards: ['🎯 Eagle Eye Pin', '🪙 600 Pts', 'Rank Elo +55'],
          multiplier: 'Bolt-Action Only',
          defaultMode: 'Duo',
          defaultStake: 'ranked',
        }
      ];

    case 'ea_fc':
      return [
        {
          id: 'ea-fut-champions',
          title: 'Weekend FUT Champions Gauntlet',
          tag: 'FUT CHAMPIONS',
          tagColor: '#00BFEF',
          endsIn: '3 day(s) 14 hr(s)',
          bgGradient: 'from-[#081F2B] via-[#0F3547] to-[#0D1117]',
          desc: 'Competitive 90-min ranked match on PS5/Xbox/PC. Authentic Ultimate Team squads. Extra time + penalties active.',
          rewards: ['🏆 +50 Weekend Elo', '🪙 Winner Takes Pot', 'Elite FUT Badge'],
          multiplier: 'Competitive 6-Min Halves',
          defaultMode: '1v1',
          defaultStake: 'entry_fee',
          defaultFee: 250,
        },
        {
          id: 'ea-golden-goal',
          title: 'Golden Goal: Sudden Death Duel',
          tag: 'GOLDEN GOAL',
          tagColor: '#F59E0B',
          endsIn: '4 day(s) 12 hr(s)',
          bgGradient: 'from-[#1F1708] via-[#33260E] to-[#0D1117]',
          desc: 'First player to score a goal wins immediately. Room code shared in Brief chat upon acceptance.',
          rewards: ['⚡ Sudden Death Cup', '👟 Skill Token x2', 'KES 1,500 Stakes'],
          multiplier: 'First Goal Wins',
          defaultMode: '1v1',
          defaultStake: 'ranked',
        },
        {
          id: 'ea-pro-clubs',
          title: 'Pro Clubs 2v2 / 3v3 Syndicate',
          tag: 'PRO CLUBS',
          tagColor: '#10B981',
          endsIn: '7 day(s) 10 hr(s)',
          bgGradient: 'from-[#082015] via-[#103825] to-[#0D1117]',
          desc: 'Bring your Virtual Pro or pair up for 2v2 or 3v3 teamplay matchrooms. Voice and chat coordinated in Brief.',
          rewards: ['⭐ Co-op Pin', '💎 30k Club Rep', 'Leaderboard +60'],
          multiplier: 'Pro Clubs Squads',
          defaultMode: '2v2',
          defaultStake: 'friendly',
        },
        {
          id: 'ea-nairobi-classico',
          title: 'Nairobi Classico: Authentic Teams',
          tag: 'AUTHENTIC SQUADS',
          tagColor: '#EC4899',
          endsIn: '5 day(s) 8 hr(s)',
          bgGradient: 'from-[#2B0E1E] via-[#42152F] to-[#0D1117]',
          desc: 'Tactical club battle using real 2025/2026 club squads (Real Madrid, Arsenal, Barcelona, Chelsea). Staked KES pool.',
          rewards: ['🎁 Classico Derby Trophy', '🪙 500 Pts', 'KES 2,500 Pool'],
          multiplier: 'Authentic Clubs Only',
          defaultMode: '1v1',
          defaultStake: 'entry_fee',
          defaultFee: 200,
        }
      ];

    case 'fc_mobile':
      return [
        {
          id: 'fcm-vsa-sprint',
          title: 'VS Attack (VSA) 90-Sec Sprint',
          tag: 'VSA SPRINT',
          tagColor: '#F59E0B',
          endsIn: '2 day(s) 12 hr(s)',
          bgGradient: 'from-[#1F1708] via-[#33260E] to-[#0D1117]',
          desc: 'Fast-paced 90-second attack scenario rush. Most goals scored from high-intensity counter-attacks wins.',
          rewards: ['🏆 +40 VSA Elo', '🪙 Winner Takes Pot', 'Speed Badge'],
          multiplier: '90-Second Rush',
          defaultMode: '1v1',
          defaultStake: 'entry_fee',
          defaultFee: 100,
        },
        {
          id: 'fcm-h2h-match',
          title: 'Head to Head (H2H) Staked 1v1',
          tag: 'H2H FULL MATCH',
          tagColor: '#00BFEF',
          endsIn: '5 day(s) 18 hr(s)',
          bgGradient: 'from-[#081F2B] via-[#0F3547] to-[#0D1117]',
          desc: 'Full 90-minute real-time mobile gameplay. Normal speed, gestures and virtual buttons active.',
          rewards: ['⚡ H2H Leaderboard Pts', '👟 Skill Token', 'KES 1,200 Stakes'],
          multiplier: 'Real-Time H2H',
          defaultMode: '1v1',
          defaultStake: 'entry_fee',
          defaultFee: 150,
        },
        {
          id: 'fcm-manager-mode',
          title: 'Manager Mode Tactical League',
          tag: 'TACTICAL AUTO',
          tagColor: '#10B981',
          endsIn: '6 day(s) 14 hr(s)',
          bgGradient: 'from-[#082015] via-[#103825] to-[#0D1117]',
          desc: 'Tactical simulation duel. Choose tactical playbook (Counter / Attacking / Balanced) and battle rival OVR teams.',
          rewards: ['⭐ Manager Cup', '💎 20k OVR Rep', 'Leaderboard +50'],
          multiplier: 'Tactical Simulation',
          defaultMode: '1v1',
          defaultStake: 'ranked',
        },
        {
          id: 'fcm-mobile-derby',
          title: 'East Africa Mobile Championship',
          tag: 'REGIONAL BRACKET',
          tagColor: '#EC4899',
          endsIn: '4 day(s) 6 hr(s)',
          bgGradient: 'from-[#2B0E1E] via-[#42152F] to-[#0D1117]',
          desc: 'Regional tournament for African FC Mobile players. 100+ OVR squads eligible. Staked KES prize pool.',
          rewards: ['🎁 EA Africa Trophy', '🪙 600 Pts', 'KES 2,500 Pool'],
          multiplier: 'Bracket Tournament',
          defaultMode: '1v1',
          defaultStake: 'entry_fee',
          defaultFee: 200,
        }
      ];

    case 'efootball':
    default:
      return [
        {
          id: 'ef-golden-goal',
          title: 'Golden Goal: Sudden Death Duel',
          tag: 'GOLDEN GOAL',
          tagColor: '#F59E0B',
          endsIn: '4 day(s) 12 hr(s)',
          bgGradient: 'from-[#1A1408] via-[#2A1F0C] to-[#0D1117]',
          desc: 'First player to score a goal wins immediately. Normal time only. Room code shared in Brief chat upon acceptance.',
          rewards: ['🏆 +40 Elo', '🪙 Winner Takes Pot', 'Golden Boot Pin'],
          multiplier: 'Sudden Death Rules',
          defaultMode: '1v1',
          defaultStake: 'ranked',
        },
        {
          id: 'ef-tour-blitz',
          title: 'Tour & Milestone Challenge Blitz',
          tag: 'TOUR BLITZ',
          tagColor: '#10B981',
          endsIn: '6 day(s) 18 hr(s)',
          bgGradient: 'from-[#082015] via-[#103825] to-[#0D1117]',
          desc: 'Climb the eFootball milestone point ladder. Win matches and earn event reward multipliers.',
          rewards: ['⚡ Event Points', '🪙 500 Coins', 'KES 1,500 Pool'],
          multiplier: '+180% Event Multiplier',
          defaultMode: '1v1',
          defaultStake: 'entry_fee',
          defaultFee: 150,
        },
        {
          id: 'ef-coop-pinboard',
          title: '3v3 Co-op Syndicate Pinboard',
          tag: '3v3 CO-OP SQUAD',
          tagColor: '#00BFEF',
          endsIn: '13 day(s) 18 hr(s)',
          bgGradient: 'from-[#0B1B2A] via-[#173247] to-[#0D1117]',
          desc: 'Coordinate 3v3 co-op matchroom invites. Team up with clan mates across Nairobi & Mombasa.',
          rewards: ['⭐ Co-op Pin', '💎 30k Clan Rep', 'Leaderboard +60'],
          multiplier: '+200% Team Multiplier',
          defaultMode: '2v2',
          defaultStake: 'friendly',
        },
        {
          id: 'ef-african-derby',
          title: 'eFootball Nairobi Derby Championship',
          tag: 'REGIONAL DERBY',
          tagColor: '#EC4899',
          endsIn: '5 day(s) 6 hr(s)',
          bgGradient: 'from-[#2B0E1E] via-[#42152F] to-[#0D1117]',
          desc: 'Weekly regional tournament for African eFootball contenders. Authentic Dream Team squads only.',
          rewards: ['🎁 Derby Cup', '🪙 1,000 Pts', 'KES 3,000 Pool'],
          multiplier: '+220% Derby Stakes',
          defaultMode: '1v1',
          defaultStake: 'entry_fee',
          defaultFee: 250,
        }
      ];
  }
}
