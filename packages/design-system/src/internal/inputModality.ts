// The kind of input that last moved the page: a pointer press or a key.
// Browsers keep their own version of this for :focus-visible, but they differ
// on focus a script moves after a press, so a tip that must not follow a
// pointer pick reads this instead of trusting the ring alone.

type Modality = 'pointer' | 'keyboard' | null;

let last: Modality = null;
// The documents watched, so a press in a frame counts as much as one in the page.
const watched = new WeakSet<Document>();

function onPointerDown() {
  last = 'pointer';
}

function onKeyDown(event: KeyboardEvent) {
  // A modifier alone, or a shortcut held with one, moves nothing on its own.
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (['Shift', 'Meta', 'Control', 'Alt', 'CapsLock'].includes(event.key)) return;
  last = 'keyboard';
}

/** Starts watching presses and keys in `doc`, once for each document. */
export function watchInputModality(doc: Document | undefined = globalThis.document): void {
  if (!doc || watched.has(doc)) return;
  watched.add(doc);
  doc.addEventListener('pointerdown', onPointerDown, true);
  doc.addEventListener('keydown', onKeyDown, true);
}

/** Whether a pointer press, not a key, is the last input the page saw. */
export function lastInputWasPointer(): boolean {
  return last === 'pointer';
}

/** Forgets the last input, for tests. */
export function resetInputModality(): void {
  last = null;
}
