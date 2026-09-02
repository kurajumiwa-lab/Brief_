import React from 'react';
import { ExternalLink, MessageCircle, Sparkles } from 'lucide-react';
import type { CampaignBanner } from '../api/types';
import bannerArt from '../assets/shelf/whatsapp-share.webp';

// ---------------------------------------------------------------------------
// STANDALONE BANNER
//
// A public presentation wrapper over a real published campaign. The canonical
// campaign URL and WhatsApp intent URL come from the server; this component
// only presents them. When the public origin is not configured it says so
// instead of manufacturing a link from the preview host.
// ---------------------------------------------------------------------------

export interface StandaloneBannerProps {
  banner: CampaignBanner;
}

export function StandaloneBanner({ banner }: StandaloneBannerProps) {
  const image = banner.imageUrl || bannerArt;
  return (
    <article className="group relative min-h-[190px] overflow-hidden rounded-2xl border border-[#E5E8EC] bg-[#FF5A1F]">
      <img src={image} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117]/95 via-[#0D1117]/55 to-[#0D1117]/10" />
      <div className="relative flex min-h-[190px] flex-col justify-between p-4 text-[#FFFFFF]">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFFFF] px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#0D1117]">
            <Sparkles className="h-3 w-3" /> Standalone banner
          </span>
          {banner.location && <span className="max-w-[45%] truncate text-[9px] font-bold text-[#FFFFFF]/70">{banner.location}</span>}
        </div>
        <div>
          <h3 className="max-w-xl text-[18px] font-extrabold leading-tight">{banner.title}</h3>
          {banner.body && <p className="mt-1 line-clamp-2 max-w-xl text-[11px] leading-snug text-[#FFFFFF]/75">{banner.body}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {banner.share.available ? (
              <>
                <a
                  href={banner.share.channels.whatsapp}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#FFFFFF] px-3 py-2 text-[10px] font-extrabold text-[#0D1117]"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Open in WhatsApp
                </a>
                <a
                  href={banner.share.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E5E8EC]/30 px-3 py-2 text-[10px] font-extrabold text-[#0D1117]"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View campaign
                </a>
              </>
            ) : (
              <span className="rounded-lg border border-[#E5E8EC]/25 px-3 py-2 text-[10px] font-bold text-[#0D1117]/70">
                Public link unavailable · {banner.share.reason.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default StandaloneBanner;
