import React from 'react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// TEA DESK — the editorial workflow (home-feed Phase 5).
//
// The admin surface for Tea: write, edit, preview, and publish — through the
// REAL editorial routes (POST/PATCH /api/admin/tea, /:id/:action). Publishing
// is an explicit, authenticated act, never available to an anonymous consumer.
//
// The preview mirrors the consumer card so an editor sees the article as a
// reader will. Status colours carry meaning; a draft is clearly not live.
// ---------------------------------------------------------------------------

const CATEGORIES = ['live', 'guide', 'explainer', 'culture', 'useful', 'trend', 'weekend', 'local_business', 'opportunity', 'howto'];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', review: 'Review', approved: 'Approved', published: 'Published',
  scheduled: 'Scheduled', expired: 'Expired', archived: 'Archived'
};
const STATUS_COLOR: Record<string, string> = {
  draft: '#4B5162', review: '#E8A33D', approved: '#B98CE0', published: '#43D17A',
  scheduled: '#3E8EFF', expired: '#4B5162', archived: '#4B5162'
};

interface TeaArticle {
  id: string; slug: string; title: string; dek: string; body: string;
  category: string; location: string | null; status: string; readingTime: number;
}

export function TeaDesk() {
  const [articles, setArticles] = React.useState<TeaArticle[]>([]);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState('');
  const [dek, setDek] = React.useState('');
  const [body, setBody] = React.useState('');
  const [category, setCategory] = React.useState('guide');
  const [location, setLocation] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setState('loading');
    const res = await briefApi.listTeaAll();
    if (res.ok) { setArticles(res.data as TeaArticle[]); setState('ready'); }
    else { setState('error'); setError(res.error ?? 'could not load articles'); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const resetForm = () => {
    setTitle(''); setDek(''); setBody(''); setCategory('guide'); setLocation(''); setEditingId(null);
  };

  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    if (editingId) {
      await briefApi.updateTeaArticle(editingId, { title, dek, body, category, location: location || null });
    } else {
      await briefApi.createTeaArticle({ title, dek, body, category, location: location || null });
    }
    setBusy(false);
    resetForm();
    await load();
  };

  const transition = async (id: string, action: string) => {
    await briefApi.transitionTea(id, action);
    await load();
  };

  const edit = (a: TeaArticle) => {
    setEditingId(a.id);
    setTitle(a.title); setDek(a.dek); setBody(a.body); setCategory(a.category); setLocation(a.location ?? '');
  };

  const preview = articles.find((a) => a.id === editingId) ?? null;
  const published = articles.filter((a) => a.status === 'published');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-[#F3F1E7]">Tea Desk</h2>
          <p className="text-[10px] text-[#8A93A6]">Write, preview and publish the editorial layer. {published.length} live.</p>
        </div>
        <button onClick={() => void load()} className="text-[10px] font-extrabold text-[#43D17A] cursor-pointer">Refresh</button>
      </div>

      {state === 'loading' && <p className="text-xs text-[#8A93A6]">Loading…</p>}
      {state === 'error' && <p className="text-xs text-[#FF6A4D]">{error}</p>}

      {state === 'ready' && (
        <>
          {/* Editor */}
          <div className="rounded-2xl border border-[#232A38] bg-[#10141C] p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#43D17A]">
              {editingId ? `Editing: ${preview?.title ?? ''}` : 'New article'}
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Headline"
              className="w-full rounded-lg border border-[#232A38] bg-[#090B10] px-3 py-2 text-[13px] text-[#F3F1E7] outline-none focus:border-[#43D17A]"
            />
            <input
              value={dek}
              onChange={(e) => setDek(e.target.value)}
              placeholder="Dek (one-line summary)"
              className="w-full rounded-lg border border-[#232A38] bg-[#090B10] px-3 py-2 text-[12px] text-[#F3F1E7] outline-none focus:border-[#43D17A]"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Body — short and useful. Hook → what's happening → why it matters → what you can do."
              rows={5}
              className="w-full rounded-lg border border-[#232A38] bg-[#090B10] px-3 py-2 text-[12px] text-[#F3F1E7] outline-none focus:border-[#43D17A]"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-[#232A38] bg-[#090B10] px-2 py-1.5 text-[11px] text-[#F3F1E7]"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (e.g. Nairobi)"
                className="flex-1 rounded-lg border border-[#232A38] bg-[#090B10] px-3 py-2 text-[12px] text-[#F3F1E7] outline-none focus:border-[#43D17A]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void submit()}
                disabled={busy || !title.trim() || !body.trim()}
                className="rounded-full bg-[#43D17A] px-4 py-2 text-[12px] font-bold text-[#090B10] disabled:opacity-40 cursor-pointer"
              >
                {editingId ? 'Save' : 'Save draft'}
              </button>
              {editingId && (
                <button onClick={resetForm} className="rounded-full border border-[#232A38] px-4 py-2 text-[12px] font-bold text-[#8A93A6] cursor-pointer">
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Live preview — mirrors the consumer card */}
          {preview && (
            <div className="rounded-2xl border border-[#43D17A]/30 bg-[#10141C] p-4">
              <p className="text-[9px] uppercase tracking-[0.15em] text-[#4B5162]">Preview · as readers see it</p>
              <div className="mt-2 overflow-hidden rounded-2xl border border-[#232A38] bg-[#10141C]">
                <div className="p-4">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[#4B5162]">{preview.location ?? 'Your city'} · {preview.category}</p>
                  <h3 className="mt-1 text-[18px] font-bold leading-snug text-[#F3F1E7]">{preview.title}</h3>
                  {preview.dek && <p className="mt-1 text-[12px] leading-relaxed text-[#8A93A6]">{preview.dek}</p>}
                  <p className="mt-2 text-[10px] text-[#4B5162]">{preview.readingTime} min read</p>
                  <div className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed text-[#E8E3D4]">{preview.body}</div>
                </div>
              </div>
            </div>
          )}

          {/* Library */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#43D17A]">Library ({articles.length})</p>
            {articles.length === 0 && <p className="text-xs text-[#8A93A6]">No articles yet. Write the first one above.</p>}
            {articles.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-[#232A38] bg-[#10141C] p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#F3F1E7] truncate">{a.title}</p>
                  <p className="text-[10px] text-[#8A93A6]">{a.category}{a.location ? ` · ${a.location}` : ''} · {a.readingTime}m</p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ color: STATUS_COLOR[a.status], border: `1px solid ${STATUS_COLOR[a.status]}` }}>
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => edit(a)} className="text-[10px] font-bold text-[#43D17A] cursor-pointer">Edit</button>
                  {a.status !== 'published' ? (
                    <button onClick={() => void transition(a.id, 'publish')} className="text-[10px] font-bold text-[#43D17A] cursor-pointer">Publish</button>
                  ) : (
                    <button onClick={() => void transition(a.id, 'unpublish')} className="text-[10px] font-bold text-[#E8A33D] cursor-pointer">Unpublish</button>
                  )}
                  {a.status !== 'archived' && (
                    <button onClick={() => void transition(a.id, 'archive')} className="text-[10px] font-bold text-[#8A93A6] cursor-pointer">Archive</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default TeaDesk;
