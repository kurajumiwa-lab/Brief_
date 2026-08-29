import React, { useMemo, useState } from 'react';
import { X, Star, Trash2 } from 'lucide-react';
import { STORY_THEMES, STORY_LAYOUTS, designOf, type StoryDesign } from './storyDesign';
import { StoryView } from './StoryView';
import { ImageField } from './ImageField';
import { MediaLibrary } from './MediaLibrary';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// STORY EDITOR — the full-screen presentation studio.
//
// The editorial surface: write the story, choose a THEME and a LAYOUT preset,
// freehand the accent and the hero overlay, and manage the photos — a lead
// photo (the home-shelf background) plus a gallery readers see in the reader.
// The right half is a LIVE PREVIEW rendering through the exact StoryView the
// reader uses, so what you design is what they get.
//
// Everything saves through the real editorial routes; the design is validated
// again server-side (the client never gets to invent a theme id).
// ---------------------------------------------------------------------------

const CATEGORIES = ['live', 'guide', 'explainer', 'culture', 'useful', 'trend', 'weekend', 'local_business', 'opportunity', 'howto'];

export interface StoryEditorProps {
  /** An existing article to edit, or null for a new story. */
  article: any | null;
  onClose: () => void;
  /** Called after a successful save so the desk can refresh. */
  onSaved: () => void;
}

