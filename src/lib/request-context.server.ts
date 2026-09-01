/**
 * Per-request execution context for work that should finish AFTER the
 * response is sent.
 *
 * On Cloudflare Workers a promise left dangling when the handler returns is
 * cancelled with the request; `ctx.waitUntil()` is the only way to let it
 * complete. The Worker entry (src/server.ts) receives that `ctx` and runs the
 * whole request inside `runWithExecutionContext`, so any server code deeper
 * in the call tree can hand off background work with `deferAfterResponse`
 * without threading `ctx` through every signature.
 *
 * Outside Workers (Vite dev, tests) there is no execution context; the task
 * simply runs to completion in-process, which is the pre-existing behaviour.
 */
import { AsyncLocalStorage } from "node:async_hooks";

type ExecutionContextLike = { waitUntil?: (promise: Promise<unknown>) => void };

const store = new AsyncLocalStorage<ExecutionContextLike | undefined>();

export function runWithExecutionContext<T>(ctx: unknown, fn: () => T): T {
  const ec =
    ctx && typeof ctx === "object" && typeof (ctx as ExecutionContextLike).waitUntil === "function"
      ? (ctx as ExecutionContextLike)
      : undefined;
  return store.run(ec, fn);
}

/**
 * Let `task` finish after the response is sent. Never throws and never
 * rejects: background work must not fail the request it was recorded for.
 */
export function deferAfterResponse(task: Promise<unknown>): void {
  const guarded = task.catch((err) => {
    console.error("[deferAfterResponse] background task failed", err);
  });
  store.getStore()?.waitUntil?.(guarded);
}
