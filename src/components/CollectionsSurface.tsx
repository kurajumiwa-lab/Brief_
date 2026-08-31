// ---------------------------------------------------------------------------
// COLLECTIONS SURFACE — the viewer's personal collections layer.
//
// A secondary, personal surface (Home → Discover → Object stays primary):
// collection cards with real covers/counts, quick create, search scoped to
// the owner, and the "Saved" quick-save bucket (the existing server saves —
// named collections extend that layer, never duplicate it).
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Bookmark, FolderPlus, Globe, Lock, MapPin, Plus, Search, X
} from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { BriefCollectionSummary } from '../api/briefApi';
import { CollectionPage } from './CollectionPage';

const INK = '#251045';
const MUTED = 'rgba(37,16,69,0.62)';
const LINE = '#D6CFE4';
const ACCENT = '#5B2EA6';

function CoverThumb({ cover, name }: { cover: briefApi.CollectionCover; name: string }) {
  const urls = cover.kind === 'mosaic' ? (cover.urls ?? []) : cover.kind === 'single' || cover.kind === 'custom' ? [cover.url ?? ''] : [];
  const real = urls.filter(Boolean);
  if (real.length >= 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-0.5">
        {real.slice(0, 4).map((u, i) => (
          <img key={i} src={u} alt="" aria-hidden="true" loading="lazy" className="h-full w-full object-cover" />
        ))}
      </div>
    );
  }
  if (real.length === 1) {
    return <img src={real[0]} alt="" aria-hidden="true" loading="lazy" className="h-full w-full object-cover" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#3A2169] via-[#5B2EA6] to-[#2A1657]">
      <span className="text-2xl font-extrabold text-white/85">{name.trim().slice(0, 1).toUpperCase() || 'C'}</span>
    </div>
  );
}

