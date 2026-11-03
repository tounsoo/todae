/**
 * An iframe's document for a test of another document. jsdom gives the frame
 * its own window, so its classes fail `instanceof` against this window's, as a
 * real iframe's do. The setup's popover and animation stand-ins are copied onto
 * its prototypes. The caller removes the frame.
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
  return frame.contentDocument!;
}

/** Dispatches a cancelable Escape keydown on `el` and returns the event. */
export function escapeIn(el: Element | Document): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}
