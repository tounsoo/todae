import tokens from '@tounsoo/todae/tokens.json';

/** `oklch(L C h)` as `#rrggbb`. The image renderer reads only sRGB colors, and Todae's tokens are OKLCH. */
export function oklchToHex(value: string): string {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value.trim());
  if (!match) throw new Error(`Not an oklch() color: ${value}`);
  const [, l, percent, c, h] = match;
  const L = Number(l) / (percent ? 100 : 1);
  const hue = (Number(h) * Math.PI) / 180;
  const a = Number(c) * Math.cos(hue);
  const b = Number(c) * Math.sin(hue);
  // OKLab to linear sRGB (Björn Ottosson's matrices).
  const lms = [L + 0.3963377774 * a + 0.2158037573 * b, L - 0.1055613458 * a - 0.0638541728 * b, L - 0.0894841775 * a - 1.291485548 * b].map(
    (x) => x ** 3,
  ) as [number, number, number];
  const [lc, mc, sc] = lms;
  const linear = [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ];
  return `#${linear
    .map((x) => {
      const clamped = Math.min(1, Math.max(0, x));
      const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
      return Math.round(encoded * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

/** A core color token, such as `gray.900`, as hex. */
export function coreColor(path: string): string {
  const token = tokens.tokens.find((row) => row.path === `color.${path}` && row.layer === 'core');
  if (!token) throw new Error(`No core color token color.${path}`);
  return oklchToHex(token.cssValue);
}
