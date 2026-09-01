/**
 * deferAfterResponse must (a) hand the task to Cloudflare's waitUntil when a
 * request context is present, so the Worker does not cancel it with the
 * response, (b) still let the task run when there is no context (Vite dev,
 * tests), and (c) never surface a task failure to the caller.
 */
import { describe, expect, test } from "bun:test";
import {
  deferAfterResponse,
  runWithExecutionContext,
} from "../src/lib/request-context.server";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("deferAfterResponse", () => {
  test("hands the task to ctx.waitUntil inside a request context", async () => {
    const captured: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => captured.push(p) };
    let ran = false;
    runWithExecutionContext(ctx, () => {
      deferAfterResponse(
        (async () => {
          await tick();
          ran = true;
        })(),
      );
    });
    expect(captured).toHaveLength(1);
    await captured[0];
    expect(ran).toBe(true);
  });

  test("still runs the task when there is no execution context", async () => {
    let ran = false;
    deferAfterResponse(
      (async () => {
        await tick();
        ran = true;
      })(),
    );
    await tick();
    await tick();
    expect(ran).toBe(true);
  });

  test("ignores a ctx without waitUntil", () => {
    expect(() =>
      runWithExecutionContext({}, () => deferAfterResponse(Promise.resolve())),
    ).not.toThrow();
    expect(() =>
      runWithExecutionContext(null, () => deferAfterResponse(Promise.resolve())),
    ).not.toThrow();
  });

  test("a failing task never rejects past the boundary", async () => {
    const captured: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => captured.push(p) };
    runWithExecutionContext(ctx, () => {
      deferAfterResponse(Promise.reject(new Error("boom")));
    });
    // The promise handed to waitUntil is the guarded one: it resolves.
    await expect(captured[0]).resolves.toBeUndefined();
  });

  test("the context is scoped to the run, not global", () => {
    const captured: Promise<unknown>[] = [];
    runWithExecutionContext({ waitUntil: (p: Promise<unknown>) => captured.push(p) }, () => {});
    deferAfterResponse(Promise.resolve());
    expect(captured).toHaveLength(0);
  });
});
