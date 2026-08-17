import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { registerServiceWorker } from "@/lib/pwa/register-sw";
import { PRICE_CENTS, SITE_URL } from "@/lib/site";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, interactive-widget=resizes-content" },
      { name: "theme-color", content: "#0F172A" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "TravelDoss" },
      { title: "TravelDoss - Your trip in a beautiful dossier" },
      { name: "description", content: "Create beautiful travel dossiers for unforgettable journeys. Turn scattered plans into a day-by-day itinerary with every place mapped — offline-ready." },
      { name: "author", content: "TravelDoss" },
      { property: "og:title", content: "TravelDoss - Your trip in a beautiful dossier" },
      { property: "og:description", content: "Create beautiful travel dossiers for unforgettable journeys. Turn scattered plans into a day-by-day itinerary with every place mapped — offline-ready." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "TravelDoss" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TravelDoss - Your trip in a beautiful dossier" },
      { name: "twitter:description", content: "Create beautiful travel dossiers for unforgettable journeys. Turn scattered plans into a day-by-day itinerary with every place mapped — offline-ready." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: "TravelDoss",
              url: SITE_URL,
              logo: `${SITE_URL}/favicon.png`,
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              name: "TravelDoss",
              url: SITE_URL,
              publisher: { "@id": `${SITE_URL}/#organization` },
            },
            {
              "@type": "WebApplication",
              "@id": `${SITE_URL}/#app`,
              name: "TravelDoss",
              url: SITE_URL,
              applicationCategory: "TravelApplication",
              operatingSystem: "Web",
              description:
                "Travel itinerary planner that turns pasted or written trip plans into a beautiful day-by-day dossier — every place pinned, categorized, and routed on a live map, offline-ready.",
              offers: {
                "@type": "Offer",
                // Derived from PRICE_CENTS so structured data can never
                // contradict the copy — see src/lib/site.ts.
                price: (PRICE_CENTS / 100).toFixed(2),
                priceCurrency: "USD",
                description: "One dossier, one URL, live for one month.",
              },
              publisher: { "@id": `${SITE_URL}/#organization` },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
