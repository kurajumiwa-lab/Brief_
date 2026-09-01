import React from 'react';
import * as briefApi from '../api/briefApi';
import { StoryEditor } from './StoryEditor';
import { themeFor } from './storyDesign';

// ---------------------------------------------------------------------------
// EDITORIAL STUDIO — the story desk (formerly "Tea Desk").
//
// The library surface: every story with its real status, its design and its
// live like count. Writing and designing happen in the FULL-SCREEN StoryEditor
// studio this desk launches. Publishing remains an explicit, authenticated
// act through the real editorial routes.
//
// The "Tea" name is gone from the product copy — the layer is Stories now;
// the API keeps its historic /api/tea routes, the UI says stories.
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', review: 'Review', approved: 'Approved', published: 'Published',
  scheduled: 'Scheduled', expired: 'Expired', archived: 'Archived'
};
const STATUS_COLOR: Record<string, string> = {
  draft: '#9CA3AF', review: '#6B7280', approved: '#374151', published: '#F7F7F8',
  scheduled: '#4B5563', expired: '#9CA3AF', archived: '#D1D5DB'
};

interface TeaArticle {
  id: string; slug: string; title: string; dek: string; body: string;
  category: string; location: string | null; status: string; readingTime: number;
  heroImage?: string | null; likeCount?: number; design?: any;
}

export function TeaDesk() {
  const [articles, setArticles] = React.useState<TeaArticle[]>([]);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<TeaArticle | 'new' | null>(null);

  const load = React.useCallback(async () => {
    setState('loading');
    const res = await briefApi.listTeaAll();
    if (res.ok) { setArticles(res.data as TeaArticle[]); setState('ready'); }
    else { setState('error'); setError(res.error ?? 'could not load stories'); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const transition = async (id: string, action: string) => {
    await briefApi.transitionTea(id, action);
    await load();
  };

  const published = articles.filter((a) => a.status === 'published');

  // The full-screen studio owns editing while open; the desk waits behind it.
  if (editing) {
    return (
      <StoryEditor
        article={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => void load()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-[#F7F7F8]">Editorial Studio</h2>
          <p className="text-[10px] text-[#F7F7F8]/60">
            Write, design and publish the story layer. {published.length} live.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="rounded-full bg-[#FF5A1F] px-4 py-2 text-[12px] font-bold text-[#0D0F12] cursor-pointer"
        >
          New story
        </button>
      </div>

      {state === 'loading' && <p className="text-xs text-[#F7F7F8]/60">Loading…</p>}
      {state === 'error' && <p className="text-xs text-[#F7F7F8]">{error}</p>}

      {state === 'ready' && (
        <div className="space-y-2">
          {articles.length === 0 && (
            <div className="rounded-2xl border border-[#222630] bg-[#12151A] p-4">
              <p className="text-[13px] font-bold text-[#F7F7F8]">No stories yet.</p>
              <p className="mt-1 text-[11px] text-[#F7F7F8]/60">
                Open the studio and design the first one — theme, layout, photos and all.
              </p>
            </div>
          )}
          {articles.map((a) => {
            const theme = themeFor(a.design);
            return (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-[#222630] bg-[#12151A] p-3">
                {/* design + hero thumbnail: what the story looks like */}
                <div
                  className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#222630]"
                  style={{ background: theme.surface }}
                >
                  {a.heroImage ? (
                    <img src={a.heroImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="h-1 w-5 rounded-full" style={{ background: theme.defaultAccent }} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#F7F7F8] truncate">{a.title}</p>
                  <p className="text-[10px] text-[#F7F7F8]/60">
                    {a.category}{a.location ? ` · ${a.location}` : ''} · {a.readingTime}m
                    {a.design?.theme ? ` · ${theme.label}` : ''}
                    {typeof a.likeCount === 'number' ? ` · ♥ ${a.likeCount}` : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ color: STATUS_COLOR[a.status], border: `1px solid ${STATUS_COLOR[a.status]}` }}>
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setEditing(a)} className="text-[10px] font-bold text-[#F7F7F8] cursor-pointer">Design</button>
                  {a.status !== 'published' ? (
                    <button onClick={() => void transition(a.id, 'publish')} className="text-[10px] font-bold text-[#F7F7F8] cursor-pointer">Publish</button>
                  ) : (
                    <button onClick={() => void transition(a.id, 'unpublish')} className="text-[10px] font-bold text-[#F7F7F8] cursor-pointer">Unpublish</button>
                  )}
                  {a.status !== 'archived' && (
                    <button onClick={() => void transition(a.id, 'archive')} className="text-[10px] font-bold text-[#F7F7F8]/60 cursor-pointer">Archive</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TeaDesk;
