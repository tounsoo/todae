import { act, cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeFrame } from '../test/frame.js';
import { useFocusLeave } from './useFocusLeave.js';

afterEach(() => {
  cleanup();
  for (const frame of document.querySelectorAll('iframe')) frame.remove();
  document.body.replaceChildren();
});

function Group({ doc, onLeave, children }: { doc: Document; onLeave: (next: Element | null) => void; children?: ReactNode }) {
  const leave = useFocusLeave(onLeave);
  const group = (
    <div {...leave}>
      <button type="button">One</button>
      {children}
    </div>
  );
  return doc === document ? group : createPortal(group, doc.body);
}

/** A browser blurs an element with no relatedTarget as focus leaves its document; jsdom doesn't always. */
function blurOut(el: Element) {
  const view = el.ownerDocument.defaultView as unknown as typeof globalThis;
  el.dispatchEvent(new view.FocusEvent('blur', { relatedTarget: null }));
  el.dispatchEvent(new view.FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

describe('useFocusLeave across documents', () => {
  it('counts focus moving from an iframe to the page around it as leaving', async () => {
    const doc = makeFrame();
    const outside = document.body.appendChild(document.createElement('input'));
    const onLeave = vi.fn();
    render(<Group doc={doc} onLeave={onLeave} />);
    const one = doc.querySelector('button')!;
    act(() => one.focus());
    let blurred = false;
    one.addEventListener('blur', () => (blurred = true));
    act(() => outside.focus());
    // The iframe's document keeps its active element, as in a browser.
    expect(doc.activeElement).toBe(one);
    if (!blurred) act(() => blurOut(one));
    await settle();
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledWith(outside);
  });

  it('counts focus in an iframe inside the element as inside', async () => {
    const onLeave = vi.fn();
    render(
      <Group doc={document} onLeave={onLeave}>
        <iframe title="Inner" />
      </Group>,
    );
    const frame = document.querySelector('iframe')!;
    const inner = frame.contentDocument!.body.appendChild(frame.contentDocument!.createElement('input'));
    const one = document.querySelector('button')!;
    act(() => one.focus());
    act(() => inner.focus());
    act(() => blurOut(one));
    await settle();
    expect(onLeave).not.toHaveBeenCalled();
  });
});
