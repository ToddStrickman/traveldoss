import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { gtagPageView } from "@/lib/analytics/gtag";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPreload: "intent",
  });

  // GA4 auto page views are disabled (single page app), so send one scrubbed
  // page_view per resolved navigation — including the first render.
  if (typeof window !== "undefined") {
    let lastPath: string | null = null;
    const send = () => {
      const path = window.location.pathname;
      if (path === lastPath) return;
      lastPath = path;
      gtagPageView(path);
    };
    router.subscribe("onResolved", send);
    send();
  }

  return router;
};
