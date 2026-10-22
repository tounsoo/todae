import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Splitter, type SplitterRootProps } from '../index.js';

afterEach(() => {
  cleanup();
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
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    render(<Layout defaultValue={240} min={100} />);
    expect(handle().getAttribute('aria-valuemax')).toBe('600');
    expect(screen.getByTestId('root').style.getPropertyValue('--_size')).toBe('240px');
  });

  it('shows a size past the measured container as the container', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
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

  it('runs the product\'s key handler first and lets it stop the move', () => {
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
    expect(screen.getByTestId('first').hasAttribute('data-collapsed')).toBe(false);
  });

  it('collapses to 0 on Enter and restores the size before on the next', () => {
    const onValueChange = vi.fn();
    render(<Layout defaultValue={240} min={180} collapsible onValueChange={onValueChange} />);
    expect(handle().getAttribute('aria-valuemin')).toBe('0');
    press('ArrowRight');
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByTestId('first').hasAttribute('data-collapsed')).toBe(true);
    expect(screen.getByTestId('second').hasAttribute('data-collapsed')).toBe(false);
    press('Enter');
    expect(handle().getAttribute('aria-valuenow')).toBe('256');
    expect(screen.getByTestId('first').hasAttribute('data-collapsed')).toBe(false);
    expect(onValueChange.mock.calls).toEqual([[256], [0], [256]]);
  });

  it('collapses the last panel when it is the primary one', () => {
    render(<Layout defaultValue={240} primary="end" collapsible />);
    press('Enter');
    expect(screen.getByTestId('second').hasAttribute('data-collapsed')).toBe(true);
    expect(screen.getByTestId('first').hasAttribute('data-collapsed')).toBe(false);
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
    expect(screen.getByTestId('first').hasAttribute('data-collapsed')).toBe(true);
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

  it('keep the product\'s style on the root', () => {
    render(<Layout defaultValue={100} style={{ blockSize: 300 }} />);
    expect(screen.getByTestId('root').style.blockSize).toBe('300px');
  });
});
