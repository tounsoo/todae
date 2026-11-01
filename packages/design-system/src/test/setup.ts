import './temporal.js';
import { afterEach } from 'vitest';
import { resetTooltipWarmth } from '../components/Tooltip.warmth.js';

afterEach(() => {
  resetTooltipWarmth();
});
function polyfillDialog(): void {
  const proto = globalThis.HTMLDialogElement?.prototype;
  if (!proto) return;

  Object.defineProperty(proto, 'open', {
    configurable: true,
    get() {
      return this.hasAttribute('open');
    },
    set(value: boolean) {
      if (value) this.setAttribute('open', '');
      else this.removeAttribute('open');
    },
  });

  proto.showModal = function showModal() {
    this.open = true;
    this.setAttribute('aria-modal', 'true');
  };

  proto.close = function close() {
    this.open = false;
    this.removeAttribute('aria-modal');
    this.dispatchEvent(new Event('close'));
  };
}

function polyfillInert(): void {
  if (typeof HTMLElement === 'undefined') return;
  if (Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'inert')) return;
  Object.defineProperty(HTMLElement.prototype, 'inert', {
    configurable: true,
    get() {
      return this.hasAttribute('inert');
    },
    set(value: boolean) {
      if (value) this.setAttribute('inert', '');
      else this.removeAttribute('inert');
    },
  });
}

function polyfillPointerEvent(): void {
  if (typeof globalThis.PointerEvent === 'function' || typeof MouseEvent === 'undefined') return;
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(
      type: string,
      init: MouseEventInit & {
        pointerId?: number;
        pointerType?: string;
        isPrimary?: boolean;
      } = {},
    ) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? '';
      this.isPrimary = init.isPrimary ?? false;
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as typeof PointerEvent;
}

function polyfillPopover(): void {
  if (typeof HTMLElement === 'undefined') return;
  const proto = HTMLElement.prototype;
  if (typeof proto.showPopover === 'function') return;

  proto.showPopover = function showPopover() {
    this.setAttribute('data-popover-open', '');
  };
  proto.hidePopover = function hidePopover() {
    this.removeAttribute('data-popover-open');
  };
  proto.togglePopover = function togglePopover(force?: boolean) {
    const shown = this.hasAttribute('data-popover-open');
    if (force === true || (force !== false && !shown)) this.showPopover();
    else this.hidePopover();
    return this.hasAttribute('data-popover-open');
  };
}

// jsdom runs no animations and has no layout, so a Drilldown view settles
// as soon as it moves; its slide and settle are tested in the browser only.
// A hidden ancestor, an inline display:none, a closed dialog or a popover
// that isn't showing stands in for an element that isn't rendered.
function rendered(el: Element | null): boolean {
  if (!el) return true;
  if (el.matches('[hidden], dialog:not([open]), [popover]:not([data-popover-open])')) return false;
  if (el instanceof HTMLElement && el.style.display === 'none') return false;
  return rendered(el.parentElement);
}

function polyfillRendering(): void {
  if (typeof Element === 'undefined') return;
  const proto = Element.prototype;
  proto.getAnimations ??= () => [];
  proto.animate ??= () => ({ cancel() {} }) as Animation;
  proto.checkVisibility ??= function checkVisibility(this: Element) {
    return rendered(this);
  };
}

function polyfillCssSupports(): void {
  const css = globalThis.CSS ?? {};
  if (typeof css.supports === 'function') return;
  globalThis.CSS = Object.assign(css, {
    supports: () => false,
  }) as typeof CSS;
}

const matchMediaMatches = new Map<string, boolean>();
const matchMediaListeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>();

export function setMatchMedia(query: string, matches: boolean): void {
  matchMediaMatches.set(query, matches);
  const event = { matches, media: query } as MediaQueryListEvent;
  matchMediaListeners.get(query)?.forEach((listener) => listener(event));
}

export function resetMatchMedia(): void {
  matchMediaMatches.clear();
  matchMediaListeners.clear();
}

function polyfillMatchMedia(): void {
  if (typeof window === 'undefined') return;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => {
      let listeners = matchMediaListeners.get(query);
      if (!listeners) {
        listeners = new Set<(event: MediaQueryListEvent) => void>();
        matchMediaListeners.set(query, listeners);
      }
      return {
        get matches() {
          return matchMediaMatches.get(query) ?? false;
        },
        media: query,
        addEventListener(_type: string, listener: (event: MediaQueryListEvent) => void) {
          listeners.add(listener);
        },
        removeEventListener(_type: string, listener: (event: MediaQueryListEvent) => void) {
          listeners.delete(listener);
        },
        addListener(listener: (event: MediaQueryListEvent) => void) {
          listeners.add(listener);
        },
        removeListener(listener: (event: MediaQueryListEvent) => void) {
          listeners.delete(listener);
        },
        dispatchEvent(event: Event) {
          listeners.forEach((listener) => listener(event as MediaQueryListEvent));
          return true;
        },
        onchange: null,
      };
    },
  });
}

polyfillDialog();
polyfillInert();
polyfillPointerEvent();
polyfillPopover();
polyfillRendering();
polyfillCssSupports();
polyfillMatchMedia();
