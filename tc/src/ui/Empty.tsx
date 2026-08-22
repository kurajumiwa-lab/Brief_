import React from 'react';

export function Empty({
  title,
  body,
  action,
  onAction
}: {
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--brief-line)] bg-[var(--brief-card)] px-5 py-8 text-center">
      <p className="text-[15px] font-semibold text-[var(--brief-ink)]">{title}</p>
      {body && <p className="mt-2 text-[13px] leading-snug text-[var(--brief-muted)]">{body}</p>}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="brief-tap mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--brief-green)] px-4 text-[13px] font-bold text-[var(--brief-green-ink)]"
        >
          {action}
        </button>
      )}
    </div>
  );
}
