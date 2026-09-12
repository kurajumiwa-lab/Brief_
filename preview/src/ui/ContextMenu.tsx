// ---------------------------------------------------------------------------
// CONTEXT MENU — progressive disclosure of secondary actions.
//
// The critique's fix for dense cards: instead of three inline buttons on every
// row, collapse secondary actions behind a single "···" trigger that opens a
// bottom sheet. This is that sheet — state-driven (so it is testable in jsdom,
// unlike a CSS-only popover), token-based, and keyboard/overlay dismissible.
//
// The PRIMARY action (the consequential one) stays inline at the call site;
// only SECONDARY actions move here. This component renders actions, never
// decides which ones are secondary.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export interface ContextAction {
  label: string;
  onSelect: () => void;
  /** danger renders the action in the danger token (e.g. remove). */
  tone?: "default" | "danger";
}

export interface ContextMenuProps {
  actions: ContextAction[];
  /** Accessible name for the trigger (required for the test suites). */
  ariaLabel: string;
  /** Compact trigger (icon-only "···") vs. a labelled button. */
  variant?: "icon" | "labelled";
  triggerLabel?: string;
}

export function ContextMenu({ actions, ariaLabel, variant = "icon", triggerLabel = "More" }: ContextMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-bold cursor-pointer"
        style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
      >
        <MoreHorizontal className="w-4 h-4" />
        {variant === "labelled" && <span>{triggerLabel}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          {/* Scrim */}
          <div className="absolute inset-0" style={{ background: "var(--overlay-scrim)", opacity: 0.3 }} />
          {/* Bottom sheet */}
          <div
            role="menu"
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-3 space-y-1"
            style={{ background: "var(--color-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-2 pt-1 pb-2 text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Actions
            </p>
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  a.onSelect();
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
                style={{
                  background: "var(--color-surface-elevated)",
                  color: a.tone === "danger" ? "var(--color-danger)" : "var(--color-text)"
                }}
              >
                {a.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
              style={{ background: "transparent", color: "var(--color-text-muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
