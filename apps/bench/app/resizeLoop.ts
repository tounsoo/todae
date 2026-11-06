/**
 * Chromium's report that a resize callback changed a size it observes in the
 * same frame, so the browser held the rest of the notifications for the next
 * frame. It reaches window as an error event and Playwright as a page error,
 * but nothing threw: the bench counts it per run instead of failing the case.
 * Older Chromium worded it "ResizeObserver loop limit exceeded".
 */
export function isResizeLoop(message: unknown): boolean {
  return typeof message === 'string' && message.startsWith('ResizeObserver loop');
}
