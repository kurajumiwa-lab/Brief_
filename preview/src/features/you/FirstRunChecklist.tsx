// ---------------------------------------------------------------------------
// FIRST-RUN CHECKLIST — the new member's first session, as an action queue.
//
// A brand-new user should not land on a passive dashboard; they should be told
// what to DO next. Every step here is DERIVED from real rows — a step is
// "done" because the data says so, never because a client flipped a flag:
//
//   1. Start your group        — done when ≥1 table-banking group exists
//   2. Add members             — done when any group has more than one member
//   3. Record a contribution   — done when any group's derived total > 0
//   4. See your ledger         — done once there are rows to see (a ledger
//                                with no rows is not a ledger)
//
// This component is PURE: it receives the group list as a prop and never
// fetches, so the derivation is trivially testable and cannot drift from the
// server's data. The parent decides where it lives (a full-screen first-run
// state, or a compact card in the You tab) and what each step's action does.
// ---------------------------------------------------------------------------

import React from "react";
import { Check, Plus, Users, DollarSign, BookOpen } from "lucide-react";
import type { TableBankingGroup } from "../../api/briefApi";

export interface FirstRunChecklistProps {
  groups: TableBankingGroup[];
  onStartGroup: () => void;
  onAddMembers: () => void;
  onRecordContribution: () => void;
  onSeeLedger: () => void;
  onDismiss?: () => void;
  /** Compact = a card inside the You tab; full = the first-run takeover. */
  compact?: boolean;
}

export interface ChecklistStep {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  action: () => void;
  icon: React.ReactNode;
}

/** Derive the checklist from real rows — the single source of "done". */
export function deriveChecklist(
  groups: TableBankingGroup[],
  actions: Pick<FirstRunChecklistProps, "onStartGroup" | "onAddMembers" | "onRecordContribution" | "onSeeLedger">
): ChecklistStep[] {
  const hasGroup = groups.length > 0;
  const hasMembers = groups.some((g) => (g.members?.length ?? 0) > 1);
  const hasContribution = groups.some((g) => (g.summary?.totalContributed ?? 0) > 0);

  return [
    {
      id: "group",
      label: "Start your group",
      hint: "Give your circle a name and a contribution amount.",
      done: hasGroup,
      action: actions.onStartGroup,
      icon: <Plus className="w-4 h-4" />
    },
    {
      id: "members",
      label: "Add members",
      hint: "Invite the people who already sit around the table with you.",
      done: hasMembers,
      action: actions.onAddMembers,
      icon: <Users className="w-4 h-4" />
    },
    {
      id: "contribution",
      label: "Record your first contribution",
      hint: "A receipt-hashed record — Brief holds none of the money.",
      done: hasContribution,
      action: actions.onRecordContribution,
      icon: <DollarSign className="w-4 h-4" />
    },
    {
      id: "ledger",
      label: "See your ledger",
      hint: "Every shilling, derived from real rows — the notebook, but better.",
      done: hasContribution,
      action: actions.onSeeLedger,
      icon: <BookOpen className="w-4 h-4" />
    }
  ];
}

export function FirstRunChecklist({
  groups,
  onStartGroup,
  onAddMembers,
  onRecordContribution,
  onSeeLedger,
  onDismiss,
  compact = false
}: FirstRunChecklistProps) {
  const steps = deriveChecklist(groups, { onStartGroup, onAddMembers, onRecordContribution, onSeeLedger });
  const done = steps.filter((s) => s.done).length;
  const complete = done === steps.length;

  if (complete && compact) return null; // the compact card disappears when everything is done

  const container = compact
    ? "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    : "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6";

  return (
    <div className={container}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black" style={{ color: "var(--color-text)" }}>
            {compact ? "Get your circle running" : "Welcome — let's set up your circle"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {done} of {steps.length} done
          </p>
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="text-xs font-bold underline" style={{ color: "var(--color-text-muted)" }}>
            {compact ? "Dismiss" : "Skip for now"}
          </button>
        )}
      </div>

      <ol className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={s.action}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors"
              style={{ background: "var(--color-surface-elevated)" }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: s.done ? "var(--color-primary)" : "transparent",
                  color: s.done ? "var(--accent-ink)" : "var(--color-text-muted)",
                  border: s.done ? "none" : "1px solid var(--color-border)"
                }}
              >
                {s.done ? <Check className="w-3.5 h-3.5" /> : s.icon}
              </span>
              <span className="min-w-0">
                <span className={`block text-xs font-bold ${s.done ? "" : ""}`} style={{ color: s.done ? "var(--color-text-muted)" : "var(--color-text)" }}>
                  {s.label}
                </span>
                <span className="block text-[10px]" style={{ color: "var(--color-text-muted)" }}>{s.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
