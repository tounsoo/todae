import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { usePopover } from '../hooks/usePopover.js';
import { BottomSheet } from '../components/BottomSheet.js';
import { Dialog } from '../components/Dialog.js';
import { Drawer } from '../components/Drawer.js';
import { Checkbox } from '../components/Checkbox.js';
import { ColorPicker } from '../components/ColorPicker.js';
import { Field } from '../components/Field.js';
import { Popover } from '../components/Popover.js';
import { ScrollArea } from '../components/ScrollArea.js';
import { Switch } from '../components/Switch.js';
import { Tree } from '../components/Tree.js';
import { focusWithoutScroll } from '../components/revealRing.js';

function Themed({ children }: { children: ReactNode }) {
  return (
    <main data-appearance="light" data-density="comfortable">
      {children}
    </main>
  );
}

/** The nearest element from `el` up that draws an outline. */
function ringed(el: HTMLElement): HTMLElement {
  let node = el;
  while (getComputedStyle(node).outlineStyle === 'none' && node.parentElement) node = node.parentElement;
  return node;
}

/** Edges of `area`'s padding box that the ring around `el` crosses. */
function cutEdges(el: HTMLElement, area: HTMLElement): string[] {
  const ring = ringed(el);
  const style = getComputedStyle(ring);
  const room = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
  const box = ring.getBoundingClientRect();
  const port = area.getBoundingClientRect();
  const top = port.top + area.clientTop;
  const left = port.left + area.clientLeft;
  const edges: string[] = [];
  if (box.top - room < top - 0.5) edges.push('top');
  if (box.left - room < left - 0.5) edges.push('left');
  if (box.right + room > left + area.clientWidth + 0.5) edges.push('right');
  if (box.bottom + room > top + area.clientHeight + 0.5) edges.push('bottom');
  return edges;
}

/** Scrolls `area` so `el`'s own box ends a pixel inside its bottom edge: wholly visible, so focus does not scroll it. */
function justFit(area: HTMLElement, el: HTMLElement) {
  const port = area.getBoundingClientRect();
  const bottom = port.top + area.clientTop + area.clientHeight;
  area.scrollTop += el.getBoundingClientRect().bottom - (bottom - 1);
}

const spacer = <div style={{ height: 2000, flex: 'none' }} />;
// Content after the control, so the area can scroll it to its bottom edge.
const tail = <div style={{ height: 200, flex: 'none' }} />;
const field = (
  <Field.Root>
    <Field.TextInput aria-label="Name" value="" onChange={() => undefined} />
  </Field.Root>
);

function PopoverArea({ children }: { children: ReactNode }) {
  const popover = usePopover({ defaultOpen: true });
  return (
    <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Panel" data-testid="area" style={{ maxHeight: 160 }}>
      {children}
    </Popover.Root>
  );
}

const byTestId = () => screen.getByTestId('area');
const panel = () => screen.getByRole('document');

/** Each scroll container, holding `content`, and how to find it. */
const containers: [string, (content: ReactNode) => ReactNode, () => HTMLElement][] = [
  [
    'ScrollArea.Root',
    (content) => (
      <ScrollArea.Root data-testid="area" style={{ height: 160 }}>
        {content}
      </ScrollArea.Root>
    ),
    byTestId,
  ],
  [
    'BottomSheet.Body',
    (content) => (
      <BottomSheet.Root open onOpenChange={() => undefined}>
        <BottomSheet.Title>Filter</BottomSheet.Title>
        <BottomSheet.Body data-testid="area">{content}</BottomSheet.Body>
      </BottomSheet.Root>
    ),
    byTestId,
  ],
  [
    'the Dialog panel',
    (content) => (
      <Dialog.Root open onOpenChange={() => undefined} aria-label="Edit">
        {content}
      </Dialog.Root>
    ),
    panel,
  ],
  [
    'the Drawer panel',
    (content) => (
      <Drawer.Root open onOpenChange={() => undefined} aria-label="Edit">
        {content}
      </Drawer.Root>
    ),
    panel,
  ],
  [
    'Drawer.Body',
    (content) => (
      <Drawer.Root open onOpenChange={() => undefined} aria-label="Edit">
        <Drawer.Body data-testid="area">{content}</Drawer.Body>
      </Drawer.Root>
    ),
    byTestId,
  ],
  ['Popover.Root', (content) => <PopoverArea>{content}</PopoverArea>, byTestId],
];

/** Shows keyboard focus on `el` the way Tab would, from elsewhere, without the browser's own scroll. */
async function keyboardFocus(el: HTMLElement) {
  // Overlays focus their first control on open; start from elsewhere.
  el.blur();
  await userEvent.keyboard('{Shift}');
  el.focus({ preventScroll: true });
}

