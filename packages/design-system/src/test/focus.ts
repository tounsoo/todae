/**
 * Blurs what has focus. Firefox's popup for a failed form check closes when its control blurs, not when the
 * control is removed, and one left open takes the keys and clicks of the tests after it. The shared cleanup
 * calls this first, and so does a file with a cleanup of its own.
 */
export function blurBeforeCleanup(): void {
  (document.activeElement as HTMLElement | null)?.blur();
}
