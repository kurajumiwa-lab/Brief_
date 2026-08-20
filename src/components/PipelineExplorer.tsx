import React from 'react';
import { Settings, ArrowDown, Diamond, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// PIPELINE EXPLORER — "how Brief works", for a layman
//
// This is the feature the whole product is built on: a message arrives from a
// community, Brief extracts the real facts, and one findable/verifiable object
// comes out the other side. It was previously three static dots that told you
// nothing; now it is a clickable, count-backed explainer:
//
//   * each stage is a real <button> that expands a plain-language explanation
//   * each stage shows a REAL count from /api/status (messages, objects,
//     connections) — when the server is unreachable it shows "—", never a fake
//     number
//   * the connectors are animated so the flow reads as movement, not a table
//
// It never moves money, never mutates anything, and never invents a figure.
// ---------------------------------------------------------------------------

interface PipelineStats {
  rawItems?: number;
  objects?: number;
  relationships?: number;
  sources?: number;
}

export interface PipelineExplorerProps {
  stats: PipelineStats | null;
  online: boolean;
}

type Stage = 'in' | 'understand' | 'act';

const STAGES: { id: Stage; glyph: LucideIcon; label: string; verb: string; count: (s: PipelineStats) => number | null; explain: string; example: string }[] = [
  {
    id: 'in',
    glyph: ArrowDown,
    label: 'Message in',
    verb: 'message',
    count: (s) => s?.rawItems ?? null,
    explain: 'Communities post on Telegram, WhatsApp or the web. Brief captures each message exactly as it arrived — nothing is invented or rewritten.',
    example: '"Saturday popup at Kilimani Studio, KES 300 entry, 4–10pm."'
  },
  {
    id: 'understand',
    glyph: Diamond,
    label: 'Brief understands it',
    verb: 'thing',
    count: (s) => s?.objects ?? null,
    explain: 'Brief reads the message and pulls out the real facts — what it is, where, when, how much. Anything it cannot confirm stays unstated.',
    example: 'A popup · Kilimani Studio · KES 300 · Saturday, 4–10pm'
  },
  {
    id: 'act',
    glyph: Check,
    label: 'Thing to act on',
    verb: 'connection',
    count: (s) => s?.relationships ?? null,
    explain: 'One real-world thing becomes one object, linked to its vendors, place and source. You find it, verify it, and act on it.',
    example: 'One popup · linked vendors · one trusted source'
  }
];

export function PipelineExplorer({ stats, online }: PipelineExplorerProps) {
  const [open, setOpen] = React.useState<Stage | null>(null);

  return (
    <div className="rounded-2xl border border-[#43D17A]/20 bg-gradient-to-b from-[#10141C] to-[#090B10] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Settings className="h-4 w-4" style={{ color: 'var(--signal-live)' }} />
        <div className="min-w-0">
          <p className="text-[12px] font-extrabold text-[#F3F1E7]">How Brief works</p>
          <p className="text-[10px] text-[#8A93A6]">Everything you see starts as a message. Tap a step.</p>
        </div>
      </div>

      {/* The three clickable stages, joined by animated connectors */}
      <div className="flex items-stretch gap-0">
        {STAGES.map((stage, i) => {
          const count = stats ? stage.count(stats) : null;
          const isOpen = open === stage.id;
          return (
            <React.Fragment key={stage.id}>
              <button
                onClick={() => setOpen(isOpen ? null : stage.id)}
                aria-expanded={isOpen}
                className={`brief-sheen relative flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all ${
                  isOpen
                    ? 'border-[#43D17A]/60 bg-[#43D17A]/10'
                    : 'border-[#232A38] bg-[#10141C] hover:border-[#43D17A]/40'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-extrabold ${
                    isOpen ? 'border-[#43D17A] text-[#43D17A]' : 'border-[#232A38] text-[#8A93A6]'
                  }`}
                  style={isOpen ? { boxShadow: '0 0 14px rgba(0,230,118,0.35)' } : undefined}
                >
                  <stage.glyph className="h-4 w-4" />
                </span>
                <span className={`text-[10px] font-bold leading-tight ${isOpen ? 'text-[#43D17A]' : 'text-[#F3F1E7]'}`}>
                  {stage.label}
                </span>
                <span className="text-[11px] font-extrabold text-[#F3F1E7]">
                  {count === null ? (online ? '…' : '—') : count}
                </span>
                <span className="text-[8px] uppercase tracking-wide text-[#4B5162]">
                  {count === 1 ? stage.verb : `${stage.verb}s`}
                </span>
              </button>

              {i < STAGES.length - 1 && (
                <div className="flex w-4 shrink-0 items-center">
                  <div className="brief-flow-connector h-0.5 flex-1 rounded-full bg-[#43D17A]/40" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Expanded explanation — a real interaction, not a dead control */}
      {open && (
        <div className="brief-spring-modal mt-3 rounded-xl border border-[#43D17A]/25 bg-[#10141C] p-3">
          {(() => {
            const stage = STAGES.find((s) => s.id === open)!;
            return (
              <>
                <p className="text-[11px] leading-relaxed text-[#F3F1E7]">{stage.explain}</p>
                <p className="mt-2 rounded-lg bg-[#090B10] px-2.5 py-2 font-mono text-[10px] text-[#43D17A]">
                  {stage.example}
                </p>
              </>
            );
          })()}
        </div>
      )}

      {/* Honest availability note */}
      {!online && (
        <p className="mt-2 text-[9px] text-[#4B5162]">
          Counts appear once Brief is reachable. The flow itself is always on.
        </p>
      )}
    </div>
  );
}