describe('focus rings in a scrolling container', () => {
  for (const [name, ui, area] of containers) {
    it(`scrolls ${name} to show the whole ring of a control that just fits`, async () => {
      render(<Themed>{ui(<>{spacer}{field}{tail}</>)}</Themed>);
      const input = await screen.findByRole('textbox', { name: 'Name' });
      await waitFor(() => expect(area().scrollHeight).toBeGreaterThan(area().clientHeight));
      justFit(area(), input);
      const before = area().scrollTop;
      await keyboardFocus(input);
      // The ring sits on the Field shell, wider than the input, so only the
      // reveal moves the area for an input that just fits.
      expect(ringed(input)).not.toBe(input);
      expect(area().scrollTop).toBeGreaterThan(before);
      expect(cutEdges(input, area())).toEqual([]);
    });

    it(`scrolls ${name} to show the whole ring of a Checkbox, drawn on its indicator`, async () => {
      render(<Themed>{ui(<>{spacer}<Checkbox.Root>Archived</Checkbox.Root>{tail}</>)}</Themed>);
      const box = await screen.findByRole('checkbox', { name: 'Archived' });
      await waitFor(() => expect(area().scrollHeight).toBeGreaterThan(area().clientHeight));
      justFit(area(), box);
      await keyboardFocus(box);
      const indicator = box.nextElementSibling as HTMLElement;
      expect(getComputedStyle(indicator).outlineStyle).not.toBe('none');
      expect(cutEdges(indicator, area())).toEqual([]);
    });

    it(`scrolls ${name} to show the whole ring of a Field.OneTimeCode box, drawn on a box inside it`, async () => {
      render(
        <Themed>
          {ui(
            <>
              {spacer}
              <Field.Root>
                <Field.OneTimeCode aria-label="Code" value="" onValueChange={() => undefined} />
              </Field.Root>
              {tail}
            </>,
          )}
        </Themed>,
      );
      const input = await screen.findByRole('textbox', { name: 'Code' });
      await waitFor(() => expect(area().scrollHeight).toBeGreaterThan(area().clientHeight));
      // Without the area's own scroll padding, only the reveal makes room for the ring.
      area().style.scrollPadding = '0';
      justFit(area(), input);
      await keyboardFocus(input);
      const slot = await waitFor(() => {
        const found = input.nextElementSibling!.querySelector<HTMLElement>('[data-active]');
        expect(found).not.toBeNull();
        return found!;
      });
      expect(getComputedStyle(slot).outlineStyle).not.toBe('none');
      expect(cutEdges(slot, area())).toEqual([]);
    });

    it(`scrolls ${name} to show the ColorPicker thumb's ring, away from the focused input`, async () => {
      render(
        <Themed>
          {ui(
            <>
              {spacer}
              <ColorPicker.Root aria-label="Accent" defaultValue="#804040">
                <ColorPicker.Area />
              </ColorPicker.Root>
              {tail}
            </>,
          )}
        </Themed>,
      );
      const axis = await screen.findByRole('slider', { name: 'Saturation' });
      await waitFor(() => expect(area().scrollHeight).toBeGreaterThan(area().clientHeight));
      // The input is a pixel at the area's top-left corner; the thumb sits well below it.
      justFit(area(), axis);
      await keyboardFocus(axis);
      const thumb = axis.parentElement!.querySelector<HTMLElement>('[data-todae-focus-ring]')!;
      expect(getComputedStyle(thumb).outlineStyle).not.toBe('none');
      expect(cutEdges(thumb, area())).toEqual([]);
    });

    it(`leaves ${name} where it is for a focused part taller than it`, async () => {
      render(
        <Themed>
          {ui(
            <>
              <div tabIndex={0} aria-label="Tall" style={{ height: 3000, flex: 'none' }} />
              {tail}
            </>,
          )}
        </Themed>,
      );
      const tall = await screen.findByLabelText('Tall');
      await waitFor(() => expect(area().scrollHeight).toBeGreaterThan(area().clientHeight));
      area().scrollTop = 1000;
      await keyboardFocus(tall);
      expect(tall.matches(':focus-visible')).toBe(true);
      expect(area().scrollTop).toBe(1000);
    });
  }

  it('scrolls to show the whole ring of a Switch track, wider than its input', async () => {
    render(
      <Themed>
        <ScrollArea.Root axis="inline" data-testid="area" style={{ width: 160 }}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 2000, flex: 'none' }} />
            <Switch.Root>Dark</Switch.Root>
            <div style={{ width: 200, flex: 'none' }} />
          </div>
        </ScrollArea.Root>
      </Themed>,
    );
    const area = screen.getByTestId('area');
    const input = screen.getByRole('switch', { name: 'Dark' });
    const port = area.getBoundingClientRect();
    // The input's inline end a pixel inside the area's: wholly visible, while the track runs past it.
    area.scrollLeft += input.getBoundingClientRect().right - (port.left + area.clientLeft + area.clientWidth - 1);
    await keyboardFocus(input);
    const track = input.parentElement!.querySelector<HTMLElement>('[data-todae-focus-ring]')!;
    expect(track.getBoundingClientRect().width).toBeGreaterThan(input.getBoundingClientRect().width);
    expect(cutEdges(track, area)).toEqual([]);
  });

  it('scrolls to show the row of an expanded Tree item taller than the area', async () => {
    render(
      <Themed>
        <ScrollArea.Root data-testid="area" style={{ height: 160 }}>
          {tail}
          <Tree.Root aria-label="Files" defaultExpanded={['src']}>
            <Tree.Item value="src">
              <Tree.Label>src</Tree.Label>
              <Tree.Group>
                {Array.from({ length: 20 }, (_, i) => (
                  <Tree.Item key={i} value={`f${i}`}>
                    <Tree.Label>{`file ${i}`}</Tree.Label>
                  </Tree.Item>
                ))}
              </Tree.Group>
            </Tree.Item>
          </Tree.Root>
          {tail}
        </ScrollArea.Root>
      </Themed>,
    );
    const area = screen.getByTestId('area');
    const item = screen.getByRole('treeitem', { name: 'src' });
    expect(item.getBoundingClientRect().height).toBeGreaterThan(area.clientHeight);
    // The row above the top edge, the item's subtree still filling the area.
    area.scrollTop += item.getBoundingClientRect().top - area.getBoundingClientRect().top + 60;
    await keyboardFocus(item);
    const row = item.querySelector<HTMLElement>(':scope > [data-todae-focus-ring]')!;
    expect(cutEdges(row, area)).toEqual([]);
  });

  it('lets a Dialog.Root onFocus that calls preventDefault() skip the reveal', async () => {
    render(
      <Themed>
        <Dialog.Root open onOpenChange={() => undefined} aria-label="Edit" onFocus={(event) => event.preventDefault()}>
          {spacer}
          {field}
          {tail}
        </Dialog.Root>
      </Themed>,
    );
    const input = await screen.findByRole('textbox', { name: 'Name' });
    justFit(panel(), input);
    const before = panel().scrollTop;
    await keyboardFocus(input);
    expect(input.matches(':focus-visible')).toBe(true);
    expect(panel().scrollTop).toBe(before);
  });

  it('leaves the area where it is for a focus that shows no ring', async () => {
    render(
      <Themed>
        <button type="button">Start</button>
        <ScrollArea.Root data-testid="area" style={{ height: 160 }}>
          {spacer}
          <button type="button">Save</button>
          {tail}
        </ScrollArea.Root>
      </Themed>,
    );
    const area = screen.getByTestId('area');
    const button = screen.getByRole('button', { name: 'Save' });
    // A pointer press makes the next focus show no ring. Pressing the button
    // itself would let the test driver scroll it into view first.
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    justFit(area, button);
    const before = area.scrollTop;
    button.focus({ preventScroll: true });
    expect(button.matches(':focus-visible')).toBe(false);
    expect(area.scrollTop).toBe(before);
  });

  it('leaves the area where it is when Todae moves focus without scrolling', async () => {
    render(
      <Themed>
        <ScrollArea.Root data-testid="area" style={{ height: 160 }}>
          {spacer}
          {field}
          {tail}
        </ScrollArea.Root>
      </Themed>,
    );
    const area = screen.getByTestId('area');
    const input = screen.getByRole('textbox', { name: 'Name' });
    justFit(area, input);
    const before = area.scrollTop;
    await userEvent.keyboard('{Shift}');
    focusWithoutScroll(input);
    expect(input.matches(':focus-visible')).toBe(true);
    expect(area.scrollTop).toBe(before);
  });

  it('leaves the area where it is for focus in a popover it holds, which the top layer draws outside it', async () => {
    function Harness() {
      const popover = usePopover({ defaultOpen: true });
      return (
        <ScrollArea.Root data-testid="area" style={{ height: 160, marginTop: 400 }}>
          {spacer}
          <Popover.Root
            {...popover.getPopoverProps()}
            role="dialog"
            aria-label="Panel"
            style={{ inset: '0 auto auto 0', margin: 0 }}
          >
            {field}
          </Popover.Root>
          {spacer}
        </ScrollArea.Root>
      );
    }
    render(
      <Themed>
        <Harness />
      </Themed>,
    );
    const area = screen.getByTestId('area');
    const input = await screen.findByRole('textbox', { name: 'Name' });
    await waitFor(() => expect(input.closest(':popover-open')).not.toBeNull());
    input.blur();
    area.scrollTop = 300;
    await userEvent.keyboard('{Shift}');
    input.focus({ preventScroll: true });
    expect(input.matches(':focus-visible')).toBe(true);
    // The top layer draws the popover at the top of the page, above the area.
    expect(cutEdges(input, area)).toContain('top');
    expect(area.scrollTop).toBe(300);
  });
});
