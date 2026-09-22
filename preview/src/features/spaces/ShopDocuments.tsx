import React from 'react';
import { FileText } from 'lucide-react';

// ---------------------------------------------------------------------------
// SHOP DOCUMENTS — the folder pattern the reorg approved from Think Finance:
// a folder row is an icon, a name, and what is current about it. Three
// folders, the three kinds a shopfront actually files: verification,
// licences, receipts.
//
// The house rule applies: a row shows a date only when a date exists. Brief
// has no document store yet, so the folders take a real list of rows and,
// while that list is empty, each one says "Nothing filed yet" — the pattern
// is in place, and none of it pretends a document, a licence or a receipt
// exists. The moment a row is filed, the folder shows it by name with its
// real date and nothing invented.
// ---------------------------------------------------------------------------

export type DocumentFolder = 'verification' | 'licences' | 'receipts';

export interface ShopDocument {
  id: string;
  folder: DocumentFolder;
  name: string;
  /** Real timestamp the row was filed. null = nothing to date. */
  updatedAt: string | null;
}

const FOLDERS: Array<{ id: DocumentFolder; label: string }> = [
  { id: 'verification', label: 'Verification' },
  { id: 'licences', label: 'Licences' },
  { id: 'receipts', label: 'Receipts' },
];

const dateOf = (iso: string) => {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const ShopDocuments: React.FC<{
  documents: ShopDocument[];
  className?: string;
}> = ({ documents = [], className = '' }) => {
  return (
    <section aria-label="Documents" data-testid="shop-documents" className={`space-y-2.5 ${className}`}>
      <div>
        <h3 className="text-[13px] font-extrabold" style={{ color: 'var(--color-text)' }}>
          Documents
        </h3>
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          Verification, licences and receipts, as filed.
        </p>
      </div>
      <div className="space-y-2">
        {FOLDERS.map((folder) => {
          const rows = documents.filter((d) => d.folder === folder.id);
          return (
            <div
              key={folder.id}
              data-testid={`shop-doc-folder-${folder.id}`}
              className="p-3 rounded-2xl space-y-1.5"
              style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-lg grid place-items-center shrink-0"
                  style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
                >
                  <FileText className="w-4 h-4" />
                </span>
                <span className="text-[13px] font-bold" style={{ color: 'var(--color-text)' }}>
                  {folder.label}
                </span>
                <span
                  className="ml-auto text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {rows.length === 0 ? 'Empty' : `${rows.length} filed`}
                </span>
              </div>
              {rows.length === 0 ? (
                <p className="text-[11px] pl-9" style={{ color: 'var(--color-text-muted)' }}>
                  Nothing filed yet.
                </p>
              ) : (
                rows.map((d) => {
                  const filed = d.updatedAt ? dateOf(d.updatedAt) : null;
                  return (
                    <div key={d.id} className="pl-9 text-[11px]">
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {d.name}
                      </span>
                      {filed ? (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {' '}
                          · filed {filed}
                        </span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ShopDocuments;
