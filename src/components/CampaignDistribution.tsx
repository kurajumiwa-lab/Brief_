// ---------------------------------------------------------------------------
// CAMPAIGN DISTRIBUTION SURFACE
//
// A persistent share surface for a published campaign: the canonical URL as
// readable text, Copy, and the three channels that genuinely support a share
// intent. Extracted as its own module so the same surface can appear both at
// the publish moment and in the campaign detail view WITHOUT duplicating the
// markup or growing App.tsx.
//
// HONESTY RULES BAKED IN:
//   - The URL is only ever the server-configured canonical one, passed in.
//     This component cannot construct an origin and never sees window.location.
//   - Instagram and TikTok get no buttons, because neither platform exposes a
//     share-intent URL. They are named as copy-link, not faked.
//   - Nothing here records economic activity. Pressing a channel button emits
//     an existing `campaign_shared` signal via onShare and nothing else.
// ---------------------------------------------------------------------------

import React from 'react';
import * as briefApi from '../api/briefApi';
import type { ShareLink, ShareChannel } from '../api/types';

export interface CampaignDistributionProps {
  /** Canonical link, or the structured reason there isn't one. */
  link: ShareLink;
  /** Used to pre-fill the channel compose box. */
  title: string;
  onCopy: () => void;
  /** Records an existing campaign_shared signal. Never moves money. */
  onShare: (channel: ShareChannel) => void;
  /** The native share sheet, when the browser has one. */
  onNativeShare?: () => void;
  compact?: boolean;
}

export function CampaignDistribution({
  link,
  title,
  onCopy,
  onShare,
  onNativeShare,
  compact = false
}: CampaignDistributionProps) {
  // No configured origin means there is no honest link to hand out. Show the
  // canonical slug instead of a URL guessed from the current host.
  if (!link.available) {
    return (
      <div className="bg-[#211F1A] border border-[#3B372B] rounded-xl p-3 space-y-1">
        <p className="text-[11px] text-[#F2EFE7] font-extrabold">
          No public link configured yet.
        </p>
        <p className="text-[10px] text-[#9A9278] leading-snug">
          Your campaign is live. Once a public address is set up for this Brief,
          your link will be:
        </p>
        <p className="text-[10px] text-[#7FA98B] break-all">
          /c/{link.slug}
        </p>
      </div>
    );
  }

  const channels = briefApi.campaignShareChannels(link.url, title);
  const buttons: [string, string, ShareChannel][] = [
    ['WhatsApp', channels.whatsapp, 'whatsapp'],
    ['Telegram', channels.telegram, 'telegram'],
    ['X', channels.x, 'x']
  ];

  return (
    <div className="space-y-2">
      <div className="bg-[#211F1A] border border-[#3B372B] rounded-xl p-3">
        <p className="text-[9px] text-[#6F6A58] mb-1">
          Your link
        </p>
        <p className="text-[10px] text-[#7FA98B] break-all">{link.url}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCopy}
          className={`flex-1 rounded-xl bg-[#3E9A66] text-[#191714] font-extrabold cursor-pointer ${
            compact ? 'py-2.5 text-[11px]' : 'py-3 text-xs'
          }`}
        >
          Copy link
        </button>
        {onNativeShare && (
          <button
            onClick={onNativeShare}
            className={`rounded-xl border border-[#3F5544] text-[#7FA98B] font-extrabold cursor-pointer ${
              compact ? 'px-4 py-2.5 text-[11px]' : 'px-4 py-3 text-xs'
            }`}
          >
            Share
          </button>
        )}
      </div>

      {/* Plain URL intents, not API integrations. Brief posts nothing on
          anyone's behalf and holds no social credentials. */}
      <div className="flex flex-wrap gap-1.5">
        {buttons.map(([label, href, ch]) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => onShare(ch)}
            className="px-3 py-1.5 rounded-full border border-[#3F5544] text-[#7FA98B] font-extrabold text-[10px] cursor-pointer"
          >
            {label}
          </a>
        ))}
      </div>

      <p className="text-[9px] text-[#6F6A58] leading-snug">
        For Instagram or TikTok, copy the link and paste it into your bio or
        caption.
      </p>
    </div>
  );
}
