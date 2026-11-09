/**
 * Captures `pointerId` on `element` when it can. The pointer may already be
 * gone, as after a fast release or for a synthetic event, and then
 * `setPointerCapture` throws: a press still works, only a drag can't follow
 * the pointer outside the element.
 */
export function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture?.(pointerId);
  } catch {
    // Nothing to capture; the caller goes on without it.
  }
}
