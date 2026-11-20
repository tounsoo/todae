/// <reference types="@vitest/browser-playwright" />
import { CodeBlock, Kbd, Menu, ScrollArea } from '@tounsoo/todae';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';

afterEach(cleanup);

const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function labelStart(item: HTMLElement): number {
  const walker = item.ownerDocument.createTreeWalker(item, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
      if (!(node.textContent ?? '').trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const node = walker.nextNode();
  if (!node) throw new Error('The item has no label text.');
  const range = item.ownerDocument.createRange();
  range.selectNodeContents(node);
  return range.getBoundingClientRect().left;
}

describe('CodeBlock wrap and a capped height', () => {
  it('wraps a long line and leaves the default block scrolling sideways', () => {
    const line = 'x'.repeat(80);
    render(
      <div style={{ inlineSize: '10rem' }}>
        <CodeBlock.Root data-testid="plain">
          <code>{line}</code>
        </CodeBlock.Root>
        <CodeBlock.Root wrap data-testid="wrap">
          <code>{line}</code>
        </CodeBlock.Root>
      </div>,
    );
    const plain = screen.getByTestId('plain');
    const wrapped = screen.getByTestId('wrap');
    expect(getComputedStyle(plain).overflowX).toBe('auto');
    expect(plain.scrollWidth).toBeGreaterThan(plain.clientWidth);
    expect(getComputedStyle(wrapped).overflowX).toBe('visible');
    expect(getComputedStyle(wrapped).whiteSpace).toBe('pre-wrap');
    expect(wrapped.scrollWidth).toBeLessThanOrEqual(wrapped.clientWidth);
    expect(wrapped.getBoundingClientRect().height).toBeGreaterThan(plain.getBoundingClientRect().height);
  });

  it('caps a block’s height in one ScrollArea that also scrolls a long line', async () => {
    const source = [`const label = '${'token-'.repeat(8)}end';`, ...Array.from({ length: 24 }, (_, i) => `const line${i + 1} = ${i + 1};`)].join(
      '\n',
    );
    render(
      <ScrollArea.Root focusable data-testid="area" axis="both" aria-label="Long source" style={{ maxBlockSize: '8rem' }}>
        <CodeBlock.Root data-testid="block" style={{ overflow: 'visible' }}>
          <code>{source}</code>
        </CodeBlock.Root>
      </ScrollArea.Root>,
    );
    await frame();
    const area = screen.getByTestId('area');
    const block = screen.getByTestId('block');
    const cap = parseFloat(getComputedStyle(area).maxBlockSize);
    expect(getComputedStyle(block).overflowX).toBe('visible');
    expect(area.clientHeight).toBeLessThanOrEqual(cap + 1);
    expect(area.scrollHeight).toBeGreaterThan(area.clientHeight);
    expect(area.scrollWidth).toBeGreaterThan(area.clientWidth);
    expect(area.tabIndex).toBe(0);
  });
});

describe('menu item icon and shortcut columns', () => {
  it('lines up labels and trailing shortcuts across items', async () => {
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>File</Menu.Trigger>
        <Menu.Content>
          <Menu.Item>
            <Menu.ItemIcon>
              <svg />
            </Menu.ItemIcon>
            Save
            <Menu.ItemShortcut data-testid="save-keys">
              <Kbd.Root>S</Kbd.Root>
            </Menu.ItemShortcut>
          </Menu.Item>
          <Menu.Item>
            <Menu.ItemIcon>
              <svg />
            </Menu.ItemIcon>
            Save as
            <Menu.ItemShortcut data-testid="save-as-keys">
              <Kbd.Root>Shift</Kbd.Root>
              <Kbd.Root>S</Kbd.Root>
            </Menu.ItemShortcut>
          </Menu.Item>
          <Menu.Item>Close</Menu.Item>
          <Menu.Group aria-label="More actions">
            <Menu.Item>Rename</Menu.Item>
          </Menu.Group>
          <Menu.Submenu defaultOpen>
            <Menu.SubmenuTrigger>
              {'More'}
              <Menu.ItemShortcut data-testid="more-keys">
                <Kbd.Root>M</Kbd.Root>
              </Menu.ItemShortcut>
            </Menu.SubmenuTrigger>
            <Menu.SubmenuContent>
              <Menu.Item>
                <Menu.ItemIcon>
                  <svg />
                </Menu.ItemIcon>
                Nested
              </Menu.Item>
            </Menu.SubmenuContent>
          </Menu.Submenu>
        </Menu.Content>
      </Menu.Root>,
    );
    await frame();
    const item = (name: string) => screen.getByRole('menuitem', { name: (text) => text === name });
    const save = item('Save');
    const saveAs = item('Save as');
    const close = item('Close');
    const rename = item('Rename');
    const more = item('More');
    expect(Math.abs(labelStart(save) - labelStart(saveAs))).toBeLessThanOrEqual(1);
    expect(Math.abs(labelStart(save) - labelStart(close))).toBeLessThanOrEqual(1);
    expect(Math.abs(labelStart(save) - labelStart(rename))).toBeLessThanOrEqual(1);
    expect(Math.abs(labelStart(save) - labelStart(more))).toBeLessThanOrEqual(1);
    const saveKeys = screen.getByTestId('save-keys').getBoundingClientRect();
    const saveAsKeys = screen.getByTestId('save-as-keys').getBoundingClientRect();
    expect(Math.abs(saveKeys.right - saveAsKeys.right)).toBeLessThanOrEqual(1);
    expect(saveKeys.left).toBeGreaterThan(labelStart(save));
    const moreKeys = screen.getByTestId('more-keys').getBoundingClientRect();
    const chevron = more.querySelector('[data-todae-glyph]')!.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(more).columnGap || getComputedStyle(more).gap);
    expect(Math.abs(chevron.left - moreKeys.right - gap)).toBeLessThanOrEqual(1);
    expect(Math.abs(chevron.right - saveKeys.right)).toBeLessThanOrEqual(1);
  });

  it('leaves the icon column closed when the only icon is inside a submenu', async () => {
    render(
      <>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Plain</Menu.Trigger>
          <Menu.Content>
            <Menu.Item data-testid="plain-close">Close</Menu.Item>
          </Menu.Content>
        </Menu.Root>
        <Menu.Root defaultOpen>
          <Menu.Trigger>With a submenu</Menu.Trigger>
          <Menu.Content>
            <Menu.Item data-testid="nested-close">Close</Menu.Item>
            <Menu.Submenu defaultOpen>
              <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
              <Menu.SubmenuContent>
                <Menu.Item>
                  <Menu.ItemIcon>
                    <svg />
                  </Menu.ItemIcon>
                  Nested
                </Menu.Item>
              </Menu.SubmenuContent>
            </Menu.Submenu>
          </Menu.Content>
        </Menu.Root>
      </>,
    );
    await frame();
    const plain = screen.getByTestId('plain-close');
    const nested = screen.getByTestId('nested-close');
    expect(nested.querySelector('[data-todae-menu-icon]')).toBeNull();
    expect(document.querySelector('[data-todae-menu-icon]')).not.toBeNull();
    expect(getComputedStyle(nested).paddingInlineStart).toBe(getComputedStyle(plain).paddingInlineStart);
  });
});
