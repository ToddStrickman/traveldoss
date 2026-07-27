/**
 * Compare dotted numeric document versions ("1.0", "1.10", "2.0.1").
 * Returns negative if a < b, 0 if equal, positive if a > b.
 *
 * Acceptance decisions never rely on timestamps — only on version
 * comparison against the current published version.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
