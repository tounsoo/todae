type ImeKeyEvent = { key: string; keyCode: number } & ({ isComposing: boolean } | { nativeEvent: { isComposing: boolean } });

const ENTER: readonly string[] = ['Enter'];

/**
 * Whether a key event, React's or the DOM's, belongs to an IME composition,
 * such as a Korean or Japanese word, and should be left to the input. Safari
 * sends the Enter that ends a composition after `compositionend`, so
 * `isComposing` is false and only `keyCode` 229 marks it. 229 counts only for
 * `commitKeys`, the keys that commit in this control, Enter by default.
 */
export function isImeKeyEvent(event: ImeKeyEvent, commitKeys: readonly string[] = ENTER): boolean {
  const composing = 'nativeEvent' in event ? event.nativeEvent.isComposing : event.isComposing;
  return composing || event.key === 'Process' || (event.keyCode === 229 && commitKeys.includes(event.key));
}
