export type OfflineWarmResult = { saved: number; failed: number };

export function dossierOfflineUrls(href: string): string[] {
  const base = new URL(href);
  base.hash = "";
  base.searchParams.delete("map");
  base.searchParams.delete("mode");
  base.searchParams.delete("mint");
  return (["vertical", "horizontal", "grid"] as const).map((view) => {
    const url = new URL(base);
    url.searchParams.set("view", view);
    return url.toString();
  });
}

export async function keepDossierOffline(
  href: string,
  fetcher: typeof fetch = fetch,
): Promise<OfflineWarmResult> {
  const results = await Promise.allSettled(
    dossierOfflineUrls(href).map(async (url) => {
      const response = await fetcher(url, { method: "GET", credentials: "omit", cache: "reload" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
    }),
  );
  const saved = results.filter((result) => result.status === "fulfilled").length;
  return { saved, failed: results.length - saved };
}