function relativeDay(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

export function CollectionsSurface({ authed, savedCount, onClose, onOpenObject, onOpenSaved, onChanged }: {
  authed: boolean;
  savedCount: number;
  onClose: () => void;
  onOpenObject: (object: any) => void;
  onOpenSaved: () => void;
  onChanged?: () => void;
}) {
  const [collections, setCollections] = useState<BriefCollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback((query = '') => {
    setLoading(true);
    void briefApi.listCollections(query).then((r) => {
      setLoading(false);
      if (r.ok && r.data) setCollections(r.data.collections);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => reload(q), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, reload]);

  const create = () => {
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    void briefApi.createCollection({ name: clean, description: description.trim() || undefined }).then((r) => {
      setBusy(false);
      if (r.ok) {
        setCreating(false);
        setName('');
        setDescription('');
        reload();
        onChanged?.();
      } else {
        setError(r.error ?? 'Could not create the collection.');
      }
    });
  };

  if (openId) {
    return (
      <CollectionPage
        collectionId={openId}
        mode="owner"
        onClose={() => setOpenId(null)}
        onOpenObject={onOpenObject}
        onChanged={() => { reload(q); onChanged?.(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#150826]/85 backdrop-blur-md" role="dialog" aria-label="Collections">
      <div className="mx-auto min-h-full max-w-3xl bg-[#FBFAFD] px-4 py-5 sm:px-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={onClose} aria-label="Back"
            className="flex items-center gap-1 rounded-full border border-[#D6CFE4] bg-white px-3 py-1.5 text-[11px] font-bold text-[#251045] cursor-pointer hover:border-[#6C3EC9]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h1 className="text-[16px] font-extrabold text-[#251045]">Collections</h1>
          <button type="button" onClick={() => { setCreating((v) => !v); setError(null); }} aria-label="New collection"
            className="flex items-center gap-1 rounded-full bg-[#5B2EA6] px-3 py-1.5 text-[10px] font-extrabold text-white cursor-pointer hover:bg-[#3A2169]">
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>

        {/* Search — scoped to the owner's own collections/items. */}
        <label className="relative mb-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#251045]/35" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your collections and items…"
            aria-label="Search collections"
            className="w-full rounded-full border border-[#D6CFE4] bg-white py-2 pl-9 pr-9 text-[12px] font-semibold text-[#251045] outline-none placeholder:text-[#251045]/35 focus:border-[#6C3EC9]"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#251045]/40 hover:text-[#251045] cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        {/* Quick create */}
        {creating && (
          <div className="mb-4 rounded-2xl border border-[#6C3EC9]/40 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#251045]">New collection</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setCreating(false); }}
              placeholder="Name (e.g. Weekend Plans, Job Hunt)"
              aria-label="Collection name"
              className="w-full rounded-xl border border-[#D6CFE4] px-3 py-2 text-[13px] font-semibold text-[#251045] outline-none focus:border-[#6C3EC9]"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              aria-label="Collection description"
              className="mt-2 w-full rounded-xl border border-[#D6CFE4] px-3 py-2 text-[12px] font-semibold text-[#251045] outline-none focus:border-[#6C3EC9]"
            />
            {error && <p className="mt-2 text-[10px] font-bold text-[#B3261E]">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={create} disabled={busy || !name.trim()}
                className="rounded-full bg-[#5B2EA6] px-4 py-1.5 text-[10px] font-extrabold text-white cursor-pointer disabled:opacity-40">
                Create
              </button>
              <button type="button" onClick={() => setCreating(false)}
                className="rounded-full border border-[#D6CFE4] px-4 py-1.5 text-[10px] font-extrabold text-[#251045]/70 cursor-pointer">
                Cancel
              </button>
            </div>
            <p className="mt-2 text-[9px] font-semibold text-[rgba(37,16,69,0.45)]">
              Private by default — make it public later to share it.
            </p>
          </div>
        )}

        {/* Saved (quick-save bucket — the existing server saves). */}
        <button type="button" onClick={onOpenSaved}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-[#6C3EC9]/30 bg-gradient-to-r from-[#F1EDF7] to-[#E4DAF2] p-3 text-left cursor-pointer hover:border-[#6C3EC9]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#5B2EA6] text-white">
            <Bookmark className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-extrabold text-[#251045]">Saved</span>
            <span className="block text-[10px] font-semibold text-[rgba(37,16,69,0.62)]">
              Your quick saves — organise them into collections any time
            </span>
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#5B2EA6]">
            {savedCount} {savedCount === 1 ? 'item' : 'items'}
          </span>
        </button>

        {/* Collections */}
        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-[#E9E2F3]" />
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#D6CFE4] px-6 py-12 text-center">
            <FolderPlus className="h-6 w-6 text-[rgba(37,16,69,0.35)]" />
            <p className="text-[13px] font-semibold text-[#251045]">
              {q ? 'No collections match your search' : 'No collections yet'}
            </p>
            <p className="max-w-xs text-[12px] leading-relaxed text-[rgba(37,16,69,0.62)]">
              {q
                ? 'Try a different search — this only looks at your own collections.'
                : 'Create a collection, then save objects into it from any object page.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {collections.map((c) => (
              <button key={c.id} type="button" onClick={() => setOpenId(c.id)}
                className="group overflow-hidden rounded-2xl border border-[#D6CFE4] bg-white text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:border-[#6C3EC9] cursor-pointer">
                <div className="h-24 w-full sm:h-28">
                  <CoverThumb cover={c.cover} name={c.name} />
                </div>
                <div className="p-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="truncate text-[13px] font-extrabold text-[#251045]">{c.name}</h3>
                    {c.visibility === 'public'
                      ? <Globe className="h-3 w-3 shrink-0 text-[#5B2EA6]" />
                      : <Lock className="h-3 w-3 shrink-0 text-[rgba(37,16,69,0.4)]" />}
                  </div>
                  <p className="mt-0.5 text-[10px] font-semibold text-[rgba(37,16,69,0.62)]">
                    {c.count} {c.count === 1 ? 'item' : 'items'} · {relativeDay(c.updatedAt)}
                  </p>
                  {c.locations.areas.length > 0 && (
                    <p className="mt-1 flex items-center gap-0.5 truncate text-[9px] font-semibold text-[#5B2EA6]">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      {c.locations.areas.slice(0, 2).join(' · ')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-[9px] font-semibold text-[rgba(37,16,69,0.45)]">
          Collections hold references only — saving or removing here never changes the objects themselves.
        </p>
      </div>
    </div>
  );
}

export default CollectionsSurface;
