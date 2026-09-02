import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { initAnalytics } from "@/lib/analytics/gtag";

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
  // page_view per resolved navigation — including the first. initAnalytics also
  // keeps localhost and Lovable preview hosts out of the production property.
  //
  // A referenced import, not a bare `import "@/lib/analytics/gtag"`:
  // package.json sets `"sideEffects": false`, so Rollup deletes side-effect-only
  // imports from the client bundle without warning.
  if (!import.meta.env.SSR) {
    initAnalytics(router);
  }

  return router;
};
