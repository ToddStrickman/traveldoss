/** Separate nearby screen anchors without changing saved geographic coordinates. */
export function spreadMapPins(
  points: Array<{ key: string; x: number; y: number }>,
): Map<string, [number, number]> {
  const offsets = new Map<string, [number, number]>();
  const remaining = [...points];
  while (remaining.length) {
    const group = [remaining.shift()!];
    for (let i = 0; i < group.length; i++) {
      for (let j = remaining.length - 1; j >= 0; j--) {
        if (Math.hypot(group[i].x - remaining[j].x, group[i].y - remaining[j].y) < 34)
          group.push(...remaining.splice(j, 1));
      }
    }
    group.sort((a, b) => a.key.localeCompare(b.key));
    if (group.length === 1) {
      offsets.set(group[0].key, [0, 0]);
      continue;
    }
    const x = group.reduce((s, p) => s + p.x, 0) / group.length,
      y = group.reduce((s, p) => s + p.y, 0) / group.length;
    const radius = Math.max(25, (group.length * 48) / (2 * Math.PI));
    group.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      offsets.set(p.key, [x + Math.cos(angle) * radius - p.x, y + Math.sin(angle) * radius - p.y]);
    });
  }
  return offsets;
}
