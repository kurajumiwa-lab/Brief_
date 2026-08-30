import React from 'react';
import { X, FileText } from 'lucide-react';
import * as briefApi from '../api/briefApi';
import type { ApiResult } from '../api/types';

// LEGAL — the documents the deployment owes its members, served by the
// server (versioned + dated, so "which terms did I accept" has an answer)
// and readable BEFORE an account exists. Reached from the footer, not from
// a new navigation destination.
type Doc = { slug: string; title: string; version: number; effective: string; body: string };

export function LegalScreen({ open, slug, onClose }: { open: boolean; slug: 'terms' | 'privacy'; onClose: () => void }) {
  const [doc, setDoc] = React.useState<Doc | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDoc(null); setError(null);
    void briefApi.getLegalDoc(slug).then((r: ApiResult<Doc>) => {
      if (r.ok) setDoc(r.data);
      else setError(r.error);
    });
  }, [open, slug]);

  if (!open) return null;

  return (
    <div role="dialog" aria-label={slug === 'terms' ? 'Terms of Service' : 'Privacy Notice'} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute inset-0 bg-[#251045]/30 cursor-pointer" />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] bg-[#F1EDF7] rounded-t-[28px] sm:rounded-[28px] border border-[#D6CFE4] shadow-2xl flex flex-col overflow-hidden">
        <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-[#D6CFE4]">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-[#5B2EA6] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-[14px] font-extrabold text-[#251045] truncate">{doc?.title ?? (slug === 'terms' ? 'Terms of Service' : 'Privacy Notice')}</h2>
              {doc && <p className="text-[9px] text-[#251045]/50">version {doc.version} · effective {doc.effective}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-[#FFFFFF] border border-[#D6CFE4] text-[#251045] text-[18px] font-light cursor-pointer">×</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {error && <p role="alert" className="text-[12px] font-bold text-[#B3261E]">{error}</p>}
          {!doc && !error && <p className="text-[12px] text-[#251045]/55">loading…</p>}
          {doc && <pre className="whitespace-pre-wrap font-sans text-[11.5px] leading-relaxed text-[#251045] select-text">{doc.body}</pre>}
        </div>
      </div>
    </div>
  );
}

export default LegalScreen;
