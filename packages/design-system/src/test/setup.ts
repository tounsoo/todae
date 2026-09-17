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
  if (typeof globalThis.PointerEvent === 'function') return;
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
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

function polyfillCssSupports(): void {
  const css = globalThis.CSS ?? {};
  if (typeof css.supports === 'function') return;
  globalThis.CSS = Object.assign(css, {
    supports: () => false,
  }) as typeof CSS;
}

polyfillDialog();
polyfillInert();
polyfillPointerEvent();
polyfillPopover();
polyfillCssSupports();
