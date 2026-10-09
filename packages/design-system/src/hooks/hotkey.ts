// Inputs a key types nothing into.
const UNTYPED_INPUTS = ['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']
  .map((type) => `[type=${type}]`)
  .join(', ');

/** Whether a key pressed in `target` types there, so a typing hotkey leaves it alone. */
export function typesIn(target: EventTarget | null, { key, modifiers }: Hotkey): boolean {
  // A function key types nothing anywhere, nor does a chord with Meta or
  // Ctrl. Ctrl with Alt is AltGr on Windows, which types.
  if (/^f\d{1,2}$/.test(key) || modifiers.has('meta') || (modifiers.has('ctrl') && !modifiers.has('alt'))) return false;
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches(`textarea, select, input:not(${UNTYPED_INPUTS})`);
}

const MODIFIERS = ['alt', 'ctrl', 'meta', 'shift'] as const;
type Modifier = (typeof MODIFIERS)[number];

// The names people write for each modifier, such as macOS's Cmd and Option.
const MODIFIER_NAMES = new Map<string, Modifier>([
  ['alt', 'alt'],
  ['option', 'alt'],
  ['opt', 'alt'],
  ['ctrl', 'ctrl'],
  ['control', 'ctrl'],
  ['meta', 'meta'],
  ['cmd', 'meta'],
  ['command', 'meta'],
  ['shift', 'shift'],
]);

// Keys whose name is not what they type.
const KEY_NAMES = new Map([['space', ' ']]);

export type Hotkey = { key: string; modifiers: ReadonlySet<Modifier> };

/**
 * The key and modifiers of a hotkey such as "Alt+T", or null when it names a
 * modifier this doesn't know, so a typo never turns into the bare key.
 */
export function parseHotkey(hotkey: string): Hotkey | null {
  const parts = hotkey.split('+').map((part) => part.trim().toLowerCase());
  const name = parts.pop();
  if (!name) return null;
  const key = KEY_NAMES.get(name) ?? name;
  const modifiers = new Set<Modifier>();
  for (const part of parts) {
    const modifier = MODIFIER_NAMES.get(part);
    if (!modifier) return null;
    modifiers.add(modifier);
  }
  return { key, modifiers };
}

/** Whether `event` is `hotkey`, such as "F8" or "Alt+T", with exactly those modifiers. */
export function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
  const parsed = parseHotkey(hotkey);
  return parsed !== null && matchesParsed(event, parsed);
}

export function matchesParsed(event: KeyboardEvent, { key, modifiers: wanted }: Hotkey): boolean {
  // Chrome sends keydown events with no key, such as for an autofill pick.
  const eventKey = event.key ?? '';
  const eventCode = event.code ?? '';
  for (const modifier of MODIFIERS) {
    if (event[`${modifier}Key`] !== wanted.has(modifier)) return false;
  }
  const typed = eventKey.toLowerCase();
  if (typed === key) return true;
  // The code only when the key is no plain letter or digit, as Option changes
  // what a letter or digit types on macOS. A plain one decides by itself, so
  // a layout such as AZERTY matches by what the key types.
  if (/^[a-z0-9]$/.test(typed)) return false;
  const code = eventCode.toLowerCase();
  return code === `key${key}` || code === `digit${key}`;
}
