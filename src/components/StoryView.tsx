import React from 'react';
import { themeFor, layoutFor, accentFor, heroVeil, designOf, type StoryDesign } from './storyDesign';

// ---------------------------------------------------------------------------
// STORY VIEW — the designed rendering of a story.
//
// Used IDENTICALLY by the full-screen editor's live preview and by the reader,
// so what the editor designs is exactly what readers get. Layouts arrange the
// hero and the text; themes set surface/ink/typography; the freehand accent
// and overlay strength apply on top. It renders only what it is given — no
// placeholder art, no invented meta.
// ---------------------------------------------------------------------------

export interface StoryViewArticle {
  title: string;
  dek?: string;
  body?: string;
  heroImage?: string | null;
  images?: string[];
  category?: string;
  location?: string | null;
  readingTime?: number;
  author?: string | null;
  publishedAt?: string | null;
}

export interface StoryViewProps {
  article: StoryViewArticle;
  design: StoryDesign | null;
  /** 'read' = the reader page; 'preview' = the editor's scaled canvas. */
  mode?: 'read' | 'preview';
}

function Meta({ a, inkDim, accent }: { a: StoryViewArticle; inkDim: string; accent: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.16em]" style={{ color: inkDim }}>
      <span style={{ color: accent }}>{a.category ?? 'story'}</span>
      {a.location ? <span>· {a.location}</span> : null}
      {a.readingTime ? <span>· {a.readingTime} min</span> : null}
      {a.author ? <span>· {a.author}</span> : null}
    </div>
  );
}

export function StoryView({ article: a, design, mode = 'read' }: StoryViewProps) {
  const theme = themeFor(design);
  const layout = layoutFor(design);
  const accent = accentFor(design);
  const d = designOf({ design });
  const hero = a.heroImage ?? null;
  const bodyClass = mode === 'preview' ? 'text-[11px] leading-relaxed' : 'text-[15px] leading-relaxed';
  const dekClass = mode === 'preview' ? 'text-[11px] leading-snug' : 'text-[15px] leading-relaxed';
  const titleClass = mode === 'preview'
    ? `${theme.titleClass} text-xl`
    : theme.titleClass;

  const Title = (
    <h1 className={`${titleClass}`} style={{ color: theme.ink }}>
      {a.title || 'Untitled story'}
    </h1>
  );
  const Dek = a.dek ? <p className={`${dekClass}`} style={{ color: theme.inkDim }}>{a.dek}</p> : null;
  const Body = a.body ? (
    <div className={`whitespace-pre-wrap ${bodyClass}`} style={{ color: theme.ink }}>
      {a.body}
    </div>
  ) : null;

  // --- Full-bleed: the hero fills the frame; the type sits over the veil ---
  if (layout.id === 'full-bleed' && hero) {
    return (
      <div className="overflow-hidden" style={{ background: theme.surface }}>
        <div className={`relative ${mode === 'preview' ? 'h-56' : 'h-72 sm:h-96'}`}>
          <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: heroVeil(d) }} />
          <div className={`absolute inset-x-0 bottom-0 ${mode === 'preview' ? 'p-4' : 'p-6'}`}>
            <Meta a={a} inkDim="rgba(255,255,255,0.75)" accent="#FFFFFF" />
            <div className="mt-2">{Title}</div>
            {Dek && <div className="mt-1">{Dek}</div>}
          </div>
        </div>
        <div className={`${mode === 'preview' ? 'p-4' : 'p-6'}`}>{Body}</div>
      </div>
    );
  }

  // --- Split: hero beside the text (stacked on narrow screens) ---
  if (layout.id === 'split') {
    return (
      <div className="overflow-hidden" style={{ background: theme.surface }}>
        <div className={`grid ${mode === 'read' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
          {hero && (
            <div className={`relative ${mode === 'read' ? 'min-h-64' : 'h-40'}`}>
              <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          )}
          <div className={`${mode === 'preview' ? 'p-4' : 'p-6'}`}>
            <Meta a={a} inkDim={theme.inkDim} accent={accent} />
            <div className="mt-2">{Title}</div>
            {Dek && <div className="mt-2">{Dek}</div>}
            <div className="mt-3 h-px w-12" style={{ background: accent }} />
            <div className="mt-3">{Body}</div>
          </div>
        </div>
      </div>
    );
  }

  // --- Center / Left: hero block above, arranged text below ---
  const centered = layout.id === 'center';
  return (
    <div className="overflow-hidden" style={{ background: theme.surface }}>
      {hero && (
        <div className={`relative ${mode === 'preview' ? 'h-36' : 'h-64'}`}>
          <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
      )}
      <div
        className={`${mode === 'preview' ? 'p-4' : 'p-6'} ${
          centered ? 'text-center' : ''
        }`}
      >
        <div className="flex justify-center">
          <Meta a={a} inkDim={theme.inkDim} accent={accent} />
        </div>
        <div className="mt-2">{Title}</div>
        {Dek && <div className="mt-2">{Dek}</div>}
        <div className={`mt-3 h-px w-12 ${centered ? 'mx-auto' : ''}`} style={{ background: accent }} />
        <div className={`mt-3 ${centered ? 'text-left' : ''}`}>{Body}</div>
      </div>
    </div>
  );
}

export default StoryView;
