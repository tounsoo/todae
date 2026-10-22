import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Splitter, type SplitterRootProps } from '../index.js';
import { resetWarnOnce } from './warnOnce.js';

afterEach(() => {
  cleanup();
  resetWarnOnce();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Layout(props: SplitterRootProps) {
  return (
    <Splitter.Root data-testid="root" {...props}>
      <Splitter.Panel data-testid="first">
        <h2 id="nav">Navigation</h2>
        <button type="button">Inside</button>
      </Splitter.Panel>
      <Splitter.Handle />
      <Splitter.Panel data-testid="second">Main</Splitter.Panel>
    </Splitter.Root>
  );
}

const handle = () => screen.getByRole('separator');
const press = (key: string) => fireEvent.keyDown(handle(), { key });
const root = () => screen.getByTestId('root');
const empty = () => root().getAttribute('data-empty');

/** A container `width` pixels wide, as a layout engine would report it. */
function measured(width: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
}

const down = (clientX = 100, init: PointerEventInit = {}) =>
  fireEvent.pointerDown(handle(), {
    button: 0,
    isPrimary: true,
    pointerId: 1,
    clientX,
    ...init,
  });
const move = (clientX: number, pointerId = 1) => fireEvent.pointerMove(handle(), { pointerId, clientX });

describe('Splitter.Handle semantics', () => {
  it('is a focusable vertical separator for side-by-side panels, with its value and range', () => {
    render(<Layout defaultValue={240} min={180} max={480} />);
    expect(handle().getAttribute('aria-orientation')).toBe('vertical');
    expect(handle().tabIndex).toBe(0);
    expect(handle().getAttribute('aria-valuenow')).toBe('240');
    expect(handle().getAttribute('aria-valuemin')).toBe('180');
    expect(handle().getAttribute('aria-valuemax')).toBe('480');
  });

  it('is a horizontal separator for stacked panels', () => {
    render(<Layout orientation="vertical" defaultValue={100} />);
    expect(handle().getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('controls the primary panel: the first, or the last with primary="end"', () => {
    const { rerender } = render(<Layout defaultValue={100} />);
    expect(handle().getAttribute('aria-controls')).toBe(screen.getByTestId('first').id);
    expect(screen.getByTestId('first').id).not.toBe('');
    rerender(<Layout defaultValue={100} primary="end" />);
    expect(handle().getAttribute('aria-controls')).toBe(screen.getByTestId('second').id);
  });

  it('keeps a panel id the product gives', () => {
    render(
      <Splitter.Root defaultValue={100}>
        <Splitter.Panel id="tree" />
        <Splitter.Handle />
        <Splitter.Panel />
      </Splitter.Root>,
    );
    expect(handle().getAttribute('aria-controls')).toBe('tree');
  });

  it('is named Resize unless the product names it', () => {
    const { rerender } = render(<Layout defaultValue={100} />);
    expect(screen.getByRole('separator', { name: 'Resize' })).toBeTruthy();
    rerender(
      <Splitter.Root defaultValue={100}>
        <Splitter.Panel>
          <h2 id="nav">Navigation</h2>
        </Splitter.Panel>
        <Splitter.Handle aria-labelledby="nav" />
        <Splitter.Panel />
      </Splitter.Root>,
    );
    expect(screen.getByRole('separator', { name: 'Navigation' })).toBeTruthy();
    rerender(
      <Splitter.Root defaultValue={100}>
        <Splitter.Panel />
        <Splitter.Handle aria-label="Resize sidebar" />
        <Splitter.Panel />
      </Splitter.Root>,
    );
    expect(screen.getByRole('separator', { name: 'Resize sidebar' })).toBeTruthy();
  });

  it('gives the container as the largest size once it is measured', () => {
    measured(600);
    render(<Layout defaultValue={240} min={100} />);
    expect(handle().getAttribute('aria-valuemax')).toBe('600');
    expect(screen.getByTestId('root').style.getPropertyValue('--_size')).toBe('240px');
  });

  it('shows a size past the measured container as the container', () => {
    measured(300);
    render(<Layout defaultValue={500} />);
    expect(handle().getAttribute('aria-valuenow')).toBe('300');
  });

  it('puts its state on the root for styles', () => {
    render(<Layout defaultValue={100} orientation="vertical" primary="end" />);
    const root = screen.getByTestId('root');
    expect(root.dataset.orientation).toBe('vertical');
    expect(root.dataset.primary).toBe('end');
    expect(root.hasAttribute('data-dragging')).toBe(false);
  });

  it('starts at 240 within the range when no size is given', () => {
    const { unmount } = render(<Layout min={300} />);
    expect(handle().getAttribute('aria-valuenow')).toBe('300');
    unmount();
    render(<Layout max={200} />);
    expect(handle().getAttribute('aria-valuenow')).toBe('200');
  });
});

describe('Splitter keys', () => {
  it('moves an uncontrolled splitter by step and reports every change', () => {
    const onValueChange = vi.fn();
    render(<Layout defaultValue={240} min={180} max={480} step={20} onValueChange={onValueChange} />);
    press('ArrowRight');
    expect(handle().getAttribute('aria-valuenow')).toBe('260');
    press('ArrowLeft');
    press('ArrowLeft');
    expect(handle().getAttribute('aria-valuenow')).toBe('220');
    expect(onValueChange.mock.calls).toEqual([[260], [240], [220]]);
  });

  it('stops at min and max and reports nothing past them', () => {
    const onValueChange = vi.fn();
    render(<Layout defaultValue={190} min={180} max={200} step={20} onValueChange={onValueChange} />);
    press('ArrowLeft');
    press('ArrowLeft');
    expect(handle().getAttribute('aria-valuenow')).toBe('180');
    press('ArrowRight');
    press('ArrowRight');
    expect(handle().getAttribute('aria-valuenow')).toBe('200');
    expect(onValueChange.mock.calls).toEqual([[180], [200]]);
  });

  it('goes to the smallest and largest size with Home and End', () => {
    render(<Layout defaultValue={240} min={180} max={480} />);
    press('End');
    expect(handle().getAttribute('aria-valuenow')).toBe('480');
    press('Home');
    expect(handle().getAttribute('aria-valuenow')).toBe('180');
  });

  it('ignores keys with a modifier and keys it does not use', () => {
    const onValueChange = vi.fn();
    render(<Layout defaultValue={240} onValueChange={onValueChange} />);
    fireEvent.keyDown(handle(), { key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyDown(handle(), { key: 'ArrowUp' });
    fireEvent.keyDown(handle(), { key: 'a' });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('leaves a controlled size to the product', () => {
    const onValueChange = vi.fn();
    render(<Layout value={240} onValueChange={onValueChange} />);
    press('ArrowRight');
    expect(onValueChange).toHaveBeenCalledWith(256);
    expect(handle().getAttribute('aria-valuenow')).toBe('240');
  });

  it('follows a controlled size the product sets', () => {
    function Controlled() {
      const [value, setValue] = useState(240);
      return <Layout value={value} onValueChange={setValue} max={300} step={30} />;
    }
    render(<Controlled />);
    press('ArrowRight');
    press('ArrowRight');
    expect(handle().getAttribute('aria-valuenow')).toBe('300');
    expect(screen.getByTestId('root').style.getPropertyValue('--_size')).toBe('300px');
  });

  it("runs the product's key handler first and lets it stop the move", () => {
    render(
      <Splitter.Root defaultValue={240}>
        <Splitter.Panel />
        <Splitter.Handle onKeyDown={(event) => event.preventDefault()} />
        <Splitter.Panel />
      </Splitter.Root>,
    );
    press('ArrowRight');
    expect(handle().getAttribute('aria-valuenow')).toBe('240');
  });

  it('flips the arrows for a panel at the end', () => {
    render(<Layout defaultValue={240} primary="end" />);
    press('ArrowLeft');
    expect(handle().getAttribute('aria-valuenow')).toBe('256');
    press('ArrowRight');
    press('ArrowRight');
    expect(handle().getAttribute('aria-valuenow')).toBe('224');
  });

  it('flips the arrows in right-to-left text, where the first panel is on the right', () => {
    render(
      <div dir="rtl">
        <Layout defaultValue={240} />
      </div>,
    );
    press('ArrowLeft');
    expect(handle().getAttribute('aria-valuenow')).toBe('256');
    press('ArrowRight');
    press('ArrowRight');
    expect(handle().getAttribute('aria-valuenow')).toBe('224');
  });

  it('uses Up and Down when the panels are stacked', () => {
    render(<Layout orientation="vertical" defaultValue={240} />);
    press('ArrowDown');
    expect(handle().getAttribute('aria-valuenow')).toBe('256');
    press('ArrowUp');
    press('ArrowUp');
    expect(handle().getAttribute('aria-valuenow')).toBe('224');
    press('ArrowLeft');
    expect(handle().getAttribute('aria-valuenow')).toBe('224');
  });
});

describe('Splitter collapse', () => {
  it('does nothing on Enter unless collapsible', () => {
    render(<Layout defaultValue={240} min={100} />);
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('240');
    expect(empty()).toBeNull();
  });

  it('collapses to 0 on Enter and restores the size before on the next', () => {
    const onValueChange = vi.fn();
    render(<Layout defaultValue={240} min={180} collapsible onValueChange={onValueChange} />);
    expect(handle().getAttribute('aria-valuemin')).toBe('0');
    press('ArrowRight');
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('0');
    expect(empty()).toBe('start');
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('256');
    expect(empty()).toBeNull();
    expect(onValueChange.mock.calls).toEqual([[256], [0], [256]]);
  });

  it('collapses the last panel when it is the primary one', () => {
    render(<Layout defaultValue={240} primary="end" collapsible />);
    press('Enter');
    expect(empty()).toBe('end');
    expect(root().dataset.primary).toBe('end');
  });

  it('collapses by arrow from min and opens to min with the opposite arrow', () => {
    render(<Layout defaultValue={180} min={180} collapsible />);
    press('ArrowLeft');
    expect(handle().getAttribute('aria-valuenow')).toBe('0');
    press('ArrowRight');
    expect(handle().getAttribute('aria-valuenow')).toBe('180');
  });

  it('opens a panel that started collapsed to min on Enter', () => {
    render(<Layout defaultValue={0} min={180} collapsible />);
    expect(empty()).toBe('start');
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('180');
  });

  it('collapses with Home and restores with End', () => {
    render(<Layout defaultValue={240} min={180} max={400} collapsible />);
    press('Home');
    expect(handle().getAttribute('aria-valuenow')).toBe('0');
    press('End');
    expect(handle().getAttribute('aria-valuenow')).toBe('400');
  });
});

describe('Splitter parts', () => {
  it('throw outside a Splitter.Root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Splitter.Handle />)).toThrow('Splitter.Handle must render inside Splitter.Root');
    expect(() => render(<Splitter.Panel />)).toThrow('Splitter.Panel must render inside Splitter.Root');
  });

  it('forward a ref on each part', () => {
    const refs: Record<string, HTMLElement | null> = {};
    render(
      <Splitter.Root ref={(el) => void (refs.root = el)} defaultValue={100}>
        <Splitter.Panel ref={(el) => void (refs.panel = el)} />
        <Splitter.Handle ref={(el) => void (refs.handle = el)} />
        <Splitter.Panel />
      </Splitter.Root>,
    );
    expect(refs.root?.tagName).toBe('DIV');
    expect(refs.panel?.hasAttribute('data-todae-splitter-panel')).toBe(true);
    expect(refs.handle).toBe(handle());
  });

  it("keep the product's style on the root", () => {
    render(<Layout defaultValue={100} style={{ blockSize: 300 }} />);
    expect(screen.getByTestId('root').style.blockSize).toBe('300px');
  });
});

describe('Splitter on the server', () => {
  it('renders an empty panel as empty before any script runs', () => {
    const html = renderToString(<Layout defaultValue={0} min={180} collapsible />);
    expect(html).toMatch(/<div[^>]*data-testid="root"[^>]*data-empty="start"/);
    expect(renderToString(<Layout defaultValue={0} collapsible primary="end" />)).toContain('data-empty="end"');
    expect(renderToString(<Layout defaultValue={200} collapsible />)).not.toContain('data-empty');
  });
});

describe('Splitter range', () => {
  it('marks a panel at size 0 as empty whether or not it is collapsible', () => {
    render(<Layout defaultValue={0} />);
    expect(handle().getAttribute('aria-valuenow')).toBe('0');
    expect(empty()).toBe('start');
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('0');
  });

  it('reads a coherent range before the container is measured', () => {
    render(<Layout defaultValue={300} />);
    expect(handle().getAttribute('aria-valuemin')).toBe('0');
    expect(handle().getAttribute('aria-valuemax')).toBe('300');
    expect(handle().getAttribute('aria-valuenow')).toBe('300');
  });

  it('lets the room win over min: the range reports what is drawn', () => {
    measured(60);
    render(<Layout defaultValue={200} min={100} />);
    expect(handle().getAttribute('aria-valuenow')).toBe('60');
    expect(handle().getAttribute('aria-valuemin')).toBe('60');
    expect(handle().getAttribute('aria-valuemax')).toBe('60');
    expect(root().style.getPropertyValue('--_size')).toBe('60px');
  });

  it('leaves the padding of the root out of the room', () => {
    measured(300);
    render(<Layout defaultValue={200} style={{ padding: '20px' }} />);
    expect(handle().getAttribute('aria-valuemax')).toBe('260');
  });

  it('marks the other panel as empty when less than a pixel of it is left', () => {
    measured(300.5);
    render(<Layout value={300} />);
    expect(empty()).toBe('end');
    expect(handle().getAttribute('aria-valuemax')).toBe('300');
  });

  it('marks the other panel as empty when the primary one fills the room', () => {
    measured(300);
    const { rerender } = render(<Layout value={300} />);
    expect(empty()).toBe('end');
    rerender(<Layout value={300} primary="end" />);
    expect(empty()).toBe('start');
    rerender(<Layout value={100} />);
    expect(empty()).toBeNull();
  });
});

describe("Splitter at the container's edge", () => {
  it('reports nothing for a key that changes nothing the panel shows', () => {
    measured(300);
    const onValueChange = vi.fn();
    render(<Layout value={500} onValueChange={onValueChange} />);
    expect(handle().getAttribute('aria-valuenow')).toBe('300');
    press('ArrowRight');
    press('End');
    expect(onValueChange).not.toHaveBeenCalled();
    press('ArrowLeft');
    expect(onValueChange).toHaveBeenCalledWith(284);
  });

  it('reports nothing for a pointer move that lands on the size shown', () => {
    measured(300);
    const onValueChange = vi.fn();
    render(<Layout value={500} onValueChange={onValueChange} />);
    down(100);
    move(400);
    expect(onValueChange).not.toHaveBeenCalled();
    move(50);
    expect(onValueChange).toHaveBeenCalledWith(250);
  });
});

describe('Splitter moves in one frame', () => {
  it('reports and shows a move back to the size on screen after one away from it', () => {
    const onValueChange = vi.fn();
    render(<Layout defaultValue={240} onValueChange={onValueChange} />);
    down(100);
    act(() => {
      move(110);
      move(100);
    });
    expect(onValueChange.mock.calls).toEqual([[250], [240]]);
    expect(handle().getAttribute('aria-valuenow')).toBe('240');
    expect(root().style.getPropertyValue('--_size')).toBe('240px');
  });

  it('keeps asking when the product holds a controlled size and refuses each change', () => {
    const onValueChange = vi.fn();
    render(<Layout value={240} onValueChange={onValueChange} />);
    down(100);
    move(110);
    move(110);
    expect(onValueChange.mock.calls).toEqual([[250], [250]]);
    expect(handle().getAttribute('aria-valuenow')).toBe('240');
  });
});

describe('Splitter dragging', () => {
  it('moves by the distance the pointer went from the size at the press', () => {
    const onValueChange = vi.fn();
    render(<Layout defaultValue={240} onValueChange={onValueChange} />);
    down(100);
    expect(root().hasAttribute('data-dragging')).toBe(true);
    move(160);
    expect(handle().getAttribute('aria-valuenow')).toBe('300');
    move(40);
    expect(handle().getAttribute('aria-valuenow')).toBe('180');
    fireEvent.pointerUp(handle(), { pointerId: 1 });
    expect(root().hasAttribute('data-dragging')).toBe(false);
    move(300);
    expect(handle().getAttribute('aria-valuenow')).toBe('180');
  });

  it('grows against the pointer for a panel at the end, and with the text direction', () => {
    const { unmount } = render(<Layout defaultValue={240} primary="end" />);
    down(100);
    move(160);
    expect(handle().getAttribute('aria-valuenow')).toBe('180');
    unmount();
    render(
      <div dir="rtl">
        <Layout defaultValue={240} />
      </div>,
    );
    down(100);
    move(160);
    expect(handle().getAttribute('aria-valuenow')).toBe('180');
  });

  it('ignores a pointer that is not the primary one, and a second press', () => {
    render(<Layout defaultValue={240} />);
    down(100, { isPrimary: false, pointerId: 2 });
    expect(root().hasAttribute('data-dragging')).toBe(false);
    down(100);
    down(500, { pointerId: 3 });
    move(130, 3);
    expect(handle().getAttribute('aria-valuenow')).toBe('240');
    move(130);
    expect(handle().getAttribute('aria-valuenow')).toBe('270');
  });

  it.each([
    ['pointerup', fireEvent.pointerUp],
    ['pointercancel', fireEvent.pointerCancel],
    ['lostpointercapture', fireEvent.lostPointerCapture],
  ])("ends on %s even when the product's handler prevents default", (name, fire) => {
    const prevent = (event: { preventDefault: () => void }) => event.preventDefault();
    const handlers = {
      pointerup: { onPointerUp: prevent },
      pointercancel: { onPointerCancel: prevent },
      lostpointercapture: { onLostPointerCapture: prevent },
    }[name];
    render(
      <Splitter.Root data-testid="root" defaultValue={240}>
        <Splitter.Panel />
        <Splitter.Handle {...handlers} />
        <Splitter.Panel />
      </Splitter.Root>,
    );
    down(100);
    expect(root().hasAttribute('data-dragging')).toBe(true);
    fire(handle(), { pointerId: 1 });
    expect(root().hasAttribute('data-dragging')).toBe(false);
    move(200);
    expect(handle().getAttribute('aria-valuenow')).toBe('240');
  });

  it('stops dragging when the handle leaves in the middle of a drag', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(<Layout defaultValue={240} />);
    down(100);
    expect(root().hasAttribute('data-dragging')).toBe(true);
    rerender(
      <Splitter.Root data-testid="root" defaultValue={240}>
        <Splitter.Panel />
        <Splitter.Panel />
      </Splitter.Root>,
    );
    expect(root().hasAttribute('data-dragging')).toBe(false);
  });
});

describe('Splitter restore point', () => {
  it('goes back to the held size when a narrow window collapsed it, not to what was drawn', () => {
    function Controlled() {
      const [value, setValue] = useState(300);
      return <Layout value={value} onValueChange={setValue} min={100} collapsible />;
    }
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    render(<Controlled />);
    expect(handle().getAttribute('aria-valuenow')).toBe('200');
    press('Home');
    expect(handle().getAttribute('aria-valuenow')).toBe('0');
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('200');
    expect(root().style.getPropertyValue('--_size')).toBe('200px');
  });

  it('goes back to the size before a drag that ended collapsed, not to where it passed', () => {
    render(<Layout defaultValue={240} min={100} collapsible />);
    down(300);
    move(250);
    move(200);
    move(100);
    move(0);
    expect(handle().getAttribute('aria-valuenow')).toBe('0');
    fireEvent.pointerUp(handle(), { pointerId: 1 });
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('240');
  });

  it('goes back to the size the product held before it set 0', () => {
    function Controlled() {
      const [value, setValue] = useState(300);
      return (
        <>
          <button type="button" onClick={() => setValue(0)}>
            Close
          </button>
          <Layout value={value} onValueChange={setValue} min={100} collapsible />
        </>
      );
    }
    render(<Controlled />);
    press('ArrowLeft');
    press('ArrowRight');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(handle().getAttribute('aria-valuenow')).toBe('0');
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('300');
  });

  it('restores the size it was last open at, for a panel that started collapsed', () => {
    render(<Layout defaultValue={0} min={100} collapsible />);
    press('Enter');
    press('ArrowRight');
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('0');
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('116');
  });
});

describe('Splitter focus', () => {
  it('moves focus from a panel that collapses to the handle', () => {
    const { rerender } = render(<Layout value={200} collapsible />);
    screen.getByRole('button', { name: 'Inside' }).focus();
    rerender(<Layout value={0} collapsible />);
    expect(document.activeElement).toBe(handle());
  });

  it('leaves focus outside the collapsing panel where it is', () => {
    const { rerender } = render(
      <>
        <button type="button">Elsewhere</button>
        <Layout value={200} collapsible />
      </>,
    );
    screen.getByRole('button', { name: 'Elsewhere' }).focus();
    rerender(
      <>
        <button type="button">Elsewhere</button>
        <Layout value={0} collapsible />
      </>,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Elsewhere' }));
  });

  it("runs the product's focus handler on a panel", () => {
    const onFocus = vi.fn();
    render(
      <Splitter.Root defaultValue={100}>
        <Splitter.Panel onFocus={onFocus}>
          <button type="button">Inside</button>
        </Splitter.Panel>
        <Splitter.Handle />
        <Splitter.Panel />
      </Splitter.Root>,
    );
    screen.getByRole('button', { name: 'Inside' }).focus();
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});

describe('Splitter shape', () => {
  const warns = () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    return error;
  };

  it('warns when a child is added after the first render', async () => {
    const error = warns();
    const shape = (extra: boolean) => (
      <Splitter.Root>
        <Splitter.Panel />
        <Splitter.Handle />
        <Splitter.Panel />
        {extra ? <div /> : null}
      </Splitter.Root>
    );
    const { rerender } = render(shape(false));
    expect(error).not.toHaveBeenCalled();
    rerender(shape(true));
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
  });

  it('warns when a child the root does not render adds an element', async () => {
    const error = warns();
    let grow: () => void = () => undefined;
    function Wrapper() {
      const [extra, setExtra] = useState(false);
      grow = () => setExtra(true);
      return (
        <>
          <Splitter.Panel />
          {extra ? <div /> : null}
        </>
      );
    }
    render(
      <Splitter.Root>
        <Splitter.Panel />
        <Splitter.Handle />
        <Wrapper />
      </Splitter.Root>,
    );
    expect(error).not.toHaveBeenCalled();
    act(() => grow());
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
  });

  it('warns for an extra child and for the wrong order', () => {
    const extra = warns();
    const { unmount } = render(
      <Splitter.Root>
        <Splitter.Panel />
        <Splitter.Handle />
        <Splitter.Panel />
        <div />
      </Splitter.Root>,
    );
    expect(extra).toHaveBeenCalledTimes(1);
    unmount();
    resetWarnOnce();
    render(
      <Splitter.Root>
        <Splitter.Handle />
        <Splitter.Panel />
        <Splitter.Panel />
      </Splitter.Root>,
    );
    expect(extra).toHaveBeenCalledTimes(2);
  });

  it('warns once for a root without two panels and a handle', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = (
      <Splitter.Root>
        <Splitter.Panel />
        <Splitter.Handle />
      </Splitter.Root>
    );
    const { unmount } = render(broken);
    unmount();
    render(broken);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toContain('two Splitter.Panel and one Splitter.Handle');
  });

  it('does not warn for the right shape', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Layout defaultValue={100} />);
    expect(error).not.toHaveBeenCalled();
  });
});
