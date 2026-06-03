import { expect, test, type Page } from "@playwright/test";

/**
 * E2E smoke tests for kanban drag-and-drop across templates.
 *
 * Drives real pointer events against the /e2e/kanban harness route (dev-only).
 * Reads serialized block state from the embedded <script data-testid="kanban-state">
 * tag and re-checks bucket membership after each drop.
 *
 * dnd-kit's PointerSensor uses a 4px activationConstraint, so each drag must
 * (1) press, (2) move past the threshold, (3) move to target, (4) release —
 * a single mouse.move() is not enough.
 */

type Block = Record<string, unknown> & { kind: string };
type Bucket = "morning" | "afternoon" | "evening";

const SKINS = ["marcello", "vesper", "calliope"] as const;

async function readState(page: Page): Promise<Block[]> {
  const raw = await page.locator('[data-testid="kanban-state"]').textContent();
  if (!raw) throw new Error("kanban-state empty");
  return JSON.parse(raw) as Block[];
}

function bucketNames(blocks: Block[], dayN: number, part: Bucket): string[] {
  const out: string[] = [];
  let inDay = false;
  let inPart = false;
  for (const b of blocks) {
    if (b.kind === "day") {
      inDay = b.n === dayN;
      inPart = false;
      continue;
    }
    if (!inDay) continue;
    if (b.kind === "section") {
      inPart = b.partOfDay === part;
      continue;
    }
    if (inPart && b.kind === "place") out.push(b.name as string);
  }
  return out;
}

async function dragCard(page: Page, fromText: string, toSelector: string) {
  const source = page.locator(`.tds-act-card-title`, { hasText: fromText }).first();
  await source.scrollIntoViewIfNeeded();
  const sBox = await source.boundingBox();
  const target = page.locator(toSelector).first();
  await target.scrollIntoViewIfNeeded();
  const tBox = await target.boundingBox();
  if (!sBox || !tBox) throw new Error(`No bounding box for ${fromText} → ${toSelector}`);

  await page.mouse.move(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
  await page.mouse.down();
  // Exceed dnd-kit's 4px activation threshold.
  await page.mouse.move(sBox.x + sBox.width / 2 + 20, sBox.y + sBox.height / 2 + 20, { steps: 5 });
  await page.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, { steps: 10 });
  await page.mouse.up();
}

for (const skin of SKINS) {
  test.describe(`kanban DnD · skin=${skin}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/e2e/kanban?skin=${skin}&fixture=full`);
      await expect(page.locator('[data-testid="kanban-harness"]')).toBeVisible();
    });

    test("append: drop card onto an empty area of another bucket", async ({ page }) => {
      // Day 3 morning currently has 1 card; drop Belcanto (Day 1 evening) at end.
      const day3MorningBucket = '.tds-board-col:nth-of-type(3) .tds-board-bucket[data-part="morning"]';
      await dragCard(page, "Belcanto", day3MorningBucket);
      const state = await readState(page);
      expect(bucketNames(state, 3, "morning")).toContain("Dinner · Belcanto");
      expect(bucketNames(state, 1, "evening")).not.toContain("Dinner · Belcanto");
    });

    test("insert-before: drop card directly onto another card", async ({ page }) => {
      // Drop Belcanto onto the Museu card (Day 2 morning) — must land BEFORE it.
      const targetCardTitle = '.tds-board-col:nth-of-type(2) .tds-board-bucket[data-part="morning"] .tds-act-card-title';
      await dragCard(page, "Belcanto", targetCardTitle);
      const state = await readState(page);
      const bucket = bucketNames(state, 2, "morning");
      const beIdx = bucket.indexOf("Dinner · Belcanto");
      const museuIdx = bucket.indexOf("Museu Nacional do Azulejo");
      expect(beIdx).toBeGreaterThanOrEqual(0);
      expect(museuIdx).toBeGreaterThanOrEqual(0);
      expect(beIdx).toBeLessThan(museuIdx);
    });

    test("cross-day move appears in destination and disappears from source", async ({ page }) => {
      const before = await readState(page);
      expect(bucketNames(before, 1, "afternoon")).toContain("Walk · Príncipe Real → Bairro Alto");
      const targetBucket = '.tds-board-col:nth-of-type(3) .tds-board-bucket[data-part="evening"]';
      await dragCard(page, "Walk · Príncipe Real → Bairro Alto", targetBucket);
      const after = await readState(page);
      expect(bucketNames(after, 1, "afternoon")).not.toContain("Walk · Príncipe Real → Bairro Alto");
      expect(bucketNames(after, 3, "evening")).toContain("Walk · Príncipe Real → Bairro Alto");
    });
  });
}