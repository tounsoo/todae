/**
 * Closes Firefox's popup for a failed form check before a test's tree is removed. Firefox ties the popup to the
 * control the check focused, a Field's value input here, and closes it only when that control blurs. The value
 * input hands focus on inside that focus(), before Firefox listens, so the popup stays over the frame and takes the
 * clicks under it for the tests after. Focused again, its hand-off is the blur. The shared cleanup calls this
 * first, and so does a file with a cleanup of its own.
 */
export function blurBeforeCleanup(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>('input[data-todae-value-input]')) {
    if (!input.disabled) input.focus();
  }
  const active = document.activeElement;
  // Not the body: blurring it can take focus from the whole frame, and the next test's keys with it.
  if (active instanceof HTMLElement && active !== document.body) active.blur();
}
