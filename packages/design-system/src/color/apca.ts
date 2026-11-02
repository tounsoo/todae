// The one copy of Todae's OKLCH to sRGB and APCA-W3 0.0.98G-4g contrast math,
// shared by the token build, ThemeProvider's override check and the docs
// playground. It imports nothing, so the Node scripts can load it too.

/** Gamma-encoded sRGB in [0, 1]. */
export type Rgb = [r: number, g: number, b: number];

/** Gamma-encoded sRGB in [0, 1], with alpha. */
export type Rgba = [r: number, g: number, b: number, alpha: number];

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function encodeSrgb(linear: number): number {
  const v = clamp01(linear);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** OKLCH to gamma-encoded sRGB in [0, 1], clipped to the sRGB gamut. */
export function oklchToSrgb({ l, c, h }: { l: number; c: number; h: number }): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    encodeSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    encodeSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    encodeSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

/** Paints `top` with its alpha over an opaque `bottom`, in gamma-encoded sRGB as browsers composite. */
export function compositeSrgb(top: Readonly<Rgba>, bottom: Readonly<Rgb | Rgba>): Rgb {
  const alpha = top[3];
  return [0, 1, 2].map((i) => top[i]! * alpha + bottom[i]! * (1 - alpha)) as Rgb;
}

function screenLuminance([r, g, b]: Readonly<Rgb>): number {
  const y = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
  return y > 0.022 ? y : y + (0.022 - y) ** 1.414;
}

/**
 * APCA Lc of `text` on `background`, both gamma-encoded sRGB: positive for dark
 * text on a light background, negative for light on dark. Checks compare its magnitude.
 */
export function apcaContrast(text: Readonly<Rgb>, background: Readonly<Rgb>): number {
  const yt = screenLuminance(text);
  const yb = screenLuminance(background);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) {
    const sapc = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  }
  const sapc = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}
