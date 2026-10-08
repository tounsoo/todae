import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dropModal, heldModals, pushModal, subscribeModals } from './modalStack';
import { TOAST_HOST_ATTRIBUTE } from './tabbables';
import { useModalLayerElement } from './useModalLayerElement';

afterEach(() => {
  // Unmounts first, so a test that failed early leaves nothing in the stack.
  cleanup();
  document.body.innerHTML = '';
});

describe('useModalLayerElement', () => {
  it('holds an open element its caller shows modally, also where :modal is unknown', () => {
    const el = document.createElement('dialog');
    el.setAttribute('open', '');
    document.body.append(el);
    const { unmount } = renderHook(() => useModalLayerElement(el, true, true));
    expect(heldModals()).toEqual([el]);
    unmount();
    expect(heldModals()).toHaveLength(0);
  });

  it('keeps an element that is still shown after open turns false, until it closes', async () => {
    const el = document.createElement('dialog');
    el.setAttribute('open', '');
    document.body.append(el);
    const { rerender, unmount } = renderHook(({ open }) => useModalLayerElement(el, open, true), {
      initialProps: { open: true },
    });
    rerender({ open: false });
    expect(heldModals()).toEqual([el]);
    el.removeAttribute('open');
    await waitFor(() => expect(heldModals()).toHaveLength(0));
    unmount();
  });

  it('notifies for the element in front only when it is shown again', () => {
    const el = document.createElement('dialog');
    const listener = vi.fn();
    const unsubscribe = subscribeModals(listener);
    pushModal(el);
    pushModal(el);
    expect(listener).toHaveBeenCalledTimes(1);
    pushModal(el, true);
    expect(listener).toHaveBeenCalledTimes(2);
    dropModal(el);
    // Says which calls are for an element shown again.
    expect(listener.mock.calls).toEqual([[false], [true], [false]]);
    unsubscribe();
  });

  it('moves focus off a toast inside when the element is shown, not otherwise', async () => {
    const el = document.createElement('dialog');
    el.tabIndex = -1;
    el.setAttribute('open', '');
    const host = document.createElement('div');
    host.setAttribute(TOAST_HOST_ATTRIBUTE, '');
    const toast = document.createElement('button');
    host.append(toast);
    el.append(host);
    document.body.append(el);
    const { unmount } = renderHook(() => useModalLayerElement(el, true, true));
    toast.focus();
    el.setAttribute('open', '');
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement).toBe(toast);
    // Shown again, as close() and showModal() in one task do.
    el.removeAttribute('open');
    el.setAttribute('open', '');
    await waitFor(() => expect(document.activeElement).toBe(el));
    unmount();
  });

  it('keeps modals in the order they were shown, when one joins late or its open turns true again', async () => {
    const a = document.createElement('dialog');
    const b = document.createElement('dialog');
    a.id = 'a';
    b.id = 'b';
    document.body.append(a, b);
    // By id: toEqual compares elements as nodes, and two empty dialogs match.
    const held = () => heldModals().map((el) => el.id);
    const first = renderHook(({ open }) => useModalLayerElement(a, open), { initialProps: { open: false } });
    const second = renderHook(() => useModalLayerElement(b, true));
    a.showModal();
    await new Promise((resolve) => setTimeout(resolve));
    expect(held()).toEqual([]);
    b.showModal();
    await waitFor(() => expect(held()).toEqual(['b']));
    // Shown before b, so it joins behind b.
    first.rerender({ open: true });
    expect(held()).toEqual(['a', 'b']);
    first.rerender({ open: false });
    first.rerender({ open: true });
    expect(held()).toEqual(['a', 'b']);
    // Shown again, it goes in front.
    a.close();
    a.showModal();
    await waitFor(() => expect(held()).toEqual(['b', 'a']));
    first.unmount();
    second.unmount();
  });

  it('leaves out an open element that is not shown modally', () => {
    const el = document.createElement('dialog');
    el.setAttribute('open', '');
    document.body.append(el);
    const { unmount } = renderHook(() => useModalLayerElement(el, true));
    expect(heldModals()).toHaveLength(0);
    unmount();
  });
});
