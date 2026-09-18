import React from 'react';
import type { SpaceFieldStatus } from '../../api/types';

// ---------------------------------------------------------------------------
// SPACE FIELD INPUTS — one renderer for the space schema, used by BOTH the
// creation wizard and the workspace, so the questions asked at the start are
// literally the same fields the pipeline reads later.
//
// The questions, their help text and their refresh cadence come from the
// SERVER (GET /api/spaces/profile-schema). Nothing here invents a field, a
// weight or a score, and nothing here can write a timestamp — the API stamps
// those. An answer left blank stays blank: it is reported as "never answered"
// in the queue rather than defaulted to zero or "none".
//
// The contact channel is the one field an owner may deliberately never answer,
// so the server marks it optional and it never appears as a to-do. It renders as
// a phone input plus the sentence a buyer should open with — no toggle to
// "hide" the number, because a WhatsApp link is the number and a switch that
// pretended otherwise would be a lie in a settings row.
// ---------------------------------------------------------------------------

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export type FieldValues = Record<string, unknown>;

const labelCls = "block text-[10px] font-black uppercase tracking-wider mb-1.5";
const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none";

function inputStyle() {
  return { background: 'var(--color-paper)', borderColor: 'var(--brief-line)', color: 'var(--color-text)' };
}

export function SpaceFieldInputs({
  fields,
  values,
  onChange,
  idPrefix = 'sp'
}: {
  fields: SpaceFieldStatus[];
  values: FieldValues;
  onChange: (key: string, value: unknown) => void;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-4">
      {fields.map((f) => {
        const raw = values[f.key];
        return (
          <div key={f.key}>
            <label className={labelCls} style={{ color: 'var(--color-text-muted)' }} htmlFor={`${idPrefix}-${f.key}`}>
              {f.question}
            </label>
            {f.help && (
              <p className="text-[10px] leading-snug mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                {f.help}
              </p>
            )}

            {f.kind === 'text' && (
              <input
                id={`${idPrefix}-${f.key}`}
                type="text"
                aria-label={f.key}
                maxLength={300}
                value={String((raw as { text?: string })?.text ?? '')}
                onChange={(e) => onChange(f.key, { text: e.target.value })}
                className={inputCls}
                style={inputStyle()}
                placeholder={f.key === 'operatingFrom' ? 'e.g. Wakulima Market, stall near the north gate' : 'e.g. Fresh tilapia, whole, graded'}
              />
            )}

            {f.kind === 'measure' && (
              <div className="flex gap-2">
                <input
                  id={`${idPrefix}-${f.key}`}
                  type="number"
                  min={0}
                  step="any"
                  aria-label={`${f.key} amount`}
                  value={String((raw as { value?: number | string })?.value ?? '')}
                  onChange={(e) => onChange(f.key, { value: e.target.value, unit: (raw as { unit?: string })?.unit ?? '', per: (raw as { per?: string })?.per ?? 'day' })}
                  className={`${inputCls} w-28`}
                  style={inputStyle()}
                  placeholder="40"
                />
                <input
                  type="text"
                  aria-label={`${f.key} unit`}
                  value={String((raw as { unit?: string })?.unit ?? '')}
                  onChange={(e) => onChange(f.key, { value: (raw as { value?: number | string })?.value ?? '', unit: e.target.value, per: (raw as { per?: string })?.per ?? 'day' })}
                  className={`${inputCls} w-24`}
                  style={inputStyle()}
                  placeholder="kg"
                />
                <input
                  type="text"
                  aria-label={`${f.key} per`}
                  value={String((raw as { per?: string })?.per ?? 'day')}
                  onChange={(e) => onChange(f.key, { value: (raw as { value?: number | string })?.value ?? '', unit: (raw as { unit?: string })?.unit ?? '', per: e.target.value })}
                  className={`${inputCls} w-24`}
                  style={inputStyle()}
                  placeholder="day"
                />
              </div>
            )}

            {f.kind === 'schedule' && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d) => {
                    const on = ((raw as { days?: string[] })?.days ?? []).includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const days = on
                            ? ((raw as { days?: string[] })?.days ?? []).filter((x) => x !== d)
                            : [...((raw as { days?: string[] })?.days ?? []), d];
                          onChange(f.key, { ...(raw as object), days, summary: (raw as { summary?: string })?.summary ?? '', from: (raw as { from?: string })?.from ?? null, to: (raw as { to?: string })?.to ?? null });
                        }}
                        className="px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer border"
                        style={{
                          background: on ? 'var(--color-primary)' : 'var(--color-paper)',
                          color: on ? 'var(--accent-ink)' : 'var(--color-text-muted)',
                          borderColor: on ? 'transparent' : 'var(--color-border)'
                        }}
                      >
                        {d.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="time"
                    aria-label={`${f.key} from`}
                    value={String((raw as { from?: string })?.from ?? '')}
                    onChange={(e) => onChange(f.key, { ...(raw as object), from: e.target.value || null })}
                    className={`${inputCls} w-32`}
                    style={inputStyle()}
                  />
                  <input
                    type="time"
                    aria-label={`${f.key} to`}
                    value={String((raw as { to?: string })?.to ?? '')}
                    onChange={(e) => onChange(f.key, { ...(raw as object), to: e.target.value || null })}
                    className={`${inputCls} w-32`}
                    style={inputStyle()}
                  />
                  <input
                    id={`${idPrefix}-${f.key}`}
                    type="text"
                    aria-label={`${f.key} summary`}
                    maxLength={120}
                    value={String((raw as { summary?: string })?.summary ?? '')}
                    onChange={(e) => onChange(f.key, { ...(raw as object), summary: e.target.value })}
                    className={inputCls}
                    style={inputStyle()}
                    placeholder="or describe it: market days only"
                  />
                </div>
              </div>
            )}

            {f.kind === 'contact' && (
              <div className="space-y-1.5">
                <input
                  id={`${idPrefix}-${f.key}`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-label={`${f.key} phone`}
                  maxLength={32}
                  value={String((raw as { phone?: string })?.phone ?? '')}
                  onChange={(e) => onChange(f.key, { platform: 'whatsapp', phone: e.target.value, message: (raw as { message?: string })?.message ?? '' })}
                  className={inputCls}
                  style={inputStyle()}
                  placeholder="+254 700 000 000"
                />
                <input
                  type="text"
                  aria-label={`${f.key} first message`}
                  maxLength={200}
                  value={String((raw as { message?: string })?.message ?? '')}
                  onChange={(e) => onChange(f.key, { platform: 'whatsapp', phone: (raw as { phone?: string })?.phone ?? '', message: e.target.value })}
                  className={inputCls}
                  style={inputStyle()}
                  placeholder="what a buyer should say first (optional)"
                />
                <p className="text-[10px] leading-snug" style={{ color: 'var(--brief-faint, var(--color-text-muted))' }}>
                  A wrong number is refused, not stored. Nothing is sent for you — this only builds the button.
                </p>
              </div>
            )}

            {f.kind === 'list' && (
              <ListEditor
                id={`${idPrefix}-${f.key}`}
                items={(raw as { items?: string[] })?.items ?? []}
                onChange={(items) => onChange(f.key, { items })}
                placeholder={
                  f.key === 'constraints' ? 'e.g. cannot deliver beyond 15km'
                    : f.key === 'needs' ? 'e.g. cold chain for 2 runs a day'
                      : f.key === 'offersToNetwork' ? 'e.g. 10% margin to a rider who brings buyers'
                        : 'e.g. Westlands'
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** One item per line. Blank lines are dropped, not counted as answers. */
function ListEditor({ items, onChange, placeholder, id }: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  id: string;
}) {
  return (
    <div className="space-y-1.5">
      <textarea
        id={id}
        rows={Math.max(2, items.length + 1)}
        aria-label={placeholder}
        value={items.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
        className="w-full px-3.5 py-2.5 rounded-xl text-xs border resize-y leading-relaxed"
        style={inputStyle()}
        placeholder={placeholder}
      />
      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
        One per line · {items.length} {items.length === 1 ? 'item' : 'items'}
      </p>
    </div>
  );
}

export default SpaceFieldInputs;
