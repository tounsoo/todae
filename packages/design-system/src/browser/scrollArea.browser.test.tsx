import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, ScrollArea } from '../index';

afterEach(() => vi.restoreAllMocks());

const links = (n: number) =>
  Array.from({ length: n }, (_, i) => (
    <a key={i} href={`#${i}`} style={{ display: 'block', padding: '4px 0' }}>
      Link {i + 1}
    </a>
  ));

/** The edges where a focused control's ring crosses its scroll area's padding box. */
function cutEdges(control: HTMLElement, area: HTMLElement): string[] {
  const style = getComputedStyle(control);
  const room = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
  const ring = control.getBoundingClientRect();
  const box = area.getBoundingClientRect();
  const edges: string[] = [];
  if (ring.top - room < box.top + area.clientTop - 0.5) edges.push('top');
  if (ring.left - room < box.left + area.clientLeft - 0.5) edges.push('left');
  if (ring.right + room > box.left + area.clientLeft + area.clientWidth + 0.5) edges.push('right');
  if (ring.bottom + room > box.top + area.clientTop + area.clientHeight + 0.5) edges.push('bottom');
  return edges;
}

describe('ScrollArea.Root', () => {
  it('keeps every ring whole while focus scrolls through it', async () => {
    render(
      <div style={{ width: 200 }}>
        <ScrollArea.Root data-testid="area" style={{ height: 80 }}>
          {links(12)}
        </ScrollArea.Root>
      </div>,
    );
    const area = screen.getByTestId('area');
    for (const link of screen.getAllByRole('link')) {
      link.focus({ focusVisible: true } as FocusOptions);
      expect(getComputedStyle(link).outlineStyle).not.toBe('none');
      expect({ link: link.textContent, cut: cutEdges(link, area) }).toEqual({ link: link.textContent, cut: [] });
    }
    expect(area.scrollTop).toBeGreaterThan(0);
  });

  it('keeps its ring room inside padding you give it', () => {
    render(
      <ScrollArea.Root data-testid="area" style={{ height: 80, padding: 12 }}>
        {links(12)}
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    const first = screen.getAllByRole('link')[0]!;
    first.focus({ focusVisible: true } as FocusOptions);
    const room = Number.parseFloat(getComputedStyle(area).scrollPaddingLeft);
    expect(room).toBeGreaterThan(0);
    expect(first.getBoundingClientRect().left - area.getBoundingClientRect().left).toBeCloseTo(12 + room, 1);
    for (const link of screen.getAllByRole('link')) {
      link.focus({ focusVisible: true } as FocusOptions);
      expect({ link: link.textContent, cut: cutEdges(link, area) }).toEqual({ link: link.textContent, cut: [] });
    }
  });

  it('keeps rings whole flush against an edge that clips', () => {
    render(
      <div data-testid="frame" style={{ width: 200, height: 80, overflow: 'hidden', display: 'flex' }}>
        <ScrollArea.Root data-testid="area" axis="inline" style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <button key={i} type="button" style={{ flex: 'none', width: 60 }}>
                {i + 1}
              </button>
            ))}
          </div>
        </ScrollArea.Root>
      </div>,
    );
    const frame = screen.getByTestId('frame');
    const area = screen.getByTestId('area');
    expect(area.scrollWidth).toBeGreaterThan(area.clientWidth);
    for (const button of screen.getAllByRole('button')) {
      button.focus({ focusVisible: true } as FocusOptions);
      expect({ button: button.textContent, cut: [...cutEdges(button, area), ...cutEdges(button, frame)] }).toEqual({
        button: button.textContent,
        cut: [],
      });
    }
    expect(area.scrollLeft).toBeGreaterThan(0);
  });

  it('reveals a ring drawn on an ancestor, such as a Field shell', () => {
    render(
      <ScrollArea.Root data-testid="area" style={{ height: 120 }}>
        <div style={{ height: 120 }} />
        <Field.Root>
          <Field.TextInput aria-label="Last" value="" onChange={() => undefined} />
        </Field.Root>
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    const input = screen.getByRole('textbox', { name: 'Last' });
    input.focus({ focusVisible: true } as FocusOptions);
    let shell: HTMLElement = input;
    while (getComputedStyle(shell).outlineStyle === 'none' && shell.parentElement !== area) shell = shell.parentElement!;
    expect(getComputedStyle(shell).outlineStyle).not.toBe('none');
    expect(cutEdges(shell, area)).toEqual([]);
  });

  it('takes a Tab stop while it overflows and holds nothing focusable', async () => {
    const { rerender } = render(
      <ScrollArea.Root aria-label="Notes" style={{ height: 40 }}>
        <div style={{ height: 200 }}>Long text</div>
      </ScrollArea.Root>,
    );
    const region = await screen.findByRole('region', { name: 'Notes' });
    expect(region.tabIndex).toBe(0);
    await userEvent.tab();
    expect(document.activeElement).toBe(region);
    expect((await axe.run(region)).violations).toEqual([]);

    rerender(
      <ScrollArea.Root aria-label="Notes" style={{ height: 40 }}>
        <div style={{ height: 20 }}>Short text</div>
      </ScrollArea.Root>,
    );
    // Focused, so it keeps its stop until focus leaves.
    expect(region.getAttribute('tabindex')).toBe('0');
    region.blur();
    await waitFor(() => expect(region.hasAttribute('tabindex')).toBe(false));
    expect(region.hasAttribute('role')).toBe(false);
  });

  it('leaves the Tab stops to what it holds, unless told otherwise', async () => {
    const { rerender } = render(
      <ScrollArea.Root data-testid="area" aria-label="Pages" style={{ height: 40 }}>
        {links(8)}
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    expect(area.hasAttribute('tabindex')).toBe(false);

    rerender(
      <ScrollArea.Root data-testid="area" aria-label="Pages" focusable style={{ height: 40 }}>
        {links(8)}
      </ScrollArea.Root>,
    );
    await waitFor(() => expect(area.tabIndex).toBe(0));

    rerender(
      <ScrollArea.Root data-testid="area" aria-label="Pages" focusable={false} style={{ height: 40 }}>
        <div style={{ height: 200 }}>Long text</div>
      </ScrollArea.Root>,
    );
    await waitFor(() => expect(area.hasAttribute('tabindex')).toBe(false));
  });

  it('notices content that grows past it', async () => {
    const { rerender } = render(
      <ScrollArea.Root data-testid="area" aria-label="Log" style={{ height: 40 }}>
        <div style={{ height: 20 }}>One line</div>
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    expect(area.hasAttribute('tabindex')).toBe(false);
    rerender(
      <ScrollArea.Root data-testid="area" aria-label="Log" style={{ height: 40 }}>
        <div style={{ height: 200 }}>One line</div>
      </ScrollArea.Root>,
    );
    await waitFor(() => expect(area.tabIndex).toBe(0));
  });

  it('asks for a name once it takes a Tab stop', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ScrollArea.Root style={{ height: 40 }}>
        <div style={{ height: 200 }}>Long text</div>
      </ScrollArea.Root>,
    );
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining('ScrollArea.Root')));
  });
});
