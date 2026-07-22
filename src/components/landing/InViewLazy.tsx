import { lazy, Suspense, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

type Importer<P> = () => Promise<{ default: ComponentType<P> }>;

type Props<P> = {
  // The dynamic import factory. Called once when the sentinel enters the
  // prefetch margin so the network request begins before mount; called
  // again by React.lazy at mount (dedup'd by the module cache — same
  // Promise, no second fetch).
  load: Importer<P>;
  // Props forwarded to the lazily-loaded component.
  componentProps: P;
  // Reserved space so nothing jumps when the chunk resolves and the real
  // component paints. Match the below-the-fold section's approximate
  // height on desktop; mobile is fine to over-reserve slightly.
  minHeight: number;
  // How close the section must get before we start the network fetch.
  // Defaults tuned to prefetch roughly one viewport ahead, mount when
  // it's about to be visible.
  prefetchRootMargin?: string;
  mountRootMargin?: string;
  fallback?: ReactNode;
};

export function InViewLazy<P extends object>({
  load,
  componentProps,
  minHeight,
  prefetchRootMargin = "1200px 0px",
  mountRootMargin = "300px 0px",
  fallback = null,
}: Props<P>) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [Component, setComponent] = useState<ComponentType<P> | null>(null);
  const prefetched = useRef(false);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // Older browsers / SSR fallback: mount immediately so the section
      // is never blank.
      const Lazy = lazy(load);
      setComponent(() => Lazy);
      return;
    }

    const prefetch = () => {
      if (prefetched.current) return;
      prefetched.current = true;
      // Fire-and-forget: warms the module cache so React.lazy resolves
      // synchronously by the time the mount observer trips.
      void load().catch(() => {
        // Chunk fetch failed (offline, deploy churn) — allow a retry on
        // the next intersection tick.
        prefetched.current = false;
      });
    };

    const prefetchObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            prefetch();
            prefetchObs.disconnect();
            break;
          }
        }
      },
      { rootMargin: prefetchRootMargin },
    );
    const mountObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            prefetch();
            const Lazy = lazy(load);
            setComponent(() => Lazy);
            mountObs.disconnect();
            break;
          }
        }
      },
      { rootMargin: mountRootMargin },
    );

    prefetchObs.observe(node);
    mountObs.observe(node);

    return () => {
      prefetchObs.disconnect();
      mountObs.disconnect();
    };
  }, [load, prefetchRootMargin, mountRootMargin]);

  if (!Component) {
    return <div ref={sentinelRef} aria-hidden style={{ minHeight }} />;
  }
  return (
    <Suspense fallback={fallback ?? <div aria-hidden style={{ minHeight }} />}>
      <Component {...componentProps} />
    </Suspense>
  );
}