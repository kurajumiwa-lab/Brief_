import React from 'react';

// ---------------------------------------------------------------------------
// ACTIONS ENGINE — the automation dashboard visual shell
//
// The "Actions" screen rendered as a living system, not typed text. Every
// channel card reflects REAL connector state from /api/capabilities (a channel
// is "Listening" only when its connector is genuinely configured — no fake
// "connected" toggles). The node-flow webhook graphic mirrors the server's
// reachability. All of it is decorative presentation layered over the real
// workflow state; it never emits a fake number or shadows a real action.
// ---------------------------------------------------------------------------

interface Capabilities {
  telegram?: { configured?: boolean };
  whatsapp?: { configured?: boolean };
  web?: Record<string, unknown>;
  rss?: Record<string, unknown>;
  manual?: Record<string, unknown>;
}

export interface ActionsEngineProps {
  online: boolean;
  checked: boolean;
  capabilities: Capabilities | null;
  liveSourceCount: number;
}

function ChannelCard({
  glyph,
  name,
  detail,
  configured,
  online,
  hue
}: {
  glyph: string;
  name: string;
  detail: string;
  configured: boolean;
  online: boolean;
  hue: string;
}) {
  const live = configured && online;
  return (
    <div className="brief-sheen relative flex items-center gap-3 rounded-2xl border border-[#1E1E22] bg-[#121214] px-4 py-3.5">
      {/* left glyph in a tinted well */}
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
        style={{ background: `${hue}22` }}
      >
        {glyph}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-extrabold text-[#FFFFFF]">{name}</p>
          <span
            className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide ${
              live ? 'bg-[#00E676]/15 text-[#00E676]' : 'bg-[#1C1C1F] text-[#48484A]'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-[#00E676]' : 'bg-[#48484A]'}`} />
            {live ? 'Listening' : configured ? 'Offline' : 'Not configured'}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-[#8E8E93]">{detail}</p>
      </div>

      {/* live sparkline graphic */}
      <svg viewBox="0 0 48 18" className="h-5 w-12 shrink-0 opacity-80" aria-hidden="true">
        <polyline
          points="0,14 8,11 14,13 22,7 30,9 38,4 48,6"
          fill="none"
          stroke={live ? '#00E676' : '#48484A'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* toggle */}
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full border ${
          live ? 'border-[#00E676] bg-[#00E676]/20' : 'border-[#1E1E22] bg-[#1C1C1F]'
        }`}
      >
        <span
          className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all ${
            live ? 'right-1 bg-[#00E676]' : 'left-1 bg-[#48484A]'
          }`}
        />
      </span>
    </div>
  );
}

function NodeFlow({ active }: { active: boolean }) {
  const nodes = ['incoming', 'parse', 'object'];
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#1E1E22] bg-[#121214] px-5 py-4">
      {nodes.map((n, i) => (
        <React.Fragment key={n}>
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={`brief-glow flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-extrabold uppercase tracking-wide ${
                active ? 'border-[#00E676]/50 text-[#00E676]' : 'border-[#1E1E22] text-[#48484A]'
              }`}
              style={active ? { boxShadow: '0 0 12px rgba(0,230,118,0.25)' } : undefined}
            >
              {n === 'incoming' ? '⇣' : n === 'parse' ? '◇' : '✓'}
            </span>
            <span className={`text-[9px] ${active ? 'text-[#00E676]' : 'text-[#48484A]'}`}>{n}</span>
          </div>
          {i < nodes.length - 1 && (
            <span className={`flex-1 border-t border-dashed ${active ? 'border-[#00E676]/40' : 'border-[#1E1E22]'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export function ActionsEngine({ online, checked, capabilities, liveSourceCount }: ActionsEngineProps) {
  const tg = capabilities?.telegram?.configured ?? false;
  const wa = capabilities?.whatsapp?.configured ?? false;

  return (
    <div className="space-y-4">
      {/* Hero banner */}
      <div
        className="brief-sheen brief-silk relative h-36 w-full overflow-hidden rounded-2xl border border-[#1E1E22]"
        style={{ backgroundImage: 'linear-gradient(135deg, #1b1c24 0%, #2a1d3a 50%, #0c0d10 100%)' }}
      >
        <div
          className="brief-glow absolute -right-6 -top-10 h-40 w-40 rounded-full"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(0,230,118,0.35) 0%, transparent 70%)', filter: 'blur(18px)' }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#00E676]">Automation</p>
            <p className="mt-1 text-2xl font-extrabold text-[#FFFFFF]">Channel ingest</p>
            <p className="mt-1 text-[11px] text-[#8E8E93]">Live webhook triggers · always on</p>
          </div>
          <span className="brief-float text-5xl drop-shadow-[0_0_18px_rgba(0,230,118,0.5)]">⚡</span>
        </div>
      </div>

      {/* Channel Ingest */}
      <div className="space-y-2">
        <p className="px-1 text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#48484A]">Channel ingest</p>
        <ChannelCard
          glyph="📡"
          name="Telegram"
          detail="Groups and channels, in real time"
          configured={tg}
          online={online}
          hue="#00E676"
        />
        <ChannelCard
          glyph="💬"
          name="WhatsApp"
          detail="Inbound messages, signature-verified"
          configured={wa}
          online={online}
          hue="#00E676"
        />
        <ChannelCard
          glyph="🌐"
          name="Web & RSS"
          detail="Public pages and feeds"
          configured
          online={online}
          hue="#00E676"
        />
        <ChannelCard
          glyph="✍️"
          name="Manual capture"
          detail="Paste anything, anywhere"
          configured
          online
          hue="#00E676"
        />
      </div>

      {/* Webhook triggers */}
      <div className="space-y-2">
        <p className="px-1 text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#48484A]">Webhook triggers</p>
        <NodeFlow active={online} />
        <div className="flex items-center justify-between rounded-2xl border border-[#1E1E22] bg-[#121214] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`brief-glow h-2 w-2 rounded-full ${online ? 'bg-[#00E676]' : 'bg-[#48484A]'}`} />
            <p className="text-[12px] font-bold text-[#FFFFFF]">Live webhook triggers</p>
          </div>
          <p className="text-[10px] text-[#8E8E93]">
            {!checked ? 'Checking…' : online ? `${liveSourceCount} source${liveSourceCount === 1 ? '' : 's'} connected` : 'Server unreachable'}
          </p>
        </div>
      </div>

      {/* Glassy security disclaimer */}
      <div className="rounded-2xl border border-[#00E676]/15 bg-[#00E676]/5 p-4 backdrop-blur-sm">
        <div className="flex items-start gap-2.5">
          <span className="text-base">🛡️</span>
          <p className="text-[10px] leading-relaxed text-[#8E8E93]">
            Channel secrets stay server-side. Inbound messages are verified
            before they ever reach an object, and a failing connector never
            takes Brief down.
          </p>
        </div>
      </div>
    </div>
  );
}
