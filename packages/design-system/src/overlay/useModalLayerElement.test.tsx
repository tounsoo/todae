import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { heldModals } from './modalStack';
import { useModalLayerElement } from './useModalLayerElement';

afterEach(() => {
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

  it('leaves out an open element that is not shown modally', () => {
    const el = document.createElement('dialog');
    el.setAttribute('open', '');
    document.body.append(el);
    const { unmount } = renderHook(() => useModalLayerElement(el, true));
    expect(heldModals()).toHaveLength(0);
    unmount();
  });
});
