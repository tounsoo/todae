import { vi } from 'vitest';

/**
 * An iframe's document for a test of another document. jsdom gives the frame
 * its own window, so its classes fail `instanceof` against this window's, as a
 * real iframe's do. The setup's popover and animation stand-ins are copied onto
 * its prototypes, and so are its dialog stand-ins. The caller removes the frame.
 */
export function makeFrame(): Document {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const view = frame.contentWindow as unknown as { HTMLElement: typeof HTMLElement; Element: typeof Element };
  for (const name of ['showPopover', 'hidePopover', 'togglePopover'] as const) {
    Object.assign(view.HTMLElement.prototype, { [name]: HTMLElement.prototype[name] });
  }
  for (const name of ['getAnimations', 'animate', 'checkVisibility'] as const) {
    Object.assign(view.Element.prototype, { [name]: Element.prototype[name] });
  }
  const dialog = (frame.contentWindow as unknown as { HTMLDialogElement: typeof HTMLDialogElement }).HTMLDialogElement.prototype;
  Object.defineProperty(dialog, 'open', Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'open')!);
  dialog.showModal = HTMLDialogElement.prototype.showModal;
  dialog.close = HTMLDialogElement.prototype.close;
  return frame.contentDocument!;
}

/**
 * A popup window's document. jsdom opens no window, so this is a frame from
 * `makeFrame` whose window reads as a top window, with no frame element. It
 * keeps its active element once focus goes back to the page, as a window
 * does. The caller removes the frame.
 */
export function makePopup(): Document {
  const doc = makeFrame();
  Object.defineProperty(doc.defaultView!, 'frameElement', { value: null, configurable: true });
  return doc;
}

/** Dispatches a cancelable Escape keydown on `el` and returns the event. */
export function escapeIn(el: Element | Document): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

/**
 * A frame from `makeFrame` that the page reads as inside an open shadow root,
 * as a web component hosting an embedded app. jsdom loads no iframe in a shadow
 * root, so the frame stays in the page and the page's `activeElement` reads
 * focus in it as the host, as a browser's does. Returns the frame's document
 * and a function that ends the stand-in.
 */
export function makeShadowedFrame(): { doc: Document; restore: () => void } {
  const doc = makeFrame();
  const frame = doc.defaultView!.frameElement!;
  const host = document.body.appendChild(document.createElement('div'));
  const root = host.attachShadow({ mode: 'open' });
  const read = Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement')!.get!;
  const page = vi.spyOn(document, 'activeElement', 'get').mockImplementation(() => {
    const el = read.call(document) as Element | null;
    return el === frame ? host : el;
  });
  const shadow = vi.spyOn(root, 'activeElement', 'get').mockImplementation(() => {
    const el = read.call(document) as Element | null;
    return el === frame ? frame : null;
  });
  return {
    doc,
    restore: () => {
      page.mockRestore();
      shadow.mockRestore();
      host.remove();
    },
  };
}
