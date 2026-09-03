import React, { useState, useEffect } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Radio,
  Play,
  Share2,
  Award,
  ArrowRight
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface LiveMatchTrackerData {
  id: string;
  gameTitle: string;
  roomCode: string;
  team1: { name: string; tag: string; score: number; avatar: string };
  team2: { name: string; tag: string; score: number; avatar: string };
  minute: number;
  matchEvent: 'Kick-off' | 'Dangerous Attack' | 'Shot on Target' | 'Corner Kick' | 'Goal!' | 'Penalty Shootout';
  attackVectorX: number; // 0% to 100% on pitch
  attackVectorY: number;
  possessionTeam: 1 | 2;
  stakePotKes: number;
}

export function OneXbetMatchTracker({
  match,
  onClose,
  onOpenVoice
}: {
  match: LiveMatchTrackerData;
  onClose: () => void;
  onOpenVoice?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [liveEvent, setLiveEvent] = useState(match.matchEvent);
  const [ballX, setBallX] = useState(match.attackVectorX);
  const [ballY, setBallY] = useState(match.attackVectorY);
  const [currentMinute, setCurrentMinute] = useState(match.minute);

  // Simulate animated pitch movements
  useEffect(() => {
    const interval = setInterval(() => {
      setBallX(Math.floor(20 + Math.random() * 60));
      setBallY(Math.floor(20 + Math.random() * 60));
      setCurrentMinute(prev => Math.min(prev + 1, 90));
      const events: LiveMatchTrackerData['matchEvent'][] = [
        'Dangerous Attack',
        'Shot on Target',
        'Corner Kick',
        'Dangerous Attack'
      ];
      setLiveEvent(events[Math.floor(Math.random() * events.length)]);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleCopyCode = () => {
    soundEngine.play('tap');
    navigator.clipboard?.writeText(match.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0B1B2B] text-white rounded-3xl border border-[#203A60] shadow-2xl overflow-hidden my-auto">
        
        {/* ================= HEADER ================= */}
        <div className="bg-[#11233B] p-4 border-b border-[#203A60] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00D26A] animate-pulse" />
            <span className="text-[10px] font-mono font-black uppercase text-[#00BFEF] tracking-wider">
              1XBET IN-PLAY MATCH TRACKER
            </span>
            <span className="text-xs text-gray-400 font-mono">({match.gameTitle})</span>
          </div>

          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); onClose(); }}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================= SCOREBOARD STRIP ================= */}
        <div className="p-4 bg-gradient-to-r from-[#0D1C2E] via-[#162B48] to-[#0D1C2E] border-b border-[#203A60]">
          <div className="flex items-center justify-between">
            {/* Team 1 */}
            <div className="flex items-center space-x-3 w-5/12">
              <div className="w-10 h-10 rounded-2xl bg-[#2563EB]/20 border border-[#2563EB] flex items-center justify-center text-lg">
                {match.team1.avatar}
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-xs text-white truncate">{match.team1.name}</h4>
                <span className="text-[10px] font-mono text-gray-400">{match.team1.tag}</span>
              </div>
            </div>

            {/* Live Score & Time */}
            <div className="flex flex-col items-center justify-center px-3 text-center">
              <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                LIVE {currentMinute}'
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white mt-1">
                {match.team1.score} : {match.team2.score}
              </div>
              <span className="text-[9px] font-mono text-[#00BFEF] mt-0.5">Pot: KES {match.stakePotKes}</span>
            </div>

            {/* Team 2 */}
            <div className="flex items-center justify-end space-x-3 w-5/12 text-right">
              <div className="min-w-0">
                <h4 className="font-black text-xs text-white truncate">{match.team2.name}</h4>
                <span className="text-[10px] font-mono text-gray-400">{match.team2.tag}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#00D26A]/20 border border-[#00D26A] flex items-center justify-center text-lg">
                {match.team2.avatar}
              </div>
            </div>
          </div>
        </div>

        {/* ================= 2D PITCH GRAPHICS ================= */}
        <div className="p-4 space-y-3">
          <div className="h-44 sm:h-52 rounded-2xl onex-pitch-grid flex items-center justify-center relative p-3">
            {/* Pitch markings */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t onex-pitch-line" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border onex-pitch-line" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-24 border-r border-y onex-pitch-line" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-24 border-l border-y onex-pitch-line" />

            {/* Ball Marker */}
            <div
              style={{ left: `${ballX}%`, top: `${ballY}%` }}
              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg ring-4 ring-[#00D26A]/50 transition-all duration-1000 flex items-center justify-center text-[8px]"
            >
              ⚽
            </div>

            {/* In-play event badge */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm border border-white/20 px-3 py-1 rounded-full text-[10px] font-mono font-bold text-white flex items-center space-x-1.5 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span>{liveEvent}</span>
            </div>
          </div>

          {/* Quick Room Code & Comms Bar */}
          <div className="p-3.5 rounded-2xl bg-[#11233B] border border-[#203A60] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 font-mono">
              <span className="text-gray-400 text-[10px] uppercase">GAME ROOM CODE:</span>
              <span className="text-base font-black text-emerald-400 tracking-wider bg-[#07121E] px-2.5 py-1 rounded-lg border border-[#203A60]">
                {match.roomCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                title="Copy Room Code"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {onOpenVoice && (
                <button
                  type="button"
                  onClick={() => { soundEngine.play('tap'); onOpenVoice(); }}
                  className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Join Live Voice</span>
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
