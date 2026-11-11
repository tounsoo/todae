// Server-safe color math for ColorPicker: no hooks or context.

/** A color as hue (0–360), saturation (0–1) and brightness (0–1). */
export type Hsv = { h: number; s: number; v: number };

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#rrggbb` in lower case for a three- or six-digit hex color, with or without `#`; `null` for anything else. */
export function normalizeHex(text: string): string | null {
  const match = HEX.exec(text.trim());
  if (!match) return null;
  const digits = match[1]!.toLowerCase();
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  return `#${full}`;
}

/** HSV for a hex color, or `null` when the text is not one. A gray has hue 0. */
export function hexToHsv(text: string): Hsv | null {
  const hex = normalizeHex(text);
  if (!hex) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

/** The `#rrggbb` for an HSV color. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}
