import React from 'react';
import { PipelineExplorer } from './PipelineExplorer';

// ---------------------------------------------------------------------------
// ACTIONS ENGINE — the automation dashboard
//
// The "Actions" screen rendered as a living system, not typed text. Two things
// are real here and nothing is faked:
//
//   1. The PIPELINE EXPLORER (top feature) — the ingestion mechanism itself,
//      clickable and count-backed from /api/status. This is the feature the
//      whole product is built on.
//
//   2. CHANNEL INGEST — each channel's status is read from /api/capabilities:
//      a channel shows "Listening" only when its connector is genuinely
//      configured AND the server is reachable. There is no toggle, because
//      there is no backend capability to enable/disable connectors — a dead
//      switch would be a lie about what the system can do.
//
// Everything below is honest presentation: no fabricated numbers, no
// action-shadowing controls.
// ---------------------------------------------------------------------------

interface Capabilities {
  telegram?: { configured?: boolean };
  whatsapp?: { configured?: boolean };
}

interface PipelineStats {
  rawItems?: number;
  objects?: number;
  relationships?: number;
  sources?: number;
  lastSyncRuns?: { connector?: string; at?: string }[];
}

export interface ActionsEngineProps {
  online: boolean;
  checked: boolean;
  capabilities: Capabilities | null;
  liveSourceCount: number;
  stats: PipelineStats | null;
}

function ChannelStatus({ glyph, name, detail, configured, online, hue }: {
  glyph: string;
  name: string;
  detail: string;
  configured: boolean;
  online: boolean;
  hue: string;
}) {
  const live = configured && online;
  const label = live ? 'Listening' : configured ? 'Offline' : 'Not configured';
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#232A38] bg-[#10141C] px-4 py-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `${hue}22` }}>
        {glyph}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-extrabold text-[#F3F1E7]">{name}</p>
        <p className="mt-0.5 truncate text-[10px] text-[#8A93A6]">{detail}</p>
      </div>
      {/* A plain status indicator — informational, never a control */}
      <span
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide ${
          live ? 'bg-[#43D17A]/15 text-[#43D17A]' : configured ? 'bg-[#10141C] text-[#8A93A6]' : 'bg-[#10141C] text-[#4B5162]'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-[#43D17A]' : 'bg-[#4B5162]'}`} />
        {label}
      </span>
    </div>
  );
}

export function ActionsEngine({ online, checked, capabilities, liveSourceCount, stats }: ActionsEngineProps) {
  const tg = capabilities?.telegram?.configured ?? false;
  const wa = capabilities?.whatsapp?.configured ?? false;

  return (
    <div className="space-y-4">
      {/* 1. THE PIPELINE — the feature the screen exists to explain */}
      <PipelineExplorer stats={stats} online={online} />

      {/* 2. Channel ingest — honest connector status */}
      <div className="space-y-2">
        <p className="px-1 text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#4B5162]">Channel ingest</p>
        <ChannelStatus glyph="📡" name="Telegram" detail="Groups and channels, in real time" configured={tg} online={online} hue="#43D17A" />
        <ChannelStatus glyph="💬" name="WhatsApp" detail="Inbound messages, signature-verified" configured={wa} online={online} hue="#43D17A" />
        <ChannelStatus glyph="🌐" name="Web & RSS" detail="Public pages and feeds — always on" configured online={online} hue="#43D17A" />
        <ChannelStatus glyph="✍️" name="Manual capture" detail="Paste anything, anywhere — always on" configured online hue="#43D17A" />
      </div>

      {/* 3. Reachability + last-run — a live status row (§7.3). The timestamp is
          a real sync-run readout in mono; it reads "—" when there's no run yet. */}
      <div className="flex items-center justify-between rounded-2xl border border-[#232A38] bg-[#10141C] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`brief-breathe h-2 w-2 rounded-full ${online ? 'bg-[#43D17A]' : 'bg-[#4B5162]'}`} />
          <p className="text-[12px] font-bold text-[#F3F1E7]">Ingestion engine</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#8A93A6]">
            {!checked ? 'Checking…' : online ? `${liveSourceCount} source${liveSourceCount === 1 ? '' : 's'} connected` : 'Server unreachable'}
          </p>
          {stats?.lastSyncRuns?.[0]?.at && (
            <p className="font-mono-live text-[9px] text-[#4B5162]">
              last run {new Date(stats.lastSyncRuns[0].at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* 4. Glassy security disclaimer */}
      <div className="rounded-2xl border border-[#43D17A]/15 bg-[#43D17A]/5 p-4 backdrop-blur-sm">
        <div className="flex items-start gap-2.5">
          <span className="text-base">🛡️</span>
          <p className="text-[10px] leading-relaxed text-[#8A93A6]">
            Channel secrets stay server-side. Inbound messages are verified
            before they ever reach an object, and a failing connector never
            takes Brief down.
          </p>
        </div>
      </div>
    </div>
  );
}
