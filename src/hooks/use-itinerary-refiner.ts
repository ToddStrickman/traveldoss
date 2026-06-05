import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { refineItineraryAi } from "@/lib/itinerary/refine.functions";
import type { Block } from "@/lib/skins/types";
import type { TripMeta } from "@/lib/skins/types";

type RefineSnapshot = {
  blocks: Block[];
  destination: string;
  startDate: string;
  endDate: string;
  meta: TripMeta;
};

type Options = {
  enabled: boolean;
  debounceMs?: number;
  /** Called with refined blocks once a refine pass completes. */
  onRefined: (next: Block[], reason: string) => void;
};

/**
 * Debounced silent re-generation. Watches the dossier snapshot and, when
 * meta/dates/destination change, queues a refine pass through
 * `refineItineraryAi`. While a call is in flight, additional changes mark
 * the run dirty so a follow-up call kicks off as soon as the first returns.
 *
 * The hook exposes a tiny status string ("sharpening" | "idle" | "error")
 * so the StudioBar can show an unobtrusive indicator.
 */
export function useItineraryRefiner(snap: RefineSnapshot, opts: Options) {
  const debounceMs = opts.debounceMs ?? 1200;
  const refineFn = useServerFn(refineItineraryAi);
  const [status, setStatus] = useState<"idle" | "sharpening" | "error">("idle");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const dirty = useRef(false);
  const lastSignature = useRef<string>(signature(snap));
  const lastReason = useRef<string>("");
  const latestSnap = useRef(snap);
  latestSnap.current = snap;

  const run = useCallback(async () => {
    if (inflight.current) {
      dirty.current = true;
      return;
    }
    const current = latestSnap.current;
    if (!current.blocks.length) return;
    inflight.current = true;
    setStatus("sharpening");
    try {
      const res = await refineFn({
        data: {
          blocks: current.blocks,
          destination: current.destination || undefined,
          startDate: current.startDate || undefined,
          endDate: current.endDate || undefined,
          meta: current.meta ?? undefined,
          reason: lastReason.current || undefined,
        },
      });
      if (res?.blocks?.length) {
        opts.onRefined(res.blocks as Block[], lastReason.current);
      }
      setStatus("idle");
    } catch (err) {
      console.error("[refine]", err);
      setStatus("error");
    } finally {
      inflight.current = false;
      if (dirty.current) {
        dirty.current = false;
        // Schedule another pass; debounce so rapid edits collapse.
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          void run();
        }, debounceMs);
      }
    }
  }, [debounceMs, opts, refineFn]);

  useEffect(() => {
    if (!opts.enabled) return;
    const sig = signature(snap);
    if (sig === lastSignature.current) return;
    lastReason.current = diffReason(snap, lastSignature.current);
    lastSignature.current = sig;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void run();
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [snap, opts.enabled, debounceMs, run]);

  return { status };
}

/** Stable signature over the inputs that should trigger a refine. We don't
 *  refine on every block-text keystroke — only on meta/dates/destination
 *  changes plus block structural changes (count, order, time). */
function signature(s: RefineSnapshot): string {
  const blockSig = s.blocks
    .map((b) => {
      if (b.kind === "place") return `p:${b.name}|${b.time ?? ""}|${b.category ?? ""}`;
      if (b.kind === "day") return `d:${b.n}|${b.label}`;
      if (b.kind === "flight") return `f:${b.from ?? ""}-${b.to ?? ""}`;
      return `${b.kind}`;
    })
    .join(">");
  return [
    s.destination,
    s.startDate,
    s.endDate,
    s.meta?.travelers ?? "",
    s.meta?.pace ?? "",
    s.meta?.budget ?? "",
    (s.meta?.interests ?? []).join(","),
    blockSig,
  ].join("|");
}

function diffReason(snap: RefineSnapshot, prevSig: string): string {
  const parts = prevSig.split("|");
  const reasons: string[] = [];
  if (parts[0] !== snap.destination) reasons.push("destination");
  if (parts[1] !== snap.startDate || parts[2] !== snap.endDate) reasons.push("dates");
  if (parts[3] !== (snap.meta?.travelers ?? "")) reasons.push("travelers");
  if (parts[4] !== (snap.meta?.pace ?? "")) reasons.push("pace");
  if (parts[5] !== (snap.meta?.budget ?? "")) reasons.push("budget");
  if (parts[6] !== (snap.meta?.interests ?? []).join(",")) reasons.push("interests");
  if (!reasons.length) reasons.push("blocks");
  return `User updated ${reasons.join(", ")}`;
}