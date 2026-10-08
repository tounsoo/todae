import { renderHook } from '@testing-library/react';
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

  it('leaves out an open element that is not shown modally', () => {
    const el = document.createElement('dialog');
    el.setAttribute('open', '');
    document.body.append(el);
    const { unmount } = renderHook(() => useModalLayerElement(el, true));
    expect(heldModals()).toHaveLength(0);
    unmount();
  });
});
