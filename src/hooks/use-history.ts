import { useCallback, useEffect, useRef, useState } from "react";

type HistoryEntry<T> = { state: T; key?: string; at: number };

export type UseHistoryReturn<T> = {
  state: T;
  set: (updater: T | ((prev: T) => T), opts?: { coalesceKey?: string }) => void;
  replace: (updater: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (next: T) => void;
};

/**
 * In-memory undo/redo history.
 * - `set` pushes a new snapshot (truncates redo tail).
 * - When `coalesceKey` matches the previous entry's key within `coalesceMs`,
 *   the previous entry is replaced instead of pushed (so typing collapses
 *   into a single undo step).
 * - `replace` mutates the current snapshot without growing history.
 */
export function useHistory<T>(
  initial: T,
  opts: { limit?: number; coalesceMs?: number } = {},
): UseHistoryReturn<T> {
  const limit = opts.limit ?? 100;
  const coalesceMs = opts.coalesceMs ?? 500;
  const stackRef = useRef<HistoryEntry<T>[]>([{ state: initial, at: Date.now() }]);
  const indexRef = useRef(0);
  const [, force] = useState(0);
  const bump = useCallback(() => force((n) => n + 1), []);

  const current = stackRef.current[indexRef.current];

  const set = useCallback(
    (updater: T | ((prev: T) => T), o?: { coalesceKey?: string }) => {
      const prevEntry = stackRef.current[indexRef.current];
      const nextState =
        typeof updater === "function"
          ? (updater as (p: T) => T)(prevEntry.state)
          : updater;
      if (Object.is(nextState, prevEntry.state)) return;
      const now = Date.now();
      const canCoalesce =
        !!o?.coalesceKey &&
        prevEntry.key === o.coalesceKey &&
        now - prevEntry.at < coalesceMs;
      if (canCoalesce) {
        stackRef.current[indexRef.current] = {
          state: nextState,
          key: o!.coalesceKey,
          at: now,
        };
      } else {
        const truncated = stackRef.current.slice(0, indexRef.current + 1);
        truncated.push({ state: nextState, key: o?.coalesceKey, at: now });
        // enforce limit by dropping oldest
        const overflow = truncated.length - limit;
        const trimmed = overflow > 0 ? truncated.slice(overflow) : truncated;
        stackRef.current = trimmed;
        indexRef.current = trimmed.length - 1;
      }
      bump();
    },
    [bump, coalesceMs, limit],
  );

  const replace = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const prevEntry = stackRef.current[indexRef.current];
      const nextState =
        typeof updater === "function"
          ? (updater as (p: T) => T)(prevEntry.state)
          : updater;
      if (Object.is(nextState, prevEntry.state)) return;
      stackRef.current[indexRef.current] = {
        ...prevEntry,
        state: nextState,
      };
      bump();
    },
    [bump],
  );

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    bump();
  }, [bump]);

  const redo = useCallback(() => {
    if (indexRef.current >= stackRef.current.length - 1) return;
    indexRef.current += 1;
    bump();
  }, [bump]);

  const reset = useCallback(
    (next: T) => {
      stackRef.current = [{ state: next, at: Date.now() }];
      indexRef.current = 0;
      bump();
    },
    [bump],
  );

  return {
    state: current.state,
    set,
    replace,
    undo,
    redo,
    canUndo: indexRef.current > 0,
    canRedo: indexRef.current < stackRef.current.length - 1,
    reset,
  };
}

/** Bind Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y to undo/redo.
 *  Skips when focus is in a native input/textarea so browser undo wins there
 *  (our EditableText uses contentEditable; we override for it via tdsHistory). */
export function useUndoRedoShortcuts(
  enabled: boolean,
  undo: () => void,
  redo: () => void,
) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const inNative =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (inNative) return;
      e.preventDefault();
      if (isUndo) undo();
      else redo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, undo, redo]);
}