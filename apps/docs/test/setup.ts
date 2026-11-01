import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
// The site installs this shim in Providers; components rendered without Providers, such as the Playground's preview, need it too.
import 'temporal-polyfill/global';

// jsdom has no Popover API. Toast and the preview's note call showPopover on mount.
if (typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover !== 'function') {
  HTMLElement.prototype.showPopover = function showPopover() {
    this.setAttribute('data-popover-open', '');
  };
  HTMLElement.prototype.hidePopover = function hidePopover() {
    this.removeAttribute('data-popover-open');
  };
  HTMLElement.prototype.togglePopover = function togglePopover(force?: boolean) {
    const shown = this.hasAttribute('data-popover-open');
    if (force === true || (force !== false && !shown)) this.showPopover();
    else this.hidePopover();
    return this.hasAttribute('data-popover-open');
  };
}

// jsdom reports nothing about whether a closed dialog is on screen. The dialog
// checks that before it warns about opening inside a hidden container.
if (typeof Element !== 'undefined' && typeof Element.prototype.checkVisibility !== 'function') {
  Element.prototype.checkVisibility = function checkVisibility() {
    if (this.matches('[hidden], dialog:not([open])')) return false;
    if (this instanceof HTMLElement && this.style.display === 'none') return false;
    const parent = this.parentElement;
    return parent ? parent.checkVisibility() : true;
  };
}

// jsdom's dialog has no showModal. Opening the preview's dialog calls it.
const dialogProto = globalThis.HTMLDialogElement?.prototype;
if (dialogProto && typeof dialogProto.showModal !== 'function') {
  Object.defineProperty(dialogProto, 'open', {
    configurable: true,
    get() {
      return this.hasAttribute('open');
    },
    set(value: boolean) {
      if (value) this.setAttribute('open', '');
      else this.removeAttribute('open');
    },
  });
  dialogProto.showModal = function showModal() {
    this.open = true;
  };
  dialogProto.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

// Unmount after each test, so nothing a test rendered, such as next/link's idle prefetch, runs after jsdom is gone.
afterEach(cleanup);
