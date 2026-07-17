/**
 * EditingStatusBar — sticky top strip that unifies:
 *   · lock/unlock (Edit / Done) via LockPill
 *   · autosave read-out
 *   · shareable URL copy
 *
 * Renders on both mobile and desktop above the dossier canvas. Replaces the
 * previous mobile-only "Editing · auto-saves" banner and gives the sticky
 * lock+share controls one home instead of three floating pills.
 *
 * Kept small on purpose: no undo/redo (those live in StudioBar inside the
 * editing subtree so they only appear when editing).
 */
import * as React from "react";
import { LockPill } from "./LockPill";
import { SharedDossierCard } from "./SharedDossierCard";
import { cn } from "@/lib/utils";

type SaveState = {
  saving: boolean;
  savedAt: string | null;
  saveError: boolean;
};

function SaveStatus({ saving, savedAt, saveError, editing }: SaveState & { editing: boolean }) {
  if (!editing) return null;
  const label = saveError
    ? "Offline — waiting"
    : saving
      ? "Saving…"
      : savedAt
        ? "All changes synced"
        : "Auto-saves as you type";
  return (
    <span
      className={cn(
        "hidden items-center gap-2 text-[10px] font-medium uppercase tracking-[0.28em] sm:inline-flex",
        saveError ? "text-red-500" : "text-ink-soft",
      )}
      role={saveError ? "alert" : "status"}
      aria-live="polite"
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          saveError ? "animate-pulse bg-red-500" : saving ? "animate-pulse bg-seal" : "bg-seal/60",
        )}
      />
      {label}
    </span>
  );
}

export function EditingStatusBar({
  slug,
  canEdit,
  locked,
  onToggleLock,
  saving,
  savedAt,
  saveError,
}: {
  slug: string;
  canEdit: boolean;
  locked: boolean;
  onToggleLock: () => void;
  saving: boolean;
  savedAt: string | null;
  saveError: boolean;
}) {
  const editing = canEdit && !locked;
  return (
    <div
      data-print="hide"
      className="fixed right-4 z-40 hidden items-center gap-3 rounded-full border border-white/15 bg-paper/85 px-3 py-2 backdrop-blur-md md:inline-flex"
      style={{ top: "max(1rem, env(safe-area-inset-top))" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {canEdit ? (
          <LockPill locked={locked} onToggle={onToggleLock} variant="inline" />
        ) : (
          <span className="td-eyebrow truncate text-ink/50">Viewing</span>
        )}
        <SaveStatus
          saving={saving}
          savedAt={savedAt}
          saveError={saveError}
          editing={editing}
        />
      </div>
      <SharedDossierCard slug={slug} />
    </div>
  );
}