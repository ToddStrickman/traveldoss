import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listSavedTripRequests,
  upsertSavedTripRequest,
  deleteSavedTripRequest,
  type SavedTripRequestPayload,
} from "@/lib/itinerary/saved-requests.functions";

export type SavedTripRequest = {
  id: string;
  label: string;
  payload: SavedTripRequestPayload;
  updatedAt: string;
  /** True until we know the row also lives on the server. */
  localOnly?: boolean;
};

const LS_KEY = "td.saved-trip-requests.v1";

function readLocal(): SavedTripRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTripRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(items: SavedTripRequest[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    /* quota etc. — non-fatal */
  }
}

function localId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Hybrid storage for trip-generator briefs:
 *   • localStorage is the source of truth on every device.
 *   • If the viewer is signed in we also sync each save/delete to the
 *     server, and merge what the server has on mount.
 */
export function useSavedTripRequests() {
  const [items, setItems] = useState<SavedTripRequest[]>(() => readLocal());
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  const listFn = useServerFn(listSavedTripRequests);
  const upsertFn = useServerFn(upsertSavedTripRequest);
  const deleteFn = useServerFn(deleteSavedTripRequest);

  // Track auth state — sync only when signed in.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSignedIn(!!sess);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Merge server saves on mount / sign-in. Server wins on conflicts by id.
  useEffect(() => {
    if (!signedIn) {
      setHydrated(true);
      return;
    }
    let cancelled = false;
    listFn()
      .then((r) => {
        if (cancelled) return;
        const serverItems: SavedTripRequest[] = r.saved.map((s) => ({
          id: s.id,
          label: s.label,
          payload: s.payload as SavedTripRequestPayload,
          updatedAt: s.updated_at,
        }));
        setItems((local) => {
          const byId = new Map<string, SavedTripRequest>();
          for (const it of local) byId.set(it.id, it);
          for (const it of serverItems) byId.set(it.id, it);
          const merged = Array.from(byId.values()).sort((a, b) =>
            (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
          );
          writeLocal(merged);
          return merged;
        });
      })
      .catch((err) => console.error("[saved-trips] list failed", err))
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, listFn]);

  const save = useCallback(
    async (label: string, payload: SavedTripRequestPayload, id?: string) => {
      const now = new Date().toISOString();
      // Optimistic local write.
      let nextId = id ?? localId();
      setItems((prev) => {
        const without = prev.filter((p) => p.id !== nextId);
        const next: SavedTripRequest = {
          id: nextId,
          label,
          payload,
          updatedAt: now,
          localOnly: !signedIn,
        };
        const merged = [next, ...without];
        writeLocal(merged);
        return merged;
      });
      if (!signedIn) return nextId;
      try {
        const serverId = id && !id.startsWith("local-") ? id : undefined;
        const r = await upsertFn({ data: { id: serverId, label, payload } });
        const serverRow = r.saved as { id: string; updated_at: string };
        setItems((prev) => {
          const merged = prev.map((p) =>
            p.id === nextId
              ? { ...p, id: serverRow.id, updatedAt: serverRow.updated_at, localOnly: false }
              : p,
          );
          writeLocal(merged);
          return merged;
        });
        nextId = serverRow.id;
      } catch (err) {
        console.error("[saved-trips] server save failed (kept locally)", err);
      }
      return nextId;
    },
    [signedIn, upsertFn],
  );

  const remove = useCallback(
    async (id: string) => {
      setItems((prev) => {
        const next = prev.filter((p) => p.id !== id);
        writeLocal(next);
        return next;
      });
      if (signedIn && !id.startsWith("local-")) {
        try {
          await deleteFn({ data: { id } });
        } catch (err) {
          console.error("[saved-trips] server delete failed", err);
        }
      }
    },
    [signedIn, deleteFn],
  );

  return { items, save, remove, hydrated, signedIn };
}