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
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.SyntaxError = window.SyntaxError || SyntaxError;
globalThis.TypeError = window.TypeError || TypeError;
globalThis.Error = window.Error || Error;
globalThis.RangeError = window.RangeError || RangeError;
globalThis.ReferenceError = window.ReferenceError || ReferenceError;
