/**
 * A value made safe for an id, one-to-one so two values never share an id:
 * every character outside [A-Za-z0-9-], `_` included, becomes `_<hex>_`.
 */
export function domSafe(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/gu, (char) => `_${char.codePointAt(0)!.toString(16)}_`);
}
