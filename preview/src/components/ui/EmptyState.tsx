// ---------------------------------------------------------------------------
// EMPTY STATE — one honest treatment for "there is nothing here (yet)".
//
// Three distinct situations share this shape: signed-out (a sign-in door), a
// genuinely empty list, and a failed load. Each is a real state with a
// headline and an optional next action — never a raw error string, never a
// bare void. Colors use the canonical tokens only.
// ---------------------------------------------------------------------------

import React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-8 px-4 rounded-2xl border border-dashed"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
    >
      {icon && (
        <div className="mb-3" style={{ color: "var(--color-text-muted)" }}>
          {icon}
        </div>
      )}
      <h3 className="text-lg font-black" style={{ color: "var(--color-text)" }}>{title}</h3>
      {description && (
        <p className="mt-1 text-sm max-w-sm" style={{ color: "var(--color-text-muted)" }}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
