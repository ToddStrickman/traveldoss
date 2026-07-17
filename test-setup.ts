import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost" });

globalThis.window = window as unknown as Window & typeof globalThis;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Text = window.Text;
globalThis.Comment = window.Comment;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.ResizeObserver = window.ResizeObserver;
globalThis.MutationObserver = window.MutationObserver;
// The activity carousels lazy-load images via IntersectionObserver; without
// this shim any component that renders ActivityImages throws in tests.
globalThis.IntersectionObserver = window.IntersectionObserver;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
(window as any).SyntaxError = SyntaxError;
(window as any).TypeError = TypeError;
(window as any).Error = Error;
(window as any).RangeError = RangeError;
(window as any).ReferenceError = ReferenceError;

// @testing-library/react's auto-cleanup registers on import only if a global
// afterEach already exists — under `bun test` it doesn't, so without this,
// component tests from one FILE leak DOM into the next (tests passed alone
// but failed in the full run).
import { afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";
afterEach(() => {
  cleanup();
});
