import React from 'react';

// ---------------------------------------------------------------------------
// PLAY AS — first Play visit is one person, not a fixture.
//
// WhoAmI is the only player id. Availability is an explicit switch and starts
// off. Creating a game tag is optional; it never invents a second login.
// ---------------------------------------------------------------------------

export function PlayAs({
  displayName,
  handle,
  confirmed,
  onConfirm,
  gameName,
  gameId,
  tagDraft,
  onTagDraft,
  onCreateTag,
  tagBusy,
  myTag,
  availabilityOn,
  onToggleAvailability,
  availabilityBusy
}: {
  displayName: string;
  handle: string | null;
  confirmed: boolean;
  onConfirm: () => void;
  gameName: string;
  gameId: string;
  tagDraft: string;
  onTagDraft: (v: string) => void;
  onCreateTag: () => void;
  tagBusy: boolean;
  myTag: string | null;
  availabilityOn: boolean;
  onToggleAvailability: () => void;
  availabilityBusy: boolean;
}) {
  const [tagOpen, setTagOpen] = React.useState(false);

  return (
    <div className="rounded-2xl border border-[var(--brief-line)] bg-[var(--brief-card)] p-3 space-y-3">
      {!confirmed ? (
        <>
          <p className="text-[15px] font-semibold text-[var(--brief-ink)]">
            Play as {displayName}
          </p>
          <p className="text-[13px] leading-snug text-[var(--brief-muted)]">
            Challenges and matches attach to this account
            {handle ? ` (@${handle})` : ''}. No second player is invented.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className="brief-tap h-11 px-4 rounded-xl bg-[var(--brief-green)] text-[var(--brief-green-ink)] text-[13px] font-bold cursor-pointer"
            >
              Play as {displayName}
            </button>
            <button
              type="button"
              onClick={() => setTagOpen((v) => !v)}
              className="brief-tap h-11 px-4 rounded-xl border border-[var(--brief-line)] text-[var(--brief-ink)] text-[13px] font-bold cursor-pointer"
            >
              Add a game tag
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--brief-ink)] truncate">
              {displayName}
              {myTag ? ` · ${myTag}` : ''}
            </p>
            <p className="text-[12px] text-[var(--brief-muted)] mt-0.5">
              {availabilityOn
                ? `Available for ${gameName}, 1v1, tonight, online.`
                : 'Not available. Off unless you switch it on.'}
            </p>
          </div>
          <button
            type="button"
            disabled={availabilityBusy}
            onClick={onToggleAvailability}
            aria-pressed={availabilityOn}
            className={`brief-tap shrink-0 h-11 px-3 rounded-xl text-[12px] font-bold cursor-pointer disabled:opacity-40 ${
              availabilityOn
                ? 'bg-[var(--brief-green)] text-[var(--brief-green-ink)]'
                : 'border border-[var(--brief-line)] text-[var(--brief-ink)]'
            }`}
          >
            {availabilityOn ? 'Available' : 'Go available'}
          </button>
        </div>
      )}

      {(tagOpen || (confirmed && !myTag)) && (
        <div className="space-y-2 pt-1">
          <p className="text-[12px] text-[var(--brief-muted)]">
            Optional tag for {gameName}. This is not a second account.
          </p>
          <div className="flex gap-2">
            <input
              value={tagDraft}
              onChange={(e) => onTagDraft(e.target.value)}
              placeholder="Your in-game name"
              className="flex-1 h-11 rounded-xl border border-[var(--brief-line)] bg-[var(--brief-bg)] px-3 text-[13px] text-[var(--brief-ink)]"
            />
            <button
              type="button"
              disabled={tagBusy || tagDraft.trim() === ''}
              onClick={onCreateTag}
              className="brief-tap h-11 px-3 rounded-xl bg-[var(--brief-green)] text-[var(--brief-green-ink)] text-[13px] font-bold cursor-pointer disabled:opacity-40"
            >
              Save
            </button>
          </div>
          <p className="text-[11px] text-[var(--brief-faint)]">Game: {gameId}</p>
        </div>
      )}
    </div>
  );
}

export default PlayAs;