export function StoryEditor({ article, onClose, onSaved }: StoryEditorProps) {
  const [title, setTitle] = useState(article?.title ?? '');
  const [dek, setDek] = useState(article?.dek ?? '');
  const [body, setBody] = useState(article?.body ?? '');
  const [category, setCategory] = useState(article?.category ?? 'guide');
  const [location, setLocation] = useState(article?.location ?? '');
  const [heroImage, setHeroImage] = useState(article?.heroImage ?? '');
  const [images, setImages] = useState<string[]>(Array.isArray(article?.images) ? article.images : []);
  const [design, setDesign] = useState<StoryDesign>(designOf(article));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = Boolean(title.trim() && body.trim()) && !busy;

  const patchDesign = (patch: Partial<StoryDesign>) => setDesign((d) => ({ ...d, ...patch }));

  const previewArticle = useMemo(
    () => ({ title, dek, body, heroImage: heroImage || null, category, location: location || null, readingTime: article?.readingTime ?? 2 }),
    [title, dek, body, heroImage, category, location, article]
  );

  const save = async (publish: boolean) => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const fields = {
      title: title.trim(),
      dek,
      body,
      category,
      location: location || null,
      heroImage: heroImage.trim() || null,
      images,
      design
    };
    const res = article
      ? await briefApi.updateTeaArticle(article.id, fields)
      : await briefApi.createTeaArticle(fields);
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    if (publish) {
      const id = (res.data as any)?.id ?? article?.id;
      const pub = await briefApi.transitionTea(id, 'publish');
      if (!pub.ok) {
        // The story is SAVED (as a draft); only the publish was refused.
        // Closing silently here would hide a real refusal -- show it, keep
        // the studio open, and let the desk show the saved draft.
        setBusy(false);
        setError(`Saved as a draft — publish was refused: ${pub.error}`);
        onSaved();
        return;
      }
    }
    setBusy(false);
    onSaved();
    onClose();
  };

  const makeHero = (url: string) => {
    setHeroImage(url);
    setImages((imgs) => imgs.filter((u) => u !== url));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#FAFAFA]" role="dialog" aria-modal="true" aria-label="Story studio">
      {/* top bar */}
      <div className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#FFFFFF]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-[#111111] truncate">
              {article ? 'Edit story' : 'New story'}
            </p>
            <p className="text-[10px] text-[#111111]/50">
              Design it here — readers see exactly this.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#111111] cursor-pointer"
              aria-label="Close studio"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void save(false)}
              disabled={!canSave}
              className="h-8 rounded-lg border border-[#111111] px-3 text-[11px] font-extrabold text-[#111111] cursor-pointer disabled:opacity-40"
            >
              {busy ? '…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={!canSave}
              className="h-8 rounded-lg bg-[#111111] px-3 text-[11px] font-extrabold text-[#FFFFFF] cursor-pointer disabled:opacity-40"
            >
              {busy ? '…' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ---------------- CONTROLS ---------------- */}
        <div className="space-y-4">
          {/* write */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-2.5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111111]">Write</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Headline"
              className="w-full rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-[14px] font-bold text-[#111111] outline-none focus:border-[#111111]"
            />
            <input
              value={dek}
              onChange={(e) => setDek(e.target.value)}
              placeholder="Dek (one-line summary)"
              className="w-full rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-[12px] text-[#111111] outline-none focus:border-[#111111]"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Body — hook → what's happening → why it matters → what you can do."
              rows={6}
              className="w-full rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-[12px] leading-relaxed text-[#111111] outline-none focus:border-[#111111]"
            />
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-2 py-1.5 text-[11px] text-[#111111]"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="flex-1 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-[12px] text-[#111111] outline-none focus:border-[#111111]"
              />
            </div>
          </section>

          {/* theme presets */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111111]">Theme</p>
            <div className="grid grid-cols-2 gap-2">
              {STORY_THEMES.map((t) => {
                const active = design.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => patchDesign({ theme: t.id })}
                    className="rounded-xl border p-2.5 text-left cursor-pointer transition-all"
                    style={{
                      borderColor: active ? '#111111' : '#E5E7EB',
                      background: t.surface,
                      boxShadow: active ? '0 0 0 1px #111111' : undefined
                    }}
                  >
                    <p className="text-[11px] font-extrabold" style={{ color: t.ink }}>{t.label}</p>
                    <p className="mt-0.5 text-[9px] leading-tight" style={{ color: t.inkDim }}>{t.blurb}</p>
                    <div className="mt-2 h-1 w-8 rounded-full" style={{ background: t.defaultAccent }} />
                  </button>
                );
              })}
            </div>
          </section>

          {/* layout presets */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111111]">Layout</p>
            <div className="grid grid-cols-2 gap-2">
              {STORY_LAYOUTS.map((l) => {
                const active = design.layout === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => patchDesign({ layout: l.id })}
                    className="rounded-xl border p-2.5 text-left cursor-pointer transition-all"
                    style={{ borderColor: active ? '#111111' : '#E5E7EB', background: '#FFFFFF', boxShadow: active ? '0 0 0 1px #111111' : undefined }}
                  >
                    {/* mini wireframe of the layout */}
                    <div className="flex h-9 gap-1">
                      {l.id !== 'center' && l.id !== 'left' && (
                        <div className="flex h-9 w-9 flex-col justify-end gap-0.5 rounded border border-[#E5E7EB] bg-[#FAFAFA] p-0.5">
                          <div className="h-1 w-3/4 rounded-full bg-[#111111]" />
                          <div className="h-0.5 w-full rounded-full bg-[#E5E7EB]" />
                        </div>
                      )}
                      <div className={`flex flex-1 flex-col justify-end gap-0.5 rounded border border-[#E5E7EB] bg-[#FAFAFA] p-0.5 ${l.id === 'center' ? 'items-center' : l.id === 'left' ? 'items-start' : l.id === 'split' ? 'items-start' : 'items-start'}`}>
                        <div className="h-1.5 w-2/3 rounded-full bg-[#111111]" />
                        <div className="h-0.5 w-full rounded-full bg-[#E5E7EB]" />
                        <div className="h-0.5 w-1/2 rounded-full bg-[#E5E7EB]" />
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] font-extrabold text-[#111111]">{l.label}</p>
                    <p className="text-[9px] leading-tight text-[#111111]/50">{l.blurb}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* freehand */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111111]">Freehand</p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-[#111111]">Accent colour</p>
                <p className="text-[9px] text-[#111111]/50">Kicker, rules and highlights.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={design.accent ?? '#111111'}
                  onChange={(e) => patchDesign({ accent: e.target.value.toUpperCase() })}
                  className="h-7 w-9 cursor-pointer rounded border border-[#E5E7EB] bg-[#FFFFFF] p-0.5"
                  aria-label="Accent colour"
                />
                <button
                  type="button"
                  onClick={() => patchDesign({ accent: null })}
                  className="rounded-md border border-[#E5E7EB] px-1.5 py-1 text-[9px] font-bold text-[#111111]/60 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-[#111111]">Hero overlay</p>
                <span className="text-[10px] font-mono text-[#111111]/60">{Math.round(design.overlay * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                value={Math.round(design.overlay * 100)}
                onChange={(e) => patchDesign({ overlay: Number(e.target.value) / 100 })}
                className="mt-1 w-full cursor-pointer accent-black"
                aria-label="Hero overlay strength"
              />
              <p className="text-[9px] text-[#111111]/50">How dark the veil over the lead photo is — for readable type.</p>
            </div>
          </section>

          {/* photos */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111111]">Photos</p>
            <ImageField
              label="Lead photo"
              hint="Used as the story's background on the home shelf and its hero."
              value={heroImage || null}
              onChange={(url) => setHeroImage(url ?? '')}
            />
            {/* The reuse half of the upload loop: every file you have
                uploaded, reusable as the hero or a gallery photo. */}
            <MediaLibrary
              onUse={(url) => setHeroImage(url)}
            />
            <div>
              <ImageField
                label="Gallery"
                hint="Extra photos readers see when they open the story."
                onAdd={(url) => setImages((imgs) => (imgs.includes(url) ? imgs : [...imgs, url]))}
                multiple
                compact
              />
              {images.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {images.map((url) => (
                    <div key={url} className="group relative overflow-hidden rounded-lg border border-[#E5E7EB]">
                      <img src={url} alt="" className="h-16 w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-[#111111]/0 opacity-0 transition-all group-hover:bg-[#111111]/45 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => makeHero(url)}
                          title="Make this the lead photo"
                          className="rounded-md bg-[#FFFFFF] p-1 cursor-pointer"
                        >
                          <Star className="h-3 w-3 text-[#111111]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setImages((imgs) => imgs.filter((u) => u !== url))}
                          title="Remove"
                          className="rounded-md bg-[#FFFFFF] p-1 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3 text-[#111111]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {error && (
            <p className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-2.5 text-[11px] text-[#111111]">{error}</p>
          )}
        </div>

        {/* ---------------- LIVE PREVIEW ---------------- */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111111]">Live preview</p>
              <span className="text-[9px] text-[#111111]/40">as readers will see it</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
              <StoryView article={previewArticle} design={design} mode="preview" />
            </div>
            {images.length > 0 && (
              <div className="mt-2">
                <p className="text-[9px] uppercase tracking-[0.14em] text-[#111111]/40">
                  Gallery · {images.length} photo{images.length === 1 ? '' : 's'} in the reader
                </p>
                <div className="mt-1 grid grid-cols-4 gap-1.5">
                  {images.map((url) => (
                    <img key={url} src={url} alt="" className="h-12 w-full rounded-md border border-[#E5E7EB] object-cover" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoryEditor;
