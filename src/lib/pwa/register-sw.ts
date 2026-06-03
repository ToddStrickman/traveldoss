/**
 * Guarded service-worker registration for offline support.
 *
 * Refuses to register in:
 *  - dev (`!import.meta.env.PROD`)
 *  - iframes (Lovable preview embeds the app in an iframe)
 *  - Lovable preview hosts (`id-preview--`, `preview--`, `*.lovableproject.com`,
 *    `*.lovableproject-dev.com`, `*.beta.lovable.dev`)
 *  - when `?sw=off` is in the URL (kill switch)
 *
 * In any refused context we ALSO unregister any existing `/sw.js` registrations
 * so a stale install can't keep serving the app.
 */

function isLovablePreviewHost(hostname: string): boolean {
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  if (hostname.startsWith("id-preview--")) return true;
  if (hostname.startsWith("preview--")) return true;
  return false;
}

async function unregisterAppSW(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => r.active?.scriptURL.endsWith("/sw.js") || r.installing?.scriptURL.endsWith("/sw.js") || r.waiting?.scriptURL.endsWith("/sw.js"))
        .map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const hostname = window.location.hostname;
  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";

  const refuse =
    !import.meta.env.PROD ||
    inIframe ||
    isLovablePreviewHost(hostname) ||
    killSwitch;

  if (refuse) {
    void unregisterAppSW();
    return;
  }

  // Register on idle so it never competes with first paint.
  const register = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[pwa] SW registration failed", err));
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}