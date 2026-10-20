/**
 * Whether a key event belongs to an IME composition, such as a Korean or
 * Japanese word, and should be left to the input. Safari sends the Enter that
 * ends a composition after `compositionend`, so `isComposing` is false and
 * only `keyCode` 229 marks it.
 */
export function isImeKeyEvent(event: { nativeEvent: { isComposing: boolean }; keyCode: number }): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}
