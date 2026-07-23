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
import { SharedDossierCard } from "./SharedDossierCard";
import { SavedCheck } from "./SavedCheck";
import { cn } from "@/lib/utils";

type SaveState = {
  saving: boolean;
  savedAt: string | null;
  saveError: boolean;
};

function SaveStatus({ saving, savedAt, saveError, editing }: SaveState & { editing: boolean }) {
  if (!editing) return null;
  return (
    <SavedCheck
      saving={saving}
      savedAt={savedAt}
      saveError={saveError}
      idleLabel="Auto-saves as you type"
      className="hidden sm:inline-flex"
    />
  );
}

export function EditingStatusBar({
  slug,
  canEdit,
  saving,
  savedAt,
  saveError,
}: {
  slug: string;
  canEdit: boolean;
  saving: boolean;
  savedAt: string | null;
  saveError: boolean;
}) {
  // Desktop has no lock concept — owners edit inline by clicking any field.
  const editing = canEdit;
  return (
    <div
      data-print="hide"
      className="fixed right-4 z-40 hidden items-center gap-3 rounded-full border border-white/15 bg-paper/85 px-3 py-2 backdrop-blur-md md:inline-flex"
      style={{ top: "max(1rem, env(safe-area-inset-top))" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {canEdit ? (
          <span className="td-eyebrow truncate text-ink/70">Editing</span>
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