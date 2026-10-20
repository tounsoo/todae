type ImeKeyEvent = { key: string; keyCode: number } & ({ isComposing: boolean } | { nativeEvent: { isComposing: boolean } });

/**
 * Whether a key event, React's or the DOM's, belongs to an IME composition,
 * such as a Korean or Japanese word, and should be left to the input. Safari
 * sends the Enter that ends a composition after `compositionend`, so
 * `isComposing` is false and only `keyCode` 229 marks it.
 */
export function isImeKeyEvent(event: ImeKeyEvent): boolean {
  const composing = 'nativeEvent' in event ? event.nativeEvent.isComposing : event.isComposing;
  return composing || event.key === 'Process' || event.keyCode === 229;
}
