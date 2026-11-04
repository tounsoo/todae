import { apcaContrast, compositeSrgb, type Rgb, type Rgba } from '../../../packages/design-system/src/color/apca';

/**
 * The APCA floors painted text has to reach: Lc 60 for text below 24px (or
 * below 18.67px when bold), the content-text floor of the token contrast pairs
 * in `tokens/resolver.json`, and Lc 45 above that, the floor the pairs keep for
 * large type and accent text.
 */
export const PAINTED_TEXT_MIN = { text: 60, large: 45 } as const;

let context: CanvasRenderingContext2D | null = null;

/** Any CSS color the browser computes (rgb, oklch, color-mix results) as gamma-encoded sRGB in [0, 1] with alpha. */
function toRgba(color: string): Rgba {
  if (!context) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('paintedContrast: no 2D canvas');
    context.globalCompositeOperation = 'copy';
  }
  context.fillStyle = '#000';
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r! / 255, g! / 255, b! / 255, a! / 255];
}

/**
 * The background `el` paints its text on: its own background color and each
 * ancestor's, composited from the first opaque one up. Background images are
 * left out, so the Example frame's dot grid reads as its surface color.
 */
function backdropOf(el: Element): Rgb | null {
  const layers: Rgba[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) {
    const layer = toRgba(getComputedStyle(node).backgroundColor);
    if (layer[3] === 0) continue;
    if (layer[3] === 1) {
      let painted: Rgb = [layer[0], layer[1], layer[2]];
      for (const top of layers.reverse()) painted = compositeSrgb(top, painted);
      return painted;
    }
    layers.push(layer);
  }
  return null;
}

/** An ancestor that fades its subtree, such as a dimmed or animating part: its painted color is not the computed one. */
function faded(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (Number.parseFloat(getComputedStyle(node).opacity) < 1) return true;
  }
  return false;
}

const DISABLED = ':disabled, [aria-disabled="true"], [data-disabled]';

function paintsText(el: Element): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value.trim() !== '' && !['checkbox', 'radio', 'range', 'color', 'hidden'].includes(el.type);
  }
  return [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
}

function large(style: CSSStyleDeclaration): boolean {
  const size = Number.parseFloat(style.fontSize);
  return size >= 24 || (size >= 18.67 && Number(style.fontWeight) >= 700);
}

function describe(el: Element): string {
  const text = (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : el.textContent ?? '').trim();
  const classes = [...el.classList].map((c) => `.${c}`).join('');
  return `${el.tagName.toLowerCase()}${classes} "${text.slice(0, 30)}"`;
}

/**
 * Lists each element under `root` whose own visible text paints below its
 * APCA floor on the background behind it, in whatever appearance is showing.
 * The token build checks declared token pairs; this checks what components
 * actually paint, so a part that pairs tokens the contract never declared, or
 * a theme that only one appearance gets wrong, still fails. Disabled text is
 * exempt, as WCAG and APCA exempt it, and so is text under a fading ancestor,
 * whose painted color is not its computed one.
 */
export function lowContrastText(root: ParentNode = document.body): string[] {
  const low: string[] = [];
  for (const el of root.querySelectorAll('*')) {
    if (!paintsText(el) || el.closest(DISABLED)) continue;
    if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const box = el.getBoundingClientRect();
    // Visually hidden text paints nothing a reader sees.
    if (box.width <= 1 || box.height <= 1) continue;
    const style = getComputedStyle(el);
    const ink = toRgba(style.color);
    if (ink[3] === 0 || faded(el)) continue;
    const backdrop = backdropOf(el);
    if (!backdrop) continue;
    const lc = Math.abs(apcaContrast(compositeSrgb(ink, backdrop), backdrop));
    const min = large(style) ? PAINTED_TEXT_MIN.large : PAINTED_TEXT_MIN.text;
    if (lc < min) low.push(`${describe(el)}: Lc ${lc.toFixed(1)}, below ${min}`);
  }
  return low;
}